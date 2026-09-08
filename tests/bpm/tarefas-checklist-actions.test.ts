import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  acesso: vi.fn(),
  tarefaFindUnique: vi.fn(),
  tarefaUpdate: vi.fn(),
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
  checarAcessoDiretoriaBpm: vi.fn(),
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
  MENSAGEM_TAREFA_CHECKLIST_PENDENTE: "Esta tarefa é controlada pelo checklist. Conclua os itens do checklist para finalizá-la.",
  reconciliarTarefaChecklist: mocks.reconciliar,
}));

import { ConcluirTarefaBpm } from "@/actions/bpm/Tarefas";

const TAREFA_ID = "cm12345678901234567890123";
const tarefaBase = {
  id: TAREFA_ID,
  cardId: "card-1",
  titulo: "Checklist: Documentos",
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
    mocks.tarefaFindUnique.mockResolvedValue({ id: TAREFA_ID, cardId: "card-1" });
    mocks.cardFindUnique.mockResolvedValue({ pipelineId: "pipeline-1" });
    mocks.transaction.mockImplementation((operacao) => operacao({
      bpmTarefa: { findUnique: mocks.tarefaFindUnique, update: mocks.tarefaUpdate },
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
      error: "Esta tarefa é controlada pelo checklist. Conclua os itens do checklist para finalizá-la.",
    });
    expect(mocks.tarefaUpdate).not.toHaveBeenCalled();
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
    expect(mocks.tarefaUpdate).not.toHaveBeenCalled();
    expect(mocks.realtime).toHaveBeenCalledTimes(1);
  });

  it("preserva o fluxo normal de tarefas manuais", async () => {
    mocks.tarefaFindUnique
      .mockResolvedValueOnce({ id: TAREFA_ID, cardId: "card-1" })
      .mockResolvedValueOnce({ ...tarefaBase, tipo: "TAREFA", cardChecklistId: null, cardChecklist: null });
    const resultado = await ConcluirTarefaBpm({ tarefaId: TAREFA_ID });
    expect(resultado).toEqual({ success: true });
    expect(mocks.tarefaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CONCLUIDA" }),
    }));
    expect(mocks.historico).toHaveBeenCalledTimes(1);
    expect(mocks.evento).toHaveBeenCalledTimes(1);
  });

  it("não acessa dados sem sessão", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(ConcluirTarefaBpm({ tarefaId: TAREFA_ID }))
      .resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(mocks.tarefaFindUnique).not.toHaveBeenCalled();
  });
});
