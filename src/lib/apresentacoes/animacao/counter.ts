/**
 * Fase 07 (Alpha Motion) - Counter (Secao 8 do prompt original). Generaliza
 * useCounterValue (Onda 3, RenderBasicos.tsx) - que so formatava inteiro pt-BR - para
 * os 6 tipos completos. formatarValorCounter e logica pura, testavel isoladamente; o
 * componente React continua orquestrando o useMotionValue/animate.
 */

export const TIPO_COUNTER = [
  "count-up",
  "count-down",
  "percent-counter",
  "currency-counter",
  "decimal-counter",
  "compact-number-counter",
] as const;
export type TipoCounter = (typeof TIPO_COUNTER)[number];

export interface ConfigCounter {
  valorInicial: number;
  valorFinal: number;
  casasDecimais?: number;
  prefixo?: string;
  sufixo?: string;
  separadorDecimal?: string;
  separadorMilhar?: string;
}

const MARCADOR_MILHAR = "MARCADOR_MILHAR";
const MARCADOR_DECIMAL = "MARCADOR_DECIMAL";

/**
 * Aplica separadores customizados por cima do resultado de toLocaleString/Intl (sempre
 * pt-BR: ponto como milhar, virgula como decimal), usando marcadores intermediarios de
 * texto para nunca confundir o separador de milhar recem-trocado com o decimal original.
 */
function aplicarSeparadoresCustomizados(texto: string, config: ConfigCounter): string {
  if (config.separadorDecimal === undefined && config.separadorMilhar === undefined) return texto;
  let resultado = texto.split(".").join(MARCADOR_MILHAR).split(",").join(MARCADOR_DECIMAL);
  resultado = resultado.split(MARCADOR_MILHAR).join(config.separadorMilhar ?? ".");
  resultado = resultado.split(MARCADOR_DECIMAL).join(config.separadorDecimal ?? ",");
  return resultado;
}

/**
 * Formata valorAtual (o valor corrente da animacao, entre valorInicial e valorFinal)
 * conforme o tipo. Nunca lanca excecao - valor nao finito cai em zero (Secao 29, fallback seguro).
 */
export function formatarValorCounter(valorAtual: number, tipo: TipoCounter, config: ConfigCounter): string {
  const valor = Number.isFinite(valorAtual) ? valorAtual : 0;
  const casas = config.casasDecimais ?? 0;
  const prefixo = config.prefixo ?? "";
  const sufixoPadrao = config.sufixo ?? "";

  switch (tipo) {
    case "count-up":
    case "count-down": {
      const texto = valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
      return prefixo + aplicarSeparadoresCustomizados(texto, config) + sufixoPadrao;
    }
    case "percent-counter": {
      const texto = valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
      const sufixo = config.sufixo ?? "%";
      return prefixo + aplicarSeparadoresCustomizados(texto, config) + sufixo;
    }
    case "currency-counter": {
      if (config.prefixo) {
        const texto = valor.toLocaleString("pt-BR", { minimumFractionDigits: Math.max(casas, 2), maximumFractionDigits: Math.max(casas, 2) });
        return config.prefixo + aplicarSeparadoresCustomizados(texto, config) + sufixoPadrao;
      }
      const texto = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: Math.max(casas, 2) }).format(valor);
      return aplicarSeparadoresCustomizados(texto, config) + sufixoPadrao;
    }
    case "decimal-counter": {
      const casasEfetivas = casas || 2;
      const texto = valor.toLocaleString("pt-BR", { minimumFractionDigits: casasEfetivas, maximumFractionDigits: casasEfetivas });
      return prefixo + aplicarSeparadoresCustomizados(texto, config) + sufixoPadrao;
    }
    case "compact-number-counter": {
      const texto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: casas || 1 }).format(valor);
      return prefixo + texto + sufixoPadrao;
    }
    default:
      return prefixo + String(valor) + sufixoPadrao;
  }
}
