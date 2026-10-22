// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePainelFrameLeaveGuard } from "@/hooks/usePainelFrameLeaveGuard";
import { ALPHA_GUARD_STATE, ALPHA_LEAVE_RESULT, isPainelLeaveMessage } from "@/lib/painel-leave-guard";
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
let host: HTMLDivElement, root: Root, frame: HTMLIFrameElement;
let request: ReturnType<typeof usePainelFrameLeaveGuard>;
const post = vi.fn(), activate = vi.fn(); const child = { postMessage: post } as unknown as Window;
const refs = { current: new Map<string, HTMLIFrameElement>() };
function Probe() { const guard = usePainelFrameLeaveGuard(refs, activate); React.useEffect(() => { request = guard; }, [guard]); return null; }
async function message(data: unknown, origin = window.location.origin, source: Window = child) {
  await act(async () => window.dispatchEvent(new MessageEvent("message", { data, origin, source })));
}
beforeEach(async () => {
  vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  frame = document.createElement("iframe"); frame.name = "alpha-panel-frame:tab-test:0";
  Object.defineProperty(frame, "contentWindow", { configurable: true, value: child }); refs.current = new Map([["tab-test", frame]]);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(h(Probe)));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it("frames sem suporte seguem o fluxo existente; protocolo rejeita dados inválidos", async () => {
  const execute = vi.fn(); await request("tab-test", execute); expect(execute).toHaveBeenCalledOnce();
  expect(isPainelLeaveMessage({ type: ALPHA_GUARD_STATE, version: 1, frameId: "bad/frame", pending: true })).toBe(false);
  expect(isPainelLeaveMessage({ type: ALPHA_LEAVE_RESULT, version: 1, frameId: "tab-test:0", requestId: "ok", allowed: "yes" })).toBe(false);
});
it("não confia em outra origem ou janela para declarar suporte", async () => {
  const data = { type: ALPHA_GUARD_STATE, version: 1, frameId: "tab-test:0", pending: true };
  await message(data, "https://outra.invalid"); await message(data, window.location.origin, window);
  const execute = vi.fn(); await request("tab-test", execute); expect(execute).toHaveBeenCalledOnce(); expect(post).not.toHaveBeenCalled();
});
it("pede autorização mesmo se última mensagem dizia clean; resultado precisa corresponder à janela/frame/request atuais", async () => {
  await message({ type: ALPHA_GUARD_STATE, version: 1, frameId: "tab-test:0", pending: false });
  const execute = vi.fn(); const pending = request("tab-test", execute);
  expect(execute).not.toHaveBeenCalled(); expect(activate).toHaveBeenCalledWith("tab-test");
  const { requestId } = post.mock.calls[0][0];
  await message({ type: ALPHA_LEAVE_RESULT, version: 1, frameId: "tab-test:0", requestId: "stale", allowed: true }); expect(execute).not.toHaveBeenCalled();
  await message({ type: ALPHA_LEAVE_RESULT, version: 1, frameId: "tab-test:0", requestId, allowed: true }, window.location.origin, window); expect(execute).not.toHaveBeenCalled();
  await message({ type: ALPHA_LEAVE_RESULT, version: 1, frameId: "tab-test:0", requestId, allowed: true }); await pending; expect(execute).toHaveBeenCalledOnce();
});
it("cancelar mantém iframe e dados; resposta de tentativa antiga não desmonta iframe novo", async () => {
  await message({ type: ALPHA_GUARD_STATE, version: 1, frameId: "tab-test:0", pending: true });
  const execute = vi.fn(); let pending = request("tab-test", execute); let { requestId } = post.mock.calls.at(-1)![0];
  await message({ type: ALPHA_LEAVE_RESULT, version: 1, frameId: "tab-test:0", requestId, allowed: false }); await pending; expect(execute).not.toHaveBeenCalled();
  pending = request("tab-test", execute); ({ requestId } = post.mock.calls.at(-1)![0]);
  frame.name = "alpha-panel-frame:tab-test:1";
  await message({ type: ALPHA_LEAVE_RESULT, version: 1, frameId: "tab-test:0", requestId, allowed: true }); expect(execute).not.toHaveBeenCalled();
  await act(async () => root.unmount()); await pending; root = createRoot(host); expect(execute).not.toHaveBeenCalled();
});
it("timeout bloqueia o fechamento em vez de descartar estado sem resposta", async () => {
  vi.useFakeTimers(); await message({ type: ALPHA_GUARD_STATE, version: 1, frameId: "tab-test:0", pending: true });
  const execute = vi.fn(); const pending = request("tab-test", execute);
  await vi.advanceTimersByTimeAsync(120000); await pending; expect(execute).not.toHaveBeenCalled();
});
