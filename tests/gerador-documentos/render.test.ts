import { describe, expect, it } from "vitest";
import { renderizarConteudo, validarVariaveisObrigatorias } from "@/lib/gerador-documentos/render";
import type { VariavelTemplate } from "@/lib/gerador-documentos/schemas";

const VAR_TEXTO: VariavelTemplate = { nome: "cliente_nome", label: "Cliente", tipo: "texto", obrigatorio: true, placeholder: "" };
const VAR_MOEDA: VariavelTemplate = { nome: "valor", label: "Valor", tipo: "moeda", obrigatorio: true, placeholder: "" };
const VAR_DATA: VariavelTemplate = { nome: "data_inicio", label: "Início", tipo: "data", obrigatorio: false, placeholder: "" };
const VAR_BOOL: VariavelTemplate = { nome: "tem_multa", label: "Tem multa", tipo: "booleano", obrigatorio: false, placeholder: "" };

describe("renderizarConteudo", () => {
  it("substitui placeholder de texto pelo valor bruto", () => {
    const resultado = renderizarConteudo("Contratante: {{cliente_nome}}", [VAR_TEXTO], { cliente_nome: "João da Silva" });
    expect(resultado).toBe("Contratante: João da Silva");
  });

  it("formata moeda em pt-BR", () => {
    const resultado = renderizarConteudo("Valor: {{valor}}", [VAR_MOEDA], { valor: 1500 });
    expect(resultado).toContain("R$");
    expect(resultado).toContain("1.500,00");
  });

  it("formata data em pt-BR a partir de string ISO", () => {
    const resultado = renderizarConteudo("Início: {{data_inicio}}", [VAR_DATA], { data_inicio: "2026-09-01" });
    expect(resultado).toBe("Início: 01/09/2026");
  });

  it("formata booleano como Sim/Não", () => {
    const comMulta = renderizarConteudo("{{tem_multa}}", [VAR_BOOL], { tem_multa: true });
    const semMulta = renderizarConteudo("{{tem_multa}}", [VAR_BOOL], { tem_multa: false });
    expect(comMulta).toBe("Sim");
    expect(semMulta).toBe("Não");
  });

  it("preserva o placeholder quando a variável não existe no template (nunca apaga silenciosamente)", () => {
    const resultado = renderizarConteudo("Texto {{variavel_inexistente}} aqui", [VAR_TEXTO], {});
    expect(resultado).toBe("Texto {{variavel_inexistente}} aqui");
  });

  it("substitui múltiplas ocorrências da mesma variável", () => {
    const resultado = renderizarConteudo("{{cliente_nome}} e {{cliente_nome}} novamente", [VAR_TEXTO], { cliente_nome: "Maria" });
    expect(resultado).toBe("Maria e Maria novamente");
  });

  it("valor ausente vira string vazia, não 'undefined'", () => {
    const resultado = renderizarConteudo("Nome: {{cliente_nome}}.", [VAR_TEXTO], {});
    expect(resultado).toBe("Nome: .");
  });

  it("tolera espaços dentro do placeholder ({{ nome }})", () => {
    const resultado = renderizarConteudo("{{ cliente_nome }}", [VAR_TEXTO], { cliente_nome: "Ana" });
    expect(resultado).toBe("Ana");
  });

  it("valor numérico inválido para moeda preserva o valor original como string", () => {
    const resultado = renderizarConteudo("{{valor}}", [VAR_MOEDA], { valor: "não é número" });
    expect(resultado).toBe("não é número");
  });
});

describe("validarVariaveisObrigatorias", () => {
  it("retorna vazio quando todas as obrigatórias estão preenchidas", () => {
    const faltando = validarVariaveisObrigatorias([VAR_TEXTO, VAR_MOEDA], { cliente_nome: "X", valor: 100 });
    expect(faltando).toEqual([]);
  });

  it("lista variáveis obrigatórias ausentes", () => {
    const faltando = validarVariaveisObrigatorias([VAR_TEXTO, VAR_MOEDA], { cliente_nome: "X" });
    expect(faltando).toEqual(["valor"]);
  });

  it("trata string vazia como ausente para campo obrigatório", () => {
    const faltando = validarVariaveisObrigatorias([VAR_TEXTO], { cliente_nome: "" });
    expect(faltando).toEqual(["cliente_nome"]);
  });

  it("nunca reporta variável opcional como faltando", () => {
    const faltando = validarVariaveisObrigatorias([VAR_DATA], {});
    expect(faltando).toEqual([]);
  });

  it("booleano false não conta como ausente (false é um valor válido, distinto de vazio)", () => {
    const varBoolObrigatoria: VariavelTemplate = { ...VAR_BOOL, obrigatorio: true };
    const faltando = validarVariaveisObrigatorias([varBoolObrigatoria], { tem_multa: false });
    expect(faltando).toEqual([]);
  });
});
