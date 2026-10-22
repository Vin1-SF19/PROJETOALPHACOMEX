"use client";

import type { ObterCardBpm } from "@/actions/bpm/Cards";
import { toast, type ExternalToast } from "sonner";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ALPHA_GUARD_STATE, ALPHA_LEAVE_REQUEST, ALPHA_LEAVE_RESULT, frameIdDoDocumento, isPainelLeaveMessage, type BrowserNavigationGuard, type NavigationGuardEvent } from "@/lib/painel-leave-guard";

type ConfirmedCard = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type ConfirmationListener = (card: ConfirmedCard, key?: string) => void;
export type PendingCardChange = { label: string; before?: string; after?: string };
type SaveErrorOptions = Pick<ExternalToast, "duration" | "closeButton"> & {
  failureMessage?: () => string;
  isCurrent?: () => boolean;
};
type PendingUpload = { save: () => Promise<boolean>; nome: string };

interface CardSaveContextValue {
  requestLeave: () => Promise<boolean>;
  subscribeConfirmation: (cardId: string, listener: ConfirmationListener) => () => void;
  scheduleSave: (key: string, save: () => void, delay?: number) => void;
  flushScheduled: (prefix?: string) => void;
  getVersion: (cardId: string, fallback: string) => string;
  confirmVersion: (cardId: string, version: string) => void;
  getDraft: (key: string) => Record<string, string> | undefined;
  setDraft: (key: string, value?: Record<string, string>) => void;
  setPendingFields: (instance: string, fields: Array<string | PendingCardChange>) => void;
  getPendingFields: (cardId?: string) => string[];
  getPendingChanges: (cardId?: string) => PendingCardChange[];
  getFailedSaveKeys: (cardId: string) => string[];
  clearFailedSave: (key: string) => void;
  retryFailedSaves: (cardId: string) => Promise<boolean>;
  registerManualSave: (cardId: string, instance: string, save: () => Promise<boolean>) => () => void;
  getPendingUpload: (key: string) => PendingUpload | undefined;
  setPendingUpload: (key: string, upload?: PendingUpload) => void;
  discardPending: (cardId: string) => void;
  /** Enfileira um save para preservar a ordem e a versão-base do card. */
  registerSave: (save: () => Promise<boolean>, cardId?: string, recoveryKey?: string, errorOptions?: SaveErrorOptions, refreshAfterSave?: boolean) => Promise<boolean>;
  /** Aguarda todos os saves e informa se a persistência foi concluída. */
  flushSaves: (cardId?: string) => Promise<boolean>;
}

const CardSaveContext = createContext<CardSaveContextValue | null>(null);

export function CardSaveProvider({ children }: { children: ReactNode }) {
  const parent = useContext(CardSaveContext);
  return parent ? <>{children}</> : <CardSaveProviderState>{children}</CardSaveProviderState>;
}

function CardSaveProviderState({ children }: { children: ReactNode }) {
  const publicarEstadoGuardRef = useRef<() => void>(() => {});
  const listeners = useRef(new Map<string, Set<ConfirmationListener>>());
  const subscribeConfirmation = useCallback((cardId: string, listener: ConfirmationListener) => {
    const subscribers = listeners.current.get(cardId) ?? new Set<ConfirmationListener>();
    subscribers.add(listener);
    listeners.current.set(cardId, subscribers);
    return () => {
      subscribers.delete(listener);
      if (!subscribers.size) listeners.current.delete(cardId);
    };
  }, []);
  const scheduled = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; save: () => void }>());
  const versions = useRef(new Map<string, string>());
  const drafts = useRef(new Map<string, Record<string, string>>());
  const getDraft = useCallback((key: string) => drafts.current.get(key), []);
  const setDraft = useCallback((key: string, value?: Record<string, string>) => {
    if (value) drafts.current.set(key, value); else drafts.current.delete(key);
  }, []);
  const getVersion = useCallback((id: string, fallback: string) => {
    const known = versions.current.get(id);
    return known && known > fallback ? known : fallback;
  }, []);
  const confirmVersion = useCallback((id: string, version: string) => { versions.current.set(id, version); }, []);
  const flushScheduled = useCallback((prefix = "") => {
    for (const [key, job] of scheduled.current) {
      if (!key.startsWith(prefix)) continue;
      clearTimeout(job.timer);
      scheduled.current.delete(key);
      job.save();
    }
  }, []);
  const scheduleSave = useCallback((key: string, save: () => void, delay = 500) => {
    const previous = scheduled.current.get(key);
    if (previous) clearTimeout(previous.timer);
    scheduled.current.delete(key);
    if (!delay) { save(); return; }
    const timer = setTimeout(() => {
      scheduled.current.delete(key);
      save();
    }, delay);
    scheduled.current.set(key, { timer, save });
  }, []);
  useEffect(() => () => flushScheduled(), [flushScheduled]);
  const pendingRef = useRef(new Map<string, PendingCardChange[]>());
  const setPendingFields = useCallback((instance: string, fields: Array<string | PendingCardChange>) => {
    if (fields.length) pendingRef.current.set(instance, fields.map((field) => typeof field === "string" ? { label: field } : field));
    else pendingRef.current.delete(instance);
    publicarEstadoGuardRef.current();
  }, []);
  const getPendingChanges = useCallback((cardId?: string) => [...pendingRef.current]
    .filter(([key]) => !cardId || key.startsWith(`${cardId}:`))
    .flatMap(([, fields]) => fields), []);
  const getPendingFields = useCallback((cardId?: string) => [...new Set(getPendingChanges(cardId).map((field) => field.label))], [getPendingChanges]);
  useEffect(() => {
    function protegerSaida(event: BeforeUnloadEvent) {
      if (!getPendingFields().length) return;
      event.preventDefault(); event.returnValue = "";
    }
    window.addEventListener("beforeunload", protegerSaida);
    return () => window.removeEventListener("beforeunload", protegerSaida);
  }, [getPendingFields]);
  const savePromiseRef = useRef(new Map<string, Promise<boolean>>());
  const manualSaves = useRef(new Map<string, Map<string, () => Promise<boolean>>>());
  const pendingUploads = useRef(new Map<string, PendingUpload>());
  const getPendingUpload = useCallback((key: string) => pendingUploads.current.get(key), []);
  const setPendingUpload = useCallback((key: string, upload?: PendingUpload) => {
    if (upload) pendingUploads.current.set(key, upload);
    else pendingUploads.current.delete(key);
  }, []);
  const registerManualSave = useCallback((cardId: string, instance: string, save: () => Promise<boolean>) => {
    const handlers = manualSaves.current.get(cardId) ?? new Map<string, () => Promise<boolean>>();
    handlers.set(instance, save);
    manualSaves.current.set(cardId, handlers);
    return () => {
      if (handlers.get(instance) === save && !drafts.current.has(instance)
        && ![...pendingRef.current.keys()].some((key) => key.startsWith(`${cardId}:arquivo:`))) handlers.delete(instance);
      if (!handlers.size) manualSaves.current.delete(cardId);
    };
  }, []);

  const recovery = useRef(new Map<string, { save: () => Promise<boolean>; errorOptions?: SaveErrorOptions; refreshAfterSave: boolean }>());
  const failures = useRef(new Map<string, string | undefined>());
  const registerSave = useCallback(function enqueue(save: () => Promise<boolean>, cardId?: string, recoveryKey?: string, errorOptions?: SaveErrorOptions, refreshAfterSave = true): Promise<boolean> {
    if (recoveryKey) recovery.current.set(recoveryKey, { save, errorOptions, refreshAfterSave });
    const scope = cardId ?? "";
    const anteriores = savePromiseRef.current.get(scope) ?? Promise.resolve(true);
    const tentativa = anteriores.then(async () => {
      const success = await save();
      if (success && cardId && refreshAfterSave) {
        // A leitura atualiza a tela e a versão compartilhada; uma falha nela
        // não desfaz a gravação já confirmada pela action.
        try {
          const { ObterCardBpm } = await import("@/actions/bpm/Cards");
          const result = await ObterCardBpm(cardId);
          if (result.success && result.data) {
            confirmVersion(cardId, new Date(result.data.updatedAt).toISOString());
            for (const listener of listeners.current.get(cardId) ?? []) listener(result.data, recoveryKey);
          }
        } catch (error) {
          console.error("[CardSaveProvider/refreshAfterSave]", error);
        }
      }
      return success;
    }).catch(() => false).then((success) => {
      if (recoveryKey && recovery.current.get(recoveryKey)?.save === save) {
        if (errorOptions?.isCurrent?.() === false) {
          recovery.current.delete(recoveryKey);
          failures.current.delete(recoveryKey);
          return success;
        }
        if (success) {
          recovery.current.delete(recoveryKey);
          failures.current.delete(recoveryKey);
          if (cardId && ![...failures.current.values()].includes(cardId)) toast.dismiss?.(`card-save:${cardId}`);
        } else {
          failures.current.set(recoveryKey, cardId);
          toast.error(errorOptions?.failureMessage?.() ?? "Erro ao salvar. A alteração foi preservada nesta sessão.", {
            duration: Infinity,
            closeButton: errorOptions?.closeButton,
            id: cardId ? `card-save:${cardId}` : `card-save:${recoveryKey}`,
            action: { label: "Tentar novamente", onClick: () => {
              const previous = recovery.current.get(recoveryKey);
              flushScheduled(cardId ? `${cardId}:` : "");
              const latest = recovery.current.get(recoveryKey);
              // O flush pode ter enfileirado uma revisão mais recente.
              if (latest && latest === previous) void enqueue(latest.save, cardId, recoveryKey, latest.errorOptions, latest.refreshAfterSave);
            } },
          });
        }
      } else if (!success && !recoveryKey) {
        toast.error("Erro ao salvar. Reabra o card para recuperar o rascunho.", errorOptions);
      }
      return success;
    });
    // A falha anterior continua em `failures` até o retry. Não contaminar a
    // próxima tentativa com o resultado antigo: ela pode ter sido recuperada.
    savePromiseRef.current.set(scope, tentativa);
    return tentativa;
  }, [confirmVersion, flushScheduled]);

  const flushSaves = useCallback(async (cardId?: string) => {
    flushScheduled(cardId ? `${cardId}:` : "");
    let resultado = true;
    while (true) {
      const batches = [...savePromiseRef.current].filter(([id]) => !cardId || id === cardId);
      if (!batches.length) {
        return resultado && ![...failures.current.values()].some((id) => !cardId || id === cardId)
          && getPendingFields(cardId).length === 0;
      }
      for (const [id, savesPendentes] of batches) {
        resultado = (await savesPendentes) && resultado;
        if (savePromiseRef.current.get(id) === savesPendentes) savePromiseRef.current.delete(id);
      }
    }
  }, [getPendingFields, flushScheduled]);

  const getFailedSaveKeys = useCallback((cardId: string) => [...failures.current]
    .filter(([, id]) => id === cardId).map(([key]) => key), []);
  const clearFailedSave = useCallback((key: string) => {
    const cardId = failures.current.get(key);
    failures.current.delete(key);
    recovery.current.delete(key);
    if (cardId && ![...failures.current.values()].includes(cardId)) toast.dismiss?.(`card-save:${cardId}`);
  }, []);

  const retryFailedSaves = useCallback(async (cardId: string) => {
    flushScheduled(`${cardId}:`);
    const handlers = [...(manualSaves.current.get(cardId)?.values() ?? [])];
    for (const save of handlers) if (!await save()) return false;
    if (await flushSaves(cardId)) return true;
    const falhas = [...failures.current].filter(([, id]) => id === cardId);
    if (falhas.length === 0) return false;
    const tentativas = await Promise.all(falhas.map(([key]) => {
      const recovered = recovery.current.get(key);
      return recovered ? registerSave(recovered.save, cardId, key, recovered.errorOptions, recovered.refreshAfterSave) : Promise.resolve(false);
    }));
    return tentativas.every(Boolean) && await flushSaves(cardId);
  }, [flushScheduled, flushSaves, registerSave]);

  const discardPending = useCallback((cardId: string) => {
    for (const [key, job] of scheduled.current) {
      if (!key.startsWith(`${cardId}:`)) continue;
      clearTimeout(job.timer);
      scheduled.current.delete(key);
    }
    for (const key of drafts.current.keys()) {
      if (key.startsWith(`${cardId}:`) || key.startsWith(`${cardId}-`)) drafts.current.delete(key);
    }
    for (const key of pendingRef.current.keys()) if (key.startsWith(`${cardId}:`)) pendingRef.current.delete(key);
    for (const [key, id] of failures.current) if (id === cardId) failures.current.delete(key);
    for (const key of recovery.current.keys()) if (key.startsWith(`${cardId}:`)) recovery.current.delete(key);
    for (const key of pendingUploads.current.keys()) if (key.startsWith(`${cardId}:`)) pendingUploads.current.delete(key);
    manualSaves.current.delete(cardId);
    publicarEstadoGuardRef.current();
    toast.dismiss?.(`card-save:${cardId}`);
  }, []);

  const [saidaPendente, setSaidaPendente] = useState(false);
  const [salvandoSaida, setSalvandoSaida] = useState(false);
  const [erroSaida, setErroSaida] = useState(false);
  const resolverSaidaRef = useRef<((allowed: boolean) => void) | null>(null);
  const requestLeave = useCallback(async (): Promise<boolean> => {
    if (!getPendingFields().length && await flushSaves()) return true;
    if (resolverSaidaRef.current) return Promise.resolve(false);
    setErroSaida(false); setSaidaPendente(true);
    return new Promise((resolve) => { resolverSaidaRef.current = resolve; });
  }, [getPendingFields, flushSaves]);
  function concluirSaida(allowed: boolean) {
    const resolver = resolverSaidaRef.current; resolverSaidaRef.current = null;
    setSaidaPendente(false); setErroSaida(false); resolver?.(allowed);
  }
  useEffect(() => () => { resolverSaidaRef.current?.(false); }, []);
  useEffect(() => {
    const frameId = frameIdDoDocumento();
    const publicar = () => {
      if (frameId && window.parent !== window) window.parent.postMessage({ type: ALPHA_GUARD_STATE, version: 1, frameId, pending: getPendingFields().length > 0 }, window.location.origin);
    };
    publicarEstadoGuardRef.current = publicar; publicar();
    async function receber(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== window.location.origin || !isPainelLeaveMessage(event.data)) return;
      const m = event.data;
      if (m.type !== ALPHA_LEAVE_REQUEST || m.frameId !== frameId) return;
      const allowed = await requestLeave();
      window.parent.postMessage({ type: ALPHA_LEAVE_RESULT, version: 1, frameId, requestId: m.requestId, allowed }, window.location.origin);
    }
    function clicar(event: MouseEvent) {
      if (!getPendingFields().length || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const a = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a || a.hasAttribute("download") || a.target && a.target !== "_self") return;
      const destino = new URL(a.href, window.location.href); const atual = new URL(window.location.href);
      if (!["http:", "https:"].includes(destino.protocol) || destino.pathname === atual.pathname && destino.search === atual.search && destino.hash) return;
      event.preventDefault(); event.stopPropagation();
      void requestLeave().then((allowed) => { if (allowed) window.location.assign(destino.href); });
    }
    const navigation = (window as unknown as { navigation?: BrowserNavigationGuard }).navigation;
    function navegar(event: NavigationGuardEvent) {
      if (!getPendingFields().length || !event.cancelable) return;
      const destino = new URL(event.destination.url); const atual = new URL(window.location.href);
      if (event.navigationType !== "reload" && destino.pathname === atual.pathname && destino.search === atual.search && destino.hash !== atual.hash) return;
      event.preventDefault();
      void requestLeave().then((allowed) => {
        if (!allowed) return;
        if (event.navigationType === "traverse" && navigation) navigation.traverseTo(event.destination.key);
        else if (event.navigationType === "replace") window.location.replace(destino.href);
        else window.location.assign(destino.href);
      });
    }
    window.addEventListener("message", receber); document.addEventListener("click", clicar, true); navigation?.addEventListener("navigate", navegar);
    return () => {
      window.removeEventListener("message", receber); document.removeEventListener("click", clicar, true); navigation?.removeEventListener("navigate", navegar);
      publicarEstadoGuardRef.current = () => {};
    };
  }, [getPendingFields, requestLeave]);

  return (
    <CardSaveContext.Provider value={{ requestLeave, subscribeConfirmation, scheduleSave, flushScheduled, getVersion, confirmVersion, getDraft, setDraft, registerSave, registerManualSave, getPendingUpload, setPendingUpload, flushSaves, setPendingFields, getPendingFields, getPendingChanges, getFailedSaveKeys, clearFailedSave, retryFailedSaves, discardPending }}>
      {children}
      <AlertDialog open={saidaPendente} onOpenChange={(open) => { if (!open && !salvandoSaida) concluirSaida(false); }}><AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Salvar alterações antes de sair?</AlertDialogTitle><AlertDialogDescription>Existem dados não salvos no CRM. Escolha salvar, descartar ou continuar editando.</AlertDialogDescription></AlertDialogHeader>
        {erroSaida && <p role="alert" className="text-sm text-destructive">Não foi possível salvar tudo. Suas alterações continuam disponíveis.</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={salvandoSaida}>Continuar editando</AlertDialogCancel>
          <button type="button" disabled={salvandoSaida} className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white" onClick={async () => {
            setSalvandoSaida(true); setErroSaida(false);
            try {
              const ids = [...new Set([...pendingRef.current.keys()].map((key) => key.split(":")[0]))];
              let salvo = true; for (const id of ids) if (!await retryFailedSaves(id)) salvo = false;
              if (salvo && await flushSaves()) concluirSaida(true); else setErroSaida(true);
            } catch { setErroSaida(true); } finally { setSalvandoSaida(false); }
          }}>{salvandoSaida ? "Salvando…" : "Salvar e sair"}</button>
          <button type="button" disabled={salvandoSaida} className="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white" onClick={async () => {
            setSalvandoSaida(true);
            try {
              // Uma gravação já iniciada termina antes do descarte dos rascunhos restantes.
              for (const [key, job] of scheduled.current) { clearTimeout(job.timer); scheduled.current.delete(key); }
              while (savePromiseRef.current.size) {
                const lotes = [...savePromiseRef.current];
                for (const [id, promessa] of lotes) {
                  await promessa;
                  if (savePromiseRef.current.get(id) === promessa) savePromiseRef.current.delete(id);
                }
              }
              const ids = [...new Set([...pendingRef.current.keys()].map((key) => key.split(":")[0]))];
              for (const id of ids) discardPending(id);
              concluirSaida(true);
            } finally { setSalvandoSaida(false); }
          }}>Descartar e sair</button>
        </AlertDialogFooter>
      </AlertDialogContent></AlertDialog>
    </CardSaveContext.Provider>
  );
}

export function useCardSave(): CardSaveContextValue {
  const ctx = useContext(CardSaveContext);
  if (!ctx) {
    throw new Error("useCardSave deve ser usado dentro de CardSaveProvider");
  }
  return ctx;
}

export function useCardLeaveGuard() {
  const ctx = useContext(CardSaveContext);
  return ctx?.requestLeave ?? (() => Promise.resolve(true));
}
