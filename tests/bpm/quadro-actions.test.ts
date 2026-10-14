import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), pipeline: vi.fn(), usuario: vi.fn(), cards: vi.fn(), resumos: vi.fn(), leads: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmPipeline: m.acesso, isAdminRole: (role: string) => role === "ADMIN" }));
vi.mock("@/lib/prisma", () => ({ default: { bpmPipeline: { findUnique: m.pipeline }, usuarios: { findUnique: m.usuario }, bpmCard: { findMany: m.cards } } }));
vi.mock("@/actions/bpm/Cards", () => ({ ListarCardsPipelineBpm: m.resumos }));
vi.mock("@/lib/bpm/noloss-leads", () => ({ buscarNolossLeadsPendentes: m.leads }));
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";
const card = { id: "c1", etapaId: "stage", updatedAt: new Date("2026-10-14"), servico: "Radar", status: "ATIVO", empresa: { razaoSocial: "Empresa", nomeFantasia: null, cnpj: null }, responsavel: { id: 7, nome: "Responsável" }, membros: [], vinculosOrigem: [] };
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "7" } }); m.acesso.mockResolvedValue(undefined);
  m.usuario.mockResolvedValue({ role: "Comercial" }); m.pipeline.mockResolvedValue({ nome: "Revisão de Radar", configVersion: 1, etapas: [{ id: "stage", nome: "Novo Lead", ehFinal: false, visibilidades: [], automacoes: [] }] });
  m.cards.mockResolvedValue([card]); m.leads.mockResolvedValue([]); m.resumos.mockResolvedValue({ success: true, data: [{ id: "c1" }] });
});
describe("sincronização do quadro", () => {
  it("nega pipeline revogado antes de consultar cards", async () => {
    m.acesso.mockRejectedValue(new Error("Não autorizado"));
    expect(await SincronizarQuadroBpm("pipeline")).toMatchObject({ success: false, acessoNegado: true }); expect(m.cards).not.toHaveBeenCalled(); expect(m.leads).not.toHaveBeenCalled();
  });
  it("reaplica vínculo no servidor e revalida resumos na hidratação", async () => {
    const r = await SincronizarQuadroBpm("pipeline"); expect(r.success).toBe(true);
    expect(m.cards).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ pipelineId: "pipeline", AND: [{ OR: [{ responsavelId: 7 }, { membros: { some: { userId: 7 } } }] }] }) }));
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
