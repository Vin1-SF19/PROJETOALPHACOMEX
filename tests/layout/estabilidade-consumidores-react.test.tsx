// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BibbleWeatherWidget from "@/components/BibbleChatHome/BibbleWeatherWidget";
import BroadcastBanner from "@/components/BroadcastBanner";
import { PainelVersionNotice } from "@/components/layout/PainelVersionNotice";
import { useNotasLembretesPendentes } from "@/hooks/useNotasLembretesPendentes";
import { NotificacaoFlutuante } from "@/components/NotificacaoFlutuante";
import { geolocalizacaoPermitida } from "@/lib/geolocation-policy";
import { esperaRetryAfter } from "@/lib/painel-polling";
import { useChamadoNotificacoes } from "@/store/useChamadoNotificacoes";
vi.mock("framer-motion", () => ({ motion: { div: ({ children, className }: { children: React.ReactNode; className?: string }) => h("div", { className }, children), span: ({ children }: { children: React.ReactNode }) => h("span", null, children) }, AnimatePresence: ({ children }: { children: React.ReactNode }) => children }));
const state = vi.hoisted(() => ({ id: "7", allowed: true, reminders: vi.fn() }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { estadoAcesso: state.allowed ? "PERMITIDO" : "INDISPONIVEL", user: { id: state.id } } }) }));
vi.mock("@/actions/NotasLembretes", () => ({ VerificarLembretesPendentes: state.reminders }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
let root: Root, host: HTMLDivElement, client: QueryClient;
const fetcher = vi.fn<typeof fetch>();
function Reminders() { useNotasLembretesPendentes(true); return null; }
async function mount(children: React.ReactNode) { await act(async () => root.render(h(QueryClientProvider, { client, children }))); await tick(); }
async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers(); vi.clearAllMocks(); state.allowed = true; state.id = "7";
  state.reminders.mockResolvedValue({ success: true });
  fetcher.mockResolvedValue(Response.json(null)); vi.stubGlobal("fetch", fetcher);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers(); });
it("broadcast has one request in flight and preserves dismissal across refetches", async () => {
  let resolve!: (response: Response) => void;
  fetcher.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  await mount(h(BroadcastBanner)); await tick(20_000);
  await act(async () => window.dispatchEvent(new Event("focus"))); expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => resolve(Response.json({ id: "a", tipo: "info", mensagem: "Aviso confirmado" }))); await tick();
  expect(host.textContent).toContain("Aviso confirmado");
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  fetcher.mockResolvedValue(Response.json({ id: "a", tipo: "info", mensagem: "Aviso confirmado" }));
  await tick(15_000); expect(host.textContent).not.toContain("Aviso confirmado");
});
it("broadcast respects Retry-After through focus and never polls a blocked session or child frame", async () => {
  fetcher.mockResolvedValue(Response.json({}, { status: 503, headers: { "Retry-After": "120" } }));
  await mount(h(BroadcastBanner)); await tick(30_000);
  await act(async () => window.dispatchEvent(new Event("focus"))); expect(fetcher).toHaveBeenCalledTimes(1);
  await tick(90_000); expect(fetcher).toHaveBeenCalledTimes(2);
  state.allowed = false; await mount(h(BroadcastBanner)); await tick(300_000); expect(fetcher).toHaveBeenCalledTimes(2);
});
it("a child frame starts no global broadcast, notification or reminders request", async () => {
  vi.spyOn(window, "top", "get").mockReturnValue({} as Window);
  await mount(h(React.Fragment, null, h(BroadcastBanner), h(NotificacaoFlutuante), h(Reminders)));
  await tick(600_000); expect(fetcher).not.toHaveBeenCalled(); expect(state.reminders).not.toHaveBeenCalled();
});
it("notification failure preserves confirmed snapshot and honors recovery cooldown", async () => {
  fetcher.mockResolvedValueOnce(Response.json({ notificacoes: [{ mensagemId: 3, chamadoId: 8, titulo: "Confirmed", autorNome: "A", texto: "B", createdAt: "2026-10-26" }] }))
    .mockResolvedValue(Response.json({}, { status: 503, headers: { "Retry-After": "120" } }));
  await mount(h(NotificacaoFlutuante)); expect(useChamadoNotificacoes.getState().notificacoes).toHaveLength(1);
  await tick(6000); await act(async () => window.dispatchEvent(new Event("alpha-checklist-recovery")));
  await tick(119_999); expect(fetcher).toHaveBeenCalledTimes(2); expect(useChamadoNotificacoes.getState().notificacoes).toHaveLength(1);
  await tick(1); expect(fetcher).toHaveBeenCalledTimes(3);
});
it("reminder rejection is consumed without a focus retry or concurrent action", async () => {
  let reject!: (error: Error) => void;
  state.reminders.mockImplementationOnce(() => new Promise((_r, j) => { reject = j; }));
  await mount(h(Reminders)); await tick(300_000); expect(state.reminders).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("write unknown")));
  await act(async () => window.dispatchEvent(new Event("focus"))); await tick(299_999);
  expect(state.reminders).toHaveBeenCalledTimes(1); await tick(1); expect(state.reminders).toHaveBeenCalledTimes(2);
});
it("a newer deployment is advisory and does not reload or remount open work", async () => {
  fetcher.mockResolvedValue(Response.json({ status: "ok", deployedCommitSha: "b".repeat(40) }));
  const reload = vi.spyOn(window.location, "reload");
  await mount(h(React.Fragment, null, h("textarea", { defaultValue: "Unsent draft" }), h(PainelVersionNotice, { deployedCommitSha: "a".repeat(40) })));
  const draft = host.querySelector("textarea"); expect(host.textContent).toContain("Salve o trabalho em todas as abas");
  expect(host.querySelector("button")).toBeNull(); await tick(300_000);
  expect(host.querySelector("textarea")).toBe(draft); expect(draft?.value).toBe("Unsent draft"); expect(reload).not.toHaveBeenCalled();
});
it("unknown or blocked policy never grants geolocation", () => {
  expect(geolocalizacaoPermitida({} as Document)).toBe(false);
  expect(geolocalizacaoPermitida({ permissionsPolicy: { allowsFeature: () => false } } as unknown as Document)).toBe(false);
  expect(geolocalizacaoPermitida({ featurePolicy: { allowsFeature: () => true } } as unknown as Document)).toBe(true);
});

it("a policy-blocked weather widget never calls the available geolocation API", async () => {
  const locate = vi.fn();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: locate }, onLine: true });
  Object.defineProperty(document, "permissionsPolicy", { configurable: true, value: { allowsFeature: () => false } });
  try { await mount(h(BibbleWeatherWidget)); await tick(600_000); expect(locate).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled(); }
  finally { Reflect.deleteProperty(document, "permissionsPolicy"); }
});
it("switching notification identity aborts the old request and discards its response", async () => {
  let resolve!: (response: Response) => void;
  let oldSignal: AbortSignal | null | undefined;
  fetcher.mockImplementationOnce((_url, init) => { oldSignal = init?.signal; return new Promise((r) => { resolve = r; }); });
  await mount(h(NotificacaoFlutuante)); state.id = "8"; await mount(h(NotificacaoFlutuante));
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => resolve(Response.json({ notificacoes: [{ mensagemId: 99, chamadoId: 8, titulo: "Old user", autorNome: "A", texto: "B", createdAt: "2026-10-26" }] })));
  expect(useChamadoNotificacoes.getState().notificacoes.some((n) => n.id === "mensagem-99")).toBe(false);
});

it("bounds server retry dates and rejects malformed or overflowing delays", () => {
  const now = Date.parse("2026-10-26T22:00:00Z");
  expect(esperaRetryAfter(null, now)).toBe(0);
  expect(esperaRetryAfter("  ", now)).toBe(0);
  expect(esperaRetryAfter("not-a-date", now)).toBe(0);
  expect(esperaRetryAfter("9".repeat(400), now)).toBe(0);
  expect(esperaRetryAfter("0", now)).toBe(1000);
  expect(esperaRetryAfter("Mon, 26 Oct 2026 22:02:00 GMT", now)).toBe(120_000);
  expect(esperaRetryAfter("Mon, 26 Oct 2026 23:00:00 GMT", now)).toBe(300_000);
  expect(esperaRetryAfter("Mon, 26 Oct 2026 21:00:00 GMT", now)).toBe(1000);
});
