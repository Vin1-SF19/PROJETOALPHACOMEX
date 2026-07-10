"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ListarTemas, AplicarTema } from "@/actions/apresentacao-temas";

interface Tema {
  id: string;
  nome: string;
  corPrimaria: string;
  corSecundaria: string;
  corAccent: string;
  isTemplate: boolean;
}

interface SeletorTemaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apresentacaoId: string;
  temaAtualId: string | null;
  onTemaAplicado: (tema: Tema | null) => void;
}

export function SeletorTema({ open, onOpenChange, apresentacaoId, temaAtualId, onTemaAplicado }: SeletorTemaProps) {
  const [temas, setTemas] = useState<Tema[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aplicando, setAplicando] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dispara o fetch ao abrir o modal, mesmo padrão de ExtratosListagem.tsx
    setCarregando(true);
    ListarTemas().then((res) => {
      if (res.success) setTemas(res.data as Tema[]);
      else toast.error(typeof res.error === "string" ? res.error : "Erro ao buscar temas.");
      setCarregando(false);
    });
  }, [open]);

  async function handleAplicar(tema: Tema | null) {
    setAplicando(tema?.id ?? "nenhum");
    try {
      const res = await AplicarTema({ apresentacaoId, temaId: tema?.id ?? null });
      if (res.success) {
        toast.success(tema ? "Tema aplicado." : "Tema removido.");
        onTemaAplicado(tema);
        onOpenChange(false);
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao aplicar tema.");
      }
    } finally {
      setAplicando(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Escolher tema</DialogTitle>
          <DialogDescription>Aplica um conjunto de cores e tipografia à apresentação.</DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="py-8 text-center text-sm text-slate-500">Carregando temas...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-3">
            <button
              onClick={() => handleAplicar(null)}
              disabled={aplicando !== null}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition-colors disabled:opacity-50 ${
                !temaAtualId ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="h-10 w-full rounded-lg border border-dashed border-white/20" />
              <span className="text-slate-300">Sem tema</span>
            </button>

            {temas.map((tema) => (
              <button
                key={tema.id}
                onClick={() => handleAplicar(tema)}
                disabled={aplicando !== null}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition-colors disabled:opacity-50 ${
                  temaAtualId === tema.id ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex h-10 w-full overflow-hidden rounded-lg">
                  <div className="flex-1" style={{ background: tema.corPrimaria }} />
                  <div className="flex-1" style={{ background: tema.corSecundaria }} />
                  <div className="flex-1" style={{ background: tema.corAccent }} />
                </div>
                <span className="truncate text-slate-300">{tema.nome}</span>
                {aplicando === tema.id && <span className="text-[10px] text-slate-500">Aplicando...</span>}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
