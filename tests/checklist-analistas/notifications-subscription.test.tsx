// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const realtime = vi.hoisted(() => ({
  subscribe: vi.fn(), bind: vi.fn(), unbind: vi.fn(),
  connectionBind: vi.fn(), connectionUnbind: vi.fn(), unsubscribe: vi.fn(), trigger: vi.fn(),
}));
const pusherModule = vi.hoisted(() => ({ loaded: false }));
const api = vi.hoisted(() => ({ actor: 1, read: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/pusher", () => {
  pusherModule.loaded = true;
  return { pusherClient: {
    subscribe: realtime.subscribe, unsubscribe: realtime.unsubscribe, trigger: realtime.trigger,
    connection: { bind: realtime.connectionBind, unbind: realtime.connectionUnbind },
  } };
});
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { user: { id: String(api.actor) } } }) }));
vi.mock("@/actions/checklist/eventos", () => ({ marcarEventoChecklistLido: api.read, listarEventosChecklist: api.list }));
import { useChecklistNotifications } from "@/hooks/useChecklistNotifications";
import { NotificacaoFlutuante } from "@/components/NotificacaoFlutuante";
import Widget from "@/components/Checklist/ChecklistNotificacoesWidget";
import Toast from "@/components/Checklist/ChecklistNotificationToast";
import { useChecklistNotificacoes } from "@/store/useChecklistNotificacoes";

interface ShellProps { widget?: boolean; enabled?: boolean; toast?: boolean }
function Shell({ widget = true, enabled = true, toast = true }: ShellProps) {
  const transporte = useChecklistNotifications(api.actor, enabled);
  return <>
    <output>{transporte.valid ? transporte.transport : "invalid"}</output>
    <NotificacaoFlutuante />
    {widget && <Widget />}
    {toast && <Toast onAbrir={() => {}} />}
  </>;
}
const event = (id: number) => ({
  eventId: `evento-${id}`, revision: id, tipo: "CHECKLIST_ITEM_ATUALIZADO", empresaId: "fixture",
  createdAt: "2026-10-22T12:00:00.000Z", lidoEm: null, dados: { depois: { status: "OK" } },
});
const response = (id = 1) => new Response(JSON.stringify({ checklist: { items: [event(id)], nextCursor: null } }), {
  headers: { "Content-Type": "application/json" },
});
let host: HTMLDivElement, root: Root, fetcher: ReturnType<typeof vi.fn>, mounted: boolean;
async function render(props: ShellProps = {}) {
  mounted = true;
  await act(async () => root.render(<Shell {...props} />));
}
async function unmount() {
  await act(async () => root.unmount());
  mounted = false;
}
function expectNoPusher() {
  expect(pusherModule.loaded).toBe(false);
  for (const spy of Object.values(realtime)) expect(spy).not.toHaveBeenCalled();
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CHECKLIST_REALTIME_MODE", undefined);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  api.actor = 1;
  useChecklistNotificacoes.getState().iniciar(0);
  fetcher = vi.fn().mockImplementation(async () => response());
  vi.stubGlobal("fetch", fetcher);
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
  mounted = false;
});
afterEach(async () => {
  if (mounted) await unmount();
  expectNoPusher();
  host.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("CheckList exclusivamente no poller global", () => {
  it.each([undefined, "polling", "invalid", "pusher"])("configuração %s não carrega Pusher nem bloqueia hidratação/polling", async (mode) => {
    vi.stubEnv("NEXT_PUBLIC_CHECKLIST_REALTIME_MODE", mode);
    await render();
    expect(host.querySelector("output")?.textContent).toBe(mode === undefined || mode === "polling" ? "polling" : "invalid");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(useChecklistNotificacoes.getState().usuarioId).toBe(1);
    expect(useChecklistNotificacoes.getState().notificacoes.map((n) => n.id)).toEqual(["evento-1"]);
    expect(host.querySelectorAll("aside[role=status]")).toHaveLength(1);
    expectNoPusher();
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(useChecklistNotificacoes.getState().notificacoes).toHaveLength(1);
    await unmount();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("alpha-checklist-recovery"));
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("montar/remover widgets não acrescenta poller/timer nem duplica aviso no replay", async () => {
    await render();
    const timers = vi.getTimerCount();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await render({ widget: false });
    await render();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(timers);
    await act(async () => window.dispatchEvent(new Event("alpha-checklist-recovery")));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(host.querySelectorAll("aside[role=status]")).toHaveLength(1);
    expect(useChecklistNotificacoes.getState().vistos.size).toBe(1);
    expect(vi.getTimerCount()).toBe(timers);
    await act(async () => host.querySelector<HTMLButtonElement>("button[aria-label='Fechar aviso']")!.click());
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(host.querySelector("aside")).toBeNull();
    expect(useChecklistNotificacoes.getState().notificacoes).toHaveLength(1);
    expect(api.read).not.toHaveBeenCalled();
  });

  it("mantém somente o timer global,6s visível/30s oculto e recuperação no foco", async () => {
    await render({ toast: false });
    expect(vi.getTimerCount()).toBe(1);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await act(async () => vi.advanceTimersByTimeAsync(6000));
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(29999));
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(fetcher).toHaveBeenCalledTimes(3);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(fetcher).toHaveBeenCalledTimes(3);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("troca de ator pelo hook reseta store e ignora resposta atrasada abortada", async () => {
    let finish: (value: Response) => void = () => {};
    let signal: AbortSignal | null | undefined;
    fetcher.mockImplementationOnce((_url: string, options: RequestInit) => {
      signal = options.signal;
      return new Promise<Response>((resolve) => { finish = resolve; });
    }).mockImplementation(async () => response(2));
    await render();
    api.actor = 2;
    await render();
    expect(signal?.aborted).toBe(true);
    await act(async () => finish(response(1)));
    expect(useChecklistNotificacoes.getState().usuarioId).toBe(2);
    expect(useChecklistNotificacoes.getState().notificacoes.map((n) => n.id)).toEqual(["evento-2"]);
    expect(host.querySelectorAll("aside[role=status]")).toHaveLength(1);
  });

  it("permissão revogada limpa store, rejeita replay e reativação permite recuperar", async () => {
    await render();
    await render({ enabled: false });
    expect(useChecklistNotificacoes.getState().usuarioId).toBe(0);
    expect(useChecklistNotificacoes.getState().notificacoes).toHaveLength(0);
    await act(async () => window.dispatchEvent(new Event("alpha-checklist-recovery")));
    expect(useChecklistNotificacoes.getState().notificacoes).toHaveLength(0);
    await render();
    await act(async () => window.dispatchEvent(new Event("alpha-checklist-recovery")));
    expect(useChecklistNotificacoes.getState().usuarioId).toBe(1);
    expect(useChecklistNotificacoes.getState().notificacoes).toHaveLength(1);
  });

  it("iframe não inicializa ator nem monta timer/consulta/assinatura", async () => {
    vi.spyOn(window, "top", "get").mockReturnValue(null);
    await render({ toast: false });
    expect(useChecklistNotificacoes.getState().usuarioId).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
