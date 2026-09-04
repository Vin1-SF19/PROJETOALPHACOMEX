import { avaliarFormula, avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import type {
  ContextoAvaliacao,
  GrupoCondicao,
} from "@/lib/bpm/regras/types";
import type { ConfiguracaoTributaria } from "@/lib/bpm/regras-financeiras/schemas";

const VARIAVEIS_FORMULA = {
  valorBruto: "clfinancevalorbruto000001",
  valorIrrf: "clfinancevalorirrf0000001",
  valorCsrf: "clfinancevalorcsrf0000001",
  outrasRetencoes: "clfinanceoutrasret000001",
  totalRetencoes: "clfinancetotalret0000001",
} as const;

export interface RegraTributariaAvaliavel {
  id: string;
  nome: string;
  prioridade: number;
  versao: number;
  condicao: GrupoCondicao;
  configuracao: ConfiguracaoTributaria;
}

export interface RetencaoCalculada {
  codigo: string;
  nome: string;
  baseCalculoCents: number;
  aliquotaPercentual: number | null;
  valorCents: number;
}

export interface CalculoTributarioConfigurado {
  regraId: string;
  regraNome: string;
  regraVersao: number;
  valorBrutoCents: number;
  retencoes: RetencaoCalculada[];
  valorIrrfCents: number;
  valorCsrfCents: number;
  outrasRetencoesCents: number;
  totalRetencoesCents: number;
  valorLiquidoCents: number;
  formulaValorLiquido: string;
  memoriaCalculo: string;
}

function baseDaRetencao(
  valorBrutoCents: number,
  retencoesAnterioresCents: number,
  base: ConfiguracaoTributaria["irrf"]["baseCalculo"],
): number {
  return base === "VALOR_BRUTO"
    ? valorBrutoCents
    : Math.max(0, valorBrutoCents - retencoesAnterioresCents);
}

function valorPercentual(baseCents: number, aliquotaPercentual: number): number {
  return Math.round((baseCents * aliquotaPercentual) / 100);
}

function formulaParaMotor(expressao: string): string {
  let transformada = expressao;
  for (const [nome, campoId] of Object.entries(VARIAVEIS_FORMULA)) {
    transformada = transformada.replace(
      new RegExp(`\\b${nome}\\b`, "g"),
      `{{campo_dinamico:${campoId}}}`,
    );
  }
  return transformada;
}

export function selecionarRegraTributaria(
  regras: readonly RegraTributariaAvaliavel[],
  contexto: ContextoAvaliacao,
): RegraTributariaAvaliavel | null {
  for (const regra of [...regras].sort(
    (a, b) => a.prioridade - b.prioridade || a.id.localeCompare(b.id),
  )) {
    if (avaliarGrupo(regra.condicao, contexto)) return regra;
  }
  return null;
}

export function calcularRegraTributaria(params: {
  regra: RegraTributariaAvaliavel;
  valorBrutoCents: number;
  calculadoEm?: Date;
}): CalculoTributarioConfigurado {
  const valorBrutoCents = Math.round(params.valorBrutoCents);
  if (!Number.isSafeInteger(valorBrutoCents) || valorBrutoCents < 0) {
    throw new Error("VALOR_BRUTO_INVALIDO");
  }

  const retencoes: RetencaoCalculada[] = [];
  let acumulado = 0;
  const adicionarPercentual = (
    codigo: string,
    nome: string,
    retencao: ConfiguracaoTributaria["irrf"],
  ) => {
    if (!retencao.aplicavel) return;
    const baseCalculoCents = baseDaRetencao(
      valorBrutoCents,
      acumulado,
      retencao.baseCalculo,
    );
    const valorCents = Math.min(
      baseCalculoCents,
      valorPercentual(baseCalculoCents, retencao.aliquotaPercentual),
    );
    acumulado += valorCents;
    retencoes.push({
      codigo,
      nome,
      baseCalculoCents,
      aliquotaPercentual: retencao.aliquotaPercentual,
      valorCents,
    });
  };

  adicionarPercentual("IRRF", "IRRF", params.regra.configuracao.irrf);
  adicionarPercentual("CSRF", "CSRF", params.regra.configuracao.csrf);

  for (const [indice, retencao] of params.regra.configuracao.outrasRetencoes.entries()) {
    const baseCalculoCents = baseDaRetencao(
      valorBrutoCents,
      acumulado,
      retencao.baseCalculo,
    );
    const valorCents = Math.min(
      baseCalculoCents,
      retencao.tipo === "FIXO"
        ? (retencao.valorFixoCents ?? 0)
        : valorPercentual(
            baseCalculoCents,
            retencao.aliquotaPercentual ?? 0,
          ),
    );
    acumulado += valorCents;
    retencoes.push({
      codigo: `OUTRA_${indice + 1}`,
      nome: retencao.nome,
      baseCalculoCents,
      aliquotaPercentual:
        retencao.tipo === "PERCENTUAL"
          ? (retencao.aliquotaPercentual ?? 0)
          : null,
      valorCents,
    });
  }

  const valorIrrfCents =
    retencoes.find((retencao) => retencao.codigo === "IRRF")?.valorCents ?? 0;
  const valorCsrfCents =
    retencoes.find((retencao) => retencao.codigo === "CSRF")?.valorCents ?? 0;
  const outrasRetencoesCents = retencoes
    .filter((retencao) => retencao.codigo.startsWith("OUTRA_"))
    .reduce((total, retencao) => total + retencao.valorCents, 0);
  const totalRetencoesCents = retencoes.reduce(
    (total, retencao) => total + retencao.valorCents,
    0,
  );
  const camposDinamicos = {
    [VARIAVEIS_FORMULA.valorBruto]: valorBrutoCents,
    [VARIAVEIS_FORMULA.valorIrrf]: valorIrrfCents,
    [VARIAVEIS_FORMULA.valorCsrf]: valorCsrfCents,
    [VARIAVEIS_FORMULA.outrasRetencoes]: outrasRetencoesCents,
    [VARIAVEIS_FORMULA.totalRetencoes]: totalRetencoesCents,
  };
  const valorLiquidoCents = Math.round(
    avaliarFormula(
      formulaParaMotor(params.regra.configuracao.formulaValorLiquido),
      { card: {}, camposDinamicos },
    ),
  );
  if (!Number.isSafeInteger(valorLiquidoCents) || valorLiquidoCents < 0) {
    throw new Error("VALOR_LIQUIDO_INVALIDO");
  }

  const calculadoEm = params.calculadoEm ?? new Date();
  const memoria = {
    schemaVersion: 1,
    regra: {
      id: params.regra.id,
      nome: params.regra.nome,
      versao: params.regra.versao,
      prioridade: params.regra.prioridade,
    },
    formula: params.regra.configuracao.formulaValorLiquido,
    entradas: { valorBrutoCents },
    retencoes,
    resultados: {
      valorIrrfCents,
      valorCsrfCents,
      outrasRetencoesCents,
      totalRetencoesCents,
      valorLiquidoCents,
    },
    calculadoEm: calculadoEm.toISOString(),
  };

  return {
    regraId: params.regra.id,
    regraNome: params.regra.nome,
    regraVersao: params.regra.versao,
    valorBrutoCents,
    retencoes,
    valorIrrfCents,
    valorCsrfCents,
    outrasRetencoesCents,
    totalRetencoesCents,
    valorLiquidoCents,
    formulaValorLiquido: params.regra.configuracao.formulaValorLiquido,
    memoriaCalculo: JSON.stringify(memoria),
  };
}
