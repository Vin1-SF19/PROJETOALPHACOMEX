"use server";

// CRM de Canais e Parcerias — Fase 03 (Desenvolvimento do Parceiro).

import { z } from "zod";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCtx } from "./parceiros";
import {
  calcularIndicadoresParceiro,
  transicionarEstagioDesenvolvimento,
  podeMoverEstagioParceiro,
  ESTAGIOS_DESENVOLVIMENTO,
  type EstagioDesenvolvimento,
} from "@/lib/parceiros/desenvolvimento";
import { parseDataLocalInput } from "@/lib/format-date";
import { calcularPrioridadeFollowUp, followUpEstaVencido } from "@/lib/parceiros/prioridade";

const PotencialParceiroSchema = z.object({
  parceiroId: z.number().int().positive(),
  potencialRecorrencia: z.number().int().min(0).max(5),
});

/** Score MANUAL de 0-5 — nunca calculado automaticamente. Isolado de `comissaoPercentual` (regra financeira). */
export async function AtualizarPotencialRecorrenciaParceiro(input: z.input<typeof PotencialParceiroSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = PotencialParceiroSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { parceiroId, potencialRecorrencia } = parsed.data;

  const parceiro = await db.parceiro.findUnique({ where: { id: parceiroId }, select: { potencialRecorrencia: true } });
  if (!parceiro) return { success: false as const, error: "Parceiro não encontrado" };

  await db.$transaction([
    db.parceiro.update({
      where: { id: parceiroId },
      data: {
        potencialRecorrencia,
        potencialRecorrenciaAtualizadoEm: new Date(),
        potencialRecorrenciaAtualizadoPorId: ctx.userId,
      },
    }),
    db.parceiroHistorico.create({
      data: {
        parceiroId,
        acao: "POTENCIAL_ALTERADO",
        valorAnteriorJson: JSON.stringify({ potencialRecorrencia: parceiro.potencialRecorrencia }),
        valorNovoJson: JSON.stringify({ potencialRecorrencia }),
        usuarioId: ctx.userId,
      },
    }),
  ]);

  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const };
}

/**
 * Reativação estruturada (fora de "INATIVO"): move para "EM_REATIVACAO" — estado transitório
 * de reingresso, não decide mais o destino final no mesmo clique (RM-2026-2C7A4B). O destino
 * real (ATIVO/ATIVADO_SEM_INDICACAO/EM_ATIVACAO) é resolvido depois, quando uma indicação real
 * acontecer (`sincronizarEstagioAposIndicacao`) ou por movimento manual no Kanban.
 */
export async function ReativarParceiro(parceiroIdInput: number) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parceiroId = z.number().int().positive().parse(parceiroIdInput);
  const parceiro = await db.parceiro.findUnique({
    where: { id: parceiroId },
    select: { estagioDesenvolvimento: true },
  });
  if (!parceiro) return { success: false as const, error: "Parceiro não encontrado" };
  if (parceiro.estagioDesenvolvimento !== "INATIVO") {
    return { success: false as const, error: "Este parceiro não está marcado como inativo" };
  }

  const r = await transicionarEstagioDesenvolvimento(parceiroId, "EM_REATIVACAO", { usuarioId: ctx.userId, automacaoOrigem: "reativacao:manual" });
  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const, alterado: r.alterado, estagio: "EM_REATIVACAO" as const };
}

const MoverEstagioSchema = z.object({
  parceiroId: z.number().int().positive(),
  estagioDestino: z.enum(ESTAGIOS_DESENVOLVIMENTO),
});

/** Movimento manual no Kanban de Desenvolvimento — mesmo padrão de `MoverLeadAquisicaoParceiro`. */
export async function MoverEstagioParceiro(input: z.input<typeof MoverEstagioSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = MoverEstagioSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { parceiroId, estagioDestino } = parsed.data;

  const parceiro = await db.parceiro.findUnique({ where: { id: parceiroId }, select: { estagioDesenvolvimento: true } });
  if (!parceiro) return { success: false as const, error: "Parceiro não encontrado" };

  const atual = parceiro.estagioDesenvolvimento as EstagioDesenvolvimento;
  if (!podeMoverEstagioParceiro(atual, estagioDestino)) {
    return { success: false as const, error: `Transição inválida: ${atual} → ${estagioDestino}` };
  }

  await transicionarEstagioDesenvolvimento(parceiroId, estagioDestino, { usuarioId: ctx.userId, automacaoOrigem: "kanban:manual" });
  revalidatePath("/PainelAlpha/Parceiros");
  revalidatePath("/PainelAlpha/Parceiros/Relacionamento");
  return { success: true as const };
}

const ProximaAcaoParceiroSchema = z.object({
  parceiroId: z.number().int().positive(),
  // Ver ProximaAcaoLeadSchema em parceiros-aquisicao.ts — mesmo bug corrigido
  // aqui: z.coerce.date() direto sobre "YYYY-MM-DD" ancora em meia-noite UTC,
  // que no fuso do Brasil (UTC-3) exibe o dia anterior.
  proximaAcaoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida").transform(parseDataLocalInput),
  proximaAcaoDescricao: z.string().min(1),
});

/** Registra a próxima ação de relacionamento — mesmo padrão de `RegistrarProximaAcaoLeadAquisicao`. */
export async function RegistrarProximaAcaoParceiro(input: z.input<typeof ProximaAcaoParceiroSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = ProximaAcaoParceiroSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { parceiroId, proximaAcaoEm, proximaAcaoDescricao } = parsed.data;

  const parceiro = await db.parceiro.findUnique({ where: { id: parceiroId }, select: { id: true } });
  if (!parceiro) return { success: false as const, error: "Parceiro não encontrado" };

  await db.$transaction([
    db.parceiro.update({ where: { id: parceiroId }, data: { proximaAcaoEm, proximaAcaoDescricao } }),
    db.parceiroHistorico.create({
      data: {
        parceiroId,
        acao: "PROXIMA_ACAO_REGISTRADA",
        valorNovoJson: JSON.stringify({ proximaAcaoEm, proximaAcaoDescricao }),
        usuarioId: ctx.userId,
      },
    }),
  ]);

  revalidatePath("/PainelAlpha/Parceiros");
  revalidatePath("/PainelAlpha/Parceiros/Relacionamento");
  return { success: true as const };
}

export interface CardKanbanParceiro {
  parceiroId: number;
  nome: string;
  estagioDesenvolvimento: EstagioDesenvolvimento;
  potencialRecorrencia: number | null;
  totalIndicacoes: number;
  ultimaIndicacaoEm: Date | null;
  diasSemIndicacao: number | null;
  proximaAcaoEm: Date | null;
  proximaAcaoDescricao: string | null;
  followUpVencido: boolean;
  prioridade: number;
}

/** Dados agrupáveis por coluna para o Kanban de Desenvolvimento (RM-2026-2C7A4B). */
export async function ListarParceirosParaKanban() {
  const ctx = await getCtx();
  if (!ctx) return { success: false as const, error: "Sem permissão", itens: [] as CardKanbanParceiro[] };

  const parceiros = await db.parceiro.findMany({
    where: { ativo: true },
    select: {
      id: true,
      nome: true,
      estagioDesenvolvimento: true,
      potencialRecorrencia: true,
      proximaAcaoEm: true,
      proximaAcaoDescricao: true,
    },
  });

  const itens: CardKanbanParceiro[] = [];
  for (const p of parceiros) {
    const ind = await calcularIndicadoresParceiro(p.id);
    itens.push({
      parceiroId: p.id,
      nome: p.nome,
      estagioDesenvolvimento: p.estagioDesenvolvimento as EstagioDesenvolvimento,
      potencialRecorrencia: p.potencialRecorrencia,
      totalIndicacoes: ind.totalIndicacoes,
      ultimaIndicacaoEm: ind.ultimaIndicacaoEm,
      diasSemIndicacao: ind.diasSemIndicacao,
      proximaAcaoEm: p.proximaAcaoEm,
      proximaAcaoDescricao: p.proximaAcaoDescricao,
      followUpVencido: followUpEstaVencido(p.proximaAcaoEm),
      prioridade: calcularPrioridadeFollowUp({
        potencialRecorrencia: p.potencialRecorrencia,
        proximaAcaoEm: p.proximaAcaoEm,
        diasSemIndicacao: ind.diasSemIndicacao,
        estagioDesenvolvimento: p.estagioDesenvolvimento,
      }),
    });
  }

  return { success: true as const, itens };
}

export async function ObterIndicadoresDesenvolvimentoParceiro(parceiroIdInput: number) {
  const ctx = await getCtx();
  if (!ctx) return { success: false as const, error: "Sem permissão" };

  const parceiroId = z.number().int().positive().parse(parceiroIdInput);
  const parceiro = await db.parceiro.findUnique({ where: { id: parceiroId }, select: { id: true } });
  if (!parceiro) return { success: false as const, error: "Parceiro não encontrado" };

  const indicadores = await calcularIndicadoresParceiro(parceiroId);
  return { success: true as const, indicadores };
}

/** Timeline de relacionamento — Fase 07 (tela 360º). */
export async function ListarHistoricoParceiro(parceiroIdInput: number) {
  const ctx = await getCtx();
  if (!ctx) return { success: false as const, error: "Sem permissão", historico: [] };

  const parceiroId = z.number().int().positive().parse(parceiroIdInput);
  const historico = await db.parceiroHistorico.findMany({
    where: { parceiroId },
    select: {
      id: true,
      acao: true,
      valorAnteriorJson: true,
      valorNovoJson: true,
      automacaoOrigem: true,
      createdAt: true,
      usuario: { select: { nome: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { success: true as const, historico };
}
