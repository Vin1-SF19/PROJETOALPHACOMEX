import type { Prisma } from "@prisma/client";

import db from "@/lib/prisma";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import type { ContextoAvaliacao } from "@/lib/bpm/regras/types";
import {
  calcularRegraTributaria,
  selecionarRegraTributaria,
  type CalculoTributarioConfigurado,
  type RegraTributariaAvaliavel,
} from "@/lib/bpm/regras-financeiras/motor";
import {
  decodificarConfiguracaoTributaria,
  MARCADOR_REGRA_TRIBUTARIA,
} from "@/lib/bpm/regras-financeiras/schemas";

type ClientePrisma = Prisma.TransactionClient | typeof db;

export interface RegraTributariaPersistida extends RegraTributariaAvaliavel {
  descricao: string | null;
  ativa: boolean;
  pipelineId: string;
  updatedAt: Date;
}

export interface ResultadoRegraTributariaCard {
  calculo: CalculoTributarioConfigurado;
  valoresAutomaticos: Record<string, string>;
}

function reaisParaCents(valor: string | null | undefined): number {
  const texto = valor?.trim();
  if (!texto) return 0;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function centsParaCampo(valorCents: number): string {
  return (valorCents / 100).toFixed(2);
}

export async function carregarRegrasTributarias(
  pipelineId: string,
  client: ClientePrisma = db,
  somenteAtivas = true,
): Promise<RegraTributariaPersistida[]> {
  const linhas = await client.bpmRegra.findMany({
    where: {
      pipelineId,
      ...(somenteAtivas ? { ativa: true } : {}),
      descricao: { startsWith: MARCADOR_REGRA_TRIBUTARIA },
    },
    orderBy: [{ prioridade: "asc" }, { id: "asc" }],
    select: {
      id: true,
      nome: true,
      descricao: true,
      ativa: true,
      prioridade: true,
      pipelineId: true,
      versaoAtualNum: true,
      updatedAt: true,
      versoes: {
        select: {
          versao: true,
          condicaoJson: true,
          resultadoJson: true,
        },
      },
    },
  });

  return linhas.flatMap((linha) => {
    if (!linha.pipelineId) return [];
    const versao = linha.versoes.find(
      (item) => item.versao === linha.versaoAtualNum,
    );
    if (!versao) {
      throw new Error(`REGRA_FINANCEIRA_CONFIGURACAO_INVALIDA:${linha.id}`);
    }
    try {
      const condicao = grupoCondicaoSchema.parse(JSON.parse(versao.condicaoJson));
      const resultado = JSON.parse(versao.resultadoJson) as {
        tipo?: unknown;
        valor?: unknown;
      };
      if (resultado.tipo !== "resultado_condicional") {
        throw new Error("TIPO_RESULTADO_INVALIDO");
      }
      const configuracao = decodificarConfiguracaoTributaria(resultado.valor);
      if (!configuracao) throw new Error("CONFIGURACAO_INVALIDA");
      return [
        {
          id: linha.id,
          nome: linha.nome,
          descricao: linha.descricao,
          ativa: linha.ativa,
          prioridade: linha.prioridade,
          pipelineId: linha.pipelineId,
          versao: versao.versao,
          condicao,
          configuracao,
          updatedAt: linha.updatedAt,
        },
      ];
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("REGRA_FINANCEIRA_CONFIGURACAO_INVALIDA:")) throw error;
      throw new Error(`REGRA_FINANCEIRA_CONFIGURACAO_INVALIDA:${linha.id}`);
    }
  });
}

function contextoFinanceiro(params: {
  card: {
    id: string;
    pipelineId: string;
    etapaId: string;
    responsavelId: number;
    servico: string | null;
    status: string;
  };
  cliente: {
    id: number;
    regimeTributario: string | null;
    cnpj: string | null;
    razaoSocial: string;
    nomeFantasia: string | null;
  };
  campos: Array<{ campoId: string; nome: string; valor: string | null }>;
  valoresPorNome: Record<string, string | null>;
}): ContextoAvaliacao {
  const camposDinamicos = Object.fromEntries(
    params.campos.map((campo) => [
      campo.campoId,
      params.valoresPorNome[campo.nome] ?? campo.valor,
    ]),
  );
  return {
    card: {
      id: params.card.id,
      pipelineId: params.card.pipelineId,
      etapaId: params.card.etapaId,
      responsavelId: params.card.responsavelId,
      servico:
        params.valoresPorNome["Serviço contratado"] ?? params.card.servico,
      status: params.card.status,
    },
    cliente: params.cliente,
    contratacao: {
      servico:
        params.valoresPorNome["Serviço contratado"] ?? params.card.servico,
      formaPagamento: params.valoresPorNome["Forma de pagamento"] ?? null,
      valorContrato: reaisParaCents(
        params.valoresPorNome["Valor bruto do contrato"],
      ),
      closerNome: params.valoresPorNome["Vendedor responsável"] ?? null,
    },
    camposDinamicos,
  };
}

export async function calcularRegraTributariaDoCard(params: {
  cardId: string;
  valoresPorNome?: Record<string, string | null>;
  client?: ClientePrisma;
  calculadoEm?: Date;
}): Promise<ResultadoRegraTributariaCard | null> {
  const client = params.client ?? db;
  const card = await client.bpmCard.findUnique({
    where: { id: params.cardId },
    select: {
      id: true,
      pipelineId: true,
      etapaId: true,
      responsavelId: true,
      servico: true,
      status: true,
      pipeline: { select: { nome: true } },
      empresa: {
        select: {
          id: true,
          regimeTributario: true,
          cnpj: true,
          razaoSocial: true,
          nomeFantasia: true,
        },
      },
      campoValores: {
        select: {
          campoId: true,
          valor: true,
          campo: { select: { nome: true } },
        },
      },
    },
  });
  if (!card || card.pipeline.nome !== "Financeiro") return null;

  const persistidos = Object.fromEntries(
    card.campoValores.map((item) => [item.campo.nome, item.valor]),
  );
  const valoresPorNome = {
    ...persistidos,
    ...(params.valoresPorNome ?? {}),
  };
  const valorBrutoCents = reaisParaCents(
    valoresPorNome["Valor bruto do contrato"],
  );
  if (valorBrutoCents <= 0) return null;

  const regras = await carregarRegrasTributarias(card.pipelineId, client);
  const contexto = contextoFinanceiro({
    card,
    cliente: card.empresa,
    campos: card.campoValores.map((item) => ({
      campoId: item.campoId,
      nome: item.campo.nome,
      valor: item.valor,
    })),
    valoresPorNome,
  });
  const regra = selecionarRegraTributaria(regras, contexto);
  if (!regra) {
    if (regras.length > 0) {
      throw new Error("MOVIMENTO_INVALIDO:Nenhuma regra financeira ativa corresponde ao regime, serviço e condições do card.");
    }
    return null;
  }
  const calculo = calcularRegraTributaria({
    regra,
    valorBrutoCents,
    calculadoEm: params.calculadoEm,
  });

  const irrf = regra.configuracao.irrf;
  const csrf = regra.configuracao.csrf;
  return {
    calculo,
    valoresAutomaticos: {
      "IRRF aplicável": irrf.aplicavel ? "Sim" : "Não",
      "Alíquota IRRF": String(irrf.aliquotaPercentual),
      "Valor IRRF": centsParaCampo(calculo.valorIrrfCents),
      "CSRF aplicável": csrf.aplicavel ? "Sim" : "Não",
      "Alíquota CSRF": String(csrf.aliquotaPercentual),
      "Valor CSRF": centsParaCampo(calculo.valorCsrfCents),
      "Total de retenções": centsParaCampo(calculo.totalRetencoesCents),
      "Valor líquido para pagamento": centsParaCampo(
        calculo.valorLiquidoCents,
      ),
      "Valor esperado": centsParaCampo(calculo.valorLiquidoCents),
      "Memória de cálculo": calculo.memoriaCalculo,
    },
  };
}
