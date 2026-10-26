// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { SessionProvider, useRecuperacaoSessao } from "@/components/auth/SessaoResilienteProvider";
import { SessaoProtegida } from "@/components/auth/SessaoIndisponivel";
import ChatChamado from "@/components/ChatChamado";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

vi.mock("next/navigation", () => ({ usePathname: () => "/PainelAlpha/AlphaCRM", useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/pusher", () => ({ pusherClient: null }));
vi.mock("@/actions/chamados", () => ({ enviarMensagemAction: vi.fn(async () => ({ success: true })), marcarComoLidaAction: vi.fn() }));
const allowed = { expires: "2026-12-01", estadoAcesso: "PERMITIDO", acessoBloqueado: false, user: { id: "7" } } as Session;
const temporary = { expires: "2026-12-01", estadoAcesso: "INDISPONIVEL", acessoBloqueado: false } as Session;
let root: Root;
let host: HTMLDivElement;
let recovery: ReturnType<typeof useRecuperacaoSessao>;
function Probe({ children }: { children: React.ReactNode }) {
  const value = useRecuperacaoSessao();
  React.useEffect(() => { recovery = value; }, [value]);
  return h(SessaoProtegida, { children });
}
async function mount(children: React.ReactNode) {
  await act(async () => { root.render(h(SessionProvider, { session: allowed, children: h(Probe, { children }) })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}
async function disconnect() {
  await act(async () => { recovery.sinalizarIndisponibilidade(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(temporary), { status: 200 })));
  vi.spyOn(HTMLElement.prototype, "scrollTo").mockImplementation(() => undefined);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("recovery with real existing body portals", () => {
  it("keeps the real support portal and its unsent draft mounted during recovery", async () => {
    await mount(h(ChatChamado, { chamadoId: 9, titulo: "Controlado", mensagensIniciais: [], contagem: 0, status: "ABERTO", usuarioAtualId: 7, podeResponder: true }));
    await act(async () => { (host.querySelector('[aria-label="Abrir chat do chamado #9"]') as HTMLButtonElement).click(); });
    const dialog = document.body.querySelector('[role="dialog"]')!;
    const input = dialog.querySelector<HTMLInputElement>('[aria-label="Mensagem"]')!;
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Mensagem ainda não enviada");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await disconnect();
    expect(document.body.querySelector('[role="dialog"]')).toBe(dialog);
    expect(dialog.querySelector('[aria-label="Mensagem"]')).toBe(input);
    expect(input.value).toBe("Mensagem ainda não enviada");
    // Interaction blocking is verified with trusted CDP events in the private
    // Chrome fixture, avoiding synthetic clicks that ignore native inert.
  });

  it("allows focus on recovery while an existing CRM Sheet focus scope stays mounted", async () => {
    await mount(h(Sheet, { open: true, children: h(SheetContent, { "aria-describedby": undefined, children: [h(SheetTitle, { key: "title", children: "Card em edição" }), h("input", { key: "draft", "aria-label": "Campo CRM", defaultValue: "Rascunho CRM" })] }) }));
    const input = document.body.querySelector('[aria-label="Campo CRM"]')!;
    await disconnect();
    const retry = Array.from(document.body.querySelectorAll("button")).find(button => /Tentar novamente|Verificando/.test(button.textContent ?? ""))!;
    expect(retry).toBeDefined();
    await act(async () => retry.focus());
    expect(document.body.querySelector('[aria-label="Campo CRM"]')).toBe(input);
    expect(document.activeElement).toBe(retry);
  });
});

// Browser top-layer interaction is asserted separately with trusted CDP input.
// Here the real Radix state must also survive Escape and recover its focus.
it("pauses Escape dismissal without closing the real Sheet and restores its draft focus", async () => {
  const closed = vi.fn();
  function Editor() {
    const [open, setOpen] = React.useState(true);
    return h(Sheet, { open, onOpenChange: (next: boolean) => { closed(next); setOpen(next); }, children: h(SheetContent, { "aria-describedby": undefined, children: [h(SheetTitle, {key:"title",children:"Editor"}),h("input",{key:"input","aria-label":"Rascunho pausado",defaultValue:"Não perder"})] }) });
  }
  await mount(h(Editor));
  const input = document.body.querySelector<HTMLInputElement>('[aria-label="Rascunho pausado"]')!;
  input.focus();
  await disconnect();
  const retry = document.body.querySelector<HTMLButtonElement>('[data-alpha-session-retry]')!;
  await act(async () => { retry.focus(); retry.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true,cancelable:true})); });
  expect(closed).not.toHaveBeenCalled();
  expect(document.body.querySelector('[aria-label="Rascunho pausado"]')).toBe(input);
  expect(document.activeElement).toBe(retry);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(allowed))));
  await act(async () => { await recovery.confirmar(); });
  expect(document.body.querySelector('[aria-label="Rascunho pausado"]')).toBe(input);
  expect(input.value).toBe("Não perder");
  expect(document.activeElement).toBe(input);
  expect(closed).not.toHaveBeenCalled();
});
