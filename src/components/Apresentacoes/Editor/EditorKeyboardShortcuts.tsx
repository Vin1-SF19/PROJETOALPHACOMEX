"use client";

import { useEffect } from "react";
import { useEditorStore } from "./store/useEditorStore";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

function alvoPossuiHistoricoProprio(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, [contenteditable='true'], [role='textbox']")
    || Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
}

/** Clipboard de componentes do canvas — variável de módulo (mesmo padrão já usado pela
 * Timeline pra copiar/colar configuração de animação), sobrevive à troca de slide/apresentação
 * dentro da mesma sessão do navegador, permitindo colar em outro slide (Ctrl+C/Ctrl+V). */
let areaTransferenciaComponentes: ComponenteSlide[] = [];

/** Atalhos globais do slide. Campos de texto mantêm o Undo/Redo nativo do navegador. */
export function EditorKeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || alvoPossuiHistoricoProprio(event.target)) return;
      const tecla = event.key.toLowerCase();
      const refazer = tecla === "y" || (tecla === "z" && event.shiftKey);
      const desfazer = tecla === "z" && !event.shiftKey;

      if (desfazer || refazer) {
        event.preventDefault();
        if (refazer) useEditorStore.getState().refazer();
        else useEditorStore.getState().desfazer();
        return;
      }

      if (tecla === "d") {
        const ids = useEditorStore.getState().componentesSelecionadosIds;
        if (ids.length === 0) return;
        event.preventDefault();
        useEditorStore.getState().duplicarComponentes(ids);
        return;
      }

      if (tecla === "c") {
        const estado = useEditorStore.getState();
        const idsRaiz = new Set(estado.componentesSelecionadosIds);
        const selecionados = estado.componentes.filter((c) => idsRaiz.has(c.id));
        if (selecionados.length === 0) return;
        event.preventDefault();
        areaTransferenciaComponentes = structuredClone(selecionados);
        return;
      }

      if (tecla === "v") {
        if (areaTransferenciaComponentes.length === 0) return;
        event.preventDefault();
        useEditorStore.getState().colarComponentes(areaTransferenciaComponentes);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
