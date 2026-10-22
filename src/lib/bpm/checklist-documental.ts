import db from "@/lib/prisma";
import { z } from "zod";
import type { AtorChecklist } from "@/lib/checklist/types";
import {
  exigirLeituraChecklist,
  exigirEscritaChecklist,
  type Tx,
} from "@/lib/checklist/acesso";
import { listarEmpresas, obterEmpresa } from "@/lib/checklist/leitura";
import { fail } from "@/lib/checklist/result";
import { registrarEvento, replay } from "@/lib/checklist/commands";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import { comandoSchema, idSchema } from "@/lib/checklist/schemas";
async function exigirCard(
  tx: Tx,
  ator: AtorChecklist,
  cardId: string,
  write = false,
) {
  await exigirLeituraChecklist(ator, tx);
  if (ator.kind !== "INTERNO") fail("FORBIDDEN", "Sem acesso ao CRM.");
  const acesso = await checarAcessoBpmCard(
    cardId,
    ator.id,
    null,
    write ? "editarCard" : "visualizar",
    tx,
  );
  if (!acesso.autorizado) fail("FORBIDDEN", "Sem acesso ao card.");
  const card = await tx.bpmCard.findUnique({
    where: { id: cardId },
    select: { id: true, empresaId: true, updatedAt: true },
  });
  if (!card) fail("NOT_FOUND", "Card não encontrado.");
  return card;
}
async function revisionVinculo(tx: Tx, cardId: string) {
  const last = await tx.checklistEvento.findFirst({
    where: { agregadoTipo: "VINCULO_CRM", agregadoId: cardId },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  return last?.revision ?? 0;
}
export async function exigirCompatibilidadeMasterDossie(
  tx: Tx,
  cardId: string,
  novoClienteId: number,
) {
  const link = await tx.checklistCrmVinculo.findUnique({
    where: { cardId },
    select: { empresaOperacional: { select: { clienteId: true } } },
  });
  if (link && link.empresaOperacional.clienteId !== novoClienteId)
    fail("CONFLICT", "Desvincule o dossiê antes de trocar a empresa do card.");
}
export async function obterDossieCard(ator: AtorChecklist, cardId: string) {
  idSchema.parse(cardId);
  const card = await exigirCard(db, ator, cardId);
  const link = await db.checklistCrmVinculo.findUnique({
    where: { cardId },
    select: { empresaOperacionalId: true, revision: true },
  });
  const revision = await revisionVinculo(db, cardId);
  if (!link)
    return {
      vinculo: null,
      revision,
      cardUpdatedAt: card.updatedAt.toISOString(),
      dossie: null,
    };
  const dossie = await obterEmpresa(ator, link.empresaOperacionalId);
  if (dossie.clienteId !== card.empresaId)
    fail("CONFLICT", "Vínculo do dossiê requer revisão de integridade.");
  const write = await checarAcessoBpmCard(
    cardId,
    ator.kind === "INTERNO" ? ator.id : 0,
    null,
    "editarCard",
  );
  return {
    vinculo: link,
    revision,
    cardUpdatedAt: card.updatedAt.toISOString(),
    dossie: {
      ...dossie,
      capabilities: {
        ...dossie.capabilities,
        canLinkCrm: dossie.capabilities.canEdit && write.autorizado,
      },
    },
  };
}
export async function listarCandidatosCard(
  ator: AtorChecklist,
  cardId: string,
  input: unknown = {},
) {
  const card = await exigirCard(db, ator, idSchema.parse(cardId));
  const p = z
    .object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
      busca: z.string().max(200).optional(),
    })
    .parse(input);
  return listarEmpresas(ator, { ...p, clienteId: card.empresaId });
}
export async function vincularDossieCard(ator: AtorChecklist, input: unknown) {
  const c = comandoSchema
    .extend({
      cardId: idSchema,
      empresaOperacionalId: idSchema.nullable(),
      expectedCardUpdatedAt: z.string().datetime(),
    })
    .parse(input);
  await db.$transaction(async (tx) => {
    const card = await exigirCard(tx, ator, c.cardId, true);
    const existing = await tx.checklistCrmVinculo.findUnique({
      where: { cardId: c.cardId },
    });
    if (existing)
      await exigirEscritaChecklist(tx, ator, existing.empresaOperacionalId);
    if (c.empresaOperacionalId) {
      const e = await exigirEscritaChecklist(tx, ator, c.empresaOperacionalId);
      if (e.clienteId !== card.empresaId)
        fail("FORBIDDEN", "O dossiê deve ser da mesma empresa master do card.");
    }
    const prior = await replay(tx, ator, c.mutationId, c);
    if (prior) return;
    const revision = await revisionVinculo(tx, c.cardId);
    if (
      revision !== c.expectedRevision ||
      card.updatedAt.toISOString() !== c.expectedCardUpdatedAt
    )
      fail("CONFLICT", "O card ou vínculo mudou. Recarregue.");
    if ((existing?.empresaOperacionalId ?? null) === c.empresaOperacionalId)
      return;
    const cas = await tx.bpmCard.updateMany({
      where: { id: card.id, updatedAt: card.updatedAt },
      data: {
        updatedAt: new Date(Math.max(Date.now(), card.updatedAt.getTime() + 1)),
      },
    });
    if (cas.count !== 1) fail("CONFLICT", "O card mudou. Recarregue.");
    if (c.empresaOperacionalId)
      await tx.checklistCrmVinculo.upsert({
        where: { cardId: card.id },
        create: {
          cardId: card.id,
          empresaOperacionalId: c.empresaOperacionalId,
          revision: revision + 1,
          autorId: ator.kind === "INTERNO" ? ator.id : null,
        },
        update: {
          empresaOperacionalId: c.empresaOperacionalId,
          revision: revision + 1,
          autorId: ator.kind === "INTERNO" ? ator.id : null,
        },
      });
    else if (existing)
      await tx.checklistCrmVinculo.delete({ where: { id: existing.id } });
    await registrarEvento(tx, ator, {
      mutationId: c.mutationId,
      payload: c,
      agregadoTipo: "VINCULO_CRM",
      agregadoId: card.id,
      revision: revision + 1,
      tipo: c.empresaOperacionalId
        ? "CHECKLIST_CRM_VINCULADO"
        : "CHECKLIST_CRM_DESVINCULADO",
      empresaId: c.empresaOperacionalId ?? existing?.empresaOperacionalId,
      dados: {
        cardId: card.id,
        antes: { empresaOperacionalId: existing?.empresaOperacionalId ?? null },
        depois: { empresaOperacionalId: c.empresaOperacionalId },
      },
      resultado: { cardId: card.id },
    });
  });
  return obterDossieCard(ator, c.cardId);
}
