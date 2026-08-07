"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { History, RotateCcw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ObterHistoricoVersoes, RestaurarVersaoNota } from "@/actions/NotasColaboracao";

interface VersaoListada {
  id: string;
  version: number;
  title: string;
  plainText: string;
  changeSummary: string | null;
  createdAt: Date | string;
  changedBy: { id: number; nome: string };
}

interface NoteHistoryDialogProps {
  noteId: string;
  trigger: React.ReactNode;
  onRestaurado?: () => void;
}

export function NoteHistoryDialog({ noteId, trigger, onRestaurado }: NoteHistoryDialogProps) {
  const [versoes, setVersoes] = useState<VersaoListada[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const res = await ObterHistoricoVersoes(noteId);
    setCarregando(false);
    if (res.success) setVersoes(res.data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  async function restaurar(version: number) {
    const res = await RestaurarVersaoNota({ noteId, version });
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível restaurar a versão");
      return;
    }
    toast.success(`Versão ${version} restaurada`);
    await carregar();
    onRestaurado?.();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0b1120] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={15} /> Histórico de versões
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          {carregando && <p className="text-xs text-slate-600">Carregando...</p>}
          {!carregando &&
            versoes.map((versao) => (
              <div key={versao.id} className="flex items-center justify-between gap-2 border-b border-white/5 px-1 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-200">
                    v{versao.version} — {versao.title || "Sem título"}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {versao.changedBy.nome} · {new Date(versao.createdAt).toLocaleString("pt-BR")}
                    {versao.changeSummary ? ` · ${versao.changeSummary}` : ""}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button type="button" title="Restaurar esta versão" className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white">
                      <RotateCcw size={13} />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restaurar versão {versao.version}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O conteúdo atual da nota será substituído pelo desta versão. Uma nova versão será criada — o histórico nunca é apagado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void restaurar(versao.version)}>Restaurar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          {!carregando && versoes.length === 0 && <p className="text-xs text-slate-600">Nenhuma versão registrada ainda.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
