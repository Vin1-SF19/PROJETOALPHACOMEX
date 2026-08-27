"use server";

// CRM de Canais e Parcerias — RM-2026-8B7DC7 (Tarefas vinculadas a Parceiro).

import { z } from "zod";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCtx } from "./parceiros";

const CriarTarefaSchema = z.object({
  parceiroId: z.number().int().positive(),
  titulo: z.string().min(2),
  descricao: z.string().optional(),
  responsavelId: z.number().int().positive().optional(),
  prazo: z.coerce.date().optional(),
  prioridade: z.enum(["BAIXA", "NORMAL", "ALTA"]).default("NORMAL"),
});

export async function CriarTarefaParceiro(input: z.input<typeof CriarTarefaSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = CriarTarefaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { parceiroId, titulo, descricao, responsavelId, prazo, prioridade } = parsed.data;

  const parceiro = await db.parceiro.findUnique({ where: { id: parceiroId }, select: { id: true } });
  if (!parceiro) return { success: false as const, error: "Parceiro não encontrado" };

  const [tarefa] = await db.$transaction([
    db.parceiroTarefa.create({
      data: { parceiroId, titulo, descricao, responsavelId, prazo, prioridade },
    }),
    db.parceiroHistorico.create({
      data: {
        parceiroId,
        acao: "TAREFA_CRIADA",
        valorNovoJson: JSON.stringify({ titulo, prioridade }),
        usuarioId: ctx.userId,
      },
    }),
  ]);

  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const, tarefa };
}

export async function ListarTarefasParceiro(parceiroId: number) {
  const ctx = await getCtx();
  if (!ctx) return { success: false as const, error: "Sem permissão", tarefas: [] };

  const tarefas = await db.parceiroTarefa.findMany({
    where: { parceiroId },
    include: { responsavel: { select: { id: true, nome: true } } },
    orderBy: [{ status: "asc" }, { prazo: "asc" }, { createdAt: "desc" }],
  });

  return { success: true as const, tarefas };
}

export async function ConcluirTarefaParceiro(tarefaId: string) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const tarefa = await db.parceiroTarefa.findUnique({ where: { id: tarefaId }, select: { parceiroId: true, titulo: true, status: true } });
  if (!tarefa) return { success: false as const, error: "Tarefa não encontrada" };
  if (tarefa.status === "CONCLUIDA") return { success: true as const };

  await db.$transaction([
    db.parceiroTarefa.update({
      where: { id: tarefaId },
      data: { status: "CONCLUIDA", concluidaEm: new Date() },
    }),
    db.parceiroHistorico.create({
      data: {
        parceiroId: tarefa.parceiroId,
        acao: "TAREFA_CONCLUIDA",
        valorNovoJson: JSON.stringify({ titulo: tarefa.titulo }),
        usuarioId: ctx.userId,
      },
    }),
  ]);

  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const };
}

export async function ExcluirTarefaParceiro(tarefaId: string) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeExcluir)) return { success: false as const, error: "Sem permissão" };

  const tarefa = await db.parceiroTarefa.findUnique({ where: { id: tarefaId }, select: { id: true } });
  if (!tarefa) return { success: false as const, error: "Tarefa não encontrada" };

  await db.parceiroTarefa.delete({ where: { id: tarefaId } });

  revalidatePath("/PainelAlpha/Parceiros");
  return { success: true as const };
}
