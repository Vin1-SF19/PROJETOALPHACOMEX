import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import {
  PIPELINE_CHAVE,
  ETAPAS,
  VALORES,
  CHAVE_AUTOMACAO_HANDOFF,
  ACAO_HISTORICO_CONTRATO,
  ACAO_HISTORICO_EXCECAO,
  resolverChavesCampos,
} from "@/lib/bpm/financeiro-config.client";

export {
  PIPELINE_CHAVE,
  PIPELINE_NOME,
  ETAPAS,
  CHAVES_CAMPOS,
  VALORES,
  CHAVE_AUTOMACAO_HANDOFF,
  ACAO_HISTORICO_CONTRATO,
  ACAO_HISTORICO_EXCECAO,
  TIPO_TAREFA_ASSINATURA,
  TIPO_EVENTO_LEMBRETE,
  TIPO_EVENTO_TAREFA,
  REQUISITOS_CONTRATO,
  REQUISITOS_PAGAMENTO,
  resolverChavesCampos,
  resolverValorAssinatura,
  resolverValorSim,
  resolverValorPendente,
  resolverValorConcluido,
  resolverChavePipeline,
  resolverNomePipeline,
  resolverEtapas,
  resolverChaveHandoff,
  avaliarRequisitosFinanceiro,
} from "@/lib/bpm/financeiro-config.client";

export type {
  ChaveEtapaFinanceiro,
  ChaveCampoFinanceiro,
  ValorFinanceiro,
  EntradaRequisitosFinanceiro,
  ResultadoRequisitosFinanceiro,
} from "@/lib/bpm/financeiro-config.client";

export interface ConfigFinanceiro {
  pipeline: {
    chave: string;
    nome: string;
    etapas: ReadonlyArray<string>;
  };
  campos: ReadonlyArray<{
    chave: string;
    nome: string;
  }>;
  valores: {
    assinado: string;
    sim: string;
    nao: string;
    pendente: string;
    concluido: string;
  };
  automacoes: {
    handoffOperacional: string;
  };
  acoesHistorico: {
    contratoConcluido: string;
    excecaoLiberacao: string;
  };
}

export async function carregarConfigFinanceiro(client?: Prisma.TransactionClient): Promise<ConfigFinanceiro> {
  const tx = client ?? db;
  const pipeline = await tx.bpmPipeline.findUnique({
    where: { chave: PIPELINE_CHAVE },
    select: { id: true, chave: true, nome: true, ativo: true },
  });
  if (!pipeline) {
    throw new Error("PIPELINE_NAO_ENCONTRADO:Pipeline financeiro não cadastrado.");
  }
  const etapas = await tx.bpmEtapa.findMany({
    where: { pipelineId: pipeline.id, ativo: true },
    select: { chave: true, ordem: true },
    orderBy: { ordem: "asc" },
  });
  const campos = await tx.bpmCampo.findMany({
    where: { pipelineId: pipeline.id, ativo: true },
    select: { chave: true, nome: true },
    orderBy: { ordem: "asc" },
  });
  return {
    pipeline: {
      chave: pipeline.chave ?? PIPELINE_CHAVE,
      nome: pipeline.nome,
      etapas: etapas.map((etapa) => etapa.chave ?? ""),
    },
    campos: campos.map((campo) => ({ chave: campo.chave ?? "", nome: campo.nome })),
    valores: {
      assinado: VALORES.ASSINADO,
      sim: VALORES.SIM,
      nao: VALORES.NAO,
      pendente: VALORES.PENDENTE,
      concluido: VALORES.CONCLUIDO,
    },
    automacoes: {
      handoffOperacional: CHAVE_AUTOMACAO_HANDOFF,
    },
    acoesHistorico: {
      contratoConcluido: ACAO_HISTORICO_CONTRATO,
      excecaoLiberacao: ACAO_HISTORICO_EXCECAO,
    },
  };
}

export async function validarPipelineFinanceiro(client?: Prisma.TransactionClient): Promise<{ valido: boolean; erros: string[] }> {
  const erros: string[] = [];
  try {
    const config = await carregarConfigFinanceiro(client);
    for (const etapaEsperada of Object.values(ETAPAS)) {
      if (!config.pipeline.etapas.includes(etapaEsperada)) {
        erros.push(`ETAPA_AUSENTE:Etapa "${etapaEsperada}" não encontrada no pipeline financeiro.`);
      }
    }
    for (const chave of resolverChavesCampos()) {
      if (!config.campos.some((campo) => campo.chave === chave)) {
        erros.push(`CAMPO_AUSENTE:Campo "${chave}" não encontrado no pipeline financeiro.`);
      }
    }
  } catch (error) {
    erros.push(error instanceof Error ? error.message : "ERRO_INESPERADO:Erro ao validar pipeline financeiro.");
  }
  return { valido: erros.length === 0, erros };
}
