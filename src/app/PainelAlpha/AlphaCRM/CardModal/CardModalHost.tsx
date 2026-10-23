"use client";

import { createContext, Fragment, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CardSaveProvider, useCardSave } from "./CardSaveContext";

type Entry = { owner: string; cardId: string; node: ReactNode };
type Host = {
  attach: (owner: string) => void;
  publish: (entry: Entry) => void;
  detach: (owner: string) => void;
  close: (owner: string, cardId: string) => boolean;
  releaseForNavigation: (owner: string, cardId: string) => boolean;
  replaceDetached: (entry: Entry) => void;
  isAttached: (owner: string) => boolean;
};
const CardModalHostContext = createContext<Host | null>(null);
export const useCardModalHost = () => useContext(CardModalHostContext);

/** O card pertence ao layout: uma troca de rota não desmonta seu rascunho. */
export function PainelCardState({ children }: { children: ReactNode }) {
  return <CardSaveProvider><CardModalHostProvider>{children}</CardModalHostProvider></CardSaveProvider>;
}

export function CardModalHostProvider({ children }: { children: ReactNode }) {
  const { getPendingFields, requestLeave } = useCardSave();
  const [entry, setEntry] = useState<Entry | null>(null);
  const current = useRef<Entry | null>(null);
  const candidate = useRef<Entry | null>(null);
  const attached = useRef(new Set<string>());
  const leave = useRef<Promise<boolean> | null>(null);
  const replace = useCallback((next: Entry | null) => { current.current = next; setEntry(next); }, []);
  const ask = useCallback(() => {
    if (!leave.current) {
      const result = requestLeave();
      leave.current = result;
      void result.finally(() => { if (leave.current === result) leave.current = null; });
    }
    return leave.current;
  }, [requestLeave]);
  const publish = useCallback((next: Entry) => {
    if (!attached.current.has(next.owner)) return;
    const previous = current.current;
    if (!previous || previous.owner === next.owner && previous.cardId === next.cardId || !getPendingFields(previous.cardId).length) {
      candidate.current = null; replace(next); return;
    }
    const waitingAlready = candidate.current?.owner === next.owner;
    candidate.current = next;
    if (waitingAlready) return;
    void ask().then((allowed) => {
      const waiting = candidate.current;
      if (waiting?.owner !== next.owner) return;
      if (allowed && attached.current.has(waiting.owner) && current.current?.owner === previous.owner) {
        candidate.current = null; replace(waiting);
      }
    });
  }, [ask, getPendingFields, replace]);
  const detach = useCallback((owner: string) => {
    attached.current.delete(owner);
    queueMicrotask(() => {
      if (attached.current.has(owner)) return; // remontagem de efeitos em StrictMode
      if (candidate.current?.owner === owner) candidate.current = null;
      if (current.current?.owner !== owner) return;
      void ask().then((allowed) => {
        if (!allowed || attached.current.has(owner) || current.current?.owner !== owner) return;
        const next = candidate.current;
        candidate.current = null;
        replace(next && attached.current.has(next.owner) ? next : null);
      });
    });
  }, [ask, replace]);
  const close = useCallback((owner: string, cardId: string) => {
    if (current.current?.owner !== owner || current.current.cardId !== cardId) return false;
    const next = candidate.current;
    candidate.current = null;
    const promoted = next && attached.current.has(next.owner) ? next : null;
    replace(promoted);
    // Se o mesmo Board já selecionou outro card, seu callback antigo não pode zerá-lo.
    return promoted?.owner !== owner;
  }, [replace]);
  const releaseForNavigation = useCallback((owner: string, cardId: string) => {
    if (current.current?.owner !== owner || current.current.cardId !== cardId) return false;
    candidate.current = null;
    replace(null);
    return true;
  }, [replace]);
  const replaceDetached = useCallback((next: Entry) => {
    // Este caminho vem de uma troca expressa no card já retido. O rascunho do
    // anterior permanece no provider; a guarda de navegação geral é separada.
    if (current.current?.owner === next.owner && !attached.current.has(next.owner)) replace(next);
  }, [replace]);
  const host = useMemo<Host>(() => ({
    attach: (owner) => { attached.current.add(owner); },
    isAttached: (owner) => attached.current.has(owner),
    publish, detach, close, releaseForNavigation, replaceDetached,
  }), [publish, detach, close, releaseForNavigation, replaceDetached]);
  return <CardModalHostContext.Provider value={host}>
    {children}
    <div className="crm-scope">
      {entry && <Fragment key={entry.owner}>{entry.node}</Fragment>}
    </div>
  </CardModalHostContext.Provider>;
}
