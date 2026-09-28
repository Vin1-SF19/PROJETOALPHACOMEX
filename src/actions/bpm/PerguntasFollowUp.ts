"use server";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/bpm/ownership";
import { z } from "zod";

const perguntaSchema = z.object({
  pipelineId: z.string().min(1),
  id: z.string().min(1).optional(),
  pergunta: z.string().trim().min(3).max(300),
  tipo: z.enum(["texto", "selecao", "booleano"]),
  opcoes: z.array(z.string().trim().min(1).max(120)).max(30),
  obrigatoria: z.boolean(),
  ativo: z.boolean(),
  ordem: z.number().int().min(0).max(1000),
});

async function administrador() {
  const session = await auth();
  return Boolean(session?.user?.id && isAdminRole(session.user.role ?? null));
}

export async function ListarPerguntasFollowUpBpm(pipelineId: string) {
  if (!await administrador()) return { success: false as const, error: "Não autorizado" };
  const perguntas = await db.bpmChecklistFollowUpPergunta.findMany({
    where: { pipelineId }, orderBy: [{ ordem: "asc" }, { id: "asc" }],
  });
  return { success: true as const, data: perguntas.map((item) => ({
    id: item.id, pergunta: item.pergunta, tipo: item.tipo, obrigatoria: item.obrigatoria,
    ativo: item.ativo, ordem: item.ordem,
    opcoes: item.opcoesJson ? JSON.parse(item.opcoesJson) as string[] : [],
  })) };
}

export async function SalvarPerguntaFollowUpBpm(input: unknown) {
  if (!await administrador()) return { success: false as const, error: "Não autorizado" };
  const parsed = perguntaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Confira a pergunta e as opções." };
  const { pipelineId, id, pergunta, tipo, opcoes, obrigatoria, ativo, ordem } = parsed.data;
  if (tipo === "selecao" && opcoes.length === 0) return { success: false as const, error: "Informe ao menos uma opção." };
  const normalizada = pergunta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalizada === "anotacoes sobre o ultimo follow-up") {
    return { success: false as const, error: "As anotações obrigatórias já fazem parte do checklist." };
  }
  const pipeline = await db.bpmPipeline.findUnique({ where: { id: pipelineId }, select: { id: true } });
  if (!pipeline) return { success: false as const, error: "Pipeline não encontrado." };
  if (id) {
    const atualizado = await db.bpmChecklistFollowUpPergunta.updateMany({
      where: { id, pipelineId },
      data: { pergunta, tipo, opcoesJson: tipo === "selecao" ? JSON.stringify(opcoes) : null, obrigatoria, ativo, ordem },
    });
    if (atualizado.count !== 1) return { success: false as const, error: "Pergunta não encontrada." };
  } else {
    await db.bpmChecklistFollowUpPergunta.create({
      data: { pipelineId, pergunta, tipo, opcoesJson: tipo === "selecao" ? JSON.stringify(opcoes) : null, obrigatoria, ativo, ordem },
    });
  }
  return { success: true as const };
}

export async function ExcluirPerguntaFollowUpBpm(pipelineId: string, id: string) {
  if (!await administrador()) return { success: false as const, error: "Não autorizado" };
  const excluida = await db.bpmChecklistFollowUpPergunta.deleteMany({ where: { id, pipelineId } });
  return excluida.count === 1 ? { success: true as const } : { success: false as const, error: "Pergunta não encontrada." };
}
