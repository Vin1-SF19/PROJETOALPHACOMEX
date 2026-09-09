import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  notificar: vi.fn(),
  exigirConfig: vi.fn(),
  pipelineFindUnique: vi.fn(),
  pipelineUpdate: vi.fn(),
  pipelineSetorDeleteMany: vi.fn(),
  pipelineSetorCreateMany: vi.fn(),
  etapaFindUnique: vi.fn(),
  etapaFindFirst: vi.fn(),
  etapaFindMany: vi.fn(),
  etapaCount: vi.fn(),
  etapaCreate: vi.fn(),
  etapaUpdate: vi.fn(),
  etapaUpdateMany: vi.fn(),
  subStatusFindUnique: vi.fn(),
  subStatusUpdate: vi.fn(),
  transicaoFindUnique: vi.fn(),
  transicaoUpsert: vi.fn(),
  transicaoUpdate: vi.fn(),
  transicaoDelete: vi.fn(),
  transicaoCreateMany: vi.fn(),
  auditoriaCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notificar }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoConfigPipeline: mocks.exigirConfig,
  isAdminRole: (role: string) => ["Admin", "CEO", "TI"].includes(role),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmPipeline: {
      findUnique: mocks.pipelineFindUnique,
      update: mocks.pipelineUpdate,
    },
    bpmPipelineSetor: {
      deleteMany: mocks.pipelineSetorDeleteMany,
      createMany: mocks.pipelineSetorCreateMany,
    },
    bpmEtapa: {
      findUnique: mocks.etapaFindUnique,
      findMany: mocks.etapaFindMany,
      update: mocks.etapaUpdate,
      updateMany: mocks.etapaUpdateMany,
    },
    bpmSubStatus: {
      findUnique: mocks.subStatusFindUnique,
      update: mocks.subStatusUpdate,
    },
    bpmTransicaoEtapa: {
      findUnique: mocks.transicaoFindUnique,
      upsert: mocks.transicaoUpsert,
      update: mocks.transicaoUpdate,
      delete: mocks.transicaoDelete,
    },
    bpmPipelineConfigAuditoria: { create: mocks.auditoriaCreate },
    $transaction: mocks.transaction,
  },
}));

import {
  AtivarDesativarPipelineBpm,
  ReordenarPipelinesBpm,
} from "@/actions/bpm/Pipelines";
import {
  AtivarDesativarEtapaBpm,
  CriarEtapaBpm,
  DefinirEtapaInicialBpm,
  DefinirEtapasFinaisBpm,
} from "@/actions/bpm/Etapas";
import {
  CriarSubStatusBpm,
  AtualizarSubStatusBpm,
} from "@/actions/bpm/SubStatus";
import {
  CriarTransicaoEtapaBpm,
  AtualizarTransicaoEtapaBpm,
  RemoverTransicaoEtapaBpm,
} from "@/actions/bpm/Transicoes";
import { verificarTransicaoPermitidaBpm } from "@/lib/bpm/requisitos-etapa-server";

const PIPELINE_ID = "clw0000000000000pipeline";
const ETAPA_A = "clw000000000000000etapaa";
const ETAPA_B = "clw000000000000000etapab";
const SUBSTATUS_ID = "clw0000000000000substat0";
const TRANSICAO_ID = "clw000000000000transicao";

function mockTransactionPassThrough() {
  mocks.transaction.mockImplementation(async (callback: unknown) => {
    if (typeof callback === "function") return callback(mockClienteTx());
    return Promise.all(callback as Promise<unknown>[]);
  });
}

function mockClienteTx() {
  return {
    bpmPipeline: { update: mocks.pipelineUpdate },
    bpmPipelineSetor: {
      deleteMany: mocks.pipelineSetorDeleteMany,
      createMany: mocks.pipelineSetorCreateMany,
    },
    bpmEtapa: {
      findUnique: mocks.etapaFindUnique,
      findFirst: mocks.etapaFindFirst,
      findMany: mocks.etapaFindMany,
      count: mocks.etapaCount,
      create: mocks.etapaCreate,
      update: mocks.etapaUpdate,
      updateMany: mocks.etapaUpdateMany,
    },
    bpmSubStatus: { findUnique: mocks.subStatusFindUnique, update: mocks.subStatusUpdate },
    bpmTransicaoEtapa: {
      findUnique: mocks.transicaoFindUnique,
      createMany: mocks.transicaoCreateMany,
      upsert: mocks.transicaoUpsert,
      update: mocks.transicaoUpdate,
      delete: mocks.transicaoDelete,
    },
    bpmPipelineConfigAuditoria: { create: mocks.auditoriaCreate },
  };
}

describe("Pipelines admin — ativar/desativar e reordenar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.exigirConfig.mockResolvedValue(undefined);
    mocks.etapaUpdate.mockResolvedValue({ id: ETAPA_A });
    mocks.etapaUpdateMany.mockResolvedValue({ count: 1 });
    mocks.etapaFindFirst.mockImplementation(async ({ where }: { where: { id: string; pipelineId: string } }) =>
      where.id === ETAPA_A && where.pipelineId === PIPELINE_ID ? { id: ETAPA_A } : null,
    );
    mockTransactionPassThrough();
  });

  it("rejeita usuário sem sessão", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await AtivarDesativarPipelineBpm({ pipelineId: PIPELINE_ID, ativo: false });
    expect(result).toMatchObject({ success: false, error: "Não autorizado" });
  });

  it("rejeita quem não é administrador", async () => {
    mocks.exigirConfig.mockRejectedValue(new Error("Não autorizado — apenas administradores configuram pipelines"));
    const result = await AtivarDesativarPipelineBpm({ pipelineId: PIPELINE_ID, ativo: false });
    expect(result.success).toBe(false);
    expect(mocks.pipelineUpdate).not.toHaveBeenCalled();
  });

  it("desativa pipeline, audita e notifica", async () => {
    mocks.pipelineFindUnique.mockResolvedValue({ id: PIPELINE_ID, ativo: true });
    mocks.pipelineUpdate.mockResolvedValue({ id: PIPELINE_ID, ativo: false });
    const result = await AtivarDesativarPipelineBpm({ pipelineId: PIPELINE_ID, ativo: false });
    expect(result).toMatchObject({ success: true });
    expect(mocks.pipelineUpdate).toHaveBeenCalledWith({ where: { id: PIPELINE_ID }, data: { ativo: false } });
    expect(mocks.auditoriaCreate).toHaveBeenCalled();
    expect(mocks.notificar).toHaveBeenCalledWith({ pipelineId: PIPELINE_ID, tipo: "PIPELINE_ALTERADO" });
  });

  it("reordena pipelines em lote", async () => {
    const result = await ReordenarPipelinesBpm({
      ordem: [{ pipelineId: PIPELINE_ID, ordem: 1 }],
    });
    expect(result).toMatchObject({ success: true });
    expect(mocks.transaction).toHaveBeenCalled();
  });
});

describe("Etapas admin — ativar/desativar, inicial e finais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.exigirConfig.mockResolvedValue(undefined);
    mocks.etapaUpdate.mockResolvedValue({ id: ETAPA_A });
    mocks.etapaUpdateMany.mockResolvedValue({ count: 1 });
    mockTransactionPassThrough();
  });

  it("ativa/desativa etapa com auditoria", async () => {
    mocks.etapaFindUnique.mockResolvedValue({ id: ETAPA_A, pipelineId: PIPELINE_ID, ativo: true });
    mocks.etapaUpdate.mockResolvedValue({ id: ETAPA_A, ativo: false });
    const result = await AtivarDesativarEtapaBpm({ etapaId: ETAPA_A, ativo: false });
    expect(result).toMatchObject({ success: true });
    expect(mocks.etapaUpdate).toHaveBeenCalledWith({ where: { id: ETAPA_A }, data: { ativo: false } });
  });

  it("cria etapa com arestas explícitas bloqueadas nos dois sentidos", async () => {
    mocks.etapaFindMany.mockResolvedValue([{ id: ETAPA_A }, { id: ETAPA_B }]);
    mocks.etapaCreate.mockResolvedValue({ id: "clw00000000000000etapan", pipelineId: PIPELINE_ID, nome: "Nova" });
    const result = await CriarEtapaBpm({ pipelineId: PIPELINE_ID, nome: "Nova", ordem: 2 });
    expect(result).toMatchObject({ success: true });
    expect(mocks.transicaoCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ etapaOrigemId: "clw00000000000000etapan", etapaDestinoId: ETAPA_A, permitida: false }),
        expect.objectContaining({ etapaOrigemId: ETAPA_A, etapaDestinoId: "clw00000000000000etapan", permitida: false }),
      ]),
    });
  });

  it("reverte a alteração inteira quando a auditoria obrigatória falha", async () => {
    let persistido = { ativo: true };
    const auditorias: string[] = [];
    mocks.transaction.mockImplementationOnce(async (callback: (tx: ReturnType<typeof mockClienteTx>) => unknown) => {
      let proximoAtivo = persistido.ativo;
      const tx = mockClienteTx();
      tx.bpmEtapa.findUnique = vi.fn().mockResolvedValue({ id: ETAPA_A, pipelineId: PIPELINE_ID, ativo: true });
      tx.bpmEtapa.update = vi.fn().mockImplementation(async ({ data }: { data: { ativo: boolean } }) => {
        proximoAtivo = data.ativo;
        return { id: ETAPA_A, ativo: data.ativo };
      });
      tx.bpmPipelineConfigAuditoria.create = vi.fn().mockRejectedValue(new Error("falha de auditoria"));
      try {
        const resultado = await callback(tx);
        persistido = { ativo: proximoAtivo };
        auditorias.push("commit");
        return resultado;
      } catch (error) {
        throw error;
      }
    });
    const result = await AtivarDesativarEtapaBpm({ etapaId: ETAPA_A, ativo: false });
    expect(result.success).toBe(false);
    expect(persistido.ativo).toBe(true);
    expect(auditorias).toEqual([]);
    expect(mocks.notificar).not.toHaveBeenCalled();
  });

  it("não produz auditoria quando a mutação falha", async () => {
    mocks.etapaFindUnique.mockResolvedValue({ id: ETAPA_A, pipelineId: PIPELINE_ID, ativo: true });
    mocks.etapaUpdate.mockRejectedValue(new Error("falha de domínio"));
    const result = await AtivarDesativarEtapaBpm({ etapaId: ETAPA_A, ativo: false });
    expect(result.success).toBe(false);
    expect(mocks.auditoriaCreate).not.toHaveBeenCalled();
    expect(mocks.notificar).not.toHaveBeenCalled();
  });

  it("define etapa inicial garantindo unicidade no pipeline", async () => {
    mocks.etapaFindUnique.mockResolvedValue({ id: ETAPA_A, pipelineId: PIPELINE_ID });
    const result = await DefinirEtapaInicialBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_A });
    expect(result).toMatchObject({ success: true });
    expect(mocks.etapaUpdateMany).toHaveBeenCalledWith({
      where: { pipelineId: PIPELINE_ID, ehInicial: true, NOT: { id: ETAPA_A } },
      data: { ehInicial: false },
    });
    expect(mocks.etapaUpdate).toHaveBeenCalledWith({ where: { id: ETAPA_A }, data: { ehInicial: true } });
  });

  it("rejeita etapa inicial de outro pipeline", async () => {
    mocks.etapaFindFirst.mockResolvedValue(null);
    const result = await DefinirEtapaInicialBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_A });
    expect(result.success).toBe(false);
    expect(mocks.etapaUpdate).not.toHaveBeenCalled();
  });

  it("define múltiplas etapas finais substituindo o conjunto anterior", async () => {
    mocks.etapaFindMany.mockResolvedValue([{ id: ETAPA_A }, { id: ETAPA_B }]);
    const result = await DefinirEtapasFinaisBpm({
      pipelineId: PIPELINE_ID,
      etapaIds: [ETAPA_A, ETAPA_B],
    });
    expect(result).toMatchObject({ success: true });
    expect(mocks.etapaUpdateMany).toHaveBeenCalledWith({ where: { pipelineId: PIPELINE_ID }, data: { ehFinal: false } });
    expect(mocks.etapaUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [ETAPA_A, ETAPA_B] } },
      data: { ehFinal: true },
    });
  });

  it("rejeita etapas finais que não pertencem ao pipeline", async () => {
    mocks.etapaFindMany.mockResolvedValue([{ id: ETAPA_A }]);
    const result = await DefinirEtapasFinaisBpm({
      pipelineId: PIPELINE_ID,
      etapaIds: [ETAPA_A, ETAPA_B],
    });
    expect(result.success).toBe(false);
  });
});

describe("SubStatus admin — CRUD escopado por etapa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.exigirConfig.mockResolvedValue(undefined);
    mockTransactionPassThrough();
  });

  it("cria substatus vinculado à etapa", async () => {
    mocks.etapaFindUnique.mockResolvedValue({ pipelineId: PIPELINE_ID });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        bpmEtapa: { findUnique: vi.fn().mockResolvedValue({ pipelineId: PIPELINE_ID }) },
        bpmSubStatus: {
          create: vi.fn().mockResolvedValue({ id: SUBSTATUS_ID, nome: "Aguardando" }),
        },
        bpmPipelineConfigAuditoria: { create: mocks.auditoriaCreate },
      }),
    );
    const result = await CriarSubStatusBpm({ etapaId: ETAPA_A, nome: "Aguardando", ordem: 0 });
    expect(result).toMatchObject({ success: true });
    expect(mocks.auditoriaCreate).toHaveBeenCalled();
  });

  it("rejeita nome vazio", async () => {
    const result = await CriarSubStatusBpm({ etapaId: ETAPA_A, nome: "", ordem: 0 });
    expect(result.success).toBe(false);
    expect(mocks.etapaFindUnique).not.toHaveBeenCalled();
  });

  it("atualiza substatus existente", async () => {
    mocks.subStatusFindUnique.mockResolvedValue({ id: SUBSTATUS_ID, etapaId: ETAPA_A, nome: "Aguardando", etapa: { pipelineId: PIPELINE_ID } });
    mocks.etapaFindUnique.mockResolvedValue({ pipelineId: PIPELINE_ID });
    mocks.subStatusUpdate.mockResolvedValue({ id: SUBSTATUS_ID, nome: "Aguardando Doc" });
    const result = await AtualizarSubStatusBpm({ subStatusId: SUBSTATUS_ID, nome: "Aguardando Doc" });
    expect(result).toMatchObject({ success: true });
  });
});

describe("Transições admin — CRUD e regra de origem/destino", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.exigirConfig.mockResolvedValue(undefined);
    mockTransactionPassThrough();
  });

  it("cria transição válida entre etapas do mesmo pipeline", async () => {
    mocks.etapaCount.mockResolvedValue(2);
    mocks.transicaoUpsert.mockResolvedValue({ id: TRANSICAO_ID });
    const result = await CriarTransicaoEtapaBpm({
      pipelineId: PIPELINE_ID,
      etapaOrigemId: ETAPA_A,
      etapaDestinoId: ETAPA_B,
      permitida: true,
      origem: "AMBOS",
    });
    expect(result).toMatchObject({ success: true });
  });

  it("rejeita transição com etapas de pipelines diferentes", async () => {
    mocks.etapaCount.mockResolvedValue(1);
    const result = await CriarTransicaoEtapaBpm({
      pipelineId: PIPELINE_ID,
      etapaOrigemId: ETAPA_A,
      etapaDestinoId: ETAPA_B,
    });
    expect(result.success).toBe(false);
    expect(mocks.transicaoUpsert).not.toHaveBeenCalled();
  });

  it("rejeita origem igual ao destino via schema", async () => {
    const result = await CriarTransicaoEtapaBpm({
      pipelineId: PIPELINE_ID,
      etapaOrigemId: ETAPA_A,
      etapaDestinoId: ETAPA_A,
    });
    expect(result.success).toBe(false);
    expect(mocks.etapaFindUnique).not.toHaveBeenCalled();
  });

  it("desativa transição (toggle permitida)", async () => {
    mocks.transicaoFindUnique.mockResolvedValue({ id: TRANSICAO_ID, pipelineId: PIPELINE_ID, permitida: true, origem: "AMBOS" });
    mocks.transicaoUpdate.mockResolvedValue({ id: TRANSICAO_ID, permitida: false });
    const result = await AtualizarTransicaoEtapaBpm({ transicaoId: TRANSICAO_ID, permitida: false });
    expect(result).toMatchObject({ success: true });
    expect(mocks.transicaoUpdate).toHaveBeenCalledWith({ where: { id: TRANSICAO_ID }, data: { permitida: false } });
  });

  it("remove transição", async () => {
    mocks.transicaoFindUnique.mockResolvedValue({ id: TRANSICAO_ID, pipelineId: PIPELINE_ID });
    const result = await RemoverTransicaoEtapaBpm({ transicaoId: TRANSICAO_ID });
    expect(result).toMatchObject({ success: true });
    expect(mocks.transicaoDelete).toHaveBeenCalledWith({ where: { id: TRANSICAO_ID } });
  });
});

describe("verificarTransicaoPermitidaBpm — engine de movimentação", () => {
  const findUnique = vi.fn();
  const client = { bpmTransicaoEtapa: { findUnique } } as never;

  beforeEach(() => {
    findUnique.mockReset();
  });

  it("permite mover para a mesma etapa sem consultar o banco", async () => {
    const resultado = await verificarTransicaoPermitidaBpm(ETAPA_A, ETAPA_A, "MANUAL", client);
    expect(resultado).toEqual({ permitida: true });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("bloqueia quando não há regra explícita", async () => {
    findUnique.mockResolvedValue(null);
    const resultado = await verificarTransicaoPermitidaBpm(ETAPA_A, ETAPA_B, "MANUAL", client);
    expect(resultado).toEqual({ permitida: false, motivo: "Esta transição não está definida no pipeline." });
  });

  it("bloqueia quando o admin desativou explicitamente a transição", async () => {
    findUnique.mockResolvedValue({ permitida: false, origem: "AMBOS" });
    const resultado = await verificarTransicaoPermitidaBpm(ETAPA_A, ETAPA_B, "MANUAL", client);
    expect(resultado.permitida).toBe(false);
  });

  it("permite múltiplos destinos válidos consultando o par correto", async () => {
    findUnique.mockImplementation(async ({ where }: { where: { etapaOrigemId_etapaDestinoId: { etapaDestinoId: string } } }) =>
      where.etapaOrigemId_etapaDestinoId.etapaDestinoId === ETAPA_B
        ? { permitida: true, origem: "AMBOS" }
        : { permitida: false, origem: "AMBOS" },
    );
    const paraB = await verificarTransicaoPermitidaBpm(ETAPA_A, ETAPA_B, "MANUAL", client);
    expect(paraB.permitida).toBe(true);
  });

  it("diferencia origem MANUAL de AUTOMACAO", async () => {
    findUnique.mockResolvedValue({ permitida: true, origem: "MANUAL" });
    const viaManual = await verificarTransicaoPermitidaBpm(ETAPA_A, ETAPA_B, "MANUAL", client);
    const viaAutomacao = await verificarTransicaoPermitidaBpm(ETAPA_A, ETAPA_B, "AUTOMACAO", client);
    expect(viaManual.permitida).toBe(true);
    expect(viaAutomacao.permitida).toBe(false);
  });

  it("origem AMBOS permite tanto MANUAL quanto AUTOMACAO", async () => {
    findUnique.mockResolvedValue({ permitida: true, origem: "AMBOS" });
    const viaManual = await verificarTransicaoPermitidaBpm(ETAPA_A, ETAPA_B, "MANUAL", client);
    const viaAutomacao = await verificarTransicaoPermitidaBpm(ETAPA_A, ETAPA_B, "AUTOMACAO", client);
    expect(viaManual.permitida).toBe(true);
    expect(viaAutomacao.permitida).toBe(true);
  });
});
