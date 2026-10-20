import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  acesso: vi.fn(),
  tarefaFindUnique: vi.fn(),
  tarefaUpdateMany: vi.fn(),
  cardFindUnique: vi.fn(),
  transaction: vi.fn(),
  historico: vi.fn(),
  realtime: vi.fn(),
  evento: vi.fn(),
  sla: vi.fn(),
  reconciliar: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmTarefa: { findUnique: mocks.tarefaFindUnique },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: mocks.acesso,
  checarAcessoConfigPipeline: vi.fn(),
  exigirAcessoBpmPipeline: vi.fn(),
  exigirAcessoConfigPipeline: vi.fn(),
  exigirAcessoModuloBpm: vi.fn(),
}));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: mocks.historico }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.realtime }));
vi.mock("@/lib/bpm/automacoes/fila", () => ({ enfileirarAutomacoesCriacaoTarefaBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: mocks.evento }));
vi.mock("@/lib/bpm/sla", () => ({ criarSlaInstancia: mocks.sla }));
vi.mock("@/lib/bpm/checklists/reconciliacao-tarefa", () => ({
  MENSAGEM_TAREFA_CHECKLIST_PENDENTE: "Esta tarefa é controlada pelo procedimento. Conclua os itens do procedimento para finalizá-la.",
  reconciliarTarefaChecklist: mocks.reconciliar,
}));

import { ConcluirTarefaBpm } from "@/actions/bpm/Tarefas";

const TAREFA_ID = "cm12345678901234567890123";
const tarefaBase = {
  id: TAREFA_ID,
  cardId: "card-1",
  titulo: "Procedimento: Documentos",
  tipo: "CHECKLIST",
  status: "PENDENTE",
  cardChecklistId: "checklist-1",
  cardChecklist: { id: "checklist-1", itens: [{ status: "PENDENTE" }] },
};

describe("conclusão de tarefa derivada de checklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.acesso.mockResolvedValue(undefined);
    mocks.tarefaUpdateMany.mockResolvedValue({ count: 1 });
    mocks.realtime.mockResolvedValue(undefined);
    mocks.revalidate.mockReturnValue(undefined);
    mocks.tarefaFindUnique.mockResolvedValue({ id: TAREFA_ID, cardId: "card-1" });
    mocks.cardFindUnique.mockResolvedValue({ pipelineId: "pipeline-1" });
    mocks.transaction.mockImplementation((operacao) => operacao({
      bpmTarefa: { findUnique: mocks.tarefaFindUnique, updateMany: mocks.tarefaUpdateMany },
      bpmCard: { findUnique: mocks.cardFindUnique },
    }));
  });

  it("recusa conclusão manual enquanto existe item pendente", async () => {
    mocks.tarefaFindUnique
      .mockResolvedValueOnce({ id: TAREFA_ID, cardId: "card-1" })
      .mockResolvedValueOnce(tarefaBase);
    const resultado = await ConcluirTarefaBpm({ tarefaId: TAREFA_ID });
    expect(resultado).toEqual({
      success: false,
      error: "Esta tarefa é controlada pelo procedimento. Conclua os itens do procedimento para finalizá-la.",
    });
    expect(mocks.tarefaUpdateMany).not.toHaveBeenCalled();
    expect(mocks.reconciliar).not.toHaveBeenCalled();
  });

  it("delega ao reconciliador quando o checklist já está concluído", async () => {
    mocks.tarefaFindUnique
      .mockResolvedValueOnce({ id: TAREFA_ID, cardId: "card-1" })
      .mockResolvedValueOnce({ ...tarefaBase, cardChecklist: { id: "checklist-1", itens: [{ status: "CONCLUIDO" }] } });
    mocks.reconciliar.mockResolvedValue({ acao: "CONCLUIDA" });
    const resultado = await ConcluirTarefaBpm({ tarefaId: TAREFA_ID });
    expect(resultado).toEqual({ success: true });
    expect(mocks.reconciliar).toHaveBeenCalledWith(expect.objectContaining({ checklistId: "checklist-1" }), expect.anything());
    expect(mocks.tarefaUpdateMany).not.toHaveBeenCalled();
    expect(mocks.realtime).toHaveBeenCalledTimes(1);
  });

  it("preserva o fluxo normal de tarefas manuais", async () => {
    mocks.tarefaFindUnique
      .mockResolvedValueOnce({ id: TAREFA_ID, cardId: "card-1" })
      .mockResolvedValueOnce({ ...tarefaBase, tipo: "TAREFA", cardChecklistId: null, cardChecklist: null });
    const resultado = await ConcluirTarefaBpm({ tarefaId: TAREFA_ID });
    expect(resultado).toEqual({ success: true });
    expect(mocks.tarefaUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CONCLUIDA" }),
    }));
    expect(mocks.historico).toHaveBeenCalledTimes(1);
    expect(mocks.evento).toHaveBeenCalledTimes(1);
  });

  it("aceita tarefa importada e não retorna erro se o realtime falhar após salvar", async () => {
    const id = `rdtask_${"a".repeat(28)}`;
    mocks.tarefaFindUnique.mockResolvedValue({ ...tarefaBase, id, tipo: "TAREFA", cardChecklistId: null });
    mocks.realtime.mockRejectedValueOnce(new Error("offline"));
    await expect(ConcluirTarefaBpm({ tarefaId: id })).resolves.toEqual({ success: true });
    expect(mocks.tarefaUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id, cardId: "card-1", status: "PENDENTE" },
    }));
  });

  it("não repete histórico, evento ou SLA se outra solicitação já concluiu", async () => {
    mocks.tarefaFindUnique
      .mockResolvedValueOnce({ id: TAREFA_ID, cardId: "card-1" })
      .mockResolvedValueOnce({ ...tarefaBase, cardChecklistId: null })
      .mockResolvedValueOnce({ status: "CONCLUIDA" });
    mocks.tarefaUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(ConcluirTarefaBpm({ tarefaId: TAREFA_ID })).resolves.toEqual({ success: true });
    expect(mocks.historico).not.toHaveBeenCalled();
    expect(mocks.evento).not.toHaveBeenCalled();
    expect(mocks.sla).not.toHaveBeenCalled();
    expect(mocks.realtime).not.toHaveBeenCalled();
  });

  it("não informa conclusão se outra solicitação cancelou a tarefa", async () => {
    mocks.tarefaFindUnique
      .mockResolvedValueOnce({ id: TAREFA_ID, cardId: "card-1" })
      .mockResolvedValueOnce({ ...tarefaBase, cardChecklistId: null })
      .mockResolvedValueOnce({ status: "CANCELADA" });
    mocks.tarefaUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(ConcluirTarefaBpm({ tarefaId: TAREFA_ID })).resolves.toEqual({ success: false, error: "Tarefa cancelada não pode ser concluída" });
    expect(mocks.historico).not.toHaveBeenCalled();
  });

  it("revalida a permissão dentro da transação", async () => {
    mocks.tarefaFindUnique.mockResolvedValue({ ...tarefaBase, cardChecklistId: null });
    mocks.acesso.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Não autorizado"));
    await expect(ConcluirTarefaBpm({ tarefaId: TAREFA_ID })).resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(mocks.tarefaUpdateMany).not.toHaveBeenCalled();
  });

  it("não acessa dados sem sessão", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(ConcluirTarefaBpm({ tarefaId: TAREFA_ID }))
      .resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(mocks.tarefaFindUnique).not.toHaveBeenCalled();
  });
});
