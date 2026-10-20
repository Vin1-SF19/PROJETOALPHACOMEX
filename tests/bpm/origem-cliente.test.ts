import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { CANAIS_AQUISICAO, ORIGENS_LEAD_PADRAO } from "@/lib/comercial/origens-lead";
import { campoEhOrigemCliente, criarRascunhoOrigem, extrairPayloadOrigem, valorInicialCampo } from "@/lib/bpm/origem-cliente";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import { resolverParceiroOrigem, salvarParceiroOrigem, validarParceiroOrigem } from "@/lib/bpm/origem-cliente-server";

const campo = { id: "origem", nome: "Origem do cliente", tipo: "selecao", opcoesJson: '["Direto","Parceiro","Outro"]' };
const selecao = { campoId: campo.id, parceiroId: 42 };
function mockTx() {
  const mocks = { parceiro: { findUnique: vi.fn().mockResolvedValue({ id: 42, nome: "Parceiro Alpha" }) },
    indicacao: { findUnique: vi.fn().mockResolvedValue({ id: 8, parceiroId: 10, status: "ATIVA" }), update: vi.fn(), create: vi.fn() },
    bpmCardHistorico: { create: vi.fn() } };
  return { mocks, tx: mocks as unknown as Prisma.TransactionClient };
}

describe("origem do cliente CRM", () => {
  it("alinha catálogo, aceita origens novas apesar do catálogo legado e preserva valores antigos", () => {
    expect(CANAIS_AQUISICAO.map((item) => item.value)).toEqual(ORIGENS_LEAD_PADRAO);
    for (const valor of [...ORIGENS_LEAD_PADRAO, "Direto", "Parceiro"]) {
      expect(validarValoresCamposBpm([campo], { origem: valor })).toEqual({ success: true, valores: { origem: valor } });
    }
    expect(validarValoresCamposBpm([campo], { origem: "Inexistente" }).success).toBe(false);
    expect(validarValoresCamposBpm([{ ...campo, nome: "Outro campo" }], { origem: "Discadora" }).success).toBe(false);
  });
  it.each(["Origem do cliente", "ORIGEM DO LEAD", "Canal/origem do cliente", "Canal de origem"])("reconhece %s", (nome) => {
    expect(campoEhOrigemCliente({ nome })).toBe(true);
    expect(campoEhOrigemCliente({ nome: "Origem do contrato" })).toBe(false);
  });
  it("reabre o parceiro, detecta troca só do parceiro e extrai payload mantendo origem texto", () => {
    const inicial = valorInicialCampo({ ...campo, valor: "Indicação Parceiro", parceiroOrigemId: 10 });
    const alterado = criarRascunhoOrigem("Indicação Parceiro", 42);
    expect(alterado).not.toBe(inicial);
    expect(extrairPayloadOrigem({ origem: alterado })).toEqual({ camposValores: { origem: "Indicação Parceiro" }, parceiroOrigem: selecao });
    expect(extrairPayloadOrigem({ origem: criarRascunhoOrigem("Evento", 42) }).parceiroOrigem?.parceiroId).toBeNull();
    expect(() => extrairPayloadOrigem({ origem: criarRascunhoOrigem("Indicação Parceiro", null) })).toThrow("Selecione o parceiro");
  });
  it("validação de parceiro é somente leitura e respeita campo/autorização/origem", async () => {
    const { tx, mocks } = mockTx();
    expect(await validarParceiroOrigem(selecao, [campo], { origem: "Indicação Parceiro" }, tx)).toMatchObject({ id: 42 });
    expect(mocks.indicacao.create).not.toHaveBeenCalled();
    await expect(validarParceiroOrigem(selecao, [{ ...campo, somenteLeitura: true }], { origem: "Indicação Parceiro" }, tx)).rejects.toThrow("não disponível");
    await expect(validarParceiroOrigem(selecao, [], { origem: "Indicação Parceiro" }, tx)).rejects.toThrow("não disponível");
    await expect(validarParceiroOrigem(selecao, [campo], { origem: "Evento" }, tx)).rejects.toThrow("ajuste a origem");
    mocks.parceiro.findUnique.mockResolvedValue(null);
    await expect(validarParceiroOrigem(selecao, [campo], { origem: "Indicação Parceiro" }, tx)).rejects.toThrow("não encontrado");
  });
  it("preserva indicação anterior, vincula nova ao card exato e registra auditoria", async () => {
    const { tx, mocks } = mockTx();
    await salvarParceiroOrigem(selecao, { id: "card", empresaId: 5, servico: "Radar" }, 7, tx);
    expect(mocks.indicacao.update).toHaveBeenCalledWith({ where: { id: 8 }, data: { bpmCardId: null, status: "DESVINCULADA" } });
    expect(mocks.indicacao.create).toHaveBeenCalledWith({ data: { bpmCardId: "card", clienteId: 5, parceiroId: 42, criadoPorId: 7, servicoIndicado: "Radar" } });
    expect(mocks.bpmCardHistorico.create).toHaveBeenCalledOnce();
  });
  it("limpa só vínculo do card ao mudar origem e não duplica indicação ao repetir parceiro", async () => {
    const { tx, mocks } = mockTx();
    await salvarParceiroOrigem({ ...selecao, parceiroId: 10 }, { id: "card", empresaId: 5, servico: null }, 7, tx);
    expect(mocks.indicacao.update).not.toHaveBeenCalled();
    await salvarParceiroOrigem({ ...selecao, parceiroId: null }, { id: "card", empresaId: 5, servico: null }, 7, tx);
    expect(mocks.indicacao.update).toHaveBeenCalledOnce();
    expect(mocks.indicacao.create).not.toHaveBeenCalled();
  });
  it("deriva limpeza e parceiro existente mesmo quando um cliente omite o argumento novo", async () => {
    const { tx, mocks } = mockTx();
    expect(await resolverParceiroOrigem(undefined, [campo], { origem: "Evento" }, "card", tx))
      .toEqual({ campoId: "origem", parceiroId: null });
    expect(await resolverParceiroOrigem(undefined, [campo], { origem: "Indicação Parceiro" }, "card", tx))
      .toEqual({ campoId: "origem", parceiroId: 10 });
    mocks.indicacao.findUnique.mockResolvedValue(null);
    const pendente = await resolverParceiroOrigem(undefined, [campo], { origem: "Indicação Parceiro" }, "card", tx);
    await expect(validarParceiroOrigem(pendente, [campo], { origem: "Indicação Parceiro" }, tx)).rejects.toThrow("Selecione o parceiro");
  });
});
