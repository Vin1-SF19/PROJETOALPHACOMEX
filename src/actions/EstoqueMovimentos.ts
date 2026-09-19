"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import db from "@/lib/prisma";
import { requireInventoryActor, requireInventoryManager, requireInventoryReturnApprover } from "@/lib/estoque/authorization";
import { InventoryDomainError } from "@/lib/estoque/movement-domain";
import {
  assignInventoryCommandSchema,
  registerInventoryAssetCommandSchema,
  returnInventoryCommandSchema,
  returnMaintenanceCommandSchema,
  sendMaintenanceCommandSchema,
  stockMovementCommandSchema,
} from "@/lib/estoque/movement-schemas";
import {
  assignInventory,
  executeStockMovement,
  listInventoryItems,
  listInventoryMovements,
  registerInventoryAsset,
  returnInventory,
  returnInventoryFromMaintenance,
  sendInventoryToMaintenance,
} from "@/lib/estoque/movement-service";

function revalidateInventory() {
  revalidatePath("/PainelAlpha/Estoque");
  revalidatePath("/PainelAlpha/PainelTarefas/painelTarefaSG");
}

function publicError(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof InventoryDomainError) return error.message;
  return fallback;
}

async function actionActor(requiredCapability: "MANAGE" | "RETURN" = "MANAGE") {
  const actor = requiredCapability === "RETURN"
    ? await requireInventoryReturnApprover()
    : await requireInventoryManager();
  const user = await db.usuarios.findUnique({ where: { id: actor.userId }, select: { nome: true, status: true } });
  if (!user || user.status !== "ATIVO") throw new InventoryDomainError("ACTOR_INACTIVE", "Usuário responsável inexistente ou inativo.");
  return { actorType: "USER" as const, actorUserId: actor.userId, actorName: user.nome };
}

async function runMutation<T>(work: (actor: Awaited<ReturnType<typeof actionActor>>) => Promise<T>, fallback: string) {
  try {
    const actor = await actionActor();
    const data = await work(actor);
    revalidateInventory();
    return { success: true as const, data };
  } catch (error) {
    return { success: false as const, error: publicError(error, fallback) };
  }
}

export async function MovimentarEstoque(payload: unknown) {
  return runMutation((actor) => executeStockMovement(stockMovementCommandSchema.parse({ ...(payload as object), actor })), "Não foi possível movimentar o estoque.");
}

export async function AtribuirItemEstoque(payload: unknown) {
  return runMutation((actor) => assignInventory(assignInventoryCommandSchema.parse({ ...(payload as object), actor })), "Não foi possível atribuir o item.");
}

export async function DevolverItemEstoque(payload: unknown) {
  try {
    const actor = await actionActor("RETURN");
    const data = await returnInventory(returnInventoryCommandSchema.parse({ ...(payload as object), actor }));
    revalidateInventory();
    return { success: true as const, data };
  } catch (error) {
    return { success: false as const, error: publicError(error, "Não foi possível registrar a devolução.") };
  }
}

export async function EnviarItemManutencao(payload: unknown) {
  return runMutation((actor) => sendInventoryToMaintenance(sendMaintenanceCommandSchema.parse({ ...(payload as object), actor })), "Não foi possível enviar o item para manutenção.");
}

export async function RetornarItemManutencao(payload: unknown) {
  return runMutation((actor) => returnInventoryFromMaintenance(returnMaintenanceCommandSchema.parse({ ...(payload as object), actor })), "Não foi possível retornar o item da manutenção.");
}

export async function CadastrarUnidadePatrimonial(payload: unknown) {
  return runMutation((actor) => registerInventoryAsset(registerInventoryAssetCommandSchema.parse({ ...(payload as object), actor })), "Não foi possível cadastrar a unidade patrimonial.");
}

export async function BuscarMovimentacoesEstoque(payload: { produtoId?: string; limit?: number; cursor?: string; scope?: "ALL" | "MINE" } = {}) {
  const actor = await requireInventoryActor();
  const responsibleUserId = !actor.canManage || payload.scope === "MINE" ? actor.userId : undefined;
  return listInventoryMovements({ ...payload, responsibleUserId });
}

const inventoryItemsQuerySchema = z.object({
  query: z.string().trim().max(160).optional(),
  categoryId: z.string().trim().max(160).optional(),
  status: z.string().trim().max(40).optional(),
  locationId: z.string().trim().max(160).optional(),
  responsibleUserId: z.coerce.number().int().positive().optional(),
  tagId: z.string().trim().max(160).optional(),
  stock: z.enum(["ALL", "WITH_STOCK", "WITHOUT_STOCK", "LOW_STOCK"]).default("ALL"),
  maintenanceOnly: z.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().trim().max(160).optional(),
});

export async function BuscarItensEstoque(payload: unknown = {}) {
  await requireInventoryManager();
  const data = inventoryItemsQuerySchema.parse(payload);
  const { stock, ...filters } = data;
  if (stock !== "LOW_STOCK") return listInventoryItems({ ...filters, stock });

  const matches: Awaited<ReturnType<typeof listInventoryItems>>["items"] = [];
  let scanCursor = data.cursor;
  do {
    const page = await listInventoryItems({ ...filters, stock: "ALL", limit: 100, cursor: scanCursor });
    matches.push(...page.items.filter((item) => item.quantidade <= item.estoqueMinimo));
    scanCursor = page.nextCursor ?? undefined;
  } while (scanCursor && matches.length <= data.limit);

  const items = matches.slice(0, data.limit);
  return { items, nextCursor: matches.length > data.limit ? items.at(-1)?.id ?? null : null };
}

const paginatedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().trim().min(1).max(160).optional(),
  status: z.string().trim().max(40).optional(),
  scope: z.enum(["ALL", "MINE"]).default("ALL"),
});

export async function BuscarResponsaveisEstoque(payload: { query?: string; limit?: number } = {}) {
  await requireInventoryManager();
  const data = z.object({ query: z.string().trim().max(100).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(payload);
  return db.usuarios.findMany({
    where: { status: "ATIVO", ...(data.query ? { nome: { contains: data.query } } : {}) },
    select: { id: true, nome: true, role: true },
    orderBy: [{ nome: "asc" }, { id: "asc" }],
    take: data.limit,
  });
}

export async function BuscarAtribuicoesEstoque(payload: { limit?: number; cursor?: string; status?: string; scope?: "ALL" | "MINE" } = {}) {
  const actor = await requireInventoryActor();
  const data = paginatedQuerySchema.parse(payload);
  const responsibleUserId = !actor.canManage || data.scope === "MINE" ? actor.userId : undefined;
  const rows = await db.inventoryAssignment.findMany({
    where: {
      ...(data.status ? { status: data.status } : { status: { in: ["ATIVA", "PARCIALMENTE_DEVOLVIDA", "DEVOLVIDA"] } }),
      ...(responsibleUserId ? { responsibleUserId } : {}),
    },
    include: {
      produto: { select: { id: true, nome: true, imagem: true, unidade: true } },
      asset: { select: { id: true, patrimonio: true, serial: true, codigoInterno: true, status: true } },
      kitInstance: { select: { id: true, code: true, status: true } },
      location: { select: { id: true, nome: true } },
    },
    orderBy: [{ deliveredAt: "desc" }, { id: "desc" }],
    take: data.limit + 1,
    ...(data.cursor ? { cursor: { id: data.cursor }, skip: 1 } : {}),
  });
  const hasNext = rows.length > data.limit;
  const page = rows.slice(0, data.limit);
  const responsibleIds = [...new Set(page.map((row) => row.responsibleUserId))];
  const responsibles = await db.usuarios.findMany({ where: { id: { in: responsibleIds } }, select: { id: true, nome: true, role: true } });
  const responsibleById = new Map(responsibles.map((responsible) => [responsible.id, responsible]));
  return { items: page.map((row) => ({ ...row, responsible: responsibleById.get(row.responsibleUserId) ?? null })), nextCursor: hasNext ? page.at(-1)?.id ?? null : null };
}

export async function BuscarManutencoesEstoque(payload: { limit?: number; cursor?: string; status?: string } = {}) {
  await requireInventoryManager();
  const data = paginatedQuerySchema.parse(payload);
  const rows = await db.inventoryMaintenance.findMany({
    where: data.status ? { status: data.status } : { status: { in: ["ABERTA", "CONCLUIDA"] } },
    include: {
      produto: { select: { id: true, nome: true, imagem: true, unidade: true } },
      asset: { select: { id: true, patrimonio: true, serial: true, codigoInterno: true, status: true } },
    },
    orderBy: [{ sentAt: "desc" }, { id: "desc" }],
    take: data.limit + 1,
    ...(data.cursor ? { cursor: { id: data.cursor }, skip: 1 } : {}),
  });
  const hasNext = rows.length > data.limit;
  const page = rows.slice(0, data.limit);
  return { items: page, nextCursor: hasNext ? page.at(-1)?.id ?? null : null };
}
