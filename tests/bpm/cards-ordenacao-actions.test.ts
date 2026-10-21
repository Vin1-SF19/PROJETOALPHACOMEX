import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), pipeline: vi.fn(), usuario: vi.fn(), cards: vi.fn(), leads: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmPipeline: { findUnique: m.pipeline }, usuarios: { findUnique: m.usuario },
  bpmCard: { findMany: m.cards }, nolossLead: { findMany: m.leads },
  bpmEtapaCardViewConfig: { findMany: async () => [] }, bpmInteracaoCard: { findMany: async () => [] },
} }));
vi.mock("@/lib/bpm/visao-equipe-server", () => ({ carregarEscopoLeituraBpm: async () => ({ where: {}, setores: [], responsaveis: [] }) }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmPipeline: m.acesso, exigirAcessoBpmCard: vi.fn(), exigirAcessoModuloBpm: vi.fn(),
  checarAcessoConfigPipeline: async () => true, isAdminRole: () => true, usuarioElegivelResponsavelBpm: vi.fn(),
}));
vi.mock("@/lib/bpm/sla", () => ({ obterStatusSlaCards: async () => new Map(), prioridadeStatusSla: () => 0, criarSlaInstancia: vi.fn() }));
import { ListarCardsPipelineBpm } from "@/actions/bpm/Cards";
import { buscarNolossLeadsPendentes } from "@/lib/bpm/noloss-leads";

const antigo = {
  id: "real-antigo", etapaId: "novos", createdAt: new Date("2026-10-01T12:00:00Z"),
  status: "ATIVO", servico: null, origemExterna: null, nolossLeadOrigem: [], vinculosOrigem: [],
  empresa: { id: 1, razaoSocial: "Empresa teste", nomeFantasia: null, cnpj: null },
  responsavel: { id: 7, nome: "Maria" }, membros: [], tarefas: [], campoValores: [],
  _count: { tarefas: 0, anexos: 0 },
};
const lead = (id: string, data: string) => ({ id, nome: id, email: null, telefone: null, receivedAt: new Date(data), utmSource: null, utmMedium: null, utmCampaign: null });
beforeEach(() => {
  vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "7", role: "ADMIN" } }); m.acesso.mockResolvedValue(undefined);
  m.usuario.mockResolvedValue({ role: "ADMIN" });
  m.pipeline.mockResolvedValue({ nome: "Revisão de Radar", setores: [], etapas: [{ id: "novos", nome: "Novos leads", ehFinal: false, visibilidades: [], automacoes: [] }] });
  m.cards.mockResolvedValue([antigo, { ...antigo, id: "real-novo", createdAt: new Date("2026-10-20T12:00:00Z") }]);
  m.leads.mockResolvedValue([lead("noloss-antigo", "2026-10-10T12:00:00Z"), lead("noloss-novo", "2026-10-21T12:00:00Z")]);
});
describe("hidratação real dos cards do funil", () => {
  it("intercala cards e NoLoss pela mesma cronologia na carga inicial", async () => {
    const resultado = await ListarCardsPipelineBpm("pipeline");
    expect(resultado.success).toBe(true);
    expect(resultado.data.map((card) => card.id)).toEqual(["noloss-novo", "real-novo", "noloss-antigo", "real-antigo"]);
    expect(resultado.data[0].createdAt).toEqual(new Date("2026-10-21T12:00:00Z"));
    expect(m.cards).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
  });
  it("mantém seleção de IDs na hidratação parcial e revalida o acesso", async () => {
    const resultado = await ListarCardsPipelineBpm("pipeline", ["noloss-novo", "real-antigo"]);
    expect(resultado.data.map((card) => card.id)).toEqual(["noloss-novo", "real-antigo"]);
    m.acesso.mockRejectedValue(new Error("Revogado"));
    expect(await ListarCardsPipelineBpm("pipeline")).toMatchObject({ success: false, data: [] });
  });
  it("consulta leads pendentes por recebimento e ID decrescentes", async () => {
    await buscarNolossLeadsPendentes();
    expect(m.leads).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "pending" }, orderBy: [{ receivedAt: "desc" }, { id: "desc" }] }));
  });
});
