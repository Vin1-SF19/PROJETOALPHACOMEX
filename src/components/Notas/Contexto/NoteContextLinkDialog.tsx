"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { BuscarRegistrosVinculaveis, VincularContextoNota } from "@/actions/NotasContexto";
import { MODULOS_VINCULAVEIS } from "@/lib/modulos-registry";

interface NoteContextLinkDialogProps {
  noteId: string;
  /** Omitir quando controlado externamente via `open`/`onOpenChange` (ex: item de menu). */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onVinculado?: () => void;
}

interface RegistroResultado {
  entityId: string;
  displayName: string;
  internalPath: string;
}

/**
 * Diálogo "vincular a um registro" a partir de uma nota já aberta (menu da aba na barra
 * global) — sentido inverso do NoteLinkDialog (que vincula uma nota existente a partir da
 * tela de um módulo). Lista só os módulos com checagem real de existência no backend
 * (MODULOS_VINCULAVEIS) — nunca oferece um módulo sem suporte de verdade.
 */
export function NoteContextLinkDialog({ noteId, trigger, open, onOpenChange, onVinculado }: NoteContextLinkDialogProps) {
  const [moduleKey, setModuleKey] = useState(MODULOS_VINCULAVEIS[0]?.moduleKey ?? "");
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<RegistroResultado[]>([]);
  const [buscando, setBuscando] = useState(false);

  function selecionarModulo(valor: string) {
    setModuleKey(valor);
    setQuery("");
    setResultados([]);
  }

  async function buscar(valor: string) {
    setQuery(valor);
    if (valor.trim().length < 1) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const res = await BuscarRegistrosVinculaveis({ moduleKey, query: valor });
    setBuscando(false);
    if (res.success) setResultados(res.data);
  }

  async function vincular(registro: RegistroResultado) {
    const modulo = MODULOS_VINCULAVEIS.find((m) => m.moduleKey === moduleKey);
    if (!modulo) return;

    const res = await VincularContextoNota({
      noteId,
      moduleKey: modulo.moduleKey,
      entityType: modulo.entityType,
      entityId: registro.entityId,
      displayName: registro.displayName,
      internalPath: registro.internalPath,
    });
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível vincular");
      return;
    }
    toast.success("Nota vinculada ao registro");
    onOpenChange?.(false);
    onVinculado?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="border-white/10 bg-[#0b1120] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular a um registro</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Módulo:</span>
            <select
              value={moduleKey}
              onChange={(event) => selecionarModulo(event.target.value)}
              className="rounded-md border border-white/10 bg-transparent px-2 py-1 text-xs text-slate-300 outline-none"
            >
              {MODULOS_VINCULAVEIS.map((modulo) => (
                <option key={modulo.moduleKey} value={modulo.moduleKey} className="bg-[#0b1120]">
                  {modulo.label}
                </option>
              ))}
            </select>
          </div>

          <input
            value={query}
            onChange={(event) => void buscar(event.target.value)}
            placeholder="Buscar por número ou título..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600"
          />

          <div className="max-h-64 overflow-y-auto">
            {buscando && <p className="px-1 py-2 text-xs text-slate-600">Buscando...</p>}
            {!buscando &&
              resultados.map((registro) => (
                <button
                  key={registro.entityId}
                  type="button"
                  onClick={() => void vincular(registro)}
                  className="block w-full rounded-lg px-2 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
                >
                  {registro.displayName}
                </button>
              ))}
            {!buscando && query.trim().length >= 1 && resultados.length === 0 && (
              <p className="px-1 py-2 text-xs text-slate-600">Nenhum registro encontrado.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
