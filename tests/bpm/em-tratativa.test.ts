import { describe, expect, it } from "vitest";

import {
  ID_PERGUNTA_ANOTACOES_ULTIMO_FOLLOW_UP,
  montarSnapshotPerguntasFollowUp,
  obterErroChecklistParaSaidaEmTratativa,
  obterErroProximoContatoParaEntrada,
  obterEstadoFollowUp,
  validarRespostasFollowUp,
} from "@/lib/bpm/em-tratativa";
import {
  atualizarCardSchema,
  salvarChecklistFollowUpSchema,
  salvarRequisitosEMoverCardSchema,
} from "@/lib/validations/bpm";

const CUID_CARD = "clz123456789012345678901";
const CUID_ETAPA = "clz223456789012345678901";
const CUID_CAMPO = "clz323456789012345678901";

describe("Próximo Contato e movimento em Em Tratativa", () => {
  it("normaliza o nome da etapa e exige Próximo Contato na entrada", () => {
    expect(obterErroProximoContatoParaEntrada({
      etapaDestinoNome: "  EM TRATATIVA ",
      proximoContatoEm: null,
    })).toContain("Próximo Contato");
    expect(obterErroProximoContatoParaEntrada({
      etapaDestinoNome: "Sem viabilidade",
      proximoContatoEm: new Date("2026-08-20T15:00:00.000Z"),
    })).toBeNull();
    expect(obterErroProximoContatoParaEntrada({
      etapaDestinoNome: "Fechado",
      proximoContatoEm: null,
    })).toBeNull();
  });

  it("bloqueia somente a saída com o último follow-up iniciado e incompleto", () => {
    expect(obterErroChecklistParaSaidaEmTratativa({
      etapaOrigemNome: "Em tratativa",
      ultimoChecklist: { completo: false },
    })).toContain("conclua");
    expect(obterErroChecklistParaSaidaEmTratativa({
      etapaOrigemNome: "Em Tratativa",
      ultimoChecklist: { completo: true },
    })).toBeNull();
    expect(obterErroChecklistParaSaidaEmTratativa({
      etapaOrigemNome: "Em Tratativa",
      ultimoChecklist: null,
    })).toBeNull();
  });

  it("aceita criar, alterar e limpar Próximo Contato no schema", () => {
    expect(atualizarCardSchema.parse({
      cardId: CUID_CARD,
      proximoContatoEm: "2026-08-20T15:00:00.000Z",
    }).proximoContatoEm).toBeInstanceOf(Date);
    expect(atualizarCardSchema.parse({
      cardId: CUID_CARD,
      proximoContatoEm: "",
    }).proximoContatoEm).toBeNull();
    expect(atualizarCardSchema.parse({
      cardId: CUID_CARD,
      proximoContatoEm: null,
    }).proximoContatoEm).toBeNull();
  });

  it("valida o payload atômico de requisitos e movimento", () => {
    const resultado = salvarRequisitosEMoverCardSchema.parse({
      cardId: CUID_CARD,
      etapaDestinoId: CUID_ETAPA,
      camposValores: { [CUID_CAMPO]: "  preenchido  " },
      proximoContatoEm: "2026-08-20T15:00:00.000Z",
    });
    expect(resultado.camposValores[CUID_CAMPO]).toBe("  preenchido  ");
    expect(resultado.proximoContatoEm).toBeInstanceOf(Date);
  });
});

describe("checklist operacional do último follow-up", () => {
  it("sempre inclui anotações obrigatórias e soma o catálogo ativo", () => {
    const perguntas = montarSnapshotPerguntasFollowUp([
      {
        id: CUID_CAMPO,
        pergunta: "Cliente confirmou interesse?",
        tipo: "booleano",
        opcoesJson: null,
        obrigatoria: true,
        ordem: 10,
      },
    ]);
    expect(perguntas).toHaveLength(2);
    expect(perguntas[0]).toMatchObject({
      id: ID_PERGUNTA_ANOTACOES_ULTIMO_FOLLOW_UP,
      tipo: "texto",
      obrigatoria: true,
    });
    expect(perguntas[1].pergunta).toBe("Cliente confirmou interesse?");
  });

  it("deduplica uma pergunta configurada equivalente à anotação obrigatória", () => {
    const perguntas = montarSnapshotPerguntasFollowUp([
      {
        id: CUID_CAMPO,
        pergunta: "ANOTAÇÕES SOBRE O ÚLTIMO FOLLOW-UP",
        tipo: "texto",
        opcoesJson: null,
        obrigatoria: false,
        ordem: 1,
      },
    ]);
    expect(perguntas).toHaveLength(1);
    expect(perguntas[0].obrigatoria).toBe(true);
  });

  it("não conclui com obrigatório vazio e valida seleção contra o snapshot", () => {
    const perguntas = montarSnapshotPerguntasFollowUp([
      {
        id: CUID_CAMPO,
        pergunta: "Resultado",
        tipo: "selecao",
        opcoesJson: JSON.stringify(["Retornar", "Sem interesse"]),
        obrigatoria: true,
        ordem: 1,
      },
    ]);
    expect(validarRespostasFollowUp(perguntas, {
      [ID_PERGUNTA_ANOTACOES_ULTIMO_FOLLOW_UP]: "   ",
      [CUID_CAMPO]: "Retornar",
    }).pendencias).toEqual(["Anotações sobre o último follow-up"]);
    expect(() => validarRespostasFollowUp(perguntas, {
      [ID_PERGUNTA_ANOTACOES_ULTIMO_FOLLOW_UP]: "Falamos com o cliente",
      [CUID_CAMPO]: "Opção adulterada",
    })).toThrow("opção válida");
  });

  it("distingue não iniciado, em andamento e concluído", () => {
    expect(obterEstadoFollowUp(null)).toBe("NAO_INICIADO");
    expect(obterEstadoFollowUp({ completo: false })).toBe("EM_ANDAMENTO");
    expect(obterEstadoFollowUp({ completo: true })).toBe("CONCLUIDO");
  });

  it("aceita respostas tipadas e limita chaves no contrato da action", () => {
    expect(salvarChecklistFollowUpSchema.safeParse({
      cardId: CUID_CARD,
      respostas: {
        [ID_PERGUNTA_ANOTACOES_ULTIMO_FOLLOW_UP]: "Resumo",
        [CUID_CAMPO]: true,
      },
      concluir: true,
    }).success).toBe(true);
    expect(salvarChecklistFollowUpSchema.safeParse({
      cardId: CUID_CARD,
      respostas: { "": "inválido" },
      concluir: false,
    }).success).toBe(false);
  });
});
