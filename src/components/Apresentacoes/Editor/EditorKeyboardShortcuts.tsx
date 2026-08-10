"use client";

import { useEffect } from "react";
import { useEditorStore } from "./store/useEditorStore";

function alvoPossuiHistoricoProprio(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, [contenteditable='true'], [role='textbox']")
    || Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
}

/** Atalhos globais do slide. Campos de texto mantêm o Undo/Redo nativo do navegador. */
export function EditorKeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || alvoPossuiHistoricoProprio(event.target)) return;
      const tecla = event.key.toLowerCase();
      const refazer = tecla === "y" || (tecla === "z" && event.shiftKey);
      const desfazer = tecla === "z" && !event.shiftKey;
      if (!desfazer && !refazer) return;

      event.preventDefault();
      if (refazer) useEditorStore.getState().refazer();
      else useEditorStore.getState().desfazer();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
