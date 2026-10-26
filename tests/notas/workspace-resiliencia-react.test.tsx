// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useNotasWorkspaceSync } from "@/hooks/useNotasWorkspaceSync";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { toast } from "sonner";

const actions = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
const identity = vi.hoisted(() => ({ id: "7" }));
vi.mock("@/actions/NotasWorkspace", () => ({ ObterWorkspaceNotas: actions.read, AtualizarWorkspaceNotas: actions.write }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { estadoAcesso: "PERMITIDO", user: { id: identity.id } } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const snapshot = () => ({ success: true, data: { workspace: { isTaskbarVisible: false, viewerMode: "RECOLHIDO" }, abas: [] } });
let root: Root, host: HTMLDivElement, client: QueryClient;
let controller: ReturnType<typeof useNotasWorkspaceSync>;
function Probe() { const current = useNotasWorkspaceSync(Number(identity.id)); React.useEffect(() => { controller = current; }, [current]); return h("output", null, current.error); }
async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function mount() { await act(async () => root.render(h(QueryClientProvider, { client, children: h(Probe) }))); await tick(); }
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); identity.id = "7";
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  useNotasWorkspace.setState({ tabs: [], activeTabId: null, isTaskbarVisible: false, viewerMode: "RECOLHIDO", hydrated: false, syncState: {} });
  actions.read.mockResolvedValue(snapshot()); actions.write.mockResolvedValue({ success: true });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); vi.clearAllTimers(); vi.useRealTimers(); });
it("hydrates without writing defaults and coalesces actual preference changes", async () => {
  await mount(); await tick(2000); expect(actions.write).not.toHaveBeenCalled();
  await act(async () => useNotasWorkspace.getState().toggleTaskbar()); await tick(300);
  await act(async () => useNotasWorkspace.getState().setViewerMode("COMPACTO")); await tick(600);
  expect(actions.write).toHaveBeenCalledTimes(1);
  expect(actions.write).toHaveBeenLastCalledWith({ isTaskbarVisible: true, viewerMode: "COMPACTO" });
});
it("an older read does not overwrite new tabs or drafts", async () => {
  let resolve!: (value: ReturnType<typeof snapshot>) => void;
  actions.read.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  await mount();
  await act(async () => {
    useNotasWorkspace.getState().abrirAba("new-note", "Local draft");
    useNotasWorkspace.getState().setSyncState("new-note", "pendente");
    localStorage.setItem("draft-kept", "Unsent text");
    resolve(snapshot());
  }); await tick();
  expect(useNotasWorkspace.getState().tabs[0].noteId).toBe("new-note");
  expect(useNotasWorkspace.getState().viewerMode).toBe("COMPACTO");
  expect(localStorage.getItem("draft-kept")).toBe("Unsent text");
});
it("contains action rejection and leaves an unknown write pending without replay", async () => {
  await mount();
  actions.write.mockRejectedValue(new Error("transport timeout"));
  await act(async () => useNotasWorkspace.getState().toggleTaskbar()); await tick(600);
  expect(host.textContent).toContain("não confirmadas");
  await tick(600_000); expect(actions.write).toHaveBeenCalledTimes(1);
  let result: unknown;
  await act(async () => { result = await controller.run(async () => { throw new Error("write outcome unknown"); }); });
  expect(result).toBeNull(); expect(host.textContent).toContain("rascunho foi mantido");
});
it("serializes preference writes and sends the latest distinct intention only after success", async () => {
  let resolve!: (value: { success: boolean }) => void;
  actions.write.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  await mount(); await act(async () => useNotasWorkspace.getState().toggleTaskbar()); await tick(600);
  await act(async () => useNotasWorkspace.getState().setViewerMode("COMPACTO")); await tick(1000);
  expect(actions.write).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ success: true })); await tick(600);
  expect(actions.write).toHaveBeenCalledTimes(2);
  expect(actions.write).toHaveBeenLastCalledWith({ isTaskbarVisible: true, viewerMode: "COMPACTO" });
});
it("a rejected initial read preserves local storage and never writes unhydrated defaults", async () => {
  actions.read.mockRejectedValue(new Error("auth unavailable"));
  localStorage.setItem("draft-kept", "Do not discard");
  await mount(); await tick(2000);
  expect(host.textContent).toContain("temporariamente indisponíveis");
  expect(actions.write).not.toHaveBeenCalled(); expect(localStorage.getItem("draft-kept")).toBe("Do not discard");
});

it("cached workspace coalesces pending manual and message reconsultations without overlapping Server Actions", async () => {
  await mount();
  expect(actions.read).toHaveBeenCalledTimes(1);
  expect(client.getQueryData(["notes-workspace", 7])).toBeDefined();
  let active = 0, peak = 0;
  let finish!: (value: ReturnType<typeof snapshot>) => void;
  actions.read.mockImplementation(() => {
    active++; peak = Math.max(peak, active);
    return new Promise<ReturnType<typeof snapshot>>((resolve) => {
      finish = (value) => { active--; resolve(value); };
    });
  });
  await act(async () => { void controller.refresh(); });
  expect(active).toBe(1);
  await act(async () => {
    for (let index = 0; index < 3; index++) {
      window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, data: { type: "painel-alpha:notas-workspace-atualizado" } }));
      void controller.refresh();
    }
    useNotasWorkspace.getState().abrirAba("newer-local", "Unsent draft");
    useNotasWorkspace.getState().setSyncState("newer-local", "pendente");
    localStorage.setItem("draft-kept", "Local content");
  });
  expect(actions.read).toHaveBeenCalledTimes(2);
  expect(active).toBe(1); expect(peak).toBe(1);
  await act(async () => finish(snapshot())); await tick();
  expect(active).toBe(0);
  expect(useNotasWorkspace.getState().tabs.map((tab) => tab.noteId)).toContain("newer-local");
  expect(useNotasWorkspace.getState().activeTabId).toBe("nota-tab-newer-local");
  expect(localStorage.getItem("draft-kept")).toBe("Local content");
  expect(actions.write).not.toHaveBeenCalled();
});

it("an old identity's late workspace result cannot replace the new identity's local draft", async () => {
  let finishOld!: (value: ReturnType<typeof snapshot>) => void;
  actions.read.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
  await mount();
  const nextUser = snapshot(); nextUser.data.workspace.viewerMode = "COMPACTO";
  actions.read.mockResolvedValueOnce(nextUser);
  identity.id = "8";
  await mount();
  expect(actions.read).toHaveBeenCalledTimes(2);
  await act(async () => {
    useNotasWorkspace.getState().abrirAba("new-user-note", "New user's draft");
    useNotasWorkspace.getState().setSyncState("new-user-note", "pendente");
    localStorage.setItem("draft-new-user", "Unsent new-user text");
    const old = snapshot();
    old.data.workspace.isTaskbarVisible = true;
    finishOld(old);
  });
  await tick(2000);
  expect(useNotasWorkspace.getState().tabs.map((tab) => tab.noteId)).toEqual(["new-user-note"]);
  expect(useNotasWorkspace.getState().isTaskbarVisible).toBe(false);
  expect(localStorage.getItem("draft-new-user")).toBe("Unsent new-user text");
  expect(actions.write).not.toHaveBeenCalled();
});

it.each(["success", "failure"] as const)("an old identity's %s preference write cannot change the new identity's error or drain writes", async (outcome) => {
  let finishOld!: () => void;
  actions.write.mockImplementationOnce(() => new Promise((resolve, reject) => { finishOld = () => outcome === "success" ? resolve({ success: true }) : reject(new Error("old identity unknown write result")); }));
  await mount();
  await act(async () => useNotasWorkspace.getState().toggleTaskbar()); await tick(600);
  expect(actions.write).toHaveBeenCalledTimes(1);
  identity.id = "8"; await mount();
  expect(useNotasWorkspace.getState().isTaskbarVisible).toBe(false);
  await act(async () => finishOld()); await tick(2000);
  expect(host.textContent).toBe("");
  expect(actions.write).toHaveBeenCalledTimes(1);
  expect(useNotasWorkspace.getState().isTaskbarVisible).toBe(false);
  await act(async () => useNotasWorkspace.getState().toggleTaskbar()); await tick(600);
  expect(actions.write).toHaveBeenCalledTimes(2);
  expect(host.textContent).toBe("");
});

it("an initial workspace read settling after unmount cannot hydrate shared state", async () => {
  let finishRead!: (value: ReturnType<typeof snapshot>) => void;
  actions.read.mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));
  await mount();
  await act(async () => root.render(null));
  const unchanged = JSON.stringify(useNotasWorkspace.getState());
  const late = snapshot(); late.data.workspace.isTaskbarVisible = true;
  await act(async () => finishRead(late)); await tick(2000);
  expect(JSON.stringify(useNotasWorkspace.getState())).toBe(unchanged);
  expect(actions.write).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});

it("unmount consumes a late failed action without writing or notifying the next document", async () => {
  let reject!: (error: Error) => void;
  await mount();
  const run = controller.run(async () => new Promise<{ success: boolean }>((_resolve, fail) => { reject = fail; }));
  await act(async () => root.render(null));
  const unchanged = JSON.stringify(useNotasWorkspace.getState());
  await act(async () => reject(new Error("late transport failure")));
  expect(await run).toBeNull();
  await tick(2000);
  expect(JSON.stringify(useNotasWorkspace.getState())).toBe(unchanged);
  expect(actions.write).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
  expect(host.textContent).toBe("");
});
