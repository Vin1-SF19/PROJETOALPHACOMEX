"use client";

import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

interface CardSaveContextValue {
  /** Registra uma Promise de save para que o flush possa aguardá-la. */
  registerSave: (promise: Promise<void>) => void;
  /** Aguarda o save pendente (se houver) antes de prosseguir. */
  flushSaves: () => Promise<void>;
}

const CardSaveContext = createContext<CardSaveContextValue | null>(null);

export function CardSaveProvider({ children }: { children: ReactNode }) {
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const registerSave = useCallback((promise: Promise<void>) => {
    savePromiseRef.current = promise;
  }, []);

  const flushSaves = useCallback(async () => {
    if (savePromiseRef.current) {
      await savePromiseRef.current;
      savePromiseRef.current = null;
    }
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
