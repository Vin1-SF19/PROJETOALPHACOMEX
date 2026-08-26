"use server";

// CRM de Canais e Parcerias — Fase 03 (Desenvolvimento do Parceiro).

import { z } from "zod";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCtx } from "./parceiros";
import { calcularIndicadoresParceiro, transicionarEstagioDesenvolvimento } from "@/lib/parceiros/desenvolvimento";

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
 * Reativação estruturada (fora de "INATIVO"): decide o estágio de destino a partir do
 * histórico real do parceiro — nunca reativa "no escuro" para um estágio arbitrário.
 */
export async function ReativarParceiro(parceiroIdInput: number) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parceiroId = z.number().int().positive().parse(parceiroIdInput);
  const parceiro = await db.parceiro.findUnique({
    where: { id: parceiroId },
    select: { estagioDesenvolvimento: true, onboardingCompleto: true },
  });
  if (!parceiro) return { success: false as const, error: "Parceiro não encontrado" };
  if (parceiro.estagioDesenvolvimento !== "INATIVO") {
    return { success: false as const, error: "Este parceiro não está marcado como inativo" };
  }

  const totalIndicacoes = await db.indicacao.count({ where: { parceiroId } });
  const destino = totalIndicacoes > 0 ? "ATIVO" : parceiro.onboardingCompleto ? "ATIVADO_SEM_INDICACAO" : "EM_ATIVACAO";

  const r = await transicionarEstagioDesenvolvimento(parceiroId, destino, { usuarioId: ctx.userId, automacaoOrigem: "reativacao:manual" });
  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const, alterado: r.alterado, estagio: destino };
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
