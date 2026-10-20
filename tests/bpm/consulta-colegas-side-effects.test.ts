import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(), usuario: vi.fn(), card: vi.fn(), membro: vi.fn(), transaction: vi.fn(),
  campos: vi.fn(), valores: vi.fn(), upsert: vi.fn(), update: vi.fn(),
  materializar: vi.fn(), listar: vi.fn(), evento: vi.fn(), historico: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {
  usuarios: { findUnique: m.usuario }, setorPermissao: { findMany: async () => [] },
  usuarioPermissaoOverride: { findMany: async () => [] },
  bpmCard: { findUnique: m.card, updateMany: m.update }, bpmCardMembro: { findUnique: m.membro },
  bpmCampo: { findMany: m.campos }, bpmCardCampoValor: { findMany: m.valores, upsert: m.upsert },
  $transaction: m.transaction,
} }));
vi.mock("@/lib/bpm/checklists/service", () => ({ materializarChecklistsAplicaveisCard: m.materializar, listarChecklistsMaterializadosCard: m.listar }));
vi.mock("@/lib/bpm/checklists/integracao", () => ({ carregarResumoChecklistAplicavelCard: vi.fn() }));
vi.mock("@/lib/bpm/checklists/reconciliacao-tarefa", () => ({ reconciliarTarefaChecklist: vi.fn() }));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: m.historico }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: m.evento }));
vi.mock("@/lib/bpm/financeiro-nota-fiscal-server", () => ({ sincronizarNotaFiscalCard: vi.fn() }));
vi.mock("@/lib/bpm/financeiro-nota-fiscal", () => ({ resolverCamposNotaFiscal: () => Object.fromEntries(["emitida", "dataEmissao", "numero", "valor", "link"].map((id) => [id, { id }])), validarDadosNotaFiscal: (dados: unknown) => dados, pendenciasNotaFiscal: () => [] }));
import db from "@/lib/prisma";
import { ObterNotaFiscalFinanceiroBpm, SalvarNotaFiscalFinanceiroBpm } from "@/actions/bpm/NotaFiscal";
import { ListarChecklistsCardBpm } from "@/actions/bpm/Checklists";
const card = { id: "cm12345678901234567890123", pipelineId: "financeiro", etapaId: "final", responsavelId: 2, status: "CONCLUIDO", updatedAt: new Date("2026-10-14"),
  pipeline: { chave: "financeiro", setores: [{ setor: { nome: "Financeiro" } }] },
  etapa: { nome: "Concluído", ehFinal: true, visibilidades: [] }, vinculosOrigem: [] };
const nota = { cardId: "cm12345678901234567890123", emitida: "", dataEmissao: "", numero: "", valor: "", link: "" };
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "7", role: "Financeiro" } });
  m.usuario.mockResolvedValue({ id: 7, role: "Financeiro", status: "ATIVO", permissoes: "crm" });
  m.card.mockResolvedValue(card); m.membro.mockResolvedValue(null);
  m.transaction.mockImplementation((callback) => callback(db));
  m.campos.mockResolvedValue([]); m.valores.mockResolvedValue([]);
  m.listar.mockResolvedValue([{ id: "existente" }]);
  m.materializar.mockResolvedValue({ checklists: [{ id: "novo" }], criados: ["novo"] });
});
describe("consulta de colegas não concede mutações por ações de leitura", () => {
  it("NF de colega concluído permanece consultável sem edição ou gravação", async () => {
    expect(await ObterNotaFiscalFinanceiroBpm("cm12345678901234567890123")).toMatchObject({ success: true, data: { podeEditar: false } });
    expect(await SalvarNotaFiscalFinanceiroBpm(nota)).toMatchObject({ success: false, error: "Não autorizado" });
    expect(m.upsert).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled(); expect(m.evento).not.toHaveBeenCalled();
  });
  it("preserva a edição específica da NF concluída para responsável", async () => {
    m.card.mockResolvedValue({ ...card, responsavelId: 7 });
    expect(await ObterNotaFiscalFinanceiroBpm("cm12345678901234567890123")).toMatchObject({ success: true, data: { podeEditar: true } });
    expect(await SalvarNotaFiscalFinanceiroBpm(nota)).toMatchObject({ success: true });
  });
  it("visualizador recebe somente checklists existentes sem materialização nem histórico", async () => {
    m.card.mockResolvedValue({ ...card, status: "ATIVO", etapa: { ...card.etapa, ehFinal: false } });
    expect(await ListarChecklistsCardBpm({ cardId: "cm12345678901234567890123" })).toMatchObject({ success: true, data: [{ id: "existente" }], materializados: 0 });
    expect(m.listar).toHaveBeenCalledWith("cm12345678901234567890123"); expect(m.materializar).not.toHaveBeenCalled(); expect(m.historico).not.toHaveBeenCalled();
  });
  it("responsável continua materializando checklists aplicáveis ao trabalhar card ativo", async () => {
    m.card.mockResolvedValue({ ...card, responsavelId: 7, status: "ATIVO", etapa: { ...card.etapa, ehFinal: false } });
    expect(await ListarChecklistsCardBpm({ cardId: "cm12345678901234567890123" })).toMatchObject({ success: true, data: [{ id: "novo" }], materializados: 1 });
    expect(m.materializar).toHaveBeenCalledWith({ cardId: "cm12345678901234567890123", usuarioId: 7 }); expect(m.listar).not.toHaveBeenCalled();
  });
});
