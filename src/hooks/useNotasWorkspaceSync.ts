"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { AtualizarWorkspaceNotas, ObterWorkspaceNotas } from "@/actions/NotasWorkspace";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { getNotasTabsStorageKey, parseStoredNotasTabsState } from "@/lib/notas-tabs";
import { isNotasWorkspaceAtualizadoMessage } from "@/lib/notas-workspace-messages";
import { atualizarWorkspaceSchema } from "@/lib/validations/notas";
import { sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";

const signature = () => {
  const s = useNotasWorkspace.getState();
  return JSON.stringify([s.tabs, s.activeTabId, s.viewerMode, s.isTaskbarVisible]);
};
const preferences = () => {
  const s = useNotasWorkspace.getState();
  return { isTaskbarVisible: s.isTaskbarVisible, viewerMode: s.viewerMode };
};

/** Read reconciliation never overwrites local changes made while it was in flight. */
export function useNotasWorkspaceSync(userId: number) {
  const { data: session } = useSession();
  const allowed = sessaoPermiteOperacao(session) && session?.user?.id === String(userId);
  const [error, setError] = useState("");
  const [readyUser, setReadyUser] = useState<number | null>(null);
  const ready = readyUser === userId;
  const [settled, setSettled] = useState(0);
  const hydrated = useNotasWorkspace((s) => s.hydrated);
  const visible = useNotasWorkspace((s) => s.isTaskbarVisible);
  const viewerMode = useNotasWorkspace((s) => s.viewerMode);
  const lifecycle = useRef(0);
  const baseline = useRef<string | null>(null);
  const lastAttempt = useRef<string | null>(null);
  const sending = useRef(false);
  const mounted = useRef(false);
  const storageKey = getNotasTabsStorageKey(userId);

  useEffect(() => {
    mounted.current = true;
    const generation = ++lifecycle.current;
    baseline.current = null;
    lastAttempt.current = null;
    try {
      const local = parseStoredNotasTabsState(localStorage.getItem(storageKey));
      useNotasWorkspace.getState().hidratar(local ?? { tabs: [], activeId: null });
    } catch { useNotasWorkspace.getState().hidratar({ tabs: [], activeId: null }); }
    return () => { mounted.current = false; lifecycle.current = generation + 1; };
  }, [storageKey]);

  const query = useQuery({
    queryKey: ["notes-workspace", userId], enabled: allowed && hydrated,
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const before = signature();
      const generation = lifecycle.current;
      const result = await ObterWorkspaceNotas();
      signal.throwIfAborted();
      if (!result.success) throw new Error("Workspace indisponível");
      if (!mounted.current || generation !== lifecycle.current) return result;
      const parsedMode = atualizarWorkspaceSchema.shape.viewerMode.safeParse(result.data.workspace.viewerMode);
      const serverPreferences = { isTaskbarVisible: result.data.workspace.isTaskbarVisible, viewerMode: parsedMode.success ? parsedMode.data ?? "RECOLHIDO" : "RECOLHIDO" } as const;
      baseline.current = JSON.stringify(serverPreferences);
      const local = useNotasWorkspace.getState();
      const hasPending = Object.values(local.syncState).some((s) => s !== "salvo");
      if (signature() === before && !hasPending) {
        const remote = result.data.abas.map((tab) => ({ id: tab.id, noteId: tab.noteId, title: tab.title, pinned: tab.isPinned, color: tab.color }));
        const tabs = [...remote, ...local.tabs.filter((tab) => !remote.some((r) => r.noteId === tab.noteId))];
        local.hidratar({ tabs, activeId: local.activeTabId ?? result.data.abas.find((tab) => tab.isActive)?.id ?? null });
        useNotasWorkspace.setState(serverPreferences);
      }
      setReadyUser(userId);
      return result;
    },
  });
  const refresh = useCallback(async () => { await query.refetch({ cancelRefetch: false }); }, [query]);
  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || !isNotasWorkspaceAtualizadoMessage(event.data) || !allowed) return;
      // Server Actions are not abortable: keep their in-flight read instead of restarting it.
      void refresh().catch(() => {});
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [allowed, refresh]);

  useEffect(() => {
    if (!ready || !hydrated || !allowed) return;
    const value = preferences();
    const key = JSON.stringify(value);
    if (sending.current || key === baseline.current || key === lastAttempt.current) return;
    const generation = lifecycle.current;
    const timer = setTimeout(() => {
      if (sending.current || !mounted.current || generation !== lifecycle.current) return;
      sending.current = true;
      lastAttempt.current = key;
      let success = false;
      void AtualizarWorkspaceNotas(value).then((result) => {
        if (!mounted.current || generation !== lifecycle.current) return;
        if (!result.success) throw new Error("Persistência indisponível");
        baseline.current = key;
        setError("");
        success = true;
      }).catch(() => {
        if (mounted.current && generation === lifecycle.current) setError("Preferências não confirmadas. Mantidas neste navegador; reconsulte antes de tentar outra alteração.");
      }).finally(() => {
        sending.current = false;
        if (success && mounted.current && generation === lifecycle.current) setSettled((count) => count + 1);
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [ready, hydrated, allowed, visible, viewerMode, settled]);

  const run = useCallback(async <T extends { success: boolean }>(action: () => Promise<T>): Promise<T | null> => {
    if (!allowed) { setError("A conexão precisa ser validada. Seu trabalho foi mantido."); return null; }
    const generation = lifecycle.current;
    try {
      const result = await action();
      if (!mounted.current || generation !== lifecycle.current) return null;
      if (!result.success) { setError("Não foi possível confirmar a alteração. Seu trabalho local foi mantido."); return null; }
      return result;
    } catch {
      if (mounted.current && generation === lifecycle.current) {
        setError("Alteração não confirmada. Seu rascunho foi mantido; reconsulte antes de tentar novamente.");
        toast.error("Notas indisponíveis. Seu trabalho local foi mantido.", { id: "notes-workspace-error" });
      }
      return null;
    }
  }, [allowed]);
  return { run, error: error || (query.isError ? "Notas temporariamente indisponíveis. Abas e rascunhos locais foram mantidos." : ""), refresh, allowed };
}
