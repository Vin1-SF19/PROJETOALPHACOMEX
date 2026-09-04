import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  exigirConfig: vi.fn(),
  notificar: vi.fn(),
  revalidatePath: vi.fn(),
  campoCreate: vi.fn(),
  campoFindUnique: vi.fn(),
  pipelineFindMany: vi.fn(),
  opcaoCreateMany: vi.fn(),
  campoPipelineCreateMany: vi.fn(),
  acessoCreateMany: vi.fn(),
  auditoriaCreate: vi.fn(),
  mapeamentoFindMany: vi.fn(),
  mapeamentoFindUnique: vi.fn(),
  mapeamentoUpsert: vi.fn(),
  mapeamentoUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: mocks.exigirConfig }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notificar }));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmCampo: { findUnique: mocks.campoFindUnique },
    bpmCampoMapeamento: {
      findMany: mocks.mapeamentoFindMany,
      findUnique: mocks.mapeamentoFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  ConfigurarMapeamentoCampoBpm,
  CriarCampoBpm,
  DesativarMapeamentoCampoBpm,
} from "@/actions/bpm/Campos";

const PIPELINE_ID = "clw0000000000000pipeline";
const OUTRO_PIPELINE_ID = "clw000000000000pipeline2";
const CAMPO_ORIGEM_ID = "clw00000000000000origem";
const CAMPO_DESTINO_ID = "clw0000000000000destino";

function clienteTx() {
  return {
    bpmPipeline: { findMany: mocks.pipelineFindMany },
    bpmEtapa: { findMany: vi.fn() },
    bpmCampo: { create: mocks.campoCreate },
    bpmCampoOpcao: { createMany: mocks.opcaoCreateMany },
    bpmCampoPipeline: { createMany: mocks.campoPipelineCreateMany },
    bpmCampoEtapaConfig: { createMany: vi.fn() },
    bpmCampoAcesso: { createMany: mocks.acessoCreateMany },
    bpmCampoMapeamento: {
      findMany: mocks.mapeamentoFindMany,
      upsert: mocks.mapeamentoUpsert,
      update: mocks.mapeamentoUpdate,
    },
    bpmPipelineConfigAuditoria: { create: mocks.auditoriaCreate },
  };
}

describe("ações de gestão configurável de campos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7" } });
    mocks.exigirConfig.mockResolvedValue(undefined);
    mocks.notificar.mockResolvedValue(undefined);
    mocks.pipelineFindMany.mockResolvedValue([{ id: PIPELINE_ID }]);
    mocks.campoCreate.mockResolvedValue({ id: CAMPO_DESTINO_ID, pipelineId: PIPELINE_ID });
    mocks.mapeamentoUpsert.mockResolvedValue({ id: "clw000000000000000mapa" });
    mocks.transaction.mockImplementation(async (callback: (tx: ReturnType<typeof clienteTx>) => unknown) => callback(clienteTx()));
  });

  it("exige sessão antes de consultar ou alterar configuração", async () => {
    mocks.auth.mockResolvedValue(null);
    const resultado = await ConfigurarMapeamentoCampoBpm({
      campoOrigemId: CAMPO_ORIGEM_ID,
      campoDestinoId: CAMPO_DESTINO_ID,
      modo: "COPIAR",
    });
    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(mocks.campoFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("persiste acesso explícito para todos os perfis quando o admin não customiza", async () => {
    const resultado = await CriarCampoBpm({
      pipelineId: PIPELINE_ID,
      nome: "E-mail principal",
      tipo: "email",
      obrigatorio: true,
      somenteLeitura: true,
      editavel: false,
    });
    expect(resultado.success).toBe(true);
    expect(mocks.acessoCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ campoId: CAMPO_DESTINO_ID, perfil: "ADMIN", somenteLeitura: true, editavel: false }),
        expect.objectContaining({ campoId: CAMPO_DESTINO_ID, perfil: "RESPONSAVEL", somenteLeitura: true, editavel: false }),
        expect.objectContaining({ campoId: CAMPO_DESTINO_ID, perfil: "MEMBRO", somenteLeitura: true, editavel: false }),
      ]),
    });
  });

  it("rejeita mapeamento entre tipos diferentes antes da transação", async () => {
    mocks.campoFindUnique
      .mockResolvedValueOnce({ id: CAMPO_ORIGEM_ID, pipelineId: PIPELINE_ID, tipo: "texto" })
      .mockResolvedValueOnce({ id: CAMPO_DESTINO_ID, pipelineId: OUTRO_PIPELINE_ID, tipo: "numero" });
    mocks.mapeamentoFindMany.mockResolvedValue([]);
    const resultado = await ConfigurarMapeamentoCampoBpm({
      campoOrigemId: CAMPO_ORIGEM_ID,
      campoDestinoId: CAMPO_DESTINO_ID,
      modo: "SINCRONIZAR",
    });
    expect(resultado).toEqual({ success: false, error: "Mapeamento exige campos do mesmo tipo" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("salva mapeamento válido, audita e notifica as duas pipelines", async () => {
    mocks.campoFindUnique
      .mockResolvedValueOnce({ id: CAMPO_ORIGEM_ID, pipelineId: PIPELINE_ID, tipo: "texto" })
      .mockResolvedValueOnce({ id: CAMPO_DESTINO_ID, pipelineId: OUTRO_PIPELINE_ID, tipo: "texto" });
    mocks.mapeamentoFindMany.mockResolvedValue([]);
    const resultado = await ConfigurarMapeamentoCampoBpm({
      campoOrigemId: CAMPO_ORIGEM_ID,
      campoDestinoId: CAMPO_DESTINO_ID,
      modo: "REFERENCIAR",
    });
    expect(resultado.success).toBe(true);
    expect(mocks.mapeamentoUpsert).toHaveBeenCalled();
    expect(mocks.auditoriaCreate).toHaveBeenCalled();
    expect(mocks.notificar).toHaveBeenCalledTimes(2);
  });

  it("desativa mapeamento de forma reversível e preserva o registro", async () => {
    mocks.mapeamentoFindUnique.mockResolvedValue({
      id: "clw000000000000000mapa",
      ativo: true,
      campoOrigem: { pipelineId: PIPELINE_ID },
      campoDestino: { pipelineId: OUTRO_PIPELINE_ID },
    });
    const resultado = await DesativarMapeamentoCampoBpm({ campoDestinoId: CAMPO_DESTINO_ID });
    expect(resultado.success).toBe(true);
    expect(mocks.mapeamentoUpdate).toHaveBeenCalledWith({
      where: { campoDestinoId: CAMPO_DESTINO_ID },
      data: { ativo: false },
    });
    expect(mocks.auditoriaCreate).toHaveBeenCalled();
  });
});
