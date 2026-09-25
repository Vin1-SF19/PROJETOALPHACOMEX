import { expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({
  carregarValoresCanonicosCampos: vi.fn(async () => ({
    "regime-cliente": "Simples Nacional",
    "regime-prestador": "Lucro Presumido",
    "valor-comercial": "1000",
  })),
}));

import { FINANCIAL_FIELD_KEYS as k } from "@/lib/bpm/pipeline-financeiro";
import { atualizarCalculoNovoContrato } from "@/lib/bpm/novo-contrato-financeiro-server";

it("calcula usando valores globais canônicos e grava os derivados no card", async () => {
  const campos = [
    ["regime-cliente", k.REGIME_CLIENTE],
    ["regime-prestador", k.REGIME_PRESTADOR],
    ["valor-comercial", k.VALOR_NEGOCIADO_ORIGEM],
    ["irrf", k.IRRF_APLICAVEL],
    ["aliquota-irrf", k.ALIQUOTA_IRRF],
    ["csrf", k.CSRF_APLICAVEL],
    ["valor-irrf", k.VALOR_IRRF],
    ["valor-csrf", k.VALOR_CSRF],
    ["retencoes", k.TOTAL_RETENCOES],
    ["liquido", k.VALOR_LIQUIDO],
    ["memoria", k.MEMORIA_CALCULO],
  ].map(([id, chave]) => ({ id, chave, escopo: "GLOBAL", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: "CLIENTE", opcoesJson: null, opcoes: [] }));
  const upsert = vi.fn(async () => ({}));
  const tx = {
    bpmCampo: { findMany: vi.fn(async () => campos) },
    bpmCardCampoValor: {
      findMany: vi.fn(async () => [
        { campoId: "irrf", valor: "Sim" },
        { campoId: "aliquota-irrf", valor: "1,5" },
        { campoId: "csrf", valor: "Não" },
      ]),
      upsert,
    },
  } as unknown as Prisma.TransactionClient;

  await atualizarCalculoNovoContrato(tx, "card-1", "financeiro-1");

  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { cardId_campoId: { cardId: "card-1", campoId: "liquido" } },
    update: { valor: "985" },
  }));
});
