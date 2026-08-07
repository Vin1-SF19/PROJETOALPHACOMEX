"use client";

import { useEffect } from "react";

interface UseNotasAtalhosParams {
  onNovaNota: () => void;
  onToggleBarra: () => void;
  onAbrirCentral: () => void;
}

/**
 * Ctrl+Shift+N (nova nota), Ctrl+Shift+B (abrir/recolher barra), Ctrl+Alt+N (Central de Notas).
 * Nenhum conflito com atalhos globais existentes no painel — confirmado por Scout na Fase 02.
 */
export function useNotasAtalhos({ onNovaNota, onToggleBarra, onAbrirCentral }: UseNotasAtalhosParams) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const alvo = event.target as HTMLElement | null;
      const emCampoDeTexto =
        alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA" || alvo?.isContentEditable;

      if (event.ctrlKey && event.shiftKey && !event.altKey && event.key.toLowerCase() === "n") {
        if (emCampoDeTexto) return;
        event.preventDefault();
        onNovaNota();
        return;
      }

      if (event.ctrlKey && event.shiftKey && !event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        onToggleBarra();
        return;
      }

      if (event.ctrlKey && event.altKey && !event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onAbrirCentral();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNovaNota, onToggleBarra, onAbrirCentral]);
}
