import { describe, expect, it } from "vitest";
import {
  ERRO_PROXIMO_CONTATO_ATRASADO,
  ERRO_PROXIMO_CONTATO_OBRIGATORIO,
  obterErroProximoContatoParaMovimento,
  pipelineEhRevisaoRadar,
} from "@/lib/bpm/proximo-contato";

const AGORA = new Date("2026-08-20T15:00:00.000Z");

describe("próximo contato na movimentação do card", () => {
  it("limita a regra ao pipeline Revisão de Radar", () => {
    expect(pipelineEhRevisaoRadar("Revisão de Radar")).toBe(true);
    expect(pipelineEhRevisaoRadar("Financeiro")).toBe(false);
  });
  it("bloqueia campo ausente", () => {
    expect(obterErroProximoContatoParaMovimento(null, AGORA)).toBe(ERRO_PROXIMO_CONTATO_OBRIGATORIO);
  });

  it("bloqueia data anterior ao dia civil de São Paulo", () => {
    expect(obterErroProximoContatoParaMovimento("2026-08-19T12:00:00-03:00", AGORA)).toBe(ERRO_PROXIMO_CONTATO_ATRASADO);
  });

  it("permite hoje e uma data futura", () => {
    expect(obterErroProximoContatoParaMovimento("2026-08-20T00:00:00-03:00", AGORA)).toBeNull();
    expect(obterErroProximoContatoParaMovimento("2026-08-21T00:00:00-03:00", AGORA)).toBeNull();
  });
});
