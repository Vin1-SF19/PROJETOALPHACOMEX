import { describe, expect, it } from "vitest";
import {
  LIMITES_REGRAS, avaliarCondicao, avaliarFormula, avaliarGrupo, avaliarRegra,
  avaliarRegras, campoReferenciaSchema, fixtureCliSchema, regraBpmSchema, type CondicaoFolha,
  type ContextoAvaliacao, type GrupoCondicao, type RegraBpm, type ResultadoRegra,
  type TabelaDecisao,
} from "@/lib/bpm/regras";

const status = { fonte: "card", campo: "status" } as const;
const servico = { fonte: "card", campo: "servico" } as const;
const criadoEm = { fonte: "card", campo: "createdAt" } as const;
const valorContrato = { fonte: "contratacao", campo: "valorContrato" } as const;
const contexto: ContextoAvaliacao = {
  card: { status: "ATIVO", servico: "Consultoria fiscal", createdAt: "2026-09-04T12:00:00-03:00", proximoContatoEm: null },
  cliente: { uf: "SP", status: "ATIVO" },
  processo: { origemMovimentacao: "MANUAL" },
  contratacao: { valorContrato: "100.50", nps: 9 },
  relacionada: { "tarefas.quantidade": 2 },
};
function condicao(campo: CondicaoFolha["campo"], operador: CondicaoFolha["operador"], valor?: unknown, tipoEsperado?: CondicaoFolha["tipoEsperado"]): CondicaoFolha {
  return { tipo: "condicao", campo, operador, ...(valor === undefined ? {} : { valor }), ...(tipoEsperado ? { tipoEsperado } : {}) };
}
function regra(resultado: ResultadoRegra, folha = condicao(status, "igual", "ATIVO"), overrides: Partial<RegraBpm> = {}): RegraBpm {
  return { id: "regra-1", versao: 1, nome: "Regra teste", ativa: true, prioridade: 0, condicao: { operador: "AND", condicoes: [folha] }, resultado, ...overrides };
}

describe("operadores e coerção explícita", () => {
  it.each([
    [condicao(status, "igual", "ATIVO"), true], [condicao(status, "diferente", "INATIVO"), true],
    [condicao(valorContrato, "maior", 100, "numero"), true], [condicao(valorContrato, "menor", 101, "numero"), true],
    [condicao(valorContrato, "maiorOuIgual", 100.5, "numero"), true], [condicao(valorContrato, "menorOuIgual", 100.5, "numero"), true],
    [condicao(servico, "preenchido"), true], [condicao({ fonte: "card", campo: "proximoContatoEm" }, "vazio"), true],
    [condicao(servico, "contem", "FISCAL"), true], [condicao(servico, "naoContem", "contábil"), true],
    [condicao(status, "estaEm", ["ATIVO", "PENDENTE"]), true], [condicao(status, "naoEstaEm", ["CANCELADO"]), true],
    [condicao(criadoEm, "dataAntes", "2026-09-05T00:00:00Z"), true], [condicao(criadoEm, "dataDepois", "2026-09-04T00:00:00Z"), true],
  ])("avalia %#", (entrada, esperado) => expect(avaliarCondicao(entrada, contexto)).toBe(esperado));

  it("trata campo inexistente como erro e tipos incompatíveis como bloqueio seguro", () => {
    const ausente = regra({ tipo: "bloqueio_movimentacao", mensagem: "não" }, condicao({ fonte: "card", campo: "concluidoEm" }, "igual", "x"));
    expect(avaliarRegra(ausente, contexto)).toMatchObject({ permitida: false, erros: [{ codigo: "CAMPO_INEXISTENTE" }] });
    expect(avaliarRegra(regra({ tipo: "bloqueio_movimentacao", mensagem: "não" }, condicao(status, "maior", 1, "numero")), contexto)).toMatchObject({ permitida: false, erros: [{ codigo: "TIPO_INCOMPATIVEL" }] });
  });

  it("aceita datas apenas com dia UTC determinístico ou datetime com timezone", () => {
    expect(avaliarCondicao(condicao(criadoEm, "dataDepois", "2026-09-04"), contexto)).toBe(true);
    expect(avaliarRegra(regra({ tipo: "bloqueio_movimentacao", mensagem: "não" }, condicao(criadoEm, "dataDepois", "09/04/2026")), contexto)).toMatchObject({ permitida: false, erros: [{ codigo: "TIPO_INCOMPATIVEL" }] });
  });
});

describe("árvores e resultados", () => {
  it("preserva precedência explícita de grupos AND/OR aninhados", () => {
    const grupo: GrupoCondicao = { operador: "AND", condicoes: [condicao(status, "igual", "ATIVO"), { operador: "OR", condicoes: [condicao(servico, "igual", "Outro"), condicao(servico, "contem", "fiscal")] }] };
    expect(avaliarGrupo(grupo, contexto)).toBe(true);
  });

  it("bloqueia somente os campos obrigatórios que estão vazios", () => {
    const resultado = avaliarRegra(regra({ tipo: "campo_obrigatorio", campos: [servico, { fonte: "card", campo: "proximoContatoEm" }] }), contexto);
    expect(resultado).toMatchObject({ permitida: false, aplicada: true, obrigatorios: [{ campo: "proximoContatoEm" }] });
  });

  it("produz bloqueio, mensagem, cálculo e resultado condicional tipados", () => {
    expect(avaliarRegra(regra({ tipo: "bloqueio_movimentacao", mensagem: "Bloqueado" }), contexto)).toMatchObject({ permitida: false, motivo: "Bloqueado" });
    expect(avaliarRegra(regra({ tipo: "mensagem_validacao", mensagem: "Revise" }), contexto)).toMatchObject({ permitida: false, mensagens: ["Revise"] });
    expect(avaliarRegra(regra({ tipo: "calculo", operacao: "soma", operandos: [valorContrato, { fonte: "contratacao", campo: "nps" }], campoDestino: valorContrato }), contexto).calculos).toEqual({ "contratacao:valorContrato": 109.5 });
    expect(avaliarRegra(regra({ tipo: "resultado_condicional", valor: "APROVADO", campoDestino: status }), contexto).resultados).toEqual({ "card:status": "APROVADO" });
  });

  it("avalia fórmula estruturada com precedência, sem resolução ambígua", () => {
    expect(avaliarFormula("({{contratacao:valorContrato}} + {{contratacao:nps}}) * 2", contexto)).toBe(219);
    expect(() => avaliarFormula("process.env.SECRET + 1", contexto)).toThrowError(/Caractere inválido/);
  });

  it("usa a primeira linha correspondente da tabela de decisão e o padrão", () => {
    const tabela: TabelaDecisao = { linhas: [{ condicao: { operador: "AND", condicoes: [condicao({ fonte: "cliente", campo: "uf" }, "igual", "SP")] }, resultado: "SUDESTE" }], padrao: "OUTRO" };
    expect(avaliarRegra(regra({ tipo: "tabela_decisao", tabela, campoDestino: status }), contexto).resultados).toEqual({ "card:status": "SUDESTE" });
  });

  it("ordena múltiplas regras de forma determinística e para no primeiro bloqueio", () => {
    const alta = regra({ tipo: "bloqueio_movimentacao", mensagem: "prioridade" }, undefined, { id: "b", prioridade: 1 });
    const baixa = regra({ tipo: "bloqueio_movimentacao", mensagem: "depois" }, undefined, { id: "a", prioridade: 2 });
    expect(avaliarRegras([baixa, alta], contexto).motivo).toBe("prioridade");
  });
});

describe("schemas, limites e CLI", () => {
  it("rejeita propriedade fixa fora da allowlist e aceita id dinâmico estruturado", () => {
    expect(campoReferenciaSchema.safeParse({ fonte: "card", campo: "constructor" }).success).toBe(false);
    expect(campoReferenciaSchema.safeParse({ fonte: "campo_dinamico", campo: "cmf12345678901234567890123" }).success).toBe(true);
  });

  it("rejeita lista, profundidade, quantidade, tabela e fórmula acima dos limites", () => {
    expect(regraBpmSchema.safeParse(regra({ tipo: "bloqueio_movimentacao", mensagem: "x" }, condicao(status, "estaEm", Array(LIMITES_REGRAS.listaMaxima + 1).fill("x")))).success).toBe(false);
    const profunda = (nivel: number): RegraBpm["condicao"] => nivel === 0 ? { operador: "AND", condicoes: [condicao(status, "igual", "ATIVO")] } : { operador: "AND", condicoes: [profunda(nivel - 1)] };
    expect(regraBpmSchema.safeParse({ ...regra({ tipo: "bloqueio_movimentacao", mensagem: "x" }), condicao: profunda(LIMITES_REGRAS.profundidadeMaxima + 1) }).success).toBe(false);
    expect(avaliarRegra({ ...regra({ tipo: "bloqueio_movimentacao", mensagem: "x" }), condicao: { operador: "AND", condicoes: Array(LIMITES_REGRAS.condicoesMaximas + 1).fill(condicao(status, "igual", "ATIVO")) } }, contexto)).toMatchObject({ permitida: false });
    expect(avaliarRegra(regra({ tipo: "formula_segura", expressao: "1+".repeat(201) + "1", campoDestino: valorContrato }), contexto)).toMatchObject({ permitida: false, erros: [{ codigo: "FORMULA_EXCEDIDA" }] });
  });

  it("valida o contrato de fixture consumido pelo harness", () => {
    const fixture = fixtureCliSchema.parse({ contexto, regra: regra({ tipo: "bloqueio_movimentacao", mensagem: "Sem avanço" }) });
    expect(avaliarRegra(fixture.regra, fixture.contexto)).toMatchObject({ permitida: false, motivo: "Sem avanço" });
  });
});
