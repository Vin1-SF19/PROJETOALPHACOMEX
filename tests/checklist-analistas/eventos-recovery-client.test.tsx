// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ actor: 7, allowed: true, read: vi.fn(), list: vi.fn() }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: api.allowed ? { estadoAcesso: "PERMITIDO", acessoBloqueado: false, user: { id: String(api.actor) } } : { estadoAcesso: "INDISPONIVEL", acessoBloqueado: false } }) }));
vi.mock("@/actions/checklist/eventos", () => ({ marcarEventoChecklistLido: api.read, listarEventosChecklist: api.list }));
import type { ChecklistEvento } from "@/lib/checklist/client/notificacoes";
import { NotificacaoFlutuante } from "@/components/NotificacaoFlutuante";
import ChecklistNotificationToast from "@/components/Checklist/ChecklistNotificationToast";
import { useChecklistNotificacoes } from "@/store/useChecklistNotificacoes";
const event = (n: number, dados: ChecklistEvento["dados"] = { depois: { status: "OK" }, metadata: "NAO_RENDERIZAR" }, lidoEm: string | null = null) => ({
  eventId: `evento-${String(n).padStart(3, "0")}`,
  revision: n,
  tipo: "CHECKLIST_ITEM_ATUALIZADO",
  empresaId: "atendimento-fixture",
  createdAt: new Date(Date.UTC(2026, 9, 22, 12, 0, n)).toISOString(),
  lidoEm,
  dados,
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
let host: HTMLDivElement, root: Root, fetcher: ReturnType<typeof vi.fn>, open: ReturnType<typeof vi.fn<(url: string, label: string) => void>>;
const wait = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 15));
  });
async function render() {
  await act(async () =>
    root.render(
      <>
        <NotificacaoFlutuante />
        <ChecklistNotificationToast onAbrir={open} />
      </>,
    ),
  );
  await wait();
}
async function recover() {
  await act(async () => window.dispatchEvent(new Event("alpha-checklist-recovery")));
  await wait();
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  api.allowed = true;
  api.actor = 7;
  useChecklistNotificacoes.getState().iniciar(0);
  useChecklistNotificacoes.getState().iniciar(7);
  fetcher = vi.fn();
  open = vi.fn<(url: string, label: string) => void>();
  vi.stubGlobal("fetch", fetcher);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("poller real — recovery JSON, cursor e leitura", () => {
  it("sessão INDISPONIVEL não consulta mesmo após evento de recuperação", async () => {
    api.allowed = false;
    await render();
    await recover();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("ingere duas páginas61JSON/null, preserva leitura e replay não duplica toast", async () => {
    const read = new Set([60]);
    const cursor = { createdAt: event(12).createdAt, id: event(12).eventId };
    fetcher.mockImplementation(async (url: string) => {
      const second = url.startsWith("/api/checklist/eventos?");
      const values = Array.from({ length: second ? 11 : 50 }, (_, i) => (second ? 11 - i : 61 - i)).map((n) =>
        event(n, n === 1 ? null : { itemId: "fixture", depois: { status: "OK" }, metadata: "NAO_RENDERIZAR" }, read.has(n) ? "2026-10-22T12:05:00.000Z" : null),
      );
      const page = { items: values, nextCursor: second ? null : cursor };
      return response(second ? { ok: true, data: page, requestId: "fixture" } : { notificacoes: [], feedbacksPendentes: [], checklist: page });
    });
    api.read.mockImplementation(async (id: string) => {
      read.add(Number(id.replace("evento-", "")));
      return { ok: true, data: { eventoId: id, lidoEm: new Date() }, requestId: "fixture" };
    });
    await render();
    const store = useChecklistNotificacoes.getState();
    expect(store.vistos.size).toBe(61);
    expect(store.notificacoes).toHaveLength(50);
    expect(store.notificacoes.find((n) => n.id === "evento-060")?.lida).toBe(true);
    expect(store.ultimoEventoId).toBe("evento-061");
    expect(host.textContent).not.toContain("NAO_RENDERIZAR");
    const second = fetcher.mock.calls[1][0];
    expect(JSON.parse(new URL(second, "http://fixture.invalid").searchParams.get("cursor")!)).toEqual(cursor);
    const toast = host.querySelector("aside")!;
    expect(toast).not.toBeNull();
    await act(async () => toast.querySelector<HTMLButtonElement>("button")!.click());
    await wait();
    expect(api.read).toHaveBeenCalledWith("evento-061");
    expect(open).toHaveBeenCalledOnce();
    expect(host.querySelector("aside")).toBeNull();
    await recover();
    expect(useChecklistNotificacoes.getState().vistos.size).toBe(61);
    expect(useChecklistNotificacoes.getState().notificacoes.filter((n) => n.id === "evento-061")).toHaveLength(1);
    expect(host.querySelector("aside")).toBeNull();
    expect(open).toHaveBeenCalledOnce();
  });
  it("página inválida não apaga a coleção confirmada nem trata dados arbitrários como HTML", async () => {
    useChecklistNotificacoes.getState().receber(7, [event(1)]);
    fetcher.mockResolvedValue(response({ checklist: { items: [{ ...event(2), dados: undefined }], nextCursor: null } }));
    await render();
    expect(useChecklistNotificacoes.getState().notificacoes.map((n) => n.id)).toEqual(["evento-001"]);
    expect(api.read).not.toHaveBeenCalled();
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).not.toContain("NAO_RENDERIZAR");
  });
  it("falha ao buscar página2 conserva página1 e recuperação posterior continua sem duplicar", async () => {
    let fail = true;
    const cursor = { createdAt: event(2).createdAt, id: event(2).eventId };
    fetcher.mockImplementation(async (url: string) =>
      url.startsWith("/api/checklist/eventos?")
        ? fail
          ? response({ error: "Indisponível" }, 503)
          : response({ ok: true, data: { items: [event(1, null)], nextCursor: null }, requestId: "fixture" })
        : response({ checklist: { items: [event(3), event(2)], nextCursor: cursor } }),
    );
    await render();
    expect(useChecklistNotificacoes.getState().vistos.size).toBe(2);
    fail = false;
    const callsBeforeCooldown = fetcher.mock.calls.length;
    await recover();
    expect(fetcher).toHaveBeenCalledTimes(callsBeforeCooldown);
    expect(useChecklistNotificacoes.getState().vistos.size).toBe(2);
    // Recovery events must respect the new six-second failure cooldown.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6000);
    await recover();
    expect(useChecklistNotificacoes.getState().vistos.size).toBe(3);
    expect(useChecklistNotificacoes.getState().notificacoes).toHaveLength(3);
    expect(useChecklistNotificacoes.getState().ultimoEventoId).toBe("evento-003");
  });
  it("resposta atrasada de ator anterior é abortada/ignorada ao trocar sessão", async () => {
    let resolve: (value: Response) => void = () => {};
    let signal: AbortSignal | undefined;
    fetcher
      .mockImplementationOnce((_url: string, options: RequestInit) => {
        signal = options.signal ?? undefined;
        return new Promise<Response>((r) => {
          resolve = r;
        });
      })
      .mockResolvedValue(response({ checklist: { items: [event(8)], nextCursor: null } }));
    await render();
    api.actor = 8;
    useChecklistNotificacoes.getState().iniciar(8);
    await render();
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve(response({ checklist: { items: [event(7)], nextCursor: null } })));
    await wait();
    expect(useChecklistNotificacoes.getState().usuarioId).toBe(8);
    expect(useChecklistNotificacoes.getState().notificacoes.map((n) => n.id)).toEqual(["evento-008"]);
  });
});
