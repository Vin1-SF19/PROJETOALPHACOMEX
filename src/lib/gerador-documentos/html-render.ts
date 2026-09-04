/**
 * Renderização de variáveis em HTML — mesma lógica de renderizarConteudo (render.ts)
 * mas opera sobre HTML completo (preserva tags, atributos, estrutura).
 */

import type { VariavelTemplate } from "./schemas";

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const HIGHLIGHT_STYLE_ATTRIBUTE = "data-variable-highlight-styles";
const HIGHLIGHT_STYLES = `<style ${HIGHLIGHT_STYLE_ATTRIBUTE}>
mark[data-var-status] {
  border-radius: 0.2em;
  box-decoration-break: clone;
  color: inherit;
  padding: 0.05em 0.15em;
  -webkit-box-decoration-break: clone;
}
mark[data-var-status="preenchida"] { background-color: #fef08a; }
mark[data-var-status="faltante"] { background-color: #fecaca; }
</style>`;

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (caractere) => {
    const entidades: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entidades[caractere];
  });
}

function valorEstaFaltante(valor: string | number | boolean | null | undefined): boolean {
  return valor === null || valor === undefined || (typeof valor === "string" && valor.trim() === "");
}

function encontrarFimDaTag(html: string, inicio: number): number {
  let aspas: '"' | "'" | null = null;
  for (let indice = inicio + 1; indice < html.length; indice += 1) {
    const caractere = html[indice];
    if (aspas) {
      if (caractere === aspas) aspas = null;
      continue;
    }
    if (caractere === '"' || caractere === "'") {
      aspas = caractere;
      continue;
    }
    if (caractere === ">") return indice + 1;
  }
  return html.length;
}

function injetarEstilosDeHighlight(html: string): string {
  if (html.includes(HIGHLIGHT_STYLE_ATTRIBUTE)) return html;

  const fechamentoHead = html.search(/<\/head\s*>/i);
  if (fechamentoHead >= 0) {
    return `${html.slice(0, fechamentoHead)}${HIGHLIGHT_STYLES}${html.slice(fechamentoHead)}`;
  }

  const aberturaHtml = /<html(?:\s[^>]*)?>/i.exec(html);
  if (aberturaHtml?.index !== undefined) {
    const fimAberturaHtml = aberturaHtml.index + aberturaHtml[0].length;
    return `${html.slice(0, fimAberturaHtml)}<head>${HIGHLIGHT_STYLES}</head>${html.slice(fimAberturaHtml)}`;
  }

  return `${HIGHLIGHT_STYLES}${html}`;
}

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
 * Substitui {{variavel}} em nós de texto pelo valor formatado conforme o tipo.
 * Na revisão, valores preenchidos recebem fundo amarelo e ausentes exibem
 * `[FALTANTE: nome]` com fundo vermelho. O CSS é incorporado ao próprio HTML
 * para funcionar quando o documento é exibido em iframe.
 * Placeholders sem variável correspondente são preservados (nunca apagados).
 * A substituição não altera tags, atributos, scripts ou estilos existentes.
 */
export function renderHtmlComVariaveis(
  html: string,
  variaveisTemplate: VariavelTemplate[],
  valores: Record<string, string | number | boolean | null | undefined>,
): string {
  const porNome = new Map(variaveisTemplate.map((v) => [v.nome, v]));
  const htmlMinusculo = html.toLowerCase();
  let resultado = "";
  let indice = 0;
  let substituiuVariavel = false;

  while (indice < html.length) {
    if (html[indice] === "<") {
      const fimTag = encontrarFimDaTag(html, indice);
      const tag = html.slice(indice, fimTag);
      resultado += tag;
      indice = fimTag;

      const tagEspecial = /^<\s*(script|style)\b/i.exec(tag)?.[1]?.toLowerCase();
      if (tagEspecial && !/^<\s*\//.test(tag)) {
        const inicioFechamento = htmlMinusculo.indexOf(`</${tagEspecial}`, indice);
        if (inicioFechamento < 0) {
          resultado += html.slice(indice);
          indice = html.length;
          continue;
        }
        const fimFechamento = encontrarFimDaTag(html, inicioFechamento);
        resultado += html.slice(indice, fimFechamento);
        indice = fimFechamento;
      }
      continue;
    }

    const proximaTag = html.indexOf("<", indice);
    const fimTexto = proximaTag < 0 ? html.length : proximaTag;
    const texto = html.slice(indice, fimTexto).replace(PLACEHOLDER_REGEX, (match, nome: string) => {
      const definicao = porNome.get(nome);
      if (!definicao) return match;

      substituiuVariavel = true;
      const valor = valores[nome];
      const status = valorEstaFaltante(valor) ? "faltante" : "preenchida";
      const conteudo = status === "faltante" ? `[FALTANTE: ${nome}]` : formatarValor(valor, definicao.tipo);
      return `<mark class="variable-highlight" data-variable="${nome}" data-var-status="${status}">${escaparHtml(conteudo)}</mark>`;
    });
    resultado += texto;
    indice = fimTexto;
  }

  return substituiuVariavel ? injetarEstilosDeHighlight(resultado) : resultado;
}
