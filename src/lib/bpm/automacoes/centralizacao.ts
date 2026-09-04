import type { Prisma } from "@prisma/client";

import { gatilhoConfigSchema, validarGrafoAutomacao } from "@/lib/bpm/automacoes/central-schemas";
import type { AcaoAutomacaoBpm } from "@/lib/bpm/automacoes/schemas";

type ClienteVersao = Pick<
  Prisma.TransactionClient,
  "bpmAutomacaoVersao" | "bpmAutomacaoAgenda"
>;

type DefinicaoSimples = {
  id: string;
  etapaId: string;
  gatilhoTipo: string;
  tempoMinutos: number | null;
  acaoTipo: string;
  parametrosJson: string;
  criadoPorId: number;
};

export function converterDefinicaoSimplesParaVersaoCentral(automacao: DefinicaoSimples) {
  const gatilhoTipo = automacao.gatilhoTipo === "TEMPO_NA_COLUNA"
    ? "TEMPO_NA_ETAPA_ATINGIDO"
    : automacao.gatilhoTipo;
  const gatilhoConfig = gatilhoConfigSchema.parse({
    escopo: "ETAPAS",
    etapaId: automacao.etapaId,
    etapasIds: [automacao.etapaId],
    ...(automacao.gatilhoTipo === "TEMPO_NA_COLUNA"
      ? { minutos: automacao.tempoMinutos ?? 60 }
      : {}),
  });
  const parametros = JSON.parse(automacao.parametrosJson) as Record<string, unknown>;
  const grafo = validarGrafoAutomacao({
    inicioId: "acao-1",
    nos: [
      {
        id: "acao-1",
        tipo: "ACAO",
        acaoTipo: automacao.acaoTipo as AcaoAutomacaoBpm,
        parametros,
        proximoId: "fim",
      },
      { id: "fim", tipo: "FIM" },
    ],
  });
  return { gatilhoTipo, gatilhoConfig, grafo };
}

/**
 * Publica uma nova versão ativa para a identidade estável da automação.
 * A versão anterior permanece arquivada para auditoria e nunca disputa o
 * mesmo evento com a nova versão.
 */
export async function publicarVersaoCentralDaDefinicaoSimples(
  client: ClienteVersao,
  automacao: DefinicaoSimples,
) {
  const convertida = converterDefinicaoSimplesParaVersaoCentral(automacao);
  const ultima = await client.bpmAutomacaoVersao.aggregate({
    where: { automacaoId: automacao.id },
    _max: { versao: true },
  });
  const agora = new Date();
  await client.bpmAutomacaoVersao.updateMany({
    where: { automacaoId: automacao.id, status: "ATIVA" },
    data: { status: "ARQUIVADA", arquivadaEm: agora },
  });
  await client.bpmAutomacaoAgenda.updateMany({
    where: { automacaoVersao: { automacaoId: automacao.id }, ativo: true },
    data: { ativo: false },
  });
  return client.bpmAutomacaoVersao.create({
    data: {
      automacaoId: automacao.id,
      versao: (ultima._max.versao ?? 0) + 1,
      status: "ATIVA",
      gatilhoTipo: convertida.gatilhoTipo,
      gatilhoConfigJson: JSON.stringify(convertida.gatilhoConfig),
      condicaoJson: null,
      grafoJson: JSON.stringify(convertida.grafo),
      timezone: "America/Sao_Paulo",
      criadoPorId: automacao.criadoPorId,
      ativadaEm: agora,
    },
  });
}
