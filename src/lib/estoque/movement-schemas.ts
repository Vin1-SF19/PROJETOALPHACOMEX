import { z } from "zod";
import {
  INVENTORY_BUCKETS,
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_RETURN_CONDITIONS,
} from "@/lib/estoque/movement-domain";

const identifier = z.string().trim().min(1).max(160);
const optionalIdentifier = identifier.nullish().transform((value) => value || undefined);
const positiveQuantity = z.coerce.number().int().positive().max(1_000_000);

export const inventoryActorSchema = z.object({
  actorType: z.enum(["USER", "SYSTEM"]).default("USER"),
  actorUserId: z.coerce.number().int().positive().optional(),
  actorName: z.string().trim().min(1).max(160),
}).superRefine((actor, context) => {
  if (actor.actorType === "USER" && !actor.actorUserId) {
    context.addIssue({ code: "custom", path: ["actorUserId"], message: "Usuário responsável é obrigatório." });
  }
});

const operationBaseSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  produtoId: identifier,
  quantity: positiveQuantity,
  actor: inventoryActorSchema,
  occurredAt: z.coerce.date().optional(),
  observacao: z.string().trim().max(2_000).optional(),
  fromLocationId: optionalIdentifier,
  toLocationId: optionalIdentifier,
  assetId: optionalIdentifier,
  requestId: z.string().trim().max(160).optional(),
});

export const stockMovementCommandSchema = operationBaseSchema.extend({
  type: z.enum(INVENTORY_MOVEMENT_TYPES),
  sourceBucket: z.enum(INVENTORY_BUCKETS).optional(),
  destinationBucket: z.enum(INVENTORY_BUCKETS).optional(),
  adjustmentDirection: z.enum(["INCREASE", "DECREASE"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).superRefine((command, context) => {
  if (["EM_USO", "DEVOLUCAO", "MANUTENCAO", "RETORNO_MANUTENCAO"].includes(command.type)) {
    context.addIssue({ code: "custom", path: ["type"], message: "Use o fluxo especializado para este movimento." });
  }
  if (command.type === "TRANSFERENCIA") {
    if (!command.fromLocationId || !command.toLocationId) {
      context.addIssue({ code: "custom", path: ["toLocationId"], message: "Transferência exige origem e destino." });
    } else if (command.fromLocationId === command.toLocationId) {
      context.addIssue({ code: "custom", path: ["toLocationId"], message: "Origem e destino devem ser diferentes." });
    }
  }
  if (["SAIDA", "BAIXA", "PERDA", "DANO", "AJUSTE"].includes(command.type) && !command.observacao) {
    context.addIssue({ code: "custom", path: ["observacao"], message: "Este movimento exige justificativa." });
  }
});

export const assignInventoryCommandSchema = operationBaseSchema.extend({
  responsibleUserId: z.coerce.number().int().positive(),
  sectorId: z.coerce.number().int().positive().optional(),
  expectedReturnAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const returnInventoryCommandSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  assignmentId: identifier,
  quantity: positiveQuantity,
  condition: z.enum(INVENTORY_RETURN_CONDITIONS),
  destinationLocationId: optionalIdentifier,
  actor: inventoryActorSchema,
  returnedAt: z.coerce.date().optional(),
  observacao: z.string().trim().max(2_000).optional(),
  requestId: z.string().trim().max(160).optional(),
});

export const sendMaintenanceCommandSchema = operationBaseSchema.extend({
  reason: z.string().trim().min(3).max(500),
  provider: z.string().trim().max(200).optional(),
  expectedAt: z.coerce.date().optional(),
  sourceBucket: z.enum(["DISPONIVEL", "DANIFICADO"]).default("DISPONIVEL"),
});

export const returnMaintenanceCommandSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  maintenanceId: identifier,
  actor: inventoryActorSchema,
  returnedAt: z.coerce.date().optional(),
  condition: z.enum(["BOM", "COM_AVARIA", "DANIFICADO"]).default("BOM"),
  toLocationId: optionalIdentifier,
  observacao: z.string().trim().max(2_000).optional(),
  requestId: z.string().trim().max(160).optional(),
});

export const registerInventoryAssetCommandSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  produtoId: identifier,
  serial: z.string().trim().min(1).max(160).optional(),
  patrimonio: z.string().trim().min(1).max(160).optional(),
  codigoInterno: z.string().trim().min(1).max(160).optional(),
  locationId: optionalIdentifier,
  observacao: z.string().trim().max(2_000).optional(),
  actor: inventoryActorSchema,
  occurredAt: z.coerce.date().optional(),
  requestId: z.string().trim().max(160).optional(),
}).superRefine((command, context) => {
  if (!command.serial && !command.patrimonio && !command.codigoInterno) {
    context.addIssue({ code: "custom", path: ["serial"], message: "Informe serial, patrimônio ou código interno da unidade." });
  }
});

const kitBatchCommandBase = z.object({
  kitComponentId: identifier,
  produtoId: identifier,
  quantity: positiveQuantity,
  assetId: optionalIdentifier,
});

export const inventoryBatchCommandSchema = z.discriminatedUnion("kind", [
  kitBatchCommandBase.extend({
    kind: z.literal("ASSIGN"),
    fromLocationId: optionalIdentifier,
    toLocationId: optionalIdentifier,
    responsibleUserId: z.coerce.number().int().positive(),
    sectorId: z.coerce.number().int().positive().optional(),
    observacao: z.string().trim().max(2_000).optional(),
  }),
  kitBatchCommandBase.extend({
    kind: z.literal("STOCK_OUT"),
    fromLocationId: optionalIdentifier,
    observacao: z.string().trim().min(1).max(2_000),
  }),
  z.object({
    kind: z.literal("RETURN"),
    kitComponentId: identifier,
    assignmentId: identifier,
    quantity: positiveQuantity,
    condition: z.enum(INVENTORY_RETURN_CONDITIONS),
    destinationLocationId: optionalIdentifier,
    observacao: z.string().trim().max(2_000).optional(),
  }),
]);

export const inventoryBatchSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  requestId: z.string().trim().max(160).optional(),
  actor: inventoryActorSchema,
  kitInstanceId: identifier,
  commands: z.array(inventoryBatchCommandSchema).min(1).max(500),
}).superRefine((batch, context) => {
  if (batch.actor.actorType !== "USER" || !batch.actor.actorUserId) {
    context.addIssue({ code: "custom", path: ["actor"], message: "Lotes de kit exigem um usuário executor." });
  }
  const componentIds = batch.commands.map((command) => command.kitComponentId);
  if (new Set(componentIds).size !== componentIds.length) {
    context.addIssue({ code: "custom", path: ["commands"], message: "Cada componente do kit pode aparecer uma vez por lote." });
  }
});

export type InventoryActorInput = z.infer<typeof inventoryActorSchema>;
export type StockMovementCommand = z.input<typeof stockMovementCommandSchema>;
export type AssignInventoryCommand = z.input<typeof assignInventoryCommandSchema>;
export type ReturnInventoryCommand = z.input<typeof returnInventoryCommandSchema>;
export type SendMaintenanceCommand = z.input<typeof sendMaintenanceCommandSchema>;
export type ReturnMaintenanceCommand = z.input<typeof returnMaintenanceCommandSchema>;
export type RegisterInventoryAssetCommand = z.input<typeof registerInventoryAssetCommandSchema>;
export type InventoryBatchInput = z.input<typeof inventoryBatchSchema>;
export type InventoryBatchCommand = z.infer<typeof inventoryBatchCommandSchema>;
