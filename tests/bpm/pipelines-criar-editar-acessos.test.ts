import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), config: vi.fn(), create: vi.fn(), update: vi.fn(), setores: vi.fn(), version: vi.fn(), pipeline: vi.fn(), usuario: vi.fn(), campos: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: m.config, exigirAcessoBpmPipeline: vi.fn(), isAdminRole: vi.fn() }));
vi.mock("@/lib/bpm/cards-no-quadro", () => ({ contarCardsVisiveisNoQuadro: vi.fn() }));
vi.mock("@/lib/bpm/config-version", () => ({ avancarConfigVersionBpm: m.version }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmPipeline: { create: m.create, findUnique: m.pipeline },
  usuarios: { findUnique: m.usuario }, bpmCampo: { findMany: m.campos },
  $transaction: async (fn: (tx: unknown) => unknown) => fn({ bpmPipeline: { update: m.update }, bpmPipelineSetor: { deleteMany: m.setores, createMany: m.setores } }),
} }));
import { CriarPipelineBpm, AtualizarPipelineBpm, ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { atualizarPipelineSchema, criarPipelineSchema } from "@/lib/validations/bpm";
const pipelineId = "clw000000000000000pipeline";
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "1" } }); m.config.mockResolvedValue(undefined);
  m.create.mockResolvedValue({ id: pipelineId }); m.update.mockResolvedValue({ id: pipelineId });
  m.usuario.mockResolvedValue({ role: "Comercial" }); m.campos.mockResolvedValue([]);
});

it("cria funil sem setores e com política explícita fechada", async () => {
  expect(await CriarPipelineBpm({ nome: "Novo funil" })).toMatchObject({ success: true });
  const data = m.create.mock.calls[0][0].data;
  expect(data.nome).toBe("Novo funil"); expect(data.setores).toBeUndefined();
  expect(JSON.parse(data.visualizacaoConfigJson)).toEqual({ permissoesPipeline: { version: 2, regras: [] } });
});
it("renomeia sem reescrever política de acesso nem relações de setores", async () => {
  expect(await AtualizarPipelineBpm({ pipelineId, nome: "Renomeado" })).toMatchObject({ success: true });
  expect(m.update).toHaveBeenCalledExactlyOnceWith({ where: { id: pipelineId }, data: { nome: "Renomeado" } });
  expect(m.setores).not.toHaveBeenCalled(); expect(m.version).toHaveBeenCalledOnce();
});
it("remove setorIds dos contratos de criar e editar, recusando o escritor antigo", async () => {
  expect(criarPipelineSchema.safeParse({ nome: "Novo", setorIds: [3] }).success).toBe(false);
  expect(atualizarPipelineSchema.safeParse({ pipelineId, nome: "Novo", setorIds: [3] }).success).toBe(false);
  expect(await CriarPipelineBpm({ nome: "Novo", setorIds: [3] })).toMatchObject({ success: false });
  expect(await AtualizarPipelineBpm({ pipelineId, nome: "Novo", setorIds: [3] })).toMatchObject({ success: false });
  expect(m.create).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
});
it("não permite criar ou renomear sem autoridade administrativa global", async () => {
  m.config.mockRejectedValue(new Error("Apenas administradores configuram pipelines"));
  expect(await CriarPipelineBpm({ nome: "Novo" })).toMatchObject({ success: false });
  expect(await AtualizarPipelineBpm({ pipelineId, nome: "Novo" })).toMatchObject({ success: false });
  expect(m.create).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
});

const etapa = (id: string, perfil: string) => ({
  id, nome: id, ordem: 0, visibilidades: [{ perfil, podeVer: true, podeAgir: true }],
  transicoesEtapaOrigem: [{ etapaDestinoId: "etapa-comercial" }, { etapaDestinoId: "etapa-financeiro" }],
});
function pipelineRuntime(administrativo = false) {
  return { id: pipelineId, setores: [], campos: [], automacoes: [],
    visualizacaoConfigJson: JSON.stringify({ permissoesPipeline: { version: 2, regras: [{ tipo: "USUARIO", id: 1, nivel: administrativo ? "ADMINISTRATIVO" : "PADRAO" }] } }),
    etapas: [etapa("etapa-comercial", "Comercial"), etapa("etapa-financeiro", "Financeiro")],
  };
}
it("runtime filtra colunas pelo perfil real persistido e remove ACL do DTO", async () => {
  m.auth.mockResolvedValue({ user: { id: "1", role: "Admin" } });
  m.pipeline.mockResolvedValue(pipelineRuntime());
  const result = await ObterPipelineBpm(pipelineId);
  expect(result.success).toBe(true);
  expect(result.data?.etapas.map((e) => e.id)).toEqual(["etapa-comercial"]);
  expect(result.data?.etapas[0].transicoesEtapaOrigem).toEqual([{ etapaDestinoId: "etapa-comercial" }]);
  expect(result.data).not.toHaveProperty("visualizacaoConfigJson");
  expect(result.data?.etapas[0]).not.toHaveProperty("visibilidades");
  expect(m.pipeline).toHaveBeenCalledWith(expect.objectContaining({ omit: { visualizacaoConfigJson: false } }));
});
it("admin do funil recebe todas as colunas sem receber as regras de acesso", async () => {
  m.pipeline.mockResolvedValue(pipelineRuntime(true));
  const result = await ObterPipelineBpm(pipelineId);
  expect(result.data?.etapas.map((e) => e.id)).toEqual(["etapa-comercial", "etapa-financeiro"]);
  expect(result.data).not.toHaveProperty("visualizacaoConfigJson");
});
it("editor administrativo preserva todas as colunas e exige permissão global", async () => {
  m.pipeline.mockResolvedValue(pipelineRuntime());
  const result = await ObterPipelineBpm(pipelineId, true);
  expect(result.data?.etapas.map((e) => e.id)).toEqual(["etapa-comercial", "etapa-financeiro"]);
  expect(m.config).toHaveBeenCalledWith(1, "configurarEtapas");
});
