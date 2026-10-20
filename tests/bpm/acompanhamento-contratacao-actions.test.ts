import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), carregar: vi.fn(), registrar: vi.fn(), tarefa: vi.fn(), update: vi.fn(), upsert: vi.fn(), campo: vi.fn(), valor: vi.fn(), salvarValor: vi.fn(), evento: vi.fn(), notificar: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: async (fn: (tx: unknown) => unknown) => fn({
  bpmCard: { updateMany: m.update }, bpmTarefa: { findUnique: m.tarefa, upsert: m.upsert },
  bpmCampo: { findFirst: m.campo }, bpmCardCampoValor: { findUnique: m.valor, upsert: m.salvarValor },
}) } }));
vi.mock("@/lib/bpm/contratacao-comercial-server", () => ({ acessoAcompanhamentoComercial: m.acesso, carregarAcompanhamentoComercial: m.carregar,
  registrarEventoAcompanhamento: m.registrar, idTarefaContratacao: (tipo: string, c: string, f: string, a = "") => `${tipo}:${c}:${f}:${a}` }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: m.evento }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: m.notificar }));
import { AtualizarAcompanhamentoContratacaoBpm } from "@/actions/bpm/AcompanhamentoContratacao";
const versao = "2026-10-20T12:00:00.000Z";
const input = { cardId: "comercial", versao, acao: "REGISTRAR_ENVIO" };
const contexto = () => ({ comercial: { id: "comercial", pipelineId: "radar", responsavelId: 7, updatedAt: new Date(versao), statusPosFechamento: "CONTRATO_A_ENVIAR" },
  financeiro: { id: "financeiro", pipelineId: "fin", responsavelId: 9, updatedAt: new Date(versao), status: "ATIVO" },
  documento: { anexoId: "contrato" }, envioJaAcompanhado: false });
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "7", role: "Comercial" } }); m.acesso.mockResolvedValue(true); m.carregar.mockResolvedValue(contexto()); m.tarefa.mockResolvedValue(null);
  m.update.mockResolvedValue({ count: 1 }); m.campo.mockResolvedValue({ id: "campo-envio" }); m.valor.mockResolvedValue({ valor: "Não" }); });
describe("ações estreitas de contratação", () => {
  it("nega consulta apenas, sem efeitos", async () => { m.acesso.mockResolvedValue(false);
    expect(await AtualizarAcompanhamentoContratacaoBpm(input)).toMatchObject({ success: false, error: "Não autorizado" });
    expect(m.update).not.toHaveBeenCalled(); expect(m.notificar).not.toHaveBeenCalled(); });
  it("exige documento validado e versão atual", async () => {
    m.carregar.mockResolvedValue({ ...contexto(), documento: null });
    expect(await AtualizarAcompanhamentoContratacaoBpm(input)).toMatchObject({ success: false });
    m.carregar.mockResolvedValue(contexto());
    expect(await AtualizarAcompanhamentoContratacaoBpm({ ...input, versao: "2026-10-19T12:00:00.000Z" })).toMatchObject({ success: false });
    expect(m.update).not.toHaveBeenCalled(); });
  it("registra envio nos dois cards e publica alteração canônica após CAS", async () => {
    expect(await AtualizarAcompanhamentoContratacaoBpm(input)).toMatchObject({ success: true, alterado: true });
    expect(m.update).toHaveBeenCalledTimes(2);
    expect(m.salvarValor).toHaveBeenCalledWith(expect.objectContaining({ update: { valor: "Sim" }, where: { cardId_campoId: { cardId: "financeiro", campoId: "campo-envio" } } }));
    expect(m.evento).toHaveBeenCalledWith(expect.objectContaining({ tipo: "CAMPO_ALTERADO", cardId: "financeiro", valorNovo: { campoId: "campo-envio", valor: "Sim" } }), expect.anything());
    expect(m.registrar).toHaveBeenCalledTimes(2); expect(m.notificar).toHaveBeenCalledTimes(2);
  });
  it("pagamento só cria tarefa no mesmo Financeiro, nunca altera seus campos", async () => {
    const pagamento = { ...input, acao: "CONFERIR_PAGAMENTO" };
    expect(await AtualizarAcompanhamentoContratacaoBpm(pagamento)).toMatchObject({ success: true });
    expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ cardId: "financeiro", status: "PENDENTE" }) }));
    expect(m.salvarValor).not.toHaveBeenCalled();
    expect(m.update.mock.calls[0][0].data).not.toHaveProperty("statusPosFechamento");
    m.tarefa.mockResolvedValue({ id: "existente", status: "CONCLUIDA" });
    expect(await AtualizarAcompanhamentoContratacaoBpm(pagamento)).toMatchObject({ success: true, alterado: false });
    expect(m.upsert).toHaveBeenCalledOnce();
  });
  it.each([0, 1])("conflito no CAS %i não emite realtime nem cria tarefa", async (index) => {
    if (index) m.update.mockResolvedValueOnce({ count: 1 });
    m.update.mockResolvedValueOnce({ count: 0 });
    expect(await AtualizarAcompanhamentoContratacaoBpm(input)).toMatchObject({ success: false });
    expect(m.upsert).not.toHaveBeenCalled(); expect(m.notificar).not.toHaveBeenCalled();
  });
  it("não reenvia quando o Financeiro já avançou", async () => {
    m.carregar.mockResolvedValue({ ...contexto(), envioJaAcompanhado: true });
    expect(await AtualizarAcompanhamentoContratacaoBpm(input)).toMatchObject({ success: false });
    expect(m.update).not.toHaveBeenCalled();
  });
});
