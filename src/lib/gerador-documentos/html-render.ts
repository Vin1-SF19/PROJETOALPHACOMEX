/**
 * Renderização de variáveis em HTML — mesma lógica de renderizarConteudo (render.ts)
 * mas opera sobre HTML completo (preserva tags, atributos, estrutura).
 */

import type { VariavelTemplate } from "./schemas";

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function formatarValor(
  valor: string | number | boolean | null | undefined,
  tipo: VariavelTemplate["tipo"],
): string {
  if (valor === null || valor === undefined || valor === "") return "";
  if (tipo === "moeda") {
    const numero = typeof valor === "number" ? valor : Number(valor);
    if (Number.isNaN(numero)) return String(valor);
    return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (tipo === "data") {
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
 * Substitui {{variavel}} no HTML pelo valor formatado conforme o tipo.
 * Placeholders sem variável correspondente são preservados (nunca apagados).
 * A substituição é segura para HTML: opera apenas nos placeholders, não nas tags.
 */
export function renderHtmlComVariaveis(
  html: string,
  variaveisTemplate: VariavelTemplate[],
  valores: Record<string, string | number | boolean | null | undefined>,
): string {
  const porNome = new Map(variaveisTemplate.map((v) => [v.nome, v]));
  return html.replace(PLACEHOLDER_REGEX, (match, nome: string) => {
    const definicao = porNome.get(nome);
    if (!definicao) return match;
    return formatarValor(valores[nome], definicao.tipo);
  });
}
