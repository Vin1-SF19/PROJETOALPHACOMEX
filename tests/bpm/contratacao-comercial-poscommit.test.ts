import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ tarefa: vi.fn(), alerta: vi.fn(), realtime: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { bpmTarefa: { findUnique: m.tarefa } } }));
vi.mock("@/lib/bpm/alertas-tarefas", () => ({ dispararAlertaTarefaBpm: m.alerta, tarefaAlertaSelect: { id: true } }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: m.realtime }));
import { notificarContratacaoComercialPosCommit } from "@/lib/bpm/contratacao-comercial-server";
beforeEach(() => vi.resetAllMocks());
describe("efeitos documentais após commit", () => {
  it("alerta usa tarefa canônica após commit; falha de push não transforma documento confirmado em erro", async () => {
    const tarefa = { id: "enviar-contrato", alertaEm: new Date() };
    m.tarefa.mockResolvedValue(tarefa);
    m.alerta.mockRejectedValue(new Error("Pusher indisponível"));
    m.realtime.mockRejectedValue(new Error("Realtime indisponível"));
    await expect(notificarContratacaoComercialPosCommit({ cardId: "comercial", pipelineId: "radar", tarefaAlertaId: tarefa.id })).resolves.toBeUndefined();
    expect(m.alerta).toHaveBeenCalledWith(tarefa, expect.any(Date));
  });
  it("alteração só do assinado invalida anexos mas não emite novo alerta de envio", async () => {
    await notificarContratacaoComercialPosCommit({ cardId: "comercial", pipelineId: "radar" });
    expect(m.realtime).toHaveBeenCalledWith({ cardId: "comercial", pipelineId: "radar", tipo: "ANEXO_ALTERADO" });
    expect(m.tarefa).not.toHaveBeenCalled();
    expect(m.alerta).not.toHaveBeenCalled();
  });
  it("replay sem efeitos não consulta nem escreve notificações", async () => {
    await notificarContratacaoComercialPosCommit(null);
    expect(m.tarefa).not.toHaveBeenCalled(); expect(m.realtime).not.toHaveBeenCalled();
  });
});
