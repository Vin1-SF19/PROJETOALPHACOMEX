import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), pipeline: vi.fn(), usuario: vi.fn(), cards: vi.fn(), resumos: vi.fn(), leads: vi.fn(), setores: vi.fn(), usuarios: vi.fn(), permissoes: vi.fn(), overrides: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("@/lib/bpm/ownership", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/bpm/ownership")>(), exigirAcessoBpmPipeline: m.acesso }));
vi.mock("@/lib/prisma", () => ({ default: { bpmPipeline: { findUnique: m.pipeline }, usuarios: { findUnique: m.usuario, findMany: m.usuarios }, setor: { findMany: m.setores }, setorPermissao: { findMany: m.permissoes }, usuarioPermissaoOverride: { findMany: m.overrides }, bpmCard: { findMany: m.cards } } }));
vi.mock("@/actions/bpm/Cards", () => ({ ListarCardsPipelineBpm: m.resumos }));
vi.mock("@/lib/bpm/noloss-leads", () => ({ buscarNolossLeadsPendentes: m.leads }));
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";
const card = { id: "c1", etapaId: "stage", updatedAt: new Date("2026-10-14"), servico: "Radar", status: "ATIVO", empresa: { razaoSocial: "Empresa", nomeFantasia: null, cnpj: null }, responsavel: { id: 7, nome: "Responsável" }, membros: [], vinculosOrigem: [] };
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "7" } }); m.acesso.mockResolvedValue(undefined);
  m.usuario.mockResolvedValue({ role: "Comercial" }); m.pipeline.mockResolvedValue({ nome: "Revisão de Radar", configVersion: 1, setores: [{ setor: { id: 3, nome: "Comercial" } }], etapas: [{ id: "stage", nome: "Novo Lead", ehFinal: false, visibilidades: [], automacoes: [] }] });
  m.setores.mockResolvedValue([{ id: 3, nome: "Comercial" }]); m.usuarios.mockResolvedValue([{ id: 9, nome: "Equipe", role: "Comercial", status: "ATIVO", permissoes: "crm" }, { id: 7, nome: "Responsável", role: "Comercial", status: "ATIVO", permissoes: "crm" }]); m.permissoes.mockResolvedValue([]); m.overrides.mockResolvedValue([]);
  m.cards.mockResolvedValue([card]); m.leads.mockResolvedValue([]); m.resumos.mockResolvedValue({ success: true, data: [{ id: "c1" }] });
});
describe("sincronização do quadro", () => {
  it("nega pipeline revogado antes de consultar cards", async () => {
    m.acesso.mockRejectedValue(new Error("Não autorizado"));
    expect(await SincronizarQuadroBpm("pipeline")).toMatchObject({ success: false, acessoNegado: true }); expect(m.cards).not.toHaveBeenCalled(); expect(m.leads).not.toHaveBeenCalled();
  });
  it("preserva guardas de pipeline e coluna e revalida resumos na hidratação", async () => {
    const r = await SincronizarQuadroBpm("pipeline"); expect(r.success).toBe(true);
    expect(m.cards).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ pipelineId: "pipeline", etapaId: { in: ["stage"] } }) }));
    expect(m.resumos).toHaveBeenCalledWith("pipeline", ["c1"]);
  });
  it("poll sem mudanças não busca resumos; invalidação força relações", async () => {
    const first = await SincronizarQuadroBpm("pipeline"); if (!first.success) throw new Error("fixture");
    const conhecidos = first.manifesto.entradas.map(({ id, revision }) => ({ id, revision })); m.resumos.mockClear();
    const poll = await SincronizarQuadroBpm("pipeline", { conhecidos }); expect(poll.success).toBe(true); expect(m.resumos).not.toHaveBeenCalled();
    await SincronizarQuadroBpm("pipeline", { conhecidos, forcar: true }); expect(m.resumos).toHaveBeenCalledOnce();
  });
  it("lead sem vínculo é compartilhado apenas dentro do pipeline acessível", async () => {
    m.leads.mockResolvedValue([{ id: "noloss", nome: "Lead livre" }]);
    m.resumos.mockResolvedValue({ success: true, data: [{ id: "c1" }, { id: "noloss" }] });
    const r = await SincronizarQuadroBpm("pipeline"); if (!r.success) throw new Error("fixture");
    expect(r.manifesto.entradas.find((e) => e.id === "noloss")?.responsaveis).toEqual([]);
  });
  it("não conserva card revogado durante a hidratação", async () => {
    m.resumos.mockResolvedValue({ success: true, data: [] }); const r = await SincronizarQuadroBpm("pipeline");
    expect(r).toMatchObject({ success: true, ids: [], manifesto: { entradas: [] } });
  });
  it("limita entrada maliciosa e não consulta banco sem sessão", async () => {
    expect(await SincronizarQuadroBpm("pipeline", { limites: { stage: 100000 } })).toMatchObject({ success: false });
    m.auth.mockResolvedValue(null); expect(await SincronizarQuadroBpm("pipeline")).toMatchObject({ success: false, acessoNegado: true }); expect(m.cards).not.toHaveBeenCalled();
  });
});

it("padrão de admin é meus, mas ele pode selecionar todos", async () => {
  m.usuario.mockResolvedValue({ role: "ADMIN" });
  m.cards.mockResolvedValue([card, { ...card, id: "c2", responsavel: { id: 9, nome: "Equipe" } }]);
  m.resumos.mockImplementation(async (_pipeline, ids: string[]) => ({ success: true, data: ids.map((id) => ({ id })) }));
  const meus = await SincronizarQuadroBpm("pipeline"); expect(meus).toMatchObject({ success: true, ids: ["c1"] });
  const todos = await SincronizarQuadroBpm("pipeline", { visao: "TODOS" }); expect(todos).toMatchObject({ success: true, ids: ["c1", "c2"] });
});
it.each(["Comercial", "TI"])("não aceita pessoa fora do catálogo ou setor inválido, perfil %s", async (role) => {
  m.usuario.mockResolvedValue({ role });
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS", responsavelId: 99 })).toMatchObject({ success: false, visaoRevogada: true });
  expect(await SincronizarQuadroBpm("pipeline", { visao: "SETOR", setorId: 99 })).toMatchObject({ success: false, visaoRevogada: true });
  expect(m.cards).not.toHaveBeenCalled();
});
it("usuário comum seleciona colegas sem cards e todos inclui responsáveis legados", async () => {
  m.cards.mockResolvedValue([card, { ...card, id: "c2", responsavel: { id: 9, nome: "Equipe" } }, { ...card, id: "ti", responsavel: { id: 99, nome: "TI legado" } }]);
  m.usuarios.mockResolvedValue([{ id: 9, nome: "Equipe", role: "Comercial", status: "ATIVO", permissoes: "crm" }, { id: 10, nome: "Sem cards", role: "Comercial", status: "ATIVO", permissoes: "crm" }, { id: 99, nome: "TI legado", role: "TI", status: "ATIVO", permissoes: null }]);
  m.resumos.mockImplementation(async (_pipeline, ids: string[]) => ({ success: true, data: ids.map((id) => ({ id })) }));
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS" })).toMatchObject({ success: true, ids: ["c1", "c2", "ti"], manifesto: { acesso: { responsaveis: [{ id: 9, nome: "Equipe" }, { id: 10, nome: "Sem cards" }] } } });
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS", responsavelId: 9 })).toMatchObject({ success: true, ids: ["c2"] });
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS", responsavelId: 10 })).toMatchObject({ success: true, ids: [] });
  m.overrides.mockResolvedValue([{ usuarioId: 9, modulo: "crm", acao: "REMOVE" }]);
  expect(await SincronizarQuadroBpm("pipeline", { visao: "TODOS", responsavelId: 9 })).toMatchObject({ success: false, visaoRevogada: true });
});
it("oculta colunas sem permissão também em Todos", async () => {
  const pipeline = await m.pipeline();
  m.pipeline.mockResolvedValue({ ...pipeline, etapas: [{ ...pipeline.etapas[0], visibilidades: [{ perfil: "Comercial", podeVer: false, podeAgir: false }] }] });
  await SincronizarQuadroBpm("pipeline", { visao: "TODOS" });
  expect(m.cards).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ pipelineId: "pipeline", etapaId: { in: [] } }) }));
});
