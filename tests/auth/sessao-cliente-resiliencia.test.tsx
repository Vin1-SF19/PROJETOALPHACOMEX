// @vitest-environment happy-dom
import React, { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { useSession, signOut } from "next-auth/react";
import { SessionProvider, useRecuperacaoSessao } from "@/components/auth/SessaoResilienteProvider";
import { SessaoProtegida } from "@/components/auth/SessaoIndisponivel";
import { Heartbeat } from "@/components/Heartbeat";
import { consultarJsonSessao, consultarSessao, PRAZO_SESSAO_MS } from "@/lib/auth/cliente-sessao";

vi.mock("next/navigation", () => ({ usePathname: () => "/PainelAlpha/AlphaCRM", useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next-auth/react", async importOriginal => ({ ...await importOriginal<typeof import("next-auth/react")>(), signOut: vi.fn(async () => undefined) }));
const allowed = { expires: "2026-12-01", estadoAcesso: "PERMITIDO", acessoBloqueado: false, user: { id: "7", nome: "Controlado" } } as Session;
const temporary = { expires: "2026-12-01", estadoAcesso: "INDISPONIVEL", acessoBloqueado: false } as Session;
const denied = { expires: "2026-12-01", estadoAcesso: "NEGADO", acessoBloqueado: true } as Session;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
let root: Root;
let host: HTMLDivElement;
let recovery: ReturnType<typeof useRecuperacaoSessao>;
let session: ReturnType<typeof useSession>;
const fetcher = vi.fn<typeof fetch>();
function Probe() {
  const recoveryValue = useRecuperacaoSessao(); const sessionValue = useSession();
  React.useEffect(() => { recovery = recoveryValue; session = sessionValue; }, [recoveryValue, sessionValue]);
  const [draft, setDraft] = useState("");
  return h(SessaoProtegida, { children: h(React.Fragment, null, h("output", null, draft), h("input", { value: draft, onInput: (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value), "aria-label": "Rascunho" })) });
}
async function mount(initial: Session | null = allowed, heartbeat = false) {
  await act(async () => root.render(h(SessionProvider, { session: initial, children: h(React.Fragment, null, h(Probe), heartbeat && h(Heartbeat)) })));
  await flush();
}
async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); }
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher); vi.stubGlobal("BroadcastChannel", undefined);
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); focusManager.setFocused(undefined); onlineManager.setOnline(true); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("public session bridge", () => {
  it("keeps an initially denied DTO unauthenticated and does not start a competing heartbeat", async () => {
    await mount(denied, true);
    expect(session.status).toBe("unauthenticated");
    expect(session.data).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["focus", "reconnect"] as const)("revalidates a previously allowed session on %s without waiting for an outage", async (event) => {
    await mount();
    fetcher.mockResolvedValue(json(allowed));
    await act(async () => {
      if (event === "focus") { focusManager.setFocused(false); focusManager.setFocused(true); }
      else { onlineManager.setOnline(false); onlineManager.setOnline(true); }
    });
    await flush();
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/auth/session")).toHaveLength(1);
    expect(session.data?.estadoAcesso).toBe("PERMITIDO");
  });

  it("ignores a superseded temporary response after a newer login was confirmed", async () => {
    await mount();
    let oldResolve!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; }));
    const old = recovery.confirmar().catch(() => undefined);
    await act(async () => { recovery.iniciarConfirmacao(); });
    fetcher.mockResolvedValue(json(allowed));
    await act(async () => { await recovery.confirmar(); });
    await act(async () => { oldResolve(json(temporary)); await old; });
    await flush();
    expect(session.data?.estadoAcesso).toBe("PERMITIDO");
    expect(recovery.indisponivel).toBe(false);
  });
  it("TEMP strips user and blocks interaction while preserving a typed draft through recovery", async () => {
    await mount();
    const input = host.querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Anotação em edição");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelector("output")?.textContent).toBe("Anotação em edição");
    fetcher.mockResolvedValue(json(temporary));
    await act(async () => { recovery.sinalizarIndisponibilidade(); });
    await flush();
    expect(session.data?.user).toBeUndefined();
    expect(host.querySelector("[inert]")).not.toBeNull();
    expect(host.querySelector("input")).toBe(input);
    expect(input.value).toBe("Anotação em edição");
    expect(signOut).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(json(allowed));
    await act(async () => { await recovery.confirmar(); });
    await flush();
    expect(session.data?.user?.id).toBe("7");
    expect(host.querySelector("[inert]")).toBeNull();
    expect(host.querySelector("input")).toBe(input);
    expect(input.value).toBe("Anotação em edição");
    expect(host.querySelector("output")?.textContent).toBe("Anotação em edição");
  });

  it("updates preferences through real CSRF POST and publishes only the server snapshot", async () => {
    await mount();
    fetcher.mockResolvedValueOnce(json({ csrfToken: "controlled-csrf" })).mockResolvedValueOnce(json({ ...allowed, user: { ...allowed.user, tema_interface: "blue" } }));
    await act(async () => { await session.update({ user: { tema_interface: "blue", id: "forged" } }); });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "POST", credentials: "same-origin", body: JSON.stringify({ csrfToken: "controlled-csrf", data: { user: { tema_interface: "blue", id: "forged" } } }) });
    expect(session.data?.user?.id).toBe("7");
  });

  it("shares concurrent confirmations, rejects HTML403 and never turns a transport error into logout", async () => {
    await mount();
    fetcher.mockResolvedValue(new Response("<html>challenge</html>", { status: 403 }));
    await act(async () => { await Promise.allSettled([recovery.confirmar(), recovery.confirmar(), recovery.confirmar()]); });
    await flush();
    // Enabling recovery may start one subsequent read; concurrent calls are one request.
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(2);
    expect(recovery.indisponivel).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("synchronizes a login and logout broadcast using exactly one bounded server check", async () => {
    let receiver: (() => void) | undefined;
    const close = vi.fn();
    class Channel {
      constructor(readonly name: string) { expect(name).toBe("next-auth"); }
      set onmessage(handler: () => void) { receiver = handler; }
      postMessage = vi.fn();
      close = close;
    }
    vi.stubGlobal("BroadcastChannel", Channel);
    await mount(null);
    fetcher.mockResolvedValue(json(allowed));
    await act(async () => { receiver?.(); });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(session.data?.user?.id).toBe("7");
    fetcher.mockResolvedValue(json(null));
    await act(async () => { receiver?.(); });
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(session.data).toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("explicit update without payload broadcasts login once and revalidates a peer without a loop", async () => {
    const channels = new Set<Channel>();
    const outgoing = vi.fn();
    class Channel {
      onmessage?: () => void;
      constructor(readonly name: string) { channels.add(this); }
      postMessage(value: unknown) { outgoing(value); for (const peer of channels) if (peer !== this) peer.onmessage?.(); }
      close() { channels.delete(this); }
    }
    vi.stubGlobal("BroadcastChannel", Channel);
    const peers: Record<string, ReturnType<typeof useSession>> = {};
    function Peer({ id }: { id: string }) { const value = useSession(); React.useEffect(() => { peers[id] = value; }, [id, value]); return null; }
    await act(async () => root.render(h(React.Fragment, null,
      h(SessionProvider, {session:null,children:h(Peer,{id:"sender"})}),
      h(SessionProvider, {session:null,children:h(Peer,{id:"receiver"})}))));
    fetcher.mockImplementation(async () => json(allowed));
    await act(async () => { await peers.sender.update(); });
    await flush();
    expect(peers.sender.data?.user?.id).toBe("7");
    expect(peers.receiver.data?.user?.id).toBe("7");
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/auth/session")).toHaveLength(2);
    expect(outgoing).toHaveBeenCalledTimes(1);
    fetcher.mockImplementation(async () => json(temporary));
    await act(async () => { await peers.sender.update(); });
    await flush();
    expect(peers.sender.data?.user).toBeUndefined();
    expect(outgoing).toHaveBeenCalledTimes(1);
  });

  it("a superseded denied response cannot overwrite a newer allowed confirmation", async () => {
    await mount();
    let oldResolve!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; }));
    const old = recovery.confirmar().catch(() => undefined);
    await act(async () => { recovery.iniciarConfirmacao(); });
    fetcher.mockResolvedValue(json(allowed));
    await act(async () => { await recovery.confirmar(); });
    await act(async () => { oldResolve(json(denied)); await old; });
    await flush();
    expect(session.data?.estadoAcesso).toBe("PERMITIDO");
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe("deadlines and heartbeat", () => {
  it.each(["JSON403", "HTML403"])("a heartbeat %s challenge cannot revoke a valid server-confirmed session", async (kind) => {
    fetcher.mockImplementation(async url => String(url) === "/api/heartbeat"
      ? kind === "JSON403" ? json({error: "proxy"}, 403) : new Response("<html>WAF</html>", {status:403})
      : json(allowed));
    await mount(allowed, true);
    expect(signOut).not.toHaveBeenCalled();
    // JSON403 confirms the real session endpoint; malformed HTML never counts
    // as proof. Either path keeps identity private until recovery is confirmed.
    if (kind === "JSON403") expect(fetcher.mock.calls.some(([url]) => url === "/api/auth/session")).toBe(true);
  });

  it("heartbeat waits for the next interval after a hung body and cancels the next attempt on unmount", async () => {
    const signals: AbortSignal[] = [];
    fetcher.mockImplementation(async (url, init) => {
      if (String(url) !== "/api/heartbeat") return json(temporary);
      signals.push(init!.signal!);
      return {status:200, json:()=>new Promise(()=>undefined)} as Response;
    });
    await mount(allowed, true);
    await act(async () => { await vi.advanceTimersByTimeAsync(7_999); });
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    expect(signals[0].aborted).toBe(true);
    expect(signals).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(40_000); });
    expect(signals).toHaveLength(2);
    expect(signals[1].aborted).toBe(false);
    await act(async () => root.unmount());
    expect(signals[1].aborted).toBe(true);
    root = createRoot(host);
  });
  it("aborts a stuck body, ignores late resolution and never retries an update POST", async () => {
    let bodyResolve!: (body: unknown) => void;
    let requestSignal: AbortSignal | undefined;
    fetcher.mockImplementation(async (_url, init) => {
      requestSignal = init?.signal ?? undefined;
      return { status: 200, json: () => new Promise(resolve => { bodyResolve = resolve; }) } as Response;
    });
    const result = consultarSessao().catch(error => error);
    await vi.advanceTimersByTimeAsync(PRAZO_SESSAO_MS);
    expect(await result).toBeInstanceOf(Error);
    expect(requestSignal?.aborted).toBe(true);
    bodyResolve(allowed);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("honors caller abort even with a transport that ignores abort", async () => {
    fetcher.mockImplementation(() => new Promise(() => undefined));
    const controller = new AbortController();
    const result = consultarJsonSessao("/api/auth/session", { signal: controller.signal }).catch(error => error);
    controller.abort();
    expect(await result).toBeInstanceOf(Error);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("heartbeat503 does not logout; subsequent validated recovery restores provider", async () => {
    fetcher.mockImplementation(async url => String(url) === "/api/heartbeat" ? json({ code: "AUTH_UNAVAILABLE" }, 503) : json(temporary));
    await mount(allowed, true);
    expect(recovery.indisponivel).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(json(allowed));
    await act(async () => { await recovery.confirmar(); });
    expect(session.data?.estadoAcesso).toBe("PERMITIDO");
  });

  it("heartbeat hangs are bounded, do not overlap, and abort on unmount", async () => {
    const signals: AbortSignal[] = [];
    fetcher.mockImplementation((_url, init) => { if (init?.signal) signals.push(init.signal); return new Promise(() => undefined); });
    await mount(allowed, true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(8_001); });
    expect(signals[0].aborted).toBe(true);
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/heartbeat")).toHaveLength(1);
    await act(async () => root.unmount());
    expect(signals.every(signal => signal.aborted)).toBe(true);
    root = createRoot(host);
  });
});
