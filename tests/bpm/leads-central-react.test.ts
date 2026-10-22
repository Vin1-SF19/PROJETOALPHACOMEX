// @vitest-environment happy-dom
import { act, createElement as h, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: { div: ({ children, className }: { children: ReactNode; className?: string }) => h("div", { className }, children),
    span: ({ children, className }: { children: ReactNode; className?: string }) => h("span", { className }, children) },
}));
import { CentralNotificacoesPainel } from "@/components/layout/CentralNotificacoesPainel";
import { useBpmLeadsNotificacoes as leads } from "@/store/useBpmLeadsNotificacoes";
import { useBpmTarefasNotificacoes as tarefas } from "@/store/useBpmTarefasNotificacoes";
import type { AlertaLeadBpm } from "@/lib/bpm/notificacoes-leads";
const lead: AlertaLeadBpm = {
  id: "ig:1", tipo: "LEAD_SEM_RESPONSAVEL", fonte: "INSTAGRAM", origem: "INSTAGRAM", pipelineId: "p", pipelineNome: "Comercial",
  etapaId: "novo", etapaNome: "Novo lead", nome: "Empresa fictícia", email: "teste@example.invalid", telefone: null, cnpj: null, resumo: null,
  recebidoEm: "2026-10-22T12:00:00.000Z", destino: { tipo: "LEAD_VIRTUAL", pipelineId: "p", origemLead: "instagram", leadId: "ig-1" }, responsaveisAnteriores: [],
};
describe("central mantém lead até assunção canônica", () => {
  let host: HTMLDivElement; let root: ReturnType<typeof createRoot>; const abrir = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    leads.getState().iniciarUsuario(0); leads.getState().iniciarUsuario(7); leads.getState().sincronizar(7, [lead]);
    tarefas.getState().iniciarUsuario(0); tarefas.getState().iniciarUsuario(7);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
  const clicarTexto = (texto: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(texto))!.click();
  it("ler automaticamente, marcar todas e clicar não removem nem oferecem X para lead", async () => {
    await act(async () => root.render(h(CentralNotificacoesPainel, { onAbrirAgenda: vi.fn(), onAbrirModulo: abrir, onAbrirNota: vi.fn() })));
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Notificações"]')!.click());
    expect(host.textContent).toContain("Empresa fictícia"); expect(host.textContent).toContain("Ninguém assumiu ainda");
    expect(host.querySelector('button[aria-label="Remover notificação de CRM · Leads"]')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); clicarTexto("Marcar lidas"); });
    expect(leads.getState().notificacoes).toHaveLength(1); expect(host.textContent).toContain("Empresa fictícia");
    await act(async () => clicarTexto("Empresa fictícia"));
    expect(abrir).toHaveBeenCalledWith("/PainelAlpha/AlphaCRM/pipeline/p?origemLead=instagram&leadId=ig-1", "CRM");
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Notificações"]')!.click());
    expect(host.textContent).toContain("Empresa fictícia");
    await act(async () => leads.getState().sincronizar(7, []));
    expect(host.textContent).not.toContain("Empresa fictícia"); expect(host.textContent).toContain("Nenhuma notificação");
  });
});
