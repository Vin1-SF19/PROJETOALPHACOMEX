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
  somenteLeitura?: boolean;
  onFechar: () => void;
}

export function NoteViewer({ noteId, initialTitle, initialContentJson, initialVersion, somenteLeitura, onFechar }: NoteViewerProps) {
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
        // Mobile/tablet (< lg): sempre tela cheia, sem cálculo de altura por arraste — o painel
        // pequeno ancorado no canto não é usável em telas de toque estreitas. As dimensões de
        // desktop (bottom/height fixos via --painel-*) só entram em vigor a partir de lg (ver
        // classes lg:bottom-(--painel-bottom) / lg:h-(--painel-altura) abaixo).
        "fixed inset-0 flex flex-col overflow-hidden border-white/10 bg-[#0b1120] shadow-[0_-20px_50px_rgba(0,0,0,0.6)] lg:inset-auto lg:bottom-(--painel-bottom) lg:right-3 lg:h-(--painel-altura) lg:rounded-t-2xl lg:border",
        viewerMode === "TELA_AMPLA" ? "lg:left-1/2 lg:w-[min(900px,90vw)] lg:-translate-x-1/2" : "lg:w-[min(480px,90vw)]",
      )}
      style={{
        zIndex: Z_INDEX.editorNotas,
        ["--painel-bottom" as string]: "40px",
        ["--painel-altura" as string]: `${altura}px`,
      }}
    >
      {viewerMode !== "TELA_AMPLA" && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Redimensionar painel de notas"
          onPointerDown={handleResizeStart}
          className="hidden h-1.5 w-full shrink-0 cursor-row-resize bg-transparent hover:bg-white/10 lg:block"
        />
      )}

      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-2 py-1">
        <button
          type="button"
          onClick={() => setViewerMode("RECOLHIDO")}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
        >
          <Minus size={14} /> Recolher
        </button>

        <div className="hidden lg:block">
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
        </div>

        <button
          type="button"
          title="Fechar nota"
          onClick={onFechar}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 lg:h-auto lg:w-auto lg:rounded lg:p-1"
        >
          <X size={16} className="lg:hidden" />
          <X size={13} className="hidden lg:block" />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <NoteEditor
          key={noteId}
          noteId={noteId}
          initialTitle={initialTitle}
          initialContentJson={initialContentJson}
          initialVersion={initialVersion}
          somenteLeitura={somenteLeitura}
        />
      </div>
    </div>
  );
}
