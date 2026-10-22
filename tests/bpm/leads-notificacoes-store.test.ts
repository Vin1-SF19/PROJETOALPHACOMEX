// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBpmLeadsNotificacoes as store } from "@/store/useBpmLeadsNotificacoes";
import type { AlertaLeadBpm } from "@/lib/bpm/notificacoes-leads";
export const lead: AlertaLeadBpm = {
  id: "instagram:pipeline:lead-1", tipo: "LEAD_SEM_RESPONSAVEL", fonte: "INSTAGRAM", origem: "INSTAGRAM",
  pipelineId: "pipeline", pipelineNome: "Comercial", etapaId: "novo", etapaNome: "Novo lead", nome: "Cliente fictício",
  email: "teste@example.invalid", telefone: "11999990000", cnpj: null, resumo: "Deseja Radar", recebidoEm: "2026-10-22T12:00:00.000Z",
  destino: { tipo: "LEAD_VIRTUAL", pipelineId: "pipeline", origemLead: "instagram", leadId: "lead-1" }, responsaveisAnteriores: [],
};
describe("pendências compartilhadas de leads", () => {
  beforeEach(() => { localStorage.clear(); store.getState().iniciarUsuario(0); store.getState().iniciarUsuario(7); });
  it("deduplica toast sem esconder a pendência após remontagem ou reconhecimento", () => {
    expect(store.getState().sincronizar(7, [lead, lead])).toEqual([lead]);
    expect(store.getState().sincronizar(7, [lead])).toEqual([]);
    store.getState().iniciarUsuario(0); store.getState().iniciarUsuario(7);
    expect(store.getState().sincronizar(7, [lead])).toEqual([]);
    expect(store.getState().notificacoes).toEqual([lead]);
    const salvo = localStorage.getItem("bpm_leads_vistos_v1_7")!;
    expect(JSON.parse(salvo)).toEqual([lead.id]); expect(salvo).not.toContain(lead.nome);
    expect(salvo).not.toContain(lead.email);
  });
  it("resolve apenas pelo snapshot completo e não ressuscita por respostas de outra conta", () => {
    store.getState().sincronizar(7, [lead]); store.getState().sincronizar(7, []);
    expect(store.getState().notificacoes).toEqual([]);
    store.getState().iniciarUsuario(8);
    expect(store.getState().sincronizar(7, [lead])).toEqual([]);
    expect(store.getState().notificacoes).toEqual([]);
    expect(store.getState().sincronizar(8, [lead])).toEqual([lead]);
  });
  it("reconhece IDs de outra aba e mantém fallback sem armazenamento", () => {
    localStorage.setItem("bpm_leads_vistos_v1_7", JSON.stringify([lead.id]));
    expect(store.getState().sincronizar(7, [lead])).toEqual([]);
    const gravar = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("indisponível"); });
    try {
      const outro = { ...lead, id: "outro" };
      expect(store.getState().sincronizar(7, [outro])).toEqual([outro]);
      expect(store.getState().sincronizar(7, [outro])).toEqual([]);
    } finally { gravar.mockRestore(); }
  });
});
