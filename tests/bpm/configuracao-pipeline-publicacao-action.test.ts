import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  transaction: vi.fn(),
  pipelineFindUnique: vi.fn(),
  pipelineUpdateMany: vi.fn(),
  campoFindMany: vi.fn(),
  etapaCreate: vi.fn(),
  etapaUpdate: vi.fn(),
  transicaoCreate: vi.fn(),
  transicaoUpdate: vi.fn(),
  campoUpdate: vi.fn(),
  auditCreate: vi.fn(),
  revalidatePath: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: mocks.access }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notify }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction } }));

import { PublicarConfiguracaoPipelineBpm } from "@/actions/bpm/ConfiguracaoPipeline";

const PIPELINE_ID = "pipeline-1";

function tx() {
  return {
    bpmPipeline: {
      findUnique: mocks.pipelineFindUnique,
      updateMany: mocks.pipelineUpdateMany,
    },
    bpmCampo: {
      findMany: mocks.campoFindMany,
      update: mocks.campoUpdate,
    },
    bpmEtapa: {
      create: mocks.etapaCreate,
      update: mocks.etapaUpdate,
    },
    bpmTransicaoEtapa: {
      create: mocks.transicaoCreate,
      update: mocks.transicaoUpdate,
    },
    bpmPipelineConfigAuditoria: { create: mocks.auditCreate },
  };
}

function proposta(baseVersion = 1) {
  return {
    pipelineId: PIPELINE_ID,
    baseVersion,
    etapas: [
      { id: "e1", nome: "Entrada", cor: null, ordem: 0, ativo: true, ehInicial: true, ehFinal: false },
      { id: "e2", nome: "Concluído", cor: "#22c55e", ordem: 1, ativo: true, ehInicial: false, ehFinal: true },
    ],
    transicoes: [
      { id: "t12", etapaOrigemId: "e1", etapaDestinoId: "e2", permitida: true, origem: "MANUAL" },
      { id: "t21", etapaOrigemId: "e2", etapaDestinoId: "e1", permitida: false, origem: "AMBOS" },
    ],
    campos: [{ id: "c1", ativo: false }],
  };
}

describe("Server Action da publicação do agregado de configuração", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7" } });
    mocks.access.mockResolvedValue(undefined);
    mocks.pipelineFindUnique.mockResolvedValue({
      id: PIPELINE_ID,
      configVersion: 1,
      etapas: [
        { id: "e1", nome: "Entrada", cor: null, ordem: 0, ativo: true, ehInicial: true, ehFinal: false },
        { id: "e2", nome: "Fim", cor: null, ordem: 1, ativo: true, ehInicial: false, ehFinal: true },
      ],
      transicoesEtapa: [
        { id: "t12", etapaOrigemId: "e1", etapaDestinoId: "e2", permitida: true, origem: "AMBOS" },
        { id: "t21", etapaOrigemId: "e2", etapaDestinoId: "e1", permitida: false, origem: "AMBOS" },
      ],
    });
    mocks.campoFindMany.mockResolvedValue([
      { id: "c1", nome: "Observação", tipo: "texto", ativo: true, fonteEntidade: null, fonteAtributo: null, opcoesJson: null, opcoes: [] },
    ]);
    mocks.pipelineUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (callback) => callback(tx()));
  });

  it("aplica etapas, transições e campos e incrementa uma única vez", async () => {
    const resultado = await PublicarConfiguracaoPipelineBpm(proposta());

    expect(resultado).toMatchObject({ success: true, data: { configVersion: 2 } });
    expect(mocks.pipelineUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.etapaUpdate).toHaveBeenCalledOnce();
    expect(mocks.transicaoUpdate).toHaveBeenCalledOnce();
    expect(mocks.campoUpdate).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it("bloqueia baseVersion antiga antes de qualquer escrita", async () => {
    mocks.pipelineFindUnique.mockResolvedValueOnce({
      ...(await mocks.pipelineFindUnique()),
      configVersion: 2,
    });

    const resultado = await PublicarConfiguracaoPipelineBpm(proposta(1));

    expect(resultado).toMatchObject({ success: false, conflict: true });
    expect(mocks.pipelineUpdateMany).not.toHaveBeenCalled();
    expect(mocks.etapaUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("trata CAS perdido como conflito sem executar filhos", async () => {
    mocks.pipelineUpdateMany.mockResolvedValueOnce({ count: 0 });

    const resultado = await PublicarConfiguracaoPipelineBpm(proposta());

    expect(resultado).toMatchObject({ success: false, conflict: true });
    expect(mocks.etapaUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("não executa efeitos pós-commit quando um filho falha", async () => {
    mocks.etapaUpdate.mockRejectedValueOnce(new Error("falha intermediária"));

    const resultado = await PublicarConfiguracaoPipelineBpm(proposta());

    expect(resultado).toEqual({ success: false, error: "Erro ao publicar configuração" });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("mantém o commit concluído quando apenas a notificação pós-commit falha", async () => {
    mocks.notify.mockRejectedValueOnce(new Error("realtime indisponível"));

    const resultado = await PublicarConfiguracaoPipelineBpm(proposta());

    expect(resultado).toMatchObject({ success: true, data: { configVersion: 2 } });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });
});
