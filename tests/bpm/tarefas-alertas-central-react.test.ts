// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The central uses the real checklist store, whose persistence crosses Server Actions.
vi.mock("@/actions/checklist/eventos", () => ({ marcarEventoChecklistLido: vi.fn(), listarEventosChecklist: vi.fn() }));
vi.mock("framer-motion", async () => {
  const { createElement, Fragment } = await import("react");
  const elemento = (tag: string) => ({ children, className }: { children?: React.ReactNode; className?: string }) => createElement(tag, { className }, children);
  return { AnimatePresence: Fragment, motion: { span: elemento("span"), div: elemento("div") } };
});
import { CentralNotificacoesPainel } from "@/components/layout/CentralNotificacoesPainel";
import { useBpmTarefasNotificacoes as store } from "@/store/useBpmTarefasNotificacoes";

const alerta = {
  id: "task:2026-10-20T14:00:00.000Z", tarefaId: "task", cardId: "card", pipelineId: "pipeline",
  titulo: "Retornar contato teste", descricao: null, tipo: "TAREFA", prioridade: "NORMAL",
  alertaEm: "2026-10-20T14:00:00.000Z", prazo: null,
  empresaNome: "Teste", pipelineNome: "Comercial", etapaNome: "Tratativa", responsavelNome: "Maria",
};
describe("reconhecimento pelo sino de notificações", () => {
  let root: Root; let host: HTMLDivElement;
  const abrir = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear();
    Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
    store.getState().iniciarUsuario(0); store.getState().iniciarUsuario(7); store.getState().sincronizar(7, [alerta]);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
  async function abrirSino() {
    await act(async () => root.render(h(CentralNotificacoesPainel, { onAbrirModulo: abrir, onAbrirAgenda: vi.fn(), onAbrirNota: vi.fn() })));
    await act(async () => host.querySelector<HTMLButtonElement>('[title="Notificações"]')!.click());
  }
  it("marca o alerta clicado como lido e abre o destino pelo CRM", async () => {
    await abrirSino();
    const item = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes(alerta.titulo))!;
    await act(async () => item.click());
    expect(abrir).toHaveBeenCalledWith("/PainelAlpha/AlphaCRM/pipeline/pipeline?cardId=card&tarefaId=task", "CRM");
    expect(store.getState().notificacoes[0].lida).toBe(true);
    store.getState().iniciarUsuario(0); store.getState().iniciarUsuario(7);
    expect(store.getState().sincronizar(7, [alerta])).toEqual([]);
    expect(store.getState().notificacoes[0].lida).toBe(true);
  });
  it("não deixa timer da conta anterior marcar alertas da nova conta como lidos", async () => {
    await abrirSino();
    await act(async () => { store.getState().iniciarUsuario(8); store.getState().sincronizar(8, [alerta]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(store.getState().notificacoes[0].lida).toBe(false);
    expect(JSON.parse(localStorage.getItem("bpm_alertas_reconhecidos_v1_8")!).lidas).toEqual([]);
  });
  it("preserva leitura pela visualização da central após recarregar", async () => {
    await abrirSino();
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(store.getState().notificacoes[0].lida).toBe(true);
    store.getState().iniciarUsuario(0); store.getState().iniciarUsuario(7);
    store.getState().sincronizar(7, [alerta]);
    expect(store.getState().notificacoes[0].lida).toBe(true);
  });
});
