// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { SessionProvider, useRecuperacaoSessao } from "@/components/auth/SessaoResilienteProvider";
import { SessaoProtegida } from "@/components/auth/SessaoIndisponivel";
import HoleritesPage from "@/components/holerites/HoleritesPage";
vi.mock("framer-motion", () => {
  const component = (tag: string) => {
    const MockMotion = React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => h(tag, { ...Object.fromEntries(Object.entries(props).filter(([key]) => !["initial", "animate", "exit", "transition", "whileTap", "whileHover"].includes(key))), ref }));
    MockMotion.displayName = `MockMotion(${tag})`;
    return MockMotion;
  };
  return { motion: { div: component("div"), button: component("button") }, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});
const actions = vi.hoisted(() => ({ list: vi.fn(), stats: vi.fn(), reject: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/PainelAlpha/Holerites", useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/actions/Holerites", () => ({ getHoleritesGeral: actions.list, getEstatisticasHolerites: actions.stats, getMeusHolerites: async () => ({ success: true, data: [] }), rejeitarHolerite: actions.reject, validarHolerite: vi.fn(), deletarHolerite: vi.fn(), uploadHolerite: vi.fn(), substituirHolerite: vi.fn() }));
vi.mock("@/actions/HoleriteAlertas", () => ({ getEstadoAlerta: async () => null, dispararAlerteInicial: vi.fn(), dispararAlerteFinal: vi.fn() }));
const allowed = { expires: "2026-12-01", estadoAcesso: "PERMITIDO", acessoBloqueado: false, user: { id: "7", role: "FINANCEIRO" } } as Session;
const temporary = { expires: "2026-12-01", estadoAcesso: "INDISPONIVEL", acessoBloqueado: false } as Session;
let root: Root, host: HTMLDivElement;
let recovery: ReturnType<typeof useRecuperacaoSessao>;
function Probe() { const value = useRecuperacaoSessao(); React.useEffect(() => { recovery = value; }, [value]); return h(SessaoProtegida, { children: h(HoleritesPage) }); }
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(temporary))));
  actions.list.mockResolvedValue({ success: true, data: [{ id: 12, competencia: "10/2026", mes: 10, ano: 2026, arquivoNome: "controlado.pdf", arquivoTamanho: 12, assinado: true, status: "PENDENTE", uploadedAt: "2026-10-01", colaborador: {id: 3, nome: "Controlado", imagemUrl: null, cargo: null}, uploadedBy: null }] });
  actions.stats.mockResolvedValue({ success: true, data: {total:1, pendentes:1, validados:0, rejeitados:0} });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it("preserves the actual finance rejection form while TEMP removes the public user", async () => {
  await act(async () => root.render(h(SessionProvider, { session: allowed, children: h(Probe) })));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { (host.querySelector('[title="Expandir"]') as HTMLButtonElement).click(); });
  const reject = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.trim() === "Rejeitar")!;
  expect(reject).toBeDefined();
  await act(async () => reject.click());
  const reason = host.querySelector<HTMLTextAreaElement>('[placeholder="Motivo da rejeição (obrigatório)..."]')!;
  expect(reason).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(reason, "Justificativa ainda não enviada");
    reason.dispatchEvent(new Event("input", {bubbles:true}));
  });
  await act(async () => recovery.sinalizarIndisponibilidade());
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(actions.reject).not.toHaveBeenCalled();
  expect(host.querySelector('[placeholder="Motivo da rejeição (obrigatório)..."]')).toBe(reason);
  expect(reason.value).toBe("Justificativa ainda não enviada");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(allowed))));
  await act(async () => { await recovery.confirmar(); });
  expect(host.querySelector('[placeholder="Motivo da rejeição (obrigatório)..."]')).toBe(reason);
  expect(reason.value).toBe("Justificativa ainda não enviada");
  expect(actions.reject).not.toHaveBeenCalled();
  // A fresh server-confirmed role change still replaces the presentation;
  // continuity during TEMP never becomes a client-side permission grant.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({...allowed, user:{...allowed.user,role:"COMERCIAL"}}))));
  await act(async () => { await recovery.confirmar(); });
  expect(host.querySelector('[placeholder="Motivo da rejeição (obrigatório)..."]')).toBeNull();
});
