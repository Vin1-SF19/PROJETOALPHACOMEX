import { describe, expect, it } from "vitest";

import {
  CARD_KANBAN_NATIVE_KEYS,
  cardKanbanComposicaoSchema,
  composicaoCardKanbanSemAlteracao,
  desserializarComposicaoCardKanban,
  elementoCardKanbanChaveEstavel,
  serializarComposicaoCardKanban,
  type CardKanbanComposicao,
} from "@/lib/bpm/card-kanban";

describe("CRM - registry de composição do card do Kanban (RM-2026-E1E1F7)", () => {
  it("aceita elementos nativos válidos e campos comerciais por campoId", () => {
    const composicao: CardKanbanComposicao = [
      { kind: "NATIVE", key: "EMPRESA_NOME" },
      { kind: "CAMPO", campoId: "campo-123" },
    ];
    expect(cardKanbanComposicaoSchema.safeParse(composicao).success).toBe(true);
  });

  it("rejeita chave nativa desconhecida", () => {
    const composicao = [{ kind: "NATIVE", key: "CAMPO_INEXISTENTE" }];
    expect(cardKanbanComposicaoSchema.safeParse(composicao).success).toBe(false);
  });

  it("rejeita elemento duplicado na composição (mesma identidade estável)", () => {
    const composicao = [
      { kind: "NATIVE", key: "CNPJ" },
      { kind: "NATIVE", key: "CNPJ" },
    ];
    expect(cardKanbanComposicaoSchema.safeParse(composicao).success).toBe(false);
  });

  it("permite o mesmo campoId aparecer apenas uma vez, mas não bloqueia campoIds diferentes", () => {
    const composicao: CardKanbanComposicao = [
      { kind: "CAMPO", campoId: "a" },
      { kind: "CAMPO", campoId: "b" },
    ];
    expect(cardKanbanComposicaoSchema.safeParse(composicao).success).toBe(true);
  });

  it("gera chave estável distinta por tipo e identidade", () => {
    expect(elementoCardKanbanChaveEstavel({ kind: "NATIVE", key: "TELEFONE" })).toBe("native:TELEFONE");
    expect(elementoCardKanbanChaveEstavel({ kind: "CAMPO", campoId: "x1" })).toBe("campo:x1");
  });

  it("distingue ausência de registro (null) de composição explicitamente vazia ([]) — AC-06", () => {
    expect(desserializarComposicaoCardKanban(null)).toBeNull();
    expect(desserializarComposicaoCardKanban(undefined)).toBeNull();
    expect(desserializarComposicaoCardKanban(serializarComposicaoCardKanban([]))).toEqual([]);
  });

  it("faz round-trip de serialização preservando ordem", () => {
    const composicao: CardKanbanComposicao = [
      { kind: "NATIVE", key: "TELEFONE" },
      { kind: "CAMPO", campoId: "campo-radar" },
      { kind: "NATIVE", key: "CNPJ" },
    ];
    const json = serializarComposicaoCardKanban(composicao);
    expect(desserializarComposicaoCardKanban(json)).toEqual(composicao);
  });

  it("trata JSON corrompido como composição vazia, nunca lança", () => {
    expect(desserializarComposicaoCardKanban("{not valid json")).toEqual([]);
  });

  it("detecta no-op apenas quando ordem e identidade são idênticas", () => {
    const anterior: CardKanbanComposicao = [
      { kind: "NATIVE", key: "EMPRESA_NOME" },
      { kind: "CAMPO", campoId: "c1" },
    ];
    const igual: CardKanbanComposicao = [
      { kind: "NATIVE", key: "EMPRESA_NOME" },
      { kind: "CAMPO", campoId: "c1" },
    ];
    const reordenado: CardKanbanComposicao = [
      { kind: "CAMPO", campoId: "c1" },
      { kind: "NATIVE", key: "EMPRESA_NOME" },
    ];
    expect(composicaoCardKanbanSemAlteracao(anterior, igual)).toBe(true);
    expect(composicaoCardKanbanSemAlteracao(anterior, reordenado)).toBe(false);
    expect(composicaoCardKanbanSemAlteracao(anterior, [])).toBe(false);
  });

  it("expõe todos os elementos nativos documentados no plano do Vault e o widget estrutural de reunião", () => {
    expect(new Set(CARD_KANBAN_NATIVE_KEYS)).toEqual(
      new Set([
        "EMPRESA_NOME",
        "CNPJ",
        "NOME_FANTASIA",
        "SERVICO",
        "STATUS_POS_FECHAMENTO",
        "PROXIMO_CONTATO",
        "PROXIMA_TAREFA",
        "ANOTACAO_RAPIDA",
        "TAREFAS",
        "ANEXOS",
        "TELEFONE",
        "CHECKLIST",
        "CADENCIA",
        "PENDENCIAS",
        "AGENDAMENTO_REUNIAO",
      ]),
    );
  });
});
