"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { comAutoriaOriginalRd, corrigirProjecaoHistoricoRd } from "@/lib/bpm/rd-station-history";
import { autorAjusteHistoricoRd, ordenarHistoricoRd, periodoOriginalRd } from "@/lib/bpm/rd-station-display";
import { textoLegivelRd } from "@/lib/bpm/rd-station-text";

const PROVEDOR = "RD_STATION_CRM_V1";
const correcaoSchema = z.object({
  eventoId: z.string().min(1).max(120),
  titulo: z.string().max(500),
  conteudo: z.string().max(12000),
  data: z.string().max(100).refine((value) => !value || Number.isFinite(Date.parse(value)), "Data inválida."),
});

export async function ListarHistoricoExternoRd(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado", data: [] };
    await exigirAcessoBpmCard(cardId, Number(session.user.id), session.user.role ?? null, "visualizarHistorico");
    const origem = await db.bpmCardOrigemExterna.findFirst({
      where: { cardId, provider: PROVEDOR },
      select: { id: true, sourcePipelineName: true, sourceStageName: true, sourceDealName: true },
    });
    if (!origem) return { success: true as const, data: [] };
    const eventos = await db.bpmEventoExternoCard.findMany({
      where: { origemId: origem.id },
      select: {
        id: true, eventType: true, occurredAt: true, projectedJson: true, rawJson: true,
        correcoes: { select: {
          id: true, autorId: true, versao: true, camposAlteradosJson: true, projecaoAnteriorJson: true, projecaoNovaJson: true, createdAt: true,
          autor: { select: { nome: true } },
        }, orderBy: { versao: "asc" } },
      },
      orderBy: [{ occurredAt: "desc" }, { id: "asc" }],
    });
    return {
      success: true as const,
      origem: { pipeline: textoLegivelRd(origem.sourcePipelineName), etapa: textoLegivelRd(origem.sourceStageName), nome: textoLegivelRd(origem.sourceDealName) },
      data: ordenarHistoricoRd(eventos.map((evento) => {
        const projection = JSON.parse(evento.projectedJson) as Record<string, unknown>;
        const autoriaCorrigida = evento.correcoes.some(c => JSON.parse(c.camposAlteradosJson)?.authorName === true);
        return {
          id: evento.id,
        tipo: evento.eventType,
        data: evento.occurredAt,
        projecao: autoriaCorrigida || evento.eventType === "TASK_RD" ? projection : comAutoriaOriginalRd(projection, JSON.parse(evento.rawJson)),
        periodoOriginal: periodoOriginalRd(JSON.parse(evento.rawJson) as Record<string, unknown>, JSON.parse(evento.projectedJson)),
        correcoes: evento.correcoes.map((correcao) => ({
          versao: correcao.versao, campos: JSON.parse(correcao.camposAlteradosJson) as Record<string, unknown>,
          anterior: JSON.parse(correcao.projecaoAnteriorJson) as Record<string, unknown>,
          nova: JSON.parse(correcao.projecaoNovaJson) as Record<string, unknown>,
          autor: autorAjusteHistoricoRd(correcao), data: correcao.createdAt,
        })),
        };
      })),
    };
  } catch {
    return { success: false as const, error: "Erro ao consultar histórico RD", data: [] };
  }
}

export async function CorrigirHistoricoExternoRd(input: unknown) {
  const parsed = correcaoSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Campos da correção inválidos." };
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado." };
  const userId = Number(session.user.id);
  try {
    const evento = await db.bpmEventoExternoCard.findUnique({
      where: { id: parsed.data.eventoId },
      select: { id: true, origem: { select: { cardId: true, provider: true } }, projectedJson: true },
    });
    if (!evento || evento.origem.provider !== PROVEDOR) return { success: false as const, error: "Evento RD não encontrado." };
    await exigirAcessoBpmCard(evento.origem.cardId, userId, session.user.role ?? null, "editarCard");
    const anterior = JSON.parse(evento.projectedJson) as Record<string, unknown>;
    const proxima = corrigirProjecaoHistoricoRd(anterior, { title: parsed.data.titulo, content: parsed.data.conteudo, date: parsed.data.data });
    await db.$transaction(async (tx) => {
      const ultimaCorrecao = await tx.bpmEventoExternoCorrecao.findFirst({
        where: { eventoId: evento.id }, orderBy: { versao: "desc" }, select: { versao: true },
      });
      await tx.bpmEventoExternoCorrecao.create({ data: {
        id: randomUUID(), eventoId: evento.id, versao: (ultimaCorrecao?.versao ?? 0) + 1,
        camposAlteradosJson: JSON.stringify({ title: true, content: true, date: true }),
        projecaoAnteriorJson: JSON.stringify(anterior), projecaoNovaJson: JSON.stringify(proxima), autorId: userId,
      } });
      await tx.bpmEventoExternoCard.update({ where: { id: evento.id }, data: { projectedJson: JSON.stringify(proxima) } });
    });
    revalidatePath("/PainelAlpha/AlphaCRM");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Não foi possível corrigir este evento." };
  }
}
