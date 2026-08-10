"use client";

import { useEditorStore } from "../store/useEditorStore";

/** Linhas transientes de magnetismo. As coordenadas usam o espaco logico do slide e acompanham o zoom do canvas. */
export function GuiasAlinhamento() {
  const guias = useEditorStore((state) => state.guiasAlinhamento);

  return (
    <div data-editor-only="true" aria-hidden="true" className="pointer-events-none absolute inset-0 z-[100001]">
      {guias.verticais.map((x) => (
        <div
          key={`vertical-${x}`}
          className="absolute bottom-0 top-0 w-px bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.9)]"
          style={{ left: x }}
        />
      ))}
      {guias.horizontais.map((y) => (
        <div
          key={`horizontal-${y}`}
          className="absolute left-0 right-0 h-px bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.9)]"
          style={{ top: y }}
        />
      ))}
    </div>
  );
}
