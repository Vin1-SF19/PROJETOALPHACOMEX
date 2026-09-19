import "dotenv/config";

import { randomUUID } from "node:crypto";
import db from "../../src/lib/prisma";
import { canManageInventory } from "../../src/lib/estoque/access";
import { archiveInventoryItem, deleteInventoryItemPermanently, saveInventoryItem } from "../../src/lib/estoque/items-service";
import { createInventoryKitInstance, deleteInventoryTagModelPermanently, saveInventoryTagModel, validatePersistedInventoryKit } from "../../src/lib/estoque/kits-service";
import {
  assignInventory,
  executeStockMovement,
  inventoryDoctor,
  inventoryReconcileDryRun,
  listInventoryItems,
  listInventoryMovements,
  registerInventoryAsset,
  returnInventory,
  returnInventoryFromMaintenance,
  sendInventoryToMaintenance,
} from "../../src/lib/estoque/movement-service";
import type { InventoryBucket, InventoryMovementType } from "../../src/lib/estoque/movement-domain";

type CliValue = string | boolean;

function parseArgs(argv: string[]) {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, CliValue> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) flags[key] = true;
    else { flags[key] = next; index += 1; }
  }
  return { command, flags };
}

function stringFlag(flags: Record<string, CliValue>, name: string, required = false): string | undefined {
  const value = flags[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (required) throw new Error(`Parâmetro --${name} é obrigatório.`);
  return undefined;
}

function numberFlag(flags: Record<string, CliValue>, name: string, required = false): number | undefined {
  const raw = stringFlag(flags, name, required);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Parâmetro --${name} deve ser um inteiro positivo.`);
  return value;
}

function nonNegativeNumberFlag(flags: Record<string, CliValue>, name: string): number | undefined {
  const raw = stringFlag(flags, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Parâmetro --${name} deve ser um inteiro não negativo.`);
  return value;
}

function jsonObjectFlag(flags: Record<string, CliValue>, name: string): Record<string, unknown> | undefined {
  const raw = stringFlag(flags, name);
  if (!raw) return undefined;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error(`Parâmetro --${name} deve conter JSON válido.`); }
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error(`Parâmetro --${name} deve ser um objeto JSON.`);
  return value as Record<string, unknown>;
}

function output(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, (_key, child) => typeof child === "bigint" ? Number(child) : child)}\n`);
}

async function cliActor(flags: Record<string, CliValue>) {
  if (flags.execute !== true) throw new Error("Comandos mutáveis exigem --execute explícito.");
  const actorId = numberFlag(flags, "actor-id", true)!;
  const user = await db.usuarios.findFirst({ where: { id: actorId, status: "ATIVO" }, select: { id: true, nome: true, role: true } });
  if (!user) throw new Error("Usuário executor inexistente ou inativo.");
  if (!canManageInventory(user.role)) throw new Error("Usuário executor não pertence a um setor autorizado para gerir o estoque.");
  return { actorType: "USER" as const, actorUserId: user.id, actorName: user.nome };
}

async function inventoryItemPayload(flags: Record<string, CliValue>, itemId?: string) {
  const explicit = jsonObjectFlag(flags, "data");
  if (explicit) return { ...explicit, ...(itemId ? { id: itemId } : {}) };
  const previous = itemId ? await db.produtoEstoque.findFirst({ where: { id: itemId, archivedAt: null } }) : null;
  if (itemId && !previous) throw new Error("Item não encontrado ou arquivado.");
  const required = (name: string, fallback?: string | null) => stringFlag(flags, name) ?? fallback ?? stringFlag(flags, name, true)!;
  return {
    ...(itemId ? { id: itemId } : {}),
    nome: required("name", previous?.nome),
    quantidade: 0,
    estoqueMinimo: nonNegativeNumberFlag(flags, "minimum") ?? previous?.estoqueMinimo ?? 0,
    unidade: required("unit", previous?.unidade),
    categoriaId: required("category-id", previous?.categoriaId),
    descricao: stringFlag(flags, "description") ?? previous?.descricao,
    marca: stringFlag(flags, "brand") ?? previous?.marca,
    modelo: stringFlag(flags, "model") ?? previous?.modelo,
    codigoInterno: stringFlag(flags, "code") ?? previous?.codigoInterno,
    trackingMode: stringFlag(flags, "tracking")?.toUpperCase() ?? previous?.trackingMode ?? "QUANTIDADE",
    usagePolicy: stringFlag(flags, "usage")?.toUpperCase() ?? previous?.usagePolicy ?? "RETORNAVEL",
    defaultLocationId: stringFlag(flags, "location-id") ?? previous?.defaultLocationId,
    observacoes: stringFlag(flags, "note") ?? previous?.observacoes,
    dataAquisicao: stringFlag(flags, "acquired-at") ?? previous?.dataAquisicao?.toISOString().slice(0, 10),
    valorAquisicaoCentavos: nonNegativeNumberFlag(flags, "value-cents") ?? previous?.valorAquisicaoCentavos,
    fornecedor: stringFlag(flags, "supplier") ?? previous?.fornecedor,
  };
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const limit = numberFlag(flags, "limit") ?? 50;
  switch (command) {
    case "doctor": return output({ ok: true, command, data: await inventoryDoctor() });
    case "reconcile": return output({ ok: true, command, data: await inventoryReconcileDryRun({ limit }) });
    case "list": return output({ ok: true, command, data: await listInventoryItems({
      query: stringFlag(flags, "query"), categoryId: stringFlag(flags, "category-id"), status: stringFlag(flags, "status"),
      locationId: stringFlag(flags, "location-id"), responsibleUserId: numberFlag(flags, "responsible-id"), tagId: stringFlag(flags, "tag-id"),
      stock: (stringFlag(flags, "stock")?.toUpperCase() as "ALL" | "WITH_STOCK" | "WITHOUT_STOCK" | "LOW_STOCK" | undefined) ?? "ALL",
      maintenanceOnly: flags["maintenance-only"] === true, limit, cursor: stringFlag(flags, "cursor"),
    }) });
    case "movements": return output({ ok: true, command, data: await listInventoryMovements({ produtoId: stringFlag(flags, "item-id"), limit, cursor: stringFlag(flags, "cursor") }) });
    case "entry":
    case "exit": {
      const actor = await cliActor(flags);
      const result = await executeStockMovement({ idempotencyKey: stringFlag(flags, "key") ?? randomUUID(), produtoId: stringFlag(flags, "item-id", true)!, quantity: numberFlag(flags, "quantity", true)!, type: command === "entry" ? "ENTRADA" : "SAIDA", toLocationId: command === "entry" ? stringFlag(flags, "location-id") : undefined, fromLocationId: command === "exit" ? stringFlag(flags, "location-id") : undefined, assetId: stringFlag(flags, "asset-id"), observacao: stringFlag(flags, "note"), actor });
      return output({ ok: true, command, data: result });
    }
    case "assign": {
      const actor = await cliActor(flags);
      const result = await assignInventory({ idempotencyKey: stringFlag(flags, "key") ?? randomUUID(), produtoId: stringFlag(flags, "item-id", true)!, quantity: numberFlag(flags, "quantity", true)!, responsibleUserId: numberFlag(flags, "responsible-id", true)!, fromLocationId: stringFlag(flags, "from-location-id"), toLocationId: stringFlag(flags, "to-location-id"), assetId: stringFlag(flags, "asset-id"), observacao: stringFlag(flags, "note"), actor });
      return output({ ok: true, command, data: result });
    }
    case "return": {
      const actor = await cliActor(flags);
      const result = await returnInventory({ idempotencyKey: stringFlag(flags, "key") ?? randomUUID(), assignmentId: stringFlag(flags, "assignment-id", true)!, quantity: numberFlag(flags, "quantity", true)!, condition: (stringFlag(flags, "condition", true) ?? "BOM") as "BOM", destinationLocationId: stringFlag(flags, "location-id"), observacao: stringFlag(flags, "note"), actor });
      return output({ ok: true, command, data: result });
    }
    case "asset": {
      const actor = await cliActor(flags);
      const result = await registerInventoryAsset({ idempotencyKey: stringFlag(flags, "key") ?? randomUUID(), produtoId: stringFlag(flags, "item-id", true)!, serial: stringFlag(flags, "serial"), patrimonio: stringFlag(flags, "patrimonio"), codigoInterno: stringFlag(flags, "code"), locationId: stringFlag(flags, "location-id"), observacao: stringFlag(flags, "note"), actor });
      return output({ ok: true, command, data: result });
    }
    case "transfer": {
      const actor = await cliActor(flags);
      const result = await executeStockMovement({ idempotencyKey: stringFlag(flags, "key") ?? randomUUID(), produtoId: stringFlag(flags, "item-id", true)!, quantity: numberFlag(flags, "quantity", true)!, type: "TRANSFERENCIA", fromLocationId: stringFlag(flags, "from-location-id", true), toLocationId: stringFlag(flags, "to-location-id", true), assetId: stringFlag(flags, "asset-id"), sourceBucket: stringFlag(flags, "bucket") as InventoryBucket | undefined, observacao: stringFlag(flags, "note"), actor });
      return output({ ok: true, command, data: result });
    }
    case "adjust": {
      const actor = await cliActor(flags);
      const direction = stringFlag(flags, "direction", true)?.toUpperCase() as "INCREASE" | "DECREASE";
      const locationId = stringFlag(flags, "location-id");
      const result = await executeStockMovement({ idempotencyKey: stringFlag(flags, "key") ?? randomUUID(), produtoId: stringFlag(flags, "item-id", true)!, quantity: numberFlag(flags, "quantity", true)!, type: "AJUSTE", adjustmentDirection: direction, sourceBucket: stringFlag(flags, "bucket") as InventoryBucket | undefined, destinationBucket: stringFlag(flags, "bucket") as InventoryBucket | undefined, fromLocationId: direction === "DECREASE" ? locationId : undefined, toLocationId: direction === "INCREASE" ? locationId : undefined, observacao: stringFlag(flags, "note", true), actor });
      return output({ ok: true, command, data: result });
    }
    case "write-off": {
      const actor = await cliActor(flags);
      const type = (stringFlag(flags, "type") ?? "BAIXA").toUpperCase() as InventoryMovementType;
      if (!["BAIXA", "PERDA", "DANO"].includes(type)) throw new Error("--type deve ser BAIXA, PERDA ou DANO.");
      const result = await executeStockMovement({ idempotencyKey: stringFlag(flags, "key") ?? randomUUID(), produtoId: stringFlag(flags, "item-id", true)!, quantity: numberFlag(flags, "quantity", true)!, type, fromLocationId: stringFlag(flags, "location-id"), assetId: stringFlag(flags, "asset-id"), sourceBucket: stringFlag(flags, "bucket") as InventoryBucket | undefined, observacao: stringFlag(flags, "note", true), actor });
      return output({ ok: true, command, data: result });
    }
    case "maintenance": {
      const actor = await cliActor(flags);
      const result = await sendInventoryToMaintenance({ idempotencyKey: stringFlag(flags, "key") ?? randomUUID(), produtoId: stringFlag(flags, "item-id", true)!, quantity: numberFlag(flags, "quantity", true)!, reason: stringFlag(flags, "reason", true)!, provider: stringFlag(flags, "provider"), expectedAt: stringFlag(flags, "expected-at"), fromLocationId: stringFlag(flags, "location-id"), assetId: stringFlag(flags, "asset-id"), sourceBucket: (stringFlag(flags, "bucket") as "DISPONIVEL" | "DANIFICADO" | undefined) ?? "DISPONIVEL", observacao: stringFlag(flags, "note"), actor });
      return output({ ok: true, command, data: result });
    }
    case "maintenance-return": {
      const actor = await cliActor(flags);
      const result = await returnInventoryFromMaintenance({ idempotencyKey: stringFlag(flags, "key") ?? randomUUID(), maintenanceId: stringFlag(flags, "maintenance-id", true)!, condition: (stringFlag(flags, "condition")?.toUpperCase() as "BOM" | "COM_AVARIA" | "DANIFICADO" | undefined) ?? "BOM", toLocationId: stringFlag(flags, "location-id"), observacao: stringFlag(flags, "note"), actor });
      return output({ ok: true, command, data: result });
    }
    case "item-create":
    case "item-edit": {
      const actor = await cliActor(flags);
      const itemId = command === "item-edit" ? stringFlag(flags, "item-id", true)! : undefined;
      const result = await saveInventoryItem(await inventoryItemPayload(flags, itemId), { userId: actor.actorUserId, name: actor.actorName });
      return output({ ok: true, command, data: result });
    }
    case "item-archive": {
      const actor = await cliActor(flags);
      const result = await archiveInventoryItem(stringFlag(flags, "item-id", true)!, { userId: actor.actorUserId, name: actor.actorName });
      return output({ ok: true, command, data: result });
    }
    case "item-delete": {
      const actor = await cliActor(flags);
      if (stringFlag(flags, "confirm", true) !== "EXCLUIR") throw new Error("Exclusão definitiva exige --confirm EXCLUIR.");
      const result = await deleteInventoryItemPermanently(stringFlag(flags, "item-id", true)!, { userId: actor.actorUserId, name: actor.actorName });
      return output({ ok: true, command, data: result });
    }
    case "tag-save": {
      const actor = await cliActor(flags);
      const data = jsonObjectFlag(flags, "data");
      if (!data) throw new Error("Tag/modelo exige --data com o objeto JSON completo.");
      const result = await saveInventoryTagModel(data, { userId: actor.actorUserId, name: actor.actorName });
      return output({ ok: true, command, data: result });
    }
    case "kit-create": {
      const actor = await cliActor(flags);
      const result = await createInventoryKitInstance({ tagId: stringFlag(flags, "tag-id", true), code: stringFlag(flags, "code"), observacao: stringFlag(flags, "note") }, { userId: actor.actorUserId, name: actor.actorName });
      return output({ ok: true, command, data: result });
    }
    case "tag-delete": {
      const actor = await cliActor(flags);
      if (stringFlag(flags, "confirm", true) !== "EXCLUIR") throw new Error("Exclusão definitiva exige --confirm EXCLUIR.");
      const result = await deleteInventoryTagModelPermanently(stringFlag(flags, "tag-id", true)!, { userId: actor.actorUserId, name: actor.actorName });
      return output({ ok: true, command, data: result });
    }
    case "kit-validate": {
      return output({ ok: true, command, data: await validatePersistedInventoryKit(stringFlag(flags, "kit-id", true)!) });
    }
    case "help": return output({ ok: true, commands: ["doctor", "reconcile", "list", "movements", "item-create", "item-edit", "item-archive", "item-delete", "entry", "exit", "assign", "return", "asset", "transfer", "adjust", "write-off", "maintenance", "maintenance-return", "tag-save", "tag-delete", "kit-create", "kit-validate"], mutationSafety: "Use --execute --actor-id <id> em comandos mutáveis; exclusões exigem --confirm EXCLUIR." });
    default: throw new Error(`Comando desconhecido: ${command}`);
  }
}

main()
  .catch((error) => {
    output({ ok: false, error: error instanceof Error ? error.message : "Falha inesperada." });
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
