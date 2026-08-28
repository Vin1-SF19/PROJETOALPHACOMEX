import type { VariavelTemplate } from "./schemas";

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function formatarValor(valor: string | number | boolean | null | undefined, tipo: VariavelTemplate["tipo"]): string {
  if (valor === null || valor === undefined || valor === "") return "";
  if (tipo === "moeda") {
    const numero = typeof valor === "number" ? valor : Number(valor);
    if (Number.isNaN(numero)) return String(valor);
    return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (tipo === "data") {
    // "YYYY-MM-DD" (vindo do <input type="date">) é interpretado pelo
    // construtor Date como UTC meia-noite — em fuso negativo (ex: America/Sao_Paulo,
    // UTC-3) isso volta um dia ao formatar com toLocaleDateString. Parse manual
    // dos componentes evita o bug clássico de off-by-one em datas puras (sem hora).
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
    if (isoMatch) {
      const [, ano, mes, dia] = isoMatch;
      return `${dia}/${mes}/${ano}`;
    }
    const data = new Date(String(valor));
    if (Number.isNaN(data.getTime())) return String(valor);
    return data.toLocaleDateString("pt-BR");
  }
  if (tipo === "booleano") return valor ? "Sim" : "Não";
  return String(valor);
}

/**
 * Substitui {{variavel}} pelo valor formatado conforme o tipo declarado no
 * template. Placeholder sem variável correspondente é preservado no texto
 * (nunca apagado silenciosamente) para o autor perceber o erro de digitação.
 */
export function renderizarConteudo(
  conteudo: string,
  variaveisTemplate: VariavelTemplate[],
  valores: Record<string, string | number | boolean | null | undefined>,
): string {
  const porNome = new Map(variaveisTemplate.map((v) => [v.nome, v]));
  return conteudo.replace(PLACEHOLDER_REGEX, (match, nome: string) => {
    const definicao = porNome.get(nome);
    if (!definicao) return match;
    return formatarValor(valores[nome], definicao.tipo);
  });
}

/** Lista os nomes de variáveis obrigatórias ausentes ou vazias em `valores`. */
export function validarVariaveisObrigatorias(
  variaveisTemplate: VariavelTemplate[],
  valores: Record<string, string | number | boolean | null | undefined>,
): string[] {
  return variaveisTemplate
    .filter((v) => v.obrigatorio)
    .filter((v) => valores[v.nome] === null || valores[v.nome] === undefined || valores[v.nome] === "")
    .map((v) => v.nome);
}
