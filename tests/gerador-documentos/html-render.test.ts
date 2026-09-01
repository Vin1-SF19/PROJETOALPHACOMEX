import { describe, it, expect } from "vitest";
import { renderHtmlComVariaveis } from "@/lib/gerador-documentos/html-render";
import type { VariavelTemplate } from "@/lib/gerador-documentos/schemas";

const variaveis: VariavelTemplate[] = [
  { nome: "nome_cliente", label: "Nome", tipo: "texto", obrigatorio: true },
  { nome: "valor", label: "Valor", tipo: "moeda", obrigatorio: true },
  { nome: "data_vigencia", label: "Data", tipo: "data", obrigatorio: false },
  { nome: "aceite", label: "Aceite", tipo: "booleano", obrigatorio: false },
];

describe("renderHtmlComVariaveis", () => {
  it("substitui variável de texto em HTML com tags", () => {
    const html = `<p>Contratante: <strong>{{nome_cliente}}</strong></p>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { nome_cliente: "Alpha Comex" });
    expect(resultado).toBe(`<p>Contratante: <strong>Alpha Comex</strong></p>`);
  });

  it("substitui variável de moeda formatada", () => {
    const html = `<span>Valor: {{valor}}</span>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { valor: 1500.5 });
    expect(resultado).toContain("1.500,50");
    expect(resultado).toContain("R$");
  });

  it("substitui variável de data em formato pt-BR", () => {
    const html = `<p>Válido até: {{data_vigencia}}</p>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { data_vigencia: "2026-12-25" });
    expect(resultado).toBe(`<p>Válido até: 25/12/2026</p>`);
  });

  it("substitui variável booleana", () => {
    const html = `<p>Aceite: {{aceite}}</p>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { aceite: true });
    expect(resultado).toBe(`<p>Aceite: Sim</p>`);
  });

  it("preserva placeholder desconhecido", () => {
    const html = `<p>Desconhecido: {{nao_existe}}</p>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, {});
    expect(resultado).toBe(`<p>Desconhecido: {{nao_existe}}</p>`);
  });

  it("preserva estrutura HTML com tabelas e múltiplas variáveis", () => {
    const html = `<table><tr><td>{{nome_cliente}}</td><td>{{valor}}</td></tr></table>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, {
      nome_cliente: "Teste",
      valor: 100,
    });
    expect(resultado).toContain(`<td>Teste</td>`);
    expect(resultado).toContain("100,00");
    expect(resultado).toContain("<table>");
    expect(resultado).toContain("</table>");
  });

  it("substitui múltiplas ocorrências da mesma variável", () => {
    const html = `<p>{{nome_cliente}} e {{nome_cliente}}</p>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { nome_cliente: "X" });
    expect(resultado).toBe(`<p>X e X</p>`);
  });

  it("valor vazio resulta em string vazia", () => {
    const html = `<p>Valor: {{valor}}</p>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { valor: "" });
    expect(resultado).toBe(`<p>Valor: </p>`);
  });
});
