import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const publicar = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "evento-nf" }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: publicar }));

import { exigirNotaFiscalParaConcluirTarefa, sincronizarNotaFiscalCard } from "@/lib/bpm/financeiro-nota-fiscal-server";
import { CHAVES_CAMPOS as K } from "@/lib/bpm/financeiro-config.client";

const campos = [K.NF_EMITIDA, K.NUMERO_NF, K.DATA_EMISSAO_NF, K.VALOR_NF, K.LINK_NF]
  .map((chave, indice) => ({ chave, id: `campo-${indice}` }));
const dados = { emitida: "Sim", numero: "NF-123", dataEmissao: "2026-09-29", valor: "120.50", link: "anexo-nf" };

function cliente(emitida = "Sim", valor = "120.50") {
  const mapa = [emitida, dados.numero, dados.dataEmissao, valor, dados.link];
  const tx = {
    bpmCampo: { findMany: vi.fn().mockResolvedValue(campos) },
    bpmCardCampoValor: { findMany: vi.fn().mockResolvedValue(mapa.map((item, indice) => ({ campoId: `campo-${indice}`, valor: item }))) },
    bpmCardAnexo: { findFirst: vi.fn().mockResolvedValue({ url: "bpm-blob:bpm/nf/arquivo.pdf" }) },
    bpmCardHistorico: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "historico-nf" }),
    },
    bpmTarefa: {
      findMany: vi.fn().mockImplementation(({ where }: { where: { status: string } }) => Promise.resolve(
        where.status === "PENDENTE" ? [{ id: "tarefa-nf", titulo: "Emitir NF – Cliente" }] : [],
      )),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
  };
  return tx;
}

describe("emissão de NF e tarefa vinculada", () => {
  it("fecha apenas a tarefa de NF e registra emissão válida no histórico", async () => {
    const tx = cliente();
    await sincronizarNotaFiscalCard({ tx: tx as never, cardId: "card-1", pipelineId: "financeiro-1", usuarioId: 1 });
    expect(tx.bpmCardHistorico.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      cardId: "card-1", acao: "NOTA_FISCAL_EMITIDA", valorNovoJson: JSON.stringify(dados),
    }) });
    expect(tx.bpmTarefa.updateMany).toHaveBeenCalledWith({
      where: { id: "tarefa-nf", status: "PENDENTE" },
      data: { status: "CONCLUIDA", concluidaEm: expect.any(Date) },
    });
    expect(publicar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "TAREFA_CONCLUIDA", entidadeId: "tarefa-nf" }), tx);
  });

  it("mantém a tarefa aberta se a NF estiver inválida", async () => {
    const tx = cliente("Sim", "0");
    await expect(sincronizarNotaFiscalCard({ tx: tx as never, cardId: "card-1", pipelineId: "financeiro-1" }))
      .rejects.toThrow(/Valor da NF/);
    expect(tx.bpmTarefa.updateMany).not.toHaveBeenCalled();
    await expect(exigirNotaFiscalParaConcluirTarefa("card-1", "financeiro-1", tx as never))
      .rejects.toThrow(/NF válida/);
  });

  it("não duplica evento de emissão em salvamento repetido", async () => {
    const tx = cliente();
    tx.bpmCardHistorico.findFirst.mockResolvedValue({ valorNovoJson: JSON.stringify(dados) } as never);
    tx.bpmTarefa.findMany.mockResolvedValue([] as never);
    await sincronizarNotaFiscalCard({ tx: tx as never, cardId: "card-1", pipelineId: "financeiro-1" });
    expect(tx.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(tx.bpmTarefa.updateMany).not.toHaveBeenCalled();
  });

  it("reabre a tarefa se a NF voltar para Não", async () => {
    const tx = cliente("Não");
    tx.bpmCardHistorico.findFirst.mockResolvedValue({ valorNovoJson: JSON.stringify(dados) } as never);
    tx.bpmTarefa.findMany.mockImplementation(({ where }: { where: { status: string } }) => Promise.resolve(
      where.status === "CONCLUIDA" ? [{ id: "tarefa-nf", titulo: "Emitir NF – Cliente" }] : [],
    ));
    await sincronizarNotaFiscalCard({ tx: tx as never, cardId: "card-1", pipelineId: "financeiro-1" });
    expect(tx.bpmTarefa.update).toHaveBeenCalledWith({ where: { id: "tarefa-nf" }, data: { status: "PENDENTE", concluidaEm: null } });
    expect(tx.bpmCardHistorico.create).toHaveBeenCalledWith({ data: expect.objectContaining({ acao: "NOTA_FISCAL_PENDENTE" }) });
  });
});
