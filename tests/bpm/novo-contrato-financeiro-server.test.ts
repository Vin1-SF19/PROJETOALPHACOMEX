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
import { atualizarCalculoNovoContrato, atualizarElaboracaoContrato } from "@/lib/bpm/novo-contrato-financeiro-server";

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

it("registra elaboração, envio, status e acompanhamento uma vez no salvamento", async () => {
  const values = new Map<string, string>([
    [k.CNPJ, "11222333000181"], [k.RAZAO_SOCIAL, "Cliente Teste"], [k.RUA, "Rua A"],
    [k.NUMERO, "1"], [k.BAIRRO, "Centro"], [k.CEP, "01310100"],
    [k.MUNICIPIO, "São Paulo"], [k.ESTADO, "SP"], [k.EMAIL, "a@teste.com"],
    [k.REGIME_CLIENTE, "Simples Nacional"], [k.SERVICO, "Consultoria"],
    [k.VALOR_BRUTO, "1000"], [k.FORMA_PAGAMENTO, "PIX"], [k.CONDICAO, "À vista"],
    [k.CONTRATO_ELABORADO, "Sim"], [k.CONTRATO_ENVIADO, "Sim"],
    [k.LINK_CONTRATO, "https://example.test/contrato"],
  ]);
  const campos = [...values.keys(), k.DATA_ELABORACAO, k.DATA_ENVIO, k.STATUS_ASSINATURA]
    .map((chave) => ({ id: chave, nome: chave, chave, escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null }));
  const upsert = vi.fn(async () => ({}));
  const tarefa = vi.fn(async () => ({}));
  const historico = vi.fn(async () => ({}));
  const tx = {
    bpmCampo: { findMany: vi.fn(async () => campos) },
    bpmCardCampoValor: { findMany: vi.fn(async () => [...values].map(([campoId, valor]) => ({ campoId, valor }))), upsert },
    bpmCard: { findUnique: vi.fn(async () => ({ responsavelId: 1 })) },
    bpmCardAnexo: { findMany: vi.fn(async () => []) },
    bpmTarefa: { findFirst: vi.fn(async () => null), create: tarefa },
    bpmCardHistorico: { findFirst: vi.fn(async () => null), create: historico },
  } as unknown as Prisma.TransactionClient;

  await atualizarElaboracaoContrato(tx, "card-1", "financeiro-1", [k.CONTRATO_ENVIADO]);

  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { cardId_campoId: { cardId: "card-1", campoId: k.STATUS_ASSINATURA } },
    update: { valor: "Aguardando assinatura" },
  }));
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { cardId_campoId: { cardId: "card-1", campoId: k.DATA_ENVIO } },
  }));
  expect(tarefa).toHaveBeenCalledTimes(1);
  expect(historico).toHaveBeenCalledTimes(1);
  expect(historico).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ acao: "CONTRATO_ENVIADO_ASSINATURA" }) }));
});
