"use server";

// CRM de Canais e Parcerias — Fase 04 (Indicações vinculadas ao BPM comercial existente).
// Reaproveita o pipeline "Revisão de Radar" já existente (mesmas etapas do fluxo pedido:
// Novos leads → Reunião Agendada → Em tratativa → Fechado) — NUNCA cria um pipeline paralelo.

import { z } from "zod";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCtx } from "./parceiros";
import { CriarCardBpm } from "./bpm/Cards";

const PIPELINE_INDICACOES_NOME = "Revisão de Radar";

async function obterEtapaNovosLeadsPipelineIndicacoes() {
  const pipeline = await db.bpmPipeline.findFirst({
    where: { nome: PIPELINE_INDICACOES_NOME, ativo: true },
    select: { id: true },
  });
  if (!pipeline) return null;
  const etapa = await db.bpmEtapa.findFirst({
    where: { pipelineId: pipeline.id, ordem: 0, ativo: true },
    select: { id: true },
  });
  if (!etapa) return null;
  return { pipelineId: pipeline.id, etapaId: etapa.id };
}

const DirecionarSchema = z.object({
  indicacaoId: z.number().int().positive(),
  responsavelId: z.number().int().positive(),
});

/**
 * "Indicação Recebida/Registrada" → "Direcionada ao Closer": cria a oportunidade real
 * (BpmCard) no pipeline comercial existente e vincula `Indicacao.bpmCardId`. A partir daqui,
 * o card segue o fluxo normal do Alpha CRM (Reunião Agendada → Em Tratativa → Fechado/Lost).
 */
export async function DirecionarIndicacaoParaCloser(input: z.input<typeof DirecionarSchema>) {
  const ctx = await getCtx();
  if (!ctx || (!ctx.isAdmin && !ctx.podeEditar)) return { success: false as const, error: "Sem permissão" };

  const parsed = DirecionarSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { indicacaoId, responsavelId } = parsed.data;

  const indicacao = await db.indicacao.findUnique({ where: { id: indicacaoId } });
  if (!indicacao) return { success: false as const, error: "Indicação não encontrada" };
  if (indicacao.bpmCardId) return { success: false as const, error: "Esta indicação já foi direcionada a um closer" };

  const destino = await obterEtapaNovosLeadsPipelineIndicacoes();
  if (!destino) {
    return { success: false as const, error: `Pipeline "${PIPELINE_INDICACOES_NOME}" não está configurado corretamente` };
  }

  const resultadoCard = await CriarCardBpm({
    empresaId: indicacao.clienteId,
    pipelineId: destino.pipelineId,
    etapaId: destino.etapaId,
    responsavelId,
  });
  if (!resultadoCard.success || !resultadoCard.data) {
    return { success: false as const, error: resultadoCard.error ?? "Erro ao criar a oportunidade comercial" };
  }

  // `Indicacao.bpmCardId` é @unique — CAS implícito: se por corrida dupla dois direcionamentos
  // concorrentes chegassem aqui, o segundo update falharia por violar a constraint em vez de
  // sobrescrever silenciosamente o vínculo do primeiro card criado.
  await db.$transaction([
    db.indicacao.update({ where: { id: indicacaoId }, data: { bpmCardId: resultadoCard.data.id } }),
    db.parceiroHistorico.create({
      data: {
        parceiroId: indicacao.parceiroId,
        acao: "INDICACAO_DIRECIONADA_AO_CLOSER",
        valorNovoJson: JSON.stringify({ indicacaoId, bpmCardId: resultadoCard.data.id, responsavelId }),
        usuarioId: ctx.userId,
      },
    }),
  ]);

  revalidatePath("/PainelAlpha/Parceiros");
  revalidatePath(`/PainelAlpha/AlphaCRM/pipeline/${destino.pipelineId}`);
  return { success: true as const, bpmCardId: resultadoCard.data.id };
}

/** Consolida cada indicação do parceiro com o status da oportunidade/contrato vinculados — para a tela 360º (Fase 07). */
export async function ListarIndicacoesDoParceiro(parceiroIdInput: number) {
  const ctx = await getCtx();
  if (!ctx) return { success: false as const, error: "Sem permissão", indicacoes: [] };

  const parceiroId = z.number().int().positive().parse(parceiroIdInput);

  const indicacoes = await db.indicacao.findMany({
    where: { parceiroId },
    select: {
      id: true,
      status: true,
      dataIndicacao: true,
      cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } },
      bpmCardId: true,
      bpmCard: {
        select: {
          id: true,
          status: true,
          pipelineId: true,
          pipeline: { select: { nome: true } },
          etapa: { select: { nome: true } },
        },
      },
    },
    orderBy: { dataIndicacao: "desc" },
  });

  // Contrato/serviço da empresa indicada — não presume 1:1, mostra o serviço mais recente.
  const clienteIds = indicacoes.map((i) => i.cliente.id);
  const servicos = clienteIds.length > 0
    ? await db.clienteServico.findMany({
        where: { clienteId: { in: clienteIds } },
        select: { clienteId: true, servico: true, dataContratacao: true, valorContrato: true },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  const servicoMaisRecentePorCliente = new Map<number, (typeof servicos)[number]>();
  for (const s of servicos) {
    if (!servicoMaisRecentePorCliente.has(s.clienteId)) servicoMaisRecentePorCliente.set(s.clienteId, s);
  }

  return {
    success: true as const,
    indicacoes: indicacoes.map((i) => ({
      id: i.id,
      status: i.status,
      dataIndicacao: i.dataIndicacao,
      empresa: i.cliente,
      oportunidade: i.bpmCard
        ? { id: i.bpmCard.id, status: i.bpmCard.status, pipelineNome: i.bpmCard.pipeline.nome, etapaNome: i.bpmCard.etapa.nome }
        : null,
      contrato: servicoMaisRecentePorCliente.get(i.cliente.id) ?? null,
    })),
  };
}
