"use client";

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { criarEstadoEditor } from "./pipeline-editor-store";

const EditorContext = createContext<ReturnType<typeof criarEstadoEditor> | null>(null);

interface PipelineEditorStateProviderProps { children: ReactNode }

// The page keys this provider by pipeline, above the versioned server snapshot.
export function PipelineEditorStateProvider({ children }: PipelineEditorStateProviderProps) {
  const [store] = useState(criarEstadoEditor);
  return <EditorContext.Provider value={store}>{children}</EditorContext.Provider>;
}

export function usePipelineEditorState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(EditorContext);
  const [local] = useState(criarEstadoEditor);
  const store = context ?? local;
  // The same mounted hook can move between stages. Initialize each key from
  // its own snapshot, never from the first stage visited by this component.
  const fallback = store.initialize(key, typeof initial === "function" ? (initial as () => T)() : initial);
  const getSnapshot = useCallback(() => store.read(key, fallback), [store, key, fallback]);
  const value = useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  const setValue = useCallback((action: SetStateAction<T>) => {
    store.write(key, fallback, action);
  }, [store, key, fallback]);
  return [value, setValue];
}

export function PipelineEditorStateBoundary({ children }: PipelineEditorStateProviderProps) {
  const context = useContext(EditorContext);
  return context ? children : <PipelineEditorStateProvider>{children}</PipelineEditorStateProvider>;
}
