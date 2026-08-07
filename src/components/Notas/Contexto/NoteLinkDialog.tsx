"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { BuscarNotas } from "@/actions/NotasBusca";
import { VincularContextoNota } from "@/actions/NotasContexto";

interface NoteLinkDialogProps {
  moduleKey: string;
  entityType: string;
  entityId: string;
  displayName: string;
  internalPath: string;
  trigger: React.ReactNode;
  onVinculado?: () => void;
}

interface NotaResultado {
  id: string;
  title: string;
}

export function NoteLinkDialog({ moduleKey, entityType, entityId, displayName, internalPath, trigger, onVinculado }: NoteLinkDialogProps) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<NotaResultado[]>([]);
  const [buscando, setBuscando] = useState(false);

  async function buscar(valor: string) {
    setQuery(valor);
    if (valor.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const res = await BuscarNotas({ query: valor, secao: "CRIADAS_POR_MIM", ordenarPor: "ATUALIZACAO", page: 1, pageSize: 10 });
    setBuscando(false);
    if (res.success) setResultados(res.data.map((nota) => ({ id: nota.id, title: nota.title })));
  }

  async function vincular(noteId: string) {
    const res = await VincularContextoNota({ noteId, moduleKey, entityType, entityId, displayName, internalPath });
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível vincular a nota");
      return;
    }
    toast.success("Nota vinculada");
    onVinculado?.();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0b1120] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular nota existente</DialogTitle>
        </DialogHeader>

        <input
          value={query}
          onChange={(event) => void buscar(event.target.value)}
          placeholder="Buscar suas notas..."
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600"
        />

        <div className="max-h-64 overflow-y-auto">
          {buscando && <p className="px-1 py-2 text-xs text-slate-600">Buscando...</p>}
          {!buscando &&
            resultados.map((nota) => (
              <button
                key={nota.id}
                type="button"
                onClick={() => void vincular(nota.id)}
                className="block w-full rounded-lg px-2 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
              >
                {nota.title || "Sem título"}
              </button>
            ))}
          {!buscando && query.trim().length >= 2 && resultados.length === 0 && (
            <p className="px-1 py-2 text-xs text-slate-600">Nenhuma nota encontrada.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
