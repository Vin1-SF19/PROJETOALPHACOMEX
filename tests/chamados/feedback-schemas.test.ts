import { describe, expect, it } from "vitest";
import {
  criarChamadoSchema,
  responderFeedbackChamadoSchema,
} from "@/lib/chamados/schemas";

describe("schemas de Chamados", () => {
  it("converte a data civil desejada sem deslocar o dia em São Paulo", () => {
    const resultado = criarChamadoSchema.parse({
      titulo: "Acesso ao sistema",
      categoria: "Acesso",
      prioridade: "MEDIA",
      descricao: "Solicito a liberação do perfil",
      tecnicoSolicitadoId: "9",
      dataDesejadaConclusao: "2026-09-18",
    });

    expect(resultado.tecnicoSolicitadoId).toBe(9);
    expect(resultado.dataDesejadaConclusao?.toISOString()).toBe("2026-09-18T03:00:00.000Z");
  });

  it("aceita preferência e data vazias como nulas", () => {
    const resultado = criarChamadoSchema.parse({
      titulo: "Mouse",
      categoria: "Hardware",
      prioridade: "BAIXA",
      descricao: "Mouse sem funcionamento",
      tecnicoSolicitadoId: "",
      dataDesejadaConclusao: "",
    });

    expect(resultado.tecnicoSolicitadoId).toBeNull();
    expect(resultado.dataDesejadaConclusao).toBeNull();
  });

  it("rejeita dia inexistente", () => {
    const resultado = criarChamadoSchema.safeParse({
      titulo: "Mouse",
      categoria: "Hardware",
      prioridade: "BAIXA",
      descricao: "Mouse sem funcionamento",
      dataDesejadaConclusao: "2026-02-31",
    });

    expect(resultado.success).toBe(false);
  });

  it("rejeita data fora do intervalo sem lançar exceção", () => {
    expect(() => criarChamadoSchema.safeParse({
      titulo: "Mouse",
      categoria: "Hardware",
      prioridade: "BAIXA",
      descricao: "Mouse sem funcionamento",
      dataDesejadaConclusao: "2026-99-99",
    })).not.toThrow();

    expect(criarChamadoSchema.safeParse({
      titulo: "Mouse",
      categoria: "Hardware",
      prioridade: "BAIXA",
      descricao: "Mouse sem funcionamento",
      dataDesejadaConclusao: "2026-99-99",
    }).success).toBe(false);
  });

  it("exige comentário de dez caracteres quando a solução não foi a esperada", () => {
    const resultado = responderFeedbackChamadoSchema.safeParse({
      chamadoId: 10,
      notaRapidezResposta: 4,
      notaPrazoConclusao: 3,
      solucionadaComoEsperado: false,
      comentario: "curto",
    });

    expect(resultado.success).toBe(false);
  });

  it("exige nota de qualidade e recusa comentário na resposta positiva", () => {
    expect(responderFeedbackChamadoSchema.safeParse({
      chamadoId: 10,
      notaRapidezResposta: 4,
      notaPrazoConclusao: 5,
      solucionadaComoEsperado: true,
      notaQualidadeSolucao: 5,
    }).success).toBe(true);

    expect(responderFeedbackChamadoSchema.safeParse({
      chamadoId: 10,
      notaRapidezResposta: 4,
      notaPrazoConclusao: 5,
      solucionadaComoEsperado: true,
      notaQualidadeSolucao: 5,
      comentario: "não deveria existir",
    }).success).toBe(false);
  });

  it.each([null, "", "   "])("não transforma valor vazio (%j) em nota zero", (valor) => {
    const resultado = responderFeedbackChamadoSchema.safeParse({
      chamadoId: 10,
      notaRapidezResposta: valor,
      notaPrazoConclusao: 5,
      solucionadaComoEsperado: true,
      notaQualidadeSolucao: 5,
    });

    expect(resultado.success).toBe(false);
  });

  it("limita o relato negativo a mil caracteres", () => {
    const resultado = responderFeedbackChamadoSchema.safeParse({
      chamadoId: 10,
      notaRapidezResposta: 2,
      notaPrazoConclusao: 1,
      solucionadaComoEsperado: false,
      comentario: "a".repeat(1001),
    });

    expect(resultado.success).toBe(false);
  });

  it("aceita os limites 0 e 5 da escala e o relato mínimo exato", () => {
    const resultado = responderFeedbackChamadoSchema.safeParse({
      chamadoId: 10,
      notaRapidezResposta: 0,
      notaPrazoConclusao: 5,
      solucionadaComoEsperado: false,
      comentario: "0123456789",
    });

    expect(resultado.success).toBe(true);
  });

  it.each([-1, 6, 1.5])("rejeita nota fora da escala inteira: %s", (nota) => {
    const resultado = responderFeedbackChamadoSchema.safeParse({
      chamadoId: 10,
      notaRapidezResposta: nota,
      notaPrazoConclusao: 5,
      solucionadaComoEsperado: true,
      notaQualidadeSolucao: 5,
    });

    expect(resultado.success).toBe(false);
  });
});
