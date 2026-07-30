import type { TransacaoParaExportar } from "./exportar-excel";

function normalizarIdentificador(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function escaparRazaoSocialParaRegex(razaoSocial: string): string {
  const classesAcentos: Record<string, string> = {
    a: "[aáàâãä]",
    e: "[eéèêë]",
    i: "[iíìîï]",
    o: "[oóòôõö]",
    u: "[uúùûü]",
    c: "[cç]",
  };

  return Array.from(razaoSocial.trim())
    .map((caractere) => {
      const base = caractere
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (/[\s./_|,;:()[\]{}\-–—]/u.test(caractere)) {
        return "[\\s./_|,;:()[\\]{}\\-–—]+";
      }

      return classesAcentos[base] ?? caractere.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("")
    .replace(/(?:\[\\s\.\/_\|,;:\(\)\[\\\]\{\}\\\-–—\]\+){2,}/g, "[\\s./_|,;:()[\\]{}\\-–—]+");
}

/**
 * No relatório simplificado do Itaú, a razão social não deve disputar espaço
 * com a nomenclatura do lançamento na coluna de descrição.
 */
export function simplificarDescricaoItau(
  descricao: string,
  razaoSocial: string,
  nomeBanco: string,
): string {
  if (normalizarIdentificador(nomeBanco) !== "itau" || !descricao.trim() || !razaoSocial.trim()) {
    return descricao;
  }

  const padraoRazaoSocial = escaparRazaoSocialParaRegex(razaoSocial);
  const semRazaoSocial = descricao
    .replace(new RegExp(padraoRazaoSocial, "giu"), " ")
    .replace(/\s*[-–—|/:;,]+\s*$/u, "")
    .replace(/^\s*[-–—|/:;,]+\s*/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return semRazaoSocial || descricao;
}

export function prepararTransacaoParaRelatorio(
  transacao: TransacaoParaExportar,
  razaoSocial: string,
): TransacaoParaExportar {
  return {
    ...transacao,
    descricao: simplificarDescricaoItau(
      transacao.descricao,
      razaoSocial,
      transacao.nomeBanco,
    ),
  };
}
