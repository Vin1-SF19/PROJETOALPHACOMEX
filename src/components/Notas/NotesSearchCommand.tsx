"use client";

import { useEffect, useRef, useState } from "react";
import { Search, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BuscarNotas } from "@/actions/NotasBusca";
import { AbrirAbaNota } from "@/actions/NotasWorkspace";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";

const DEBOUNCE_MS = 300;

interface ResultadoBusca {
  id: string;
  title: string;
}

/**
 * Command palette isolada e simples — sem instalar `cmdk` (nenhuma command palette existe
 * hoje no projeto, decisão consciente de minimizar dependências novas, mesmo espírito da Fase 02).
 */
export function NotesSearchCommand({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abrirAba = useNotasWorkspace((state) => state.abrirAba);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta a busca ao fechar o dialog, sem Promise
      setQuery("");
      setResultados([]);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa resultados para query curta, sem Promise
      setResultados([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await BuscarNotas({ query, secao: "RECENTES", ordenarPor: "ATUALIZACAO", page: 1, pageSize: 15 });
      if (res.success) setResultados(res.data.map((nota) => ({ id: nota.id, title: nota.title })));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function selecionar(noteId: string, title: string) {
    abrirAba(noteId, title);
    await AbrirAbaNota({ noteId });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0b1120] p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Buscar notas</DialogTitle>
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <Search size={14} className="text-slate-500" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar notas..."
            className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {resultados.map((nota) => (
            <button
              key={nota.id}
              type="button"
              onClick={() => void selecionar(nota.id, nota.title)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
            >
              <FileText size={13} className="shrink-0 opacity-60" />
              {nota.title || "Sem título"}
            </button>
          ))}
          {query.trim().length >= 2 && resultados.length === 0 && (
            <p className="px-2 py-2 text-xs text-slate-600">Nenhuma nota encontrada.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
