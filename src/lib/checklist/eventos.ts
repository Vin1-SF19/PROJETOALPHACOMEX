import db from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import type { AtorChecklist } from "./types";
import { exigirLeituraChecklist } from "./acesso";
import { z } from "zod";
import { fail } from "./result";
export async function listarEventos(ator: AtorChecklist, input: unknown = {}) {
  await exigirLeituraChecklist(ator);
  if (ator.kind !== "INTERNO") fail("FORBIDDEN", "Sem acesso.");
  const c = z
    .object({
      cursor: z
        .object({ createdAt: z.string().datetime(), id: z.string().min(1) })
        .optional(),
      limit: z.number().int().min(1).max(100).default(50),
      somenteNaoLidos: z.boolean().default(false),
    })
    .parse(input);
  const rows = await db.checklistEvento.findMany({
    where: {
      empresaId: { not: null },
      ...(c.somenteNaoLidos
        ? { leituras: { none: { usuarioId: ator.id } } }
        : {}),
      ...(c.cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(c.cursor.createdAt) } },
              {
                createdAt: new Date(c.cursor.createdAt),
                id: { lt: c.cursor.id },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      revision: true,
      tipo: true,
      empresaId: true,
      createdAt: true,
      dados: true,
      leituras: { where: { usuarioId: ator.id }, select: { lidoEm: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: c.limit + 1,
  });
  const hasMore = rows.length > c.limit;
  const items = rows.slice(0, c.limit).map((e) => ({
    eventId: e.id,
    revision: e.revision,
    tipo: e.tipo,
    empresaId: e.empresaId,
    createdAt: e.createdAt.toISOString(),
    lidoEm: e.leituras[0]?.lidoEm.toISOString() ?? null,
    dados: e.dados,
  }));
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      hasMore && last ? { createdAt: last.createdAt, id: last.eventId } : null,
  };
}
export async function marcarEventoLido(ator: AtorChecklist, eventId: string) {
  await exigirLeituraChecklist(ator);
  if (ator.kind !== "INTERNO") fail("FORBIDDEN", "Sem acesso.");
  z.string().min(1).max(80).parse(eventId);
  if (
    !(await db.checklistEvento.findFirst({
      where: { id: eventId, empresaId: { not: null } },
      select: { id: true },
    }))
  )
    fail("NOT_FOUND", "Evento não encontrado.");
  return db.checklistEventoLeitura.upsert({
    where: { eventoId_usuarioId: { eventoId: eventId, usuarioId: ator.id } },
    create: { eventoId: eventId, usuarioId: ator.id },
    update: {},
    select: { eventoId: true, lidoEm: true },
  });
}
export async function publicarPendentes(
  trigger: (event: {
    eventId: string;
    revision: number;
    empresaId: string | null;
  }) => Promise<unknown>,
) {
  const now = new Date();
  const rows = await db.checklistEvento.findMany({
    where: {
      publicadoEm: null,
      OR: [{ proximaTentativaEm: null }, { proximaTentativaEm: { lte: now } }],
      AND: [{ OR: [{ claimAte: null }, { claimAte: { lt: now } }] }],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 50,
  });
  let processed = 0;
  for (const row of rows) {
    const claimToken = randomUUID();
    const claim = await db.checklistEvento.updateMany({
      where: {
        id: row.id,
        publicadoEm: null,
        OR: [{ claimAte: null }, { claimAte: { lt: now } }],
      },
      data: {
        claimToken,
        claimAte: new Date(Date.now() + 60000),
        tentativas: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    try {
      await trigger({
        eventId: row.id,
        revision: row.revision,
        empresaId: row.empresaId,
      });
      await db.checklistEvento.updateMany({
        where: { id: row.id, claimToken },
        data: {
          publicadoEm: new Date(),
          claimAte: null,
          claimToken: null,
          ultimoErro: null,
        },
      });
      processed++;
    } catch {
      await db.checklistEvento.updateMany({
        where: { id: row.id, claimToken },
        data: {
          claimAte: null,
          claimToken: null,
          ultimoErro: "PUBLICACAO_INDISPONIVEL",
          proximaTentativaEm: new Date(
            Date.now() +
              Math.min(3600000, 2000 * 2 ** Math.min(row.tentativas, 10)),
          ),
        },
      });
    }
  }
  return { processed };
}
