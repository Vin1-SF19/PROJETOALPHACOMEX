"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { StickyNote } from "lucide-react";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { cn } from "@/lib/utils";

interface NotesLauncherButtonProps {
  isCollapsed: boolean;
}

/**
 * Botão fixo no footer da sidebar, logo abaixo do dropdown de perfil — abre/fecha a barra
 * global de notas (NotesGlobalTaskbar). Substitui o antigo botão flutuante solto no canto da
 * tela: agora o ponto de entrada da camada de notas vive dentro da própria sidebar, coerente
 * com o resto da navegação do painel.
 */
export function NotesLauncherButton({ isCollapsed }: NotesLauncherButtonProps) {
  const isTaskbarVisible = useNotasWorkspace((state) => state.isTaskbarVisible);
  const toggleTaskbar = useNotasWorkspace((state) => state.toggleTaskbar);

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            onClick={toggleTaskbar}
            aria-pressed={isTaskbarVisible}
            aria-label={isTaskbarVisible ? "Fechar notas" : "Abrir notas"}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1 transition-colors group w-full outline-none cursor-pointer",
              isCollapsed ? "justify-center" : "",
              isTaskbarVisible ? "text-amber-400" : "text-slate-600 hover:text-slate-400",
            )}
          >
            <StickyNote size={12} className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
            {!isCollapsed && (
              <span className="text-[9px] font-semibold uppercase tracking-wide truncate leading-none opacity-70 group-hover:opacity-100">
                Notas
              </span>
            )}
          </button>
        </TooltipPrimitive.Trigger>

        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="right"
            align="center"
            sideOffset={12}
            style={{ zIndex: 200 }}
            className="rounded-xl border border-amber-500/20 bg-[#080e1c] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300 shadow-[0_8px_28px_rgba(0,0,0,0.55)] data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in data-[state=delayed-open]:zoom-in-95"
          >
            {isTaskbarVisible ? "Fechar notas" : "Abrir notas"}
            <TooltipPrimitive.Arrow className="fill-[#080e1c]" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
