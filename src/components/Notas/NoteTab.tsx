"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, FileText, Loader2, AlertCircle, Users, Pin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { EstadoSincronizacaoNota } from "@/store/useNotasWorkspace";

interface NoteTabProps {
  tabId: string;
  noteId: string;
  title: string;
  isActive: boolean;
  isPinned?: boolean;
  color?: string | null;
  syncState?: EstadoSincronizacaoNota;
  isShared?: boolean;
  onActivate: () => void;
  onClose: () => void;
  onRenomear: () => void;
  onFixar: () => void;
  onDuplicar: () => void;
  onCompartilhar: () => void;
  onAbrirTelaAmpla: () => void;
  onVincular: () => void;
  onEscolherCor: (posicao: { x: number; y: number }) => void;
  onFecharOutras: () => void;
  onFecharADireita: () => void;
  onArquivar: () => void;
  onExcluir: () => void;
}

export function NoteTab({
  tabId,
  title,
  isActive,
  isPinned,
  color,
  syncState,
  isShared,
  onActivate,
  onClose,
  onRenomear,
  onFixar,
  onDuplicar,
  onCompartilhar,
  onAbrirTelaAmpla,
  onVincular,
  onEscolherCor,
  onFecharOutras,
  onFecharADireita,
  onArquivar,
  onExcluir,
}: NoteTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tabId, disabled: isPinned });
  const horizontalTransform = transform ? { ...transform, y: 0 } : null;
  const [menuAberto, setMenuAberto] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(horizontalTransform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    ...(color ? { borderLeftColor: color, borderLeftWidth: 2 } : undefined),
  };

  return (
    <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group/notetab relative flex h-7 shrink-0 items-center rounded-lg border transition-colors duration-150",
          isActive
            ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-300"
            : "border-transparent bg-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
        )}
      >
        {/* Âncora invisível posicionada no ponto do clique direito — o menu de contexto abre
            ali, nunca colado no botão. O botão em si só ativa a nota no clique esquerdo. */}
        <DropdownMenuTrigger asChild>
          <span aria-hidden="true" className="pointer-events-none fixed h-px w-px" style={{ left: menuPos.x, top: menuPos.y }} />
        </DropdownMenuTrigger>

        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={onActivate}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuPos({ x: event.clientX, y: event.clientY });
            setMenuAberto(true);
          }}
          title={isPinned ? `${title} (fixada)` : title}
          className={cn(
            "flex h-full min-w-0 max-w-[160px] items-center gap-1.5 rounded-lg pl-2.5 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
            isPinned ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
          )}
        >
          {isPinned ? (
            <Pin size={11} className="shrink-0 opacity-70" aria-label="Fixada" />
          ) : (
            <FileText size={11} className="shrink-0 opacity-60" aria-hidden="true" />
          )}
          {syncState === "salvando" && <Loader2 size={10} className="shrink-0 animate-spin text-blue-400" aria-label="Salvando" />}
          {(syncState === "erro" || syncState === "conflito") && (
            <AlertCircle size={10} className="shrink-0 text-rose-400" aria-label="Erro de sincronização" />
          )}
          {isShared && <Users size={10} className="shrink-0 opacity-60" aria-label="Nota compartilhada" />}
          <span className="truncate text-[11px] font-medium">{title || "Sem título"}</span>
        </button>

        {!isPinned && (
          <button
            type="button"
            aria-label={`Fechar nota ${title}`}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="mr-1 shrink-0 rounded p-0.5 opacity-0 outline-none transition-all hover:bg-rose-500/10 hover:text-rose-400 focus-visible:opacity-100 group-hover/notetab:opacity-60"
          >
            <X size={10} aria-hidden="true" />
          </button>
        )}
      </div>

      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={onRenomear}>Renomear</DropdownMenuItem>
        <DropdownMenuItem onClick={onFixar}>{isPinned ? "Desafixar" : "Fixar"}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEscolherCor(menuPos)}>Cor da aba</DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicar}>Duplicar</DropdownMenuItem>
        <DropdownMenuItem onClick={onCompartilhar}>Compartilhar</DropdownMenuItem>
        <DropdownMenuItem onClick={onAbrirTelaAmpla}>Abrir em janela maior</DropdownMenuItem>
        <DropdownMenuItem onClick={onVincular}>Vincular a um registro</DropdownMenuItem>
        <DropdownMenuSeparator />
        {!isPinned && (
          <>
            <DropdownMenuItem onClick={onClose}>Fechar</DropdownMenuItem>
            <DropdownMenuItem onClick={onFecharOutras}>Fechar outras</DropdownMenuItem>
            <DropdownMenuItem onClick={onFecharADireita}>Fechar as da direita</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onArquivar}>Arquivar</DropdownMenuItem>
        <DropdownMenuItem onClick={onExcluir} className="text-rose-400 focus:text-rose-400">
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
