import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), modulo: vi.fn(), config: vi.fn(), acessoPipeline: vi.fn(),
  usuario: vi.fn(), pipelines: vi.fn(), pipeline: vi.fn(), cards: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: {
  usuarios: { findUnique: mocks.usuario },
  bpmPipeline: { findMany: mocks.pipelines, findUnique: mocks.pipeline },
  bpmCard: { findMany: mocks.cards },
} }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoModuloBpm: mocks.modulo,
  checarAcessoConfigPipeline: mocks.config,
  checarAcessoBpmPipeline: mocks.acessoPipeline,
  exigirAcessoBpmPipeline: vi.fn(), exigirAcessoConfigPipeline: vi.fn(), isAdminRole: vi.fn(),
  listarUsuariosComAcessoCrmBpm: vi.fn(),
}));
// Network delegate imported by the action module; listing never emits events.
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: vi.fn() } }));

import { ListarPipelinesBpm } from "@/actions/bpm/Pipelines";

const pipelineRow = (id: string, nome: string, ativo = true) => ({
  id, nome, ativo, ordem: 0, setores: [], _count: { etapas: 3 },
});
const rows = [pipelineRow("pipeline-restrito", "Acesso restrito"), pipelineRow("pipeline-b", "Comercial"), pipelineRow("pipeline-c", "Operacional")];

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.auth.mockResolvedValue({ user: { id: "7", role: "Comercial" } });
  mocks.modulo.mockResolvedValue(undefined);
  mocks.config.mockResolvedValue(false);
  mocks.usuario.mockResolvedValue({ role: "Comercial" });
  mocks.pipelines.mockResolvedValue(rows);
  mocks.acessoPipeline.mockResolvedValue(true);
  mocks.pipeline.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    nome: "Funil sintético", visualizacaoConfigJson: null,
    etapas: [{ id: `etapa-${where.id}`, nome: "Triagem", ehFinal: false, visibilidades: [], automacoes: [] }],
  }));
  mocks.cards.mockImplementation(async ({ where }: { where: { pipelineId: string } }) => [{
    status: "ATIVO", etapaId: `etapa-${where.pipelineId}`, vinculosOrigem: [],
  }]);
});
afterEach(() => { vi.restoreAllMocks(); });

function expectNoDatabaseReads() {
  for (const query of [mocks.usuario, mocks.pipelines, mocks.pipeline, mocks.cards]) expect(query).not.toHaveBeenCalled();
}

describe("listagem real de pipelines utilizada pelo seletor", () => {
  it("sem sessão não consulta banco, permissões ou contagens", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await ListarPipelinesBpm()).toEqual({ success: false, error: "Não autorizado", data: [] });
    expectNoDatabaseReads();
    expect(mocks.modulo).not.toHaveBeenCalled();
    expect(mocks.config).not.toHaveBeenCalled();
    expect(mocks.acessoPipeline).not.toHaveBeenCalled();
  });

  it("acesso ao módulo negado interrompe antes de qualquer leitura do banco", async () => {
    mocks.modulo.mockRejectedValue(Error("Módulo indisponível para o usuário"));
    expect(await ListarPipelinesBpm()).toEqual({ success: false, error: "Erro ao buscar pipelines", data: [] });
    expect(mocks.modulo).toHaveBeenCalledWith(7);
    expectNoDatabaseReads();
    expect(mocks.config).not.toHaveBeenCalled();
    expect(mocks.acessoPipeline).not.toHaveBeenCalled();
  });

  it("consulta somente pipelines ativos por padrão e mantém ordenação por nome", async () => {
    mocks.pipelines.mockResolvedValue([]);
    expect(await ListarPipelinesBpm()).toEqual({ success: true, data: [] });
    expect(mocks.pipelines).toHaveBeenCalledWith(expect.objectContaining({
      where: { ativo: true }, orderBy: { nome: "asc" },
      select: expect.objectContaining({ id: true, nome: true, ativo: true }),
    }));
    expect(mocks.usuario).toHaveBeenCalledWith({ where: { id: 7 }, select: { role: true } });
    expect(mocks.config).toHaveBeenCalledWith(7, "visualizarPipeline");
    expect(mocks.pipeline).not.toHaveBeenCalled();
    expect(mocks.cards).not.toHaveBeenCalled();
  });

  it("verifica cada pipeline e executa a contagem real somente dos permitidos", async () => {
    mocks.acessoPipeline.mockImplementation(async (id: string) => id !== "pipeline-restrito");
    mocks.cards.mockImplementation(async ({ where }: { where: { pipelineId: string } }) => [
      { status: "ATIVO", etapaId: `etapa-${where.pipelineId}`, vinculosOrigem: [] },
      ...(where.pipelineId === "pipeline-b" ? [{ status: "ATIVO", etapaId: `etapa-${where.pipelineId}`, vinculosOrigem: [] }] : []),
      { status: "CONCLUIDO", etapaId: `etapa-${where.pipelineId}`, vinculosOrigem: [] },
    ]);
    const result = await ListarPipelinesBpm();
    expect(result).toEqual({ success: true, data: [
      { ...rows[1], _count: { etapas: 3, cards: 2 } },
      { ...rows[2], _count: { etapas: 3, cards: 1 } },
    ] });
    expect(mocks.acessoPipeline.mock.calls).toEqual(rows.map(row => [row.id, 7]));
    expect(mocks.pipeline.mock.calls.map(([query]) => query.where.id)).toEqual(["pipeline-b", "pipeline-c"]);
    expect(mocks.cards.mock.calls.map(([query]) => query.where.pipelineId)).toEqual(["pipeline-b", "pipeline-c"]);
    expect(JSON.stringify(result)).not.toContain("Acesso restrito");
  });

  it("nenhum pipeline permitido retorna lista vazia sem carregar cards", async () => {
    mocks.acessoPipeline.mockResolvedValue(false);
    expect(await ListarPipelinesBpm()).toEqual({ success: true, data: [] });
    expect(mocks.acessoPipeline).toHaveBeenCalledTimes(rows.length);
    expect(mocks.pipeline).not.toHaveBeenCalled();
    expect(mocks.cards).not.toHaveBeenCalled();
  });

  it("incluir inativos explicitamente preserva a autorização individual", async () => {
    const inativo = pipelineRow("pipeline-inativo", "Inativo autorizado", false);
    mocks.pipelines.mockResolvedValue([rows[0], inativo]);
    mocks.acessoPipeline.mockImplementation(async (id: string) => id === inativo.id);
    expect(await ListarPipelinesBpm(true)).toEqual({ success: true, data: [{ ...inativo, _count: { etapas: 3, cards: 1 } }] });
    expect(mocks.pipelines).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
    expect(mocks.acessoPipeline.mock.calls).toEqual([[rows[0].id, 7], [inativo.id, 7]]);
    expect(mocks.pipeline.mock.calls.map(([query]) => query.where.id)).toEqual([inativo.id]);
  });

  it.each(["listagem", "autorização por item", "contagem"])("falha na %s não devolve lista bruta nem resultado parcial", async fase => {
    if (fase === "listagem") mocks.pipelines.mockRejectedValue(Error("Falha sintética"));
    if (fase === "autorização por item") mocks.acessoPipeline.mockImplementation(async (id: string) => {
      if (id === "pipeline-c") throw Error("Falha sintética");
      return true;
    });
    if (fase === "contagem") mocks.cards.mockImplementation(async ({ where }: { where: { pipelineId: string } }) => {
      if (where.pipelineId === "pipeline-c") throw Error("Falha sintética");
      return [];
    });
    const result = await ListarPipelinesBpm();
    expect(result).toEqual({ success: false, error: "Erro ao buscar pipelines", data: [] });
    expect(JSON.stringify(result)).not.toContain(rows[0].nome);
    expect(JSON.stringify(result)).not.toContain("Falha sintética");
    if (fase !== "contagem") expect(mocks.cards).not.toHaveBeenCalled();
  });
});
