"use client";

import { useEffect, useState } from "react";
import { StickyNote, Pin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ObterContagemNotasContexto } from "@/actions/NotasContexto";
import { NotesContextPanel } from "./NotesContextPanel";

interface NotesContextButtonProps {
  moduleKey: string;
  entityType: string;
  entityId: string;
  displayName: string;
  internalPath: string;
}

/**
 * Componente reutilizável (Seção 12) — badge "Notas relacionadas: N" que abre o painel
 * de notas vinculadas àquela entidade. Usar em qualquer tela de detalhe de um módulo.
 */
export function NotesContextButton({ moduleKey, entityType, entityId, displayName, internalPath }: NotesContextButtonProps) {
  const [contagem, setContagem] = useState<{ total: number; temFixada: boolean } | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      const res = await ObterContagemNotasContexto({ moduleKey, entityType, entityId });
      if (!cancelado && res.success) setContagem({ total: res.total, temFixada: res.temFixada });
    }
    void carregar();
    return () => {
      cancelado = true;
    };
  }, [moduleKey, entityType, entityId]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={contagem ? `Notas relacionadas: ${contagem.total}` : "Notas"}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/10 hover:text-slate-200"
        >
          <StickyNote size={11} aria-hidden="true" />
          {contagem && contagem.total > 0 ? `Notas: ${contagem.total}` : "Notas"}
          {contagem?.temFixada && <Pin size={9} className="text-amber-400" aria-label="Tem nota fixada" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 border-white/10 bg-[#0b1120] p-0">
        <NotesContextPanel
          moduleKey={moduleKey}
          entityType={entityType}
          entityId={entityId}
          displayName={displayName}
          internalPath={internalPath}
        />
      </PopoverContent>
    </Popover>
  );
}
