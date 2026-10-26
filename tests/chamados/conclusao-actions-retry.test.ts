import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(), updateMany: vi.fn(), feedback: vi.fn(),
  agenda: vi.fn(), notificar: vi.fn(), notificarAgenda: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction, protocoloTemplate: {} } }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: vi.fn() } }));
vi.mock("@/lib/chamados/tarefa-agendada", () => ({ concluirTarefaAgendadaDoChamado: mocks.agenda, criarTarefaAgendadaParaChamado: vi.fn() }));
vi.mock("@/lib/chamados/notificacoes-server", () => ({
  notificarAgendaChamadoAtualizada: mocks.notificarAgenda, notificarChamadoConcluido: mocks.notificar,
  notificarChamadoAssumido: vi.fn(), notificarMensagemChamado: vi.fn(), notificarNovoChamado: vi.fn(),
}));
import { updateChamadosStatus } from "@/actions/chamados";
import { finalizarComProtocolo } from "@/actions/protocolos";

const tx = {
  usuarios: { findUnique: vi.fn() }, setor: { findMany: vi.fn() },
  chamados: { findUnique: vi.fn(), updateMany: mocks.updateMany }, chamadoFeedback: { create: mocks.feedback },
};
const fluxos = [
  { nome: "rápido", executar: () => updateChamadosStatus(10, "CONCLUIDO", "Perfil liberado") },
  { nome: "protocolo", executar: () => finalizarComProtocolo(10, { solucao: "Perfil liberado", causa: "Permissão", mensagemFinal: "Resolvido" }) },
];

describe.each(fluxos)("conclusão $nome com serviço transacional real", ({ executar }) => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "3" } });
    vi.useFakeTimers();
    tx.usuarios.findUnique.mockResolvedValue({ id: 3, nome: "Técnico", role: "TI", status: "ATIVO" });
    tx.setor.findMany.mockResolvedValue([{ id: 14, nome: "TI" }]);
    tx.chamados.findUnique.mockResolvedValue({
      id: 10, titulo: "Teste sintético", usuarioId: 7, tecnicoId: 3, status: "EM_ATENDIMENTO",
      tecnico: { role: "TI", status: "ATIVO" }, setorDestinoId: null,
    });
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.feedback.mockResolvedValue({ chamadoId: 10 });
  });
  afterEach(() => vi.useRealTimers());

  it("notifica e atualiza a Agenda uma única vez, somente após o retry confirmar", async () => {
    mocks.updateMany.mockRejectedValueOnce(new Error("SQLITE_BUSY: database is locked"));
    const resultado = executar();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.notificar).not.toHaveBeenCalled();
    expect(mocks.agenda).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(await resultado).toEqual({ success: true });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.feedback).toHaveBeenCalledOnce();
    expect(mocks.notificar).toHaveBeenCalledOnce();
    expect(mocks.notificarAgenda).toHaveBeenCalledOnce();
    expect(mocks.agenda).toHaveBeenCalledOnce();
  });

  it("retorna orientação segura após quatro locks e não dispara efeitos externos", async () => {
    mocks.updateMany.mockRejectedValue(new Error("SQLITE_BUSY: database is locked"));
    const resultado = executar();
    await vi.advanceTimersByTimeAsync(1_400);
    expect(await resultado).toEqual({ success: false, error: "O banco está ocupado no momento. Aguarde alguns segundos e tente finalizar o chamado novamente." });
    expect(mocks.transaction).toHaveBeenCalledTimes(4);
    expect(mocks.feedback).not.toHaveBeenCalled();
    expect(mocks.notificar).not.toHaveBeenCalled();
    expect(mocks.notificarAgenda).not.toHaveBeenCalled();
    expect(mocks.agenda).not.toHaveBeenCalled();
  });

  it("não refaz uma conclusão confirmada se a Agenda falhar depois do commit", async () => {
    mocks.agenda.mockRejectedValueOnce(new Error("SQLITE_BUSY: database is locked"));
    expect(await executar()).toEqual({ success: true });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.feedback).toHaveBeenCalledOnce();
    expect(mocks.notificar).toHaveBeenCalledOnce();
  });
});
