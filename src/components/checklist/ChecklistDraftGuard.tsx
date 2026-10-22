"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useState, useRef, useSyncExternalStore } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Acao, Falha } from "./ChecklistUI";
type Entry = { dirty: boolean; save: () => Promise<boolean>; discard: () => void };
class DraftRegistry {
  entries = new Map<string, Entry>();
  listeners = new Set<() => void>();
  beforeSave: (() => Promise<void>) | undefined;
  pending: (() => void) | null = null;
  pendingCancel: (() => void) | null = null;
  state = { dirty: false, busy: false, open: false, error: "" };
  locks = 0;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.state;
  notify(patch: Partial<typeof this.state> = {}) {
    const next = { ...this.state, ...patch, dirty: [...this.entries.values()].some((e) => e.dirty), busy: this.locks > 0 };
    if (Object.keys(next).every((key) => next[key as keyof typeof next] === this.state[key as keyof typeof next])) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }
  setBeforeSave(callback: (() => Promise<void>) | undefined) {
    this.beforeSave = callback;
  }
  register(id: string, entry: Entry) {
    this.entries.set(id, entry);
    this.notify();
    return () => {
      if (this.entries.get(id) === entry) {
        this.entries.delete(id);
        this.notify();
      }
    };
  }
  lock() {
    this.locks++;
    this.notify();
    return () => {
      this.locks--;
      this.notify();
    };
  }
  request = (action: () => void, cancel?: () => void) => {
    if (this.state.busy) {
      cancel?.();
      return;
    }
    if (this.state.dirty) {
      this.pending = action;
      this.pendingCancel = cancel ?? null;
      this.notify({ open: true, error: "" });
    } else action();
  };
  cancel = () => {
    if (!this.state.busy) {
      this.pending = null;
      this.pendingCancel?.();
      this.pendingCancel = null;
      this.notify({ open: false, error: "" });
    }
  };
  discard = () => {
    if (this.state.busy) return;
    for (const e of this.entries.values()) {
      e.discard();
      e.dirty = false;
    }
    const next = this.pending;
    this.pending = null;
    this.pendingCancel = null;
    this.notify({ open: false, error: "" });
    next?.();
  };
  save = async () => {
    if (this.state.busy) return;
    const unlock = this.lock();
    let done = false;
    try {
      for (const entry of [...this.entries.values()]) {
        if (!entry.dirty) continue;
        await this.beforeSave?.();
        if (!(await entry.save())) throw new Error("Não foi possível salvar todos os rascunhos. Confira o erro e tente novamente.");
        entry.dirty = false;
      }
      done = true;
    } catch (error) {
      this.notify({ error: error instanceof Error ? error.message : "Falha ao salvar. Os rascunhos foram preservados." });
    } finally {
      unlock();
    }
    if (done) {
      const next = this.pending;
      this.pending = null;
      this.pendingCancel = null;
      this.notify({ open: false, error: "" });
      next?.();
    }
  };
}
const Context = createContext<DraftRegistry | null>(null);
export function useOptionalChecklistDrafts() {
  return useContext(Context);
}
export function useChecklistDrafts() {
  const registry = useContext(Context);
  if (!registry) throw new Error("ChecklistDraftGuard ausente");
  return registry;
}
export function useDraftState() {
  const registry = useChecklistDrafts();
  return useSyncExternalStore(registry.subscribe, registry.snapshot, registry.snapshot);
}
export function useChecklistDraft<T extends Record<string, string | null>>(
  id: string,
  confirmed: T,
  commit: (patch: Partial<T>) => Promise<boolean>,
  enabled = true,
) {
  const registry = useChecklistDrafts(),
    [draft, setDraft] = useState<Partial<T>>({}),
    [error, setError] = useState("");
  const patch = Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== confirmed[key])) as Partial<T>;
  const dirty = Object.keys(patch).length > 0,
    value = { ...confirmed, ...draft };
  const save = async () => {
    if (!enabled) return false;
    if (!dirty) return true;
    try {
      setError("");
      const ok = await commit(patch);
      if (ok) setDraft({});
      return ok;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o rascunho.");
      return false;
    }
  };
  const discard = () => setDraft({});
  const latest = useRef({ save, discard });
  useLayoutEffect(() => {
    latest.current = { save, discard };
  });
  useLayoutEffect(() => registry.register(id, { dirty, save: () => latest.current.save(), discard: () => latest.current.discard() }), [registry, id, dirty]);
  function change<K extends keyof T>(field: K, next: T[K]) {
    setDraft((prev) => {
      const result = { ...prev, [field]: next };
      if (next === confirmed[field]) delete result[field];
      return result;
    });
  }
  return { value, dirty, change, save, discard, error };
}
export function ChecklistDraftGuard({ children }: { children: React.ReactNode }) {
  const [registry] = useState(() => new DraftRegistry());
  const state = useSyncExternalStore(registry.subscribe, registry.snapshot, registry.snapshot);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (registry.state.dirty || registry.state.busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const leave = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        event.data?.type !== "ALPHA_CHECKLIST_REQUEST_LEAVE" ||
        typeof event.data.requestId !== "string"
      )
        return;
      const requestId = event.data.requestId;
      registry.request(
        () => window.parent.postMessage({ type: "ALPHA_CHECKLIST_LEAVE_ALLOWED", requestId }, window.location.origin),
        () => window.parent.postMessage({ type: "ALPHA_CHECKLIST_LEAVE_CANCELLED", requestId }, window.location.origin),
      );
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("message", leave);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("message", leave);
    };
  }, [registry]);
  useEffect(() => {
    if (window.parent !== window)
      window.parent.postMessage({ type: "ALPHA_CHECKLIST_DRAFT_STATE", blocked: state.dirty || state.busy }, window.location.origin);
  }, [state.dirty, state.busy]);
  return (
    <Context.Provider value={registry}>
      {children}
      <Dialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) registry.cancel();
        }}
      >
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Há alterações pendentes</DialogTitle>
            <DialogDescription>Salve os rascunhos ou descarte as alterações antes de continuar.</DialogDescription>
          </DialogHeader>
          {state.error && <Falha error={state.error} />}
          <div className="flex flex-wrap gap-2">
            <Acao disabled={state.busy} onClick={() => void registry.save()}>
              Salvar e continuar
            </Acao>
            <Acao disabled={state.busy} onClick={registry.discard}>
              Descartar e continuar
            </Acao>
            <Acao disabled={state.busy} onClick={registry.cancel}>
              Continuar editando
            </Acao>
          </div>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}
