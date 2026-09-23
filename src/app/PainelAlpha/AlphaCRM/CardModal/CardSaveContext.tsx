"use client";

import { ObterCardBpm } from "@/actions/bpm/Cards";
import { toast } from "sonner";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

type ConfirmedCard = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type ConfirmationListener = (card: ConfirmedCard, key?: string) => void;

interface CardSaveContextValue {
  subscribeConfirmation: (cardId: string, listener: ConfirmationListener) => () => void;
  scheduleSave: (key: string, save: () => void, delay?: number) => void;
  flushScheduled: (prefix?: string) => void;
  getVersion: (cardId: string, fallback: string) => string;
  confirmVersion: (cardId: string, version: string) => void;
  getDraft: (key: string) => Record<string, string> | undefined;
  setDraft: (key: string, value?: Record<string, string>) => void;
  setPendingFields: (instance: string, fields: string[]) => void;
  getPendingFields: (cardId?: string) => string[];
  /** Enfileira um save para preservar a ordem e a versão-base do card. */
  registerSave: (save: () => Promise<boolean>, cardId?: string, recoveryKey?: string) => Promise<boolean>;
  /** Aguarda todos os saves e informa se a persistência foi concluída. */
  flushSaves: (cardId?: string) => Promise<boolean>;
}

const CardSaveContext = createContext<CardSaveContextValue | null>(null);

export function CardSaveProvider({ children }: { children: ReactNode }) {
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
  const pendingRef = useRef(new Map<string, string[]>());
  const setPendingFields = useCallback((instance: string, fields: string[]) => {
    if (fields.length) pendingRef.current.set(instance, fields);
    else pendingRef.current.delete(instance);
  }, []);
  const getPendingFields = useCallback((cardId?: string) => [...new Set([...pendingRef.current]
    .filter(([key]) => !cardId || key.startsWith(`${cardId}:`))
    .flatMap(([, fields]) => fields))], []);
  const savePromiseRef = useRef(new Map<string, Promise<boolean>>());

  const recovery = useRef(new Map<string, () => Promise<boolean>>());
  const failures = useRef(new Map<string, string | undefined>());
  const registerSave = useCallback(function enqueue(save: () => Promise<boolean>, cardId?: string, recoveryKey?: string): Promise<boolean> {
    if (recoveryKey) recovery.current.set(recoveryKey, save);
    const scope = cardId ?? "";
    const anteriores = savePromiseRef.current.get(scope) ?? Promise.resolve(true);
    const tentativa = anteriores.then(async () => {
      const success = await save();
      if (success && cardId) {
        const result = await ObterCardBpm(cardId);
        if (!result.success || !result.data) return false;
        confirmVersion(cardId, new Date(result.data.updatedAt).toISOString());
        for (const listener of listeners.current.get(cardId) ?? []) listener(result.data, recoveryKey);
      }
      return success;
    }).catch(() => false).then((success) => {
      if (recoveryKey && recovery.current.get(recoveryKey) === save) {
        if (success) {
          recovery.current.delete(recoveryKey);
          failures.current.delete(recoveryKey);
        } else {
          failures.current.set(recoveryKey, cardId);
          toast.error("Erro ao salvar. A alteração foi preservada nesta sessão.", {
            duration: Infinity,
            action: { label: "Tentar novamente", onClick: () => {
              const previous = recovery.current.get(recoveryKey);
              flushScheduled(cardId ? `${cardId}:` : "");
              const latest = recovery.current.get(recoveryKey);
              // O flush pode ter enfileirado uma revisão mais recente.
              if (latest && latest === previous) void enqueue(latest, cardId, recoveryKey);
            } },
          });
        }
      } else if (!success && !recoveryKey) {
        toast.error("Erro ao salvar. Reabra o card para recuperar o rascunho.");
      }
      return success;
    });
    // O chamador recebe sua tentativa; o flush conserva a segurança do lote inteiro.
    savePromiseRef.current.set(scope, anteriores.then(async (savesAnterioresConcluidos) => {
      const saveAtualConcluido = await tentativa;
      return savesAnterioresConcluidos && saveAtualConcluido;
    }));
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

  return (
    <CardSaveContext.Provider value={{ subscribeConfirmation, scheduleSave, flushScheduled, getVersion, confirmVersion, getDraft, setDraft, registerSave, flushSaves, setPendingFields, getPendingFields }}>
      {children}
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
