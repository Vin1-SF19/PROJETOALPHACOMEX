import { beforeEach, describe, expect, it } from "vitest";
import { useBpmTarefasNotificacoes as store } from "@/store/useBpmTarefasNotificacoes";
import { detalhesAlertaTarefaBpm, extrairUsuarioIdCanalTarefasBpm, urlCardAlertaBpm, type AlertaTarefaBpm } from "@/lib/bpm/notificacoes-tarefas";
const alerta: AlertaTarefaBpm = {
  id: "task:2026-10-20T14:00:00Z", tarefaId: "task", cardId: "card", pipelineId: "pipeline",
  titulo: "Retornar", descricao: "Documentos pendentes", tipo: "LIGACAO", prioridade: "ALTA", empresaNome: "Green Coast",
  pipelineNome: "Comercial", etapaNome: "Em tratativa", responsavelNome: "Vitor",
  alertaEm: "2026-10-20T14:00:00Z", prazo: "2026-10-20T15:00:00Z",
};
describe("notificações de tarefas por usuário", () => {
  beforeEach(() => { store.getState().iniciarUsuario(0); store.getState().iniciarUsuario(7); });
  it("deduplica por tarefa+alerta, preserva lida e removida e elimina concluídas/revogadas", () => {
    expect(store.getState().sincronizar(7, [alerta, alerta])).toHaveLength(1);
    store.getState().marcarTodasLidas();
    expect(store.getState().sincronizar(7, [alerta])).toHaveLength(0);
    expect(store.getState().notificacoes[0].lida).toBe(true);
    store.getState().removerNotificacao(alerta.id);
    expect(store.getState().sincronizar(7, [alerta])).toHaveLength(0);
    expect(store.getState().notificacoes).toHaveLength(0);
    const reagendado = { ...alerta, id: "novo-horario", alertaEm: "2026-10-21T14:00:00Z" };
    expect(store.getState().sincronizar(7, [reagendado])).toHaveLength(1);
    store.getState().sincronizar(7, []);
    expect(store.getState().notificacoes).toHaveLength(0);
  });
  it("descarta resposta antiga após troca de conta", () => {
    store.getState().sincronizar(7, [alerta]); store.getState().iniciarUsuario(8);
    expect(store.getState().sincronizar(7, [alerta])).toHaveLength(0);
    expect(store.getState().notificacoes).toHaveLength(0);
  });
  it("apresenta horários de Brasília e contexto completo com link do card", () => {
    const detalhes = detalhesAlertaTarefaBpm(alerta);
    for (const texto of ["20/10/2026", "11:00", "12:00", "Brasília", "Green Coast", "Comercial", "Em tratativa", "Vitor", "Documentos pendentes"]) expect(detalhes).toContain(texto);
    expect(urlCardAlertaBpm(alerta)).toBe("/PainelAlpha/AlphaCRM/pipeline/pipeline?cardId=card");
    expect(extrairUsuarioIdCanalTarefasBpm("private-bpm-tarefas-usuario-7")).toBe(7);
    for (const sufixo of ["7-extra", "-7", "7.0", "0", "007", "9007199254740993"])
      expect(extrairUsuarioIdCanalTarefasBpm(`private-bpm-tarefas-usuario-${sufixo}`)).toBeNull();
  });
});
