import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({
  carregarValoresCanonicosCampos: vi.fn(async () => ({})),
}));

import { copiarCamposCardVinculado } from "@/lib/bpm/copiar-campos-card-vinculado";

describe("cópia de valores do card comercial para o Financeiro", () => {
  const findManyCampos = vi.fn();
  const findManyValores = vi.fn();
  const upsert = vi.fn();
  const tx = {
    bpmCampo: { findMany: findManyCampos },
    bpmCardCampoValor: { findMany: findManyValores, upsert },
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    vi.clearAllMocks();
    findManyCampos
      .mockResolvedValueOnce([
        { id: "valor-compartilhado", mapeamentoDestino: null },
        { id: "destino-mapeado", mapeamentoDestino: { ativo: true, modo: "COPIAR", campoOrigemId: "origem" } },
        { id: "sem-origem", mapeamentoDestino: null },
      ])
      .mockResolvedValueOnce([
        { id: "valor-compartilhado", escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null },
        { id: "origem", escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null },
      ]);
    findManyValores.mockResolvedValue([
      { campoId: "valor-compartilhado", valor: "1000" },
      { campoId: "origem", valor: "PIX" },
    ]);
    upsert.mockResolvedValue({});
  });

  it("copia campos compartilhados e mapeados sem sobrescrever edições no destino", async () => {
    const total = await copiarCamposCardVinculado(tx, "card-comercial", "card-financeiro", "pipeline-financeiro", "novo-contrato");
    expect(total).toBe(2);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { cardId_campoId: { cardId: "card-financeiro", campoId: "destino-mapeado" } },
      create: { cardId: "card-financeiro", campoId: "destino-mapeado", valor: "PIX" },
      update: {},
    }));
  });
});
