import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  carregarValoresCanonicosCampos,
  salvarValoresGlobaisPersonalizadosCampos,
} from "@/lib/bpm/campos-configuraveis-server";

describe("campos globais personalizados por cliente", () => {
  it("reutiliza o valor do cliente em qualquer card sem criar cópia no card", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const client = {
      bpmCard: { findUnique: vi.fn().mockResolvedValue({
        id: "card-operacional",
        empresaId: 42,
        servico: null,
        tipoProcesso: null,
        status: "ATIVO",
        responsavelId: 7,
        createdAt: new Date("2026-09-04T00:00:00Z"),
        empresa: { id: 42, pessoas: [] },
        indicacaoOrigem: null,
      }) },
      bpmCampo: { findMany: vi.fn().mockResolvedValue([{ id: "radar-pretendido" }]) },
      bpmCampoValorGlobal: {
        findMany: vi.fn().mockResolvedValue([{ campoId: "radar-pretendido", valor: "Limitado" }]),
        upsert,
      },
      contratoComercial: { findFirst: vi.fn() },
      servicosComerciais: { findUnique: vi.fn() },
      businessProcess: { findFirst: vi.fn() },
    };

    const valores = await carregarValoresCanonicosCampos("card-operacional", [{
      id: "radar-pretendido",
      escopo: "GLOBAL",
      fonteEntidade: null,
      fonteAtributo: null,
      entidadeGlobal: "CLIENTE",
    }], client as never);
    expect(valores).toEqual({ "radar-pretendido": "Limitado" });

    const ids = await salvarValoresGlobaisPersonalizadosCampos(
      "card-operacional",
      { "radar-pretendido": "Ilimitado" },
      client as never,
    );
    expect([...ids]).toEqual(["radar-pretendido"]);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { campoId_entidadeTipo_entidadeId: {
        campoId: "radar-pretendido",
        entidadeTipo: "CLIENTE",
        entidadeId: "42",
      } },
      update: { valor: "Ilimitado" },
    }));
  });
});
