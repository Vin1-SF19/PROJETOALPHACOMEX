// @vitest-environment happy-dom
import { act, useEffect, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useChecklistFrameGuard } from "@/hooks/useChecklistFrameGuard";
let root: Root, host: HTMLDivElement;
let leave: ReturnType<typeof useChecklistFrameGuard>;
let frames: RefObject<Map<string, HTMLIFrameElement>>;
const origin = window.location.origin;
function frame(path: string) {
  const content = { location: { href: origin + path }, postMessage: vi.fn() };
  return { frame: { src: origin + path, contentWindow: content } as unknown as HTMLIFrameElement, content };
}
function Harness({ actor = 1 }: { actor?: number }) { const guard = useChecklistFrameGuard(frames, actor); useEffect(() => { leave = guard; }, [guard]); return null; }
async function message(source: unknown, data: object, eventOrigin = origin) {
  await act(async () => { window.dispatchEvent(new MessageEvent("message", { origin: eventOrigin, source: source as Window, data })); });
}
beforeEach(async () => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); frames = { current: new Map() }; await act(async () => root.render(<Harness />)); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe("handshake de saída — fronteira de iframe", () => {
  it("origem e source forjados não bloqueiam nem liberam a aba do Checklist", async () => {
    const valid = frame("/PainelAlpha/CheckList/synthetic"), foreign = frame("/PainelAlpha/CheckList/other");
    frames.current.set("checklist", valid.frame);
    await message(valid.content, { type: "ALPHA_CHECKLIST_DRAFT_STATE", blocked: true }, "https://evil.invalid");
    await message(foreign.content, { type: "ALPHA_CHECKLIST_DRAFT_STATE", blocked: true });
    const clean = vi.fn();
    expect(leave("checklist", clean)).toBe(true);
    expect(clean).toHaveBeenCalledOnce();
    await message(valid.content, { type: "ALPHA_CHECKLIST_DRAFT_STATE", blocked: true });
    const close = vi.fn();
    expect(leave("checklist", close)).toBe(false);
    const request = valid.content.postMessage.mock.calls[0][0] as { requestId: string };
    await message(valid.content, { type: "ALPHA_CHECKLIST_LEAVE_ALLOWED", requestId: request.requestId }, "https://evil.invalid");
    await message(foreign.content, { type: "ALPHA_CHECKLIST_LEAVE_ALLOWED", requestId: request.requestId });
    await message(valid.content, { type: "ALPHA_CHECKLIST_LEAVE_ALLOWED", requestId: "forged-id" });
    expect(close).not.toHaveBeenCalled();
    await message(valid.content, { type: "ALPHA_CHECKLIST_LEAVE_ALLOWED", requestId: request.requestId });
    await message(valid.content, { type: "ALPHA_CHECKLIST_LEAVE_ALLOWED", requestId: request.requestId });
    expect(close).toHaveBeenCalledOnce();
  });
  it("mensagens de outro módulo são ignoradas e cancelamento permite novo pedido sem fechar", async () => {
    const crm = frame("/PainelAlpha/AlphaCRM/synthetic"), valid = frame("/PainelAlpha/CheckList/synthetic");
    frames.current.set("crm", crm.frame); frames.current.set("checklist", valid.frame);
    await message(crm.content, { type: "ALPHA_CHECKLIST_DRAFT_STATE", blocked: true });
    const crmClose = vi.fn();
    expect(leave("crm", crmClose)).toBe(true);
    expect(crmClose).toHaveBeenCalledOnce();
    await message(valid.content, { type: "ALPHA_CHECKLIST_DRAFT_STATE", blocked: true });
    const close = vi.fn();
    leave("checklist", close); leave("checklist", close);
    expect(valid.content.postMessage).toHaveBeenCalledOnce();
    const first = valid.content.postMessage.mock.calls[0][0] as { requestId: string };
    await message(valid.content, { type: "ALPHA_CHECKLIST_LEAVE_CANCELLED", requestId: first.requestId });
    expect(close).not.toHaveBeenCalled();
    leave("checklist", close);
    const second = valid.content.postMessage.mock.calls[1][0] as { requestId: string };
    expect(second.requestId).not.toBe(first.requestId);
    await message(valid.content, { type: "ALPHA_CHECKLIST_LEAVE_ALLOWED", requestId: first.requestId });
    expect(close).not.toHaveBeenCalled();
    await message(valid.content, { type: "ALPHA_CHECKLIST_LEAVE_ALLOWED", requestId: second.requestId });
    expect(close).toHaveBeenCalledOnce();
  });
  it("troca de ator invalida pedidos anteriores, sem executar callback da sessão anterior", async () => {
    const valid = frame("/PainelAlpha/CheckList/synthetic"); frames.current.set("checklist", valid.frame);
    await message(valid.content, { type: "ALPHA_CHECKLIST_DRAFT_STATE", blocked: true });
    const old = vi.fn(); leave("checklist", old);
    const request = valid.content.postMessage.mock.calls[0][0] as { requestId: string };
    await act(async () => root.render(<Harness actor={2} />));
    await message(valid.content, { type: "ALPHA_CHECKLIST_LEAVE_ALLOWED", requestId: request.requestId });
    expect(old).not.toHaveBeenCalled();
    const current = vi.fn(); expect(leave("checklist", current)).toBe(true);
    expect(current).toHaveBeenCalledOnce();
  });
});
