"use client";

import { useCallback, useEffect, useRef } from "react";
import { Minus, Maximize2, X } from "lucide-react";
import type { JSONContent } from "@tiptap/react";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { Z_INDEX } from "@/lib/z-index";
import { NoteEditor } from "./NoteEditor/NoteEditor";
import { cn } from "@/lib/utils";
import { Dock, DockItem, DockIcon, DockLabel } from "@/components/ui/dock";

const ALTURA_MIN = 220;
const ALTURA_MAX_RATIO = 0.85;

interface NoteViewerProps {
  noteId: string;
  initialTitle: string;
  initialContentJson: JSONContent;
  initialVersion: number;
  onFechar: () => void;
}

export function NoteViewer({ noteId, initialTitle, initialContentJson, initialVersion, onFechar }: NoteViewerProps) {
  const viewerMode = useNotasWorkspace((state) => state.viewerMode);
  const viewerHeight = useNotasWorkspace((state) => state.viewerHeight);
  const setViewerMode = useNotasWorkspace((state) => state.setViewerMode);
  const setViewerHeight = useNotasWorkspace((state) => state.setViewerHeight);
  const arrastandoRef = useRef(false);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      arrastandoRef.current = true;

      function handleMove(moveEvent: PointerEvent) {
        if (!arrastandoRef.current) return;
        const alturaMax = window.innerHeight * ALTURA_MAX_RATIO;
        const novaAltura = Math.min(alturaMax, Math.max(ALTURA_MIN, window.innerHeight - moveEvent.clientY));
        setViewerHeight(novaAltura);
      }

      function handleUp() {
        arrastandoRef.current = false;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [setViewerHeight],
  );

  useEffect(() => {
    return () => {
      arrastandoRef.current = false;
    };
  }, []);

  if (viewerMode === "RECOLHIDO") return null;

  const altura = viewerMode === "TELA_AMPLA" ? Math.round(window.innerHeight * 0.8) : viewerHeight;

  return (
    <div
      className={cn(
        "fixed right-3 flex flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0b1120] shadow-[0_-20px_50px_rgba(0,0,0,0.6)]",
        viewerMode === "TELA_AMPLA" ? "left-1/2 w-[min(900px,90vw)] -translate-x-1/2" : "w-[min(480px,90vw)]",
      )}
      style={{ bottom: 40, height: altura, zIndex: Z_INDEX.editorNotas }}
    >
      {viewerMode !== "TELA_AMPLA" && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Redimensionar painel de notas"
          onPointerDown={handleResizeStart}
          className="h-1.5 w-full shrink-0 cursor-row-resize bg-transparent hover:bg-white/10"
        />
      )}

      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-2 py-1">
        <Dock orientation="horizontal" magnification={34} distance={60} panelSize={24} className="gap-0.5">
          <DockItem>
            <button
              type="button"
              onClick={() => setViewerMode("RECOLHIDO")}
              className="flex h-6 items-center justify-center rounded p-1 text-slate-500 hover:bg-white/5 hover:text-white"
            >
              <DockIcon><Minus size={13} /></DockIcon>
              <DockLabel>Recolher</DockLabel>
            </button>
          </DockItem>
          <DockItem>
            <button
              type="button"
              onClick={() => setViewerMode(viewerMode === "TELA_AMPLA" ? "COMPACTO" : "TELA_AMPLA")}
              className="flex h-6 items-center justify-center rounded p-1 text-slate-500 hover:bg-white/5 hover:text-white"
            >
              <DockIcon><Maximize2 size={13} /></DockIcon>
              <DockLabel>{viewerMode === "TELA_AMPLA" ? "Compacto" : "Tela ampla"}</DockLabel>
            </button>
          </DockItem>
        </Dock>
        <button
          type="button"
          title="Fechar nota"
          onClick={onFechar}
          className="rounded p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
        >
          <X size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <NoteEditor
          key={noteId}
          noteId={noteId}
          initialTitle={initialTitle}
          initialContentJson={initialContentJson}
          initialVersion={initialVersion}
        />
      </div>
    </div>
  );
}
