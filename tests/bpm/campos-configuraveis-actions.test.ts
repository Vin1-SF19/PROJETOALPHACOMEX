import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  exigirConfig: vi.fn(),
  notificar: vi.fn(),
  revalidatePath: vi.fn(),
  campoCreate: vi.fn(),
  campoUpdate: vi.fn(),
  campoFindUniqueOrThrow: vi.fn(),
  campoFindUnique: vi.fn(),
  etapaFindMany: vi.fn(),
  pipelineFindMany: vi.fn(),
  pipelineUpdate: vi.fn(),
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
  AtualizarCampoBpm,
  ConfigurarMapeamentoCampoBpm,
  CriarCampoBpm,
  DesativarMapeamentoCampoBpm,
} from "@/actions/bpm/Campos";

const PIPELINE_ID = "clw0000000000000pipeline";
const OUTRO_PIPELINE_ID = "clw000000000000pipeline2";
const CAMPO_ORIGEM_ID = "clw00000000000000origem";
const CAMPO_DESTINO_ID = "clw0000000000000destino";
const ETAPA_ID = "clw000000000000000etapa1";

function clienteTx() {
  return {
    bpmPipeline: { findMany: mocks.pipelineFindMany, update: mocks.pipelineUpdate },
    bpmEtapa: { findMany: mocks.etapaFindMany },
    bpmCampo: { create: mocks.campoCreate, update: mocks.campoUpdate, findUniqueOrThrow: mocks.campoFindUniqueOrThrow },
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
    mocks.pipelineUpdate.mockResolvedValue({ configVersion: 2 });
    mocks.etapaFindMany.mockResolvedValue([{ id: ETAPA_ID, pipelineId: PIPELINE_ID }]);
    mocks.campoCreate.mockResolvedValue({ id: CAMPO_DESTINO_ID, pipelineId: PIPELINE_ID });
    mocks.campoFindUniqueOrThrow.mockResolvedValue({
      id: CAMPO_DESTINO_ID,
      pipelineId: PIPELINE_ID,
      opcoes: [],
      pipelinesAssociados: [{ pipelineId: PIPELINE_ID }],
      etapaConfiguracoes: [],
      acessos: [],
      mapeamentoDestino: null,
    });
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
      obrigatorio: false,
      somenteLeitura: true,
      editavel: false,
    });
    expect(resultado.success).toBe(true);
    expect(mocks.acessoCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ campoId: CAMPO_DESTINO_ID, perfil: "ADMIN", somenteLeitura: true, editavel: false, obrigatorio: false }),
        expect.objectContaining({ campoId: CAMPO_DESTINO_ID, perfil: "RESPONSAVEL", somenteLeitura: true, editavel: false }),
        expect.objectContaining({ campoId: CAMPO_DESTINO_ID, perfil: "MEMBRO", somenteLeitura: true, editavel: false }),
      ]),
    });
  });

  it("preserva o agregado completo em dois saves consecutivos sem reload", async () => {
    const agregado = {
      id: CAMPO_DESTINO_ID,
      pipelineId: PIPELINE_ID,
      nome: "Receita anual",
      tipo: "texto",
      ativo: true,
      escopo: "CARD",
      fonteEntidade: null,
      fonteAtributo: null,
      entidadeGlobal: null,
      valores: [],
      opcoes: [{ id: "opcao-1", chave: "alto", rotulo: "Alto", ordem: 0, ativo: true }],
      pipelinesAssociados: [{ pipelineId: PIPELINE_ID }],
      etapaConfiguracoes: [{ etapaId: ETAPA_ID, ordem: 0, obrigatorio: true }],
      acessos: [{ perfil: "ADMIN", visivel: true, editavel: true, somenteLeitura: false, obrigatorio: false }],
      mapeamentoDestino: null,
    };
    mocks.campoFindUnique.mockResolvedValue(agregado);
    mocks.campoUpdate.mockResolvedValue({ id: CAMPO_DESTINO_ID });
    mocks.campoFindUniqueOrThrow
      .mockResolvedValueOnce({ ...agregado, nome: "Receita 2026" })
      .mockResolvedValueOnce({ ...agregado, nome: "Receita confirmada" });

    const primeiro = await AtualizarCampoBpm({ campoId: CAMPO_DESTINO_ID, nome: "Receita 2026" });
    expect(primeiro).toMatchObject({ success: true, data: { opcoes: agregado.opcoes, etapaConfiguracoes: agregado.etapaConfiguracoes } });

    const segundo = await AtualizarCampoBpm({ campoId: CAMPO_DESTINO_ID, nome: "Receita confirmada" });
    expect(segundo).toMatchObject({
      success: true,
      data: {
        pipelinesAssociados: agregado.pipelinesAssociados,
        etapaConfiguracoes: agregado.etapaConfiguracoes,
        acessos: agregado.acessos,
        opcoes: agregado.opcoes,
      },
    });
  });

  it("rejeita seleção customizada ativa sem opções e aceita fonte canônica", async () => {
    const invalido = await CriarCampoBpm({
      pipelineId: PIPELINE_ID,
      nome: "Status da sede",
      tipo: "selecao",
      obrigatorio: false,
      opcoes: [],
      escopo: "GLOBAL",
      fonteEntidade: null,
    });
    expect(invalido).toEqual({ success: false, error: "Campo de seleção customizado precisa ter ao menos uma opção ativa" });
    expect(mocks.transaction).not.toHaveBeenCalled();

    const canonico = await CriarCampoBpm({
      pipelineId: PIPELINE_ID,
      nome: "Regime tributário",
      tipo: "selecao",
      obrigatorio: false,
      opcoes: [],
      escopo: "GLOBAL",
      fonteEntidade: "CLIENTE",
      fonteAtributo: "regimeTributario",
      somenteLeitura: true,
      editavel: false,
    });
    expect(canonico.success).toBe(true);
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
