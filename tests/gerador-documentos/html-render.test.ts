import { describe, it, expect } from "vitest";
import { renderHtmlComVariaveis } from "@/lib/gerador-documentos/html-render";
import type { VariavelTemplate } from "@/lib/gerador-documentos/schemas";

const variaveis: VariavelTemplate[] = [
  { nome: "nome_cliente", label: "Nome", tipo: "texto", obrigatorio: true, placeholder: "" },
  { nome: "valor", label: "Valor", tipo: "moeda", obrigatorio: true, placeholder: "" },
  { nome: "data_vigencia", label: "Data", tipo: "data", obrigatorio: false, placeholder: "" },
  { nome: "aceite", label: "Aceite", tipo: "booleano", obrigatorio: false, placeholder: "" },
];

describe("renderHtmlComVariaveis", () => {
  it("substitui variável de texto em HTML com tags", () => {
    const html = `<p>Contratante: <strong>{{nome_cliente}}</strong></p>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { nome_cliente: "Alpha Comex" });
    expect(resultado).toContain(
      `<strong><mark class="variable-highlight" data-variable="nome_cliente" data-var-status="preenchida">Alpha Comex</mark></strong>`,
    );
    expect(resultado).toContain(`mark[data-var-status="preenchida"] { background-color: #fef08a; }`);
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
    expect(resultado).toContain(`data-variable="data_vigencia" data-var-status="preenchida">25/12/2026</mark>`);
  });

  it("substitui variável booleana", () => {
    const html = `<p>Aceite: {{aceite}}</p>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { aceite: true });
    expect(resultado).toContain(`data-variable="aceite" data-var-status="preenchida">Sim</mark>`);
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
    expect(resultado).toContain(`<td><mark class="variable-highlight"`);
    expect(resultado).toContain(`>Teste</mark></td>`);
    expect(resultado).toContain("100,00");
    expect(resultado).toContain("<table>");
    expect(resultado).toContain("</table>");
  });

  it("substitui múltiplas ocorrências da mesma variável", () => {
    const html = `<p>{{nome_cliente}} e {{nome_cliente}}</p>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { nome_cliente: "X" });
    expect(resultado.match(/data-variable="nome_cliente"/g)).toHaveLength(2);
    expect(resultado.match(/>X<\/mark>/g)).toHaveLength(2);
  });

  it("marca valor vazio em vermelho e preserva o identificador da variável", () => {
    const html = `<p>Valor: {{valor}}</p>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { valor: "" });
    expect(resultado).toContain(
      `<mark class="variable-highlight" data-variable="valor" data-var-status="faltante">[FALTANTE: valor]</mark>`,
    );
    expect(resultado).toContain(`mark[data-var-status="faltante"] { background-color: #fecaca; }`);
  });

  it("escapa conteúdo fornecido pelo usuário sem alterar tags e atributos do template", () => {
    const html = `<p title="{{nome_cliente}}">Cliente: {{nome_cliente}}</p><script>const x = "{{nome_cliente}}";</script>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, {
      nome_cliente: `<img src=x onerror="alert(1)"> & Cia`,
    });

    expect(resultado).toContain(`title="{{nome_cliente}}"`);
    expect(resultado).toContain(`&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Cia`);
    expect(resultado).toContain(`<script>const x = "{{nome_cliente}}";</script>`);
    expect(resultado).not.toContain(`<img src=x onerror=`);
  });

  it("injeta os estilos dentro do head para consumo no iframe", () => {
    const html = `<!doctype html><html><head><title>Contrato</title></head><body>{{nome_cliente}} / {{valor}}</body></html>`;
    const resultado = renderHtmlComVariaveis(html, variaveis, { nome_cliente: "Alpha", valor: null });
    const marcadorDeEstilo = "data-variable-highlight-styles";

    expect(resultado.indexOf(marcadorDeEstilo)).toBeGreaterThan(resultado.indexOf("<head>"));
    expect(resultado.indexOf(marcadorDeEstilo)).toBeLessThan(resultado.indexOf("</head>"));
    expect(resultado).toContain(`data-var-status="preenchida">Alpha</mark>`);
    expect(resultado).toContain(`data-var-status="faltante">[FALTANTE: valor]</mark>`);
  });
});
