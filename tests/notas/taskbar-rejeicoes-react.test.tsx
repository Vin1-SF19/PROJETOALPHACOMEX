// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NotesGlobalTaskbar } from "@/components/Notas/NotesGlobalTaskbar";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
const actions = vi.hoisted(() => ({ read: vi.fn(), note: vi.fn(), create: vi.fn(), open: vi.fn(), close: vi.fn(), activate: vi.fn(), reorder: vi.fn(), write: vi.fn(), pin: vi.fn(), color: vi.fn(), drag: undefined as undefined | ((event: { active: { id: string }; over: { id: string } }) => void) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { estadoAcesso: "PERMITIDO", user: { id: "7" } } }) }));
vi.mock("@/actions/NotasWorkspace", () => ({ ObterWorkspaceNotas: actions.read, AtualizarWorkspaceNotas: actions.write, AbrirAbaNota: actions.open, FecharAbaNota: actions.close, AtivarAbaNota: actions.activate, ReordenarAbasNotas: actions.reorder }));
vi.mock("@/actions/Notas", () => ({ CriarNota: actions.create, ObterNota: actions.note, AtualizarNota: vi.fn(), ArquivarNota: vi.fn(), MoverNotaParaLixeira: vi.fn() }));
vi.mock("@/actions/NotasBusca", () => ({ FixarNota: actions.pin, DefinirCorNota: actions.color }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("framer-motion", () => ({ AnimatePresence: ({ children }: { children: React.ReactNode }) => children, motion: { div: ({ children }: { children: React.ReactNode }) => h("div", null, children) } }));
vi.mock("@dnd-kit/core", () => ({ DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: typeof actions.drag }) => { actions.drag = onDragEnd; return h("div", null, children); }, closestCenter: vi.fn(), PointerSensor: vi.fn(), KeyboardSensor: vi.fn(), useSensor: vi.fn(), useSensors: vi.fn() }));
vi.mock("@dnd-kit/sortable", () => ({ SortableContext: ({ children }: { children: React.ReactNode }) => children, horizontalListSortingStrategy: vi.fn(), sortableKeyboardCoordinates: vi.fn() }));
vi.mock("@/components/Notas/NoteTab", () => ({ NoteTab: (props: { title: string; onActivate: () => void; onClose: () => void; onFixar: () => void; onEscolherCor: (pos: { x: number; y: number }) => void }) => h("div", null, h("button", { onClick: props.onActivate }, "Activate " + props.title), h("button", { onClick: props.onClose }, "Close " + props.title), h("button", { onClick: props.onFixar }, "Pin " + props.title), h("button", { onClick: () => props.onEscolherCor({ x: 0, y: 0 }) }, "Color " + props.title)) }));
vi.mock("@/components/Notas/NoteColorPicker", () => ({ NoteColorPicker: ({ onEscolher }: { onEscolher: (color: string) => void }) => h("button", { onClick: () => onEscolher("blue") }, "Choose color") }));
vi.mock("@/components/Notas/NoteViewer", () => ({ NoteViewer: () => null }));
vi.mock("@/components/Notas/NotesSearchCommand", () => ({ NotesSearchCommand: () => null }));
vi.mock("@/components/Notas/Colaboracao/NoteShareDialog", () => ({ NoteShareDialog: () => null }));
vi.mock("@/components/Notas/Contexto/NoteContextLinkDialog", () => ({ NoteContextLinkDialog: () => null }));
vi.mock("@/components/ui/dock", () => ({ Dock: () => null, DockItem: () => null, DockIcon: () => null, DockLabel: () => null }));
vi.mock("@/components/ui/sheet", () => ({ Sheet: () => null, SheetContent: () => null, SheetHeader: () => null, SheetTitle: () => null }));
let root: Root, host: HTMLDivElement, client: QueryClient;
async function tick(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function click(text: string) { const button = [...host.querySelectorAll("button")].find((b) => b.textContent === text)!; expect(button).toBeDefined(); await act(async () => button.click()); await tick(); }
beforeEach(async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear();
  actions.read.mockResolvedValue({ success: true, data: { workspace: { isTaskbarVisible: true, viewerMode: "COMPACTO" }, abas: ["a", "b"].map((id) => ({ id, noteId: id, title: id, isActive: id === "a", isPinned: false, color: null })) } });
  for (const action of [actions.note, actions.create, actions.open, actions.close, actions.activate, actions.reorder, actions.pin, actions.color]) action.mockRejectedValue(new Error("unavailable"));
  actions.write.mockResolvedValue({ success: true });
  useNotasWorkspace.setState({ tabs: [], activeTabId: null, isTaskbarVisible: false, viewerMode: "RECOLHIDO", hydrated: false, syncState: {} });
  localStorage.setItem("draft-kept", "Unsent");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  await act(async () => root.render(h(QueryClientProvider, { client, children: h(NotesGlobalTaskbar, { userId: 7, onOpenCentral: vi.fn() }) })));
  await tick(500);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); vi.clearAllTimers(); vi.useRealTimers(); });
it.each(["Activate b", "Close b", "Pin b"])("consumes rejected %s action without discarding drafts", async (label) => {
  await click(label); expect(host.textContent).toContain("mantido"); expect(localStorage.getItem("draft-kept")).toBe("Unsent");
});
it("contains a rejected color mutation", async () => { await click("Color a"); await click("Choose color"); expect(actions.color).toHaveBeenCalledTimes(1); expect(host.textContent).toContain("mantido"); });
it("contains reorder and sends the new actual order", async () => { await act(async () => actions.drag?.({ active: { id: "a" }, over: { id: "b" } })); expect(actions.reorder).toHaveBeenCalledWith({ ordemNoteIds: ["b", "a"] }); expect(host.textContent).toContain("mantido"); });
it("contains creation failure and never retries unknown writes", async () => { await click("Nova nota"); expect(actions.create).toHaveBeenCalledTimes(1); await tick(300_000); expect(actions.create).toHaveBeenCalledTimes(1); expect(localStorage.getItem("draft-kept")).toBe("Unsent"); });
it("preserves a successfully created local tab when opening the remote workspace fails", async () => {
  actions.create.mockResolvedValueOnce({ success: true, data: { id: "new", title: "New local" } });
  await click("Nova nota"); expect(actions.open).toHaveBeenCalledTimes(1); expect(useNotasWorkspace.getState().tabs.some((tab) => tab.noteId === "new")).toBe(true);
  expect(host.textContent).toContain("mantido"); expect(actions.create).toHaveBeenCalledTimes(1);
});

it("manual note reconsultation keeps one non-abortable Server Action when its cache is already populated", async () => {
  await click("Pin a"); // Keeps the recoverable workspace status/button visible.
  const confirmed = { success: true, somenteLeitura: false, data: { id: "a", title: "a", contentJson: {}, currentVersion: 1 } };
  await act(async () => client.setQueryData(["notes-active", 7, "a"], confirmed));
  const originalCalls = actions.note.mock.calls.length;
  let active = 0, peak = 0;
  let finish!: (value: typeof confirmed) => void;
  actions.note.mockImplementation(() => {
    active++; peak = Math.max(peak, active);
    return new Promise<typeof confirmed>((resolve) => { finish = (value) => { active--; resolve(value); }; });
  });
  await click("Reconsultar notas");
  await click("Reconsultar notas");
  await click("Reconsultar notas");
  expect(actions.note).toHaveBeenCalledTimes(originalCalls + 1);
  expect(active).toBe(1); expect(peak).toBe(1);
  await act(async () => finish(confirmed)); await tick();
  expect(active).toBe(0); expect(localStorage.getItem("draft-kept")).toBe("Unsent");
});
