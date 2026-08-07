"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CriarLembreteNota, ListarLembretesNota, ExcluirLembrete } from "@/actions/NotasLembretes";

interface LembreteListado {
  id: string;
  remindAt: Date | string;
  status: string;
}

interface CriarLembreteDialogProps {
  noteId: string;
  trigger: React.ReactNode;
}

export function CriarLembreteDialog({ noteId, trigger }: CriarLembreteDialogProps) {
  const [lembretes, setLembretes] = useState<LembreteListado[]>([]);
  const [dataHora, setDataHora] = useState("");

  async function carregar() {
    const res = await ListarLembretesNota(noteId);
    if (res.success) setLembretes(res.data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  async function criar() {
    if (!dataHora) return;
    const res = await CriarLembreteNota({ noteId, remindAt: new Date(dataHora) });
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível criar o lembrete");
      return;
    }
    toast.success("Lembrete criado");
    setDataHora("");
    await carregar();
  }

  async function excluir(reminderId: string) {
    await ExcluirLembrete(reminderId);
    await carregar();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0b1120] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell size={15} /> Lembretes
          </DialogTitle>
        </DialogHeader>

        <p className="text-[10px] text-slate-600">
          O lembrete notifica dentro do Painel Alpha enquanto ele estiver aberto no navegador — não é uma notificação do sistema operacional.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={dataHora}
            onChange={(event) => setDataHora(event.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 outline-none"
          />
          <button type="button" onClick={() => void criar()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
            Criar
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {lembretes.map((lembrete) => (
            <div key={lembrete.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2 py-1.5 text-xs text-slate-300">
              <span>
                {new Date(lembrete.remindAt).toLocaleString("pt-BR")} — {lembrete.status}
              </span>
              <button type="button" onClick={() => void excluir(lembrete.id)} className="text-slate-600 hover:text-rose-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {lembretes.length === 0 && <p className="text-xs text-slate-600">Nenhum lembrete para esta nota.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
