"use client";

import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

interface CardSaveContextValue {
  /** Enfileira um save para preservar a ordem e a versão-base do card. */
  registerSave: (save: () => Promise<boolean>) => Promise<boolean>;
  /** Aguarda todos os saves e informa se a persistência foi concluída. */
  flushSaves: () => Promise<boolean>;
}

const CardSaveContext = createContext<CardSaveContextValue | null>(null);

export function CardSaveProvider({ children }: { children: ReactNode }) {
  const savePromiseRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const registerSave = useCallback((save: () => Promise<boolean>) => {
    const promise = savePromiseRef.current
      .then(async (savesAnterioresConcluidos) => {
        const saveAtualConcluido = await save();
        return savesAnterioresConcluidos && saveAtualConcluido;
      })
      .catch(() => false);
    savePromiseRef.current = promise;
    return promise;
  }, []);

  const flushSaves = useCallback(async () => {
    const savesPendentes = savePromiseRef.current;
    const savesConcluidos = await savesPendentes;
    if (savePromiseRef.current === savesPendentes) {
      savePromiseRef.current = Promise.resolve(true);
    }
    return savesConcluidos;
  }, []);

  return (
    <CardSaveContext.Provider value={{ registerSave, flushSaves }}>
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
