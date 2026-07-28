"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ExcluirProjetosBlueprint } from "@/actions/BlueprintProjects";
import type { ProjetoBlueprintCard } from "./tipos";

interface ModalExcluirProjetosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetos: ProjetoBlueprintCard[];
  onExcluido: () => void;
}

export function ModalExcluirProjetos({ open, onOpenChange, projetos, onExcluido }: ModalExcluirProjetosProps) {
  const [senha, setSenha] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  function fechar() {
    if (excluindo) return;
    setSenha("");
    onOpenChange(false);
  }

  async function confirmar() {
    if (!senha || excluindo) return;
    setExcluindo(true);
    try {
      const res = await ExcluirProjetosBlueprint({ projectIds: projetos.map((p) => p.id), senha });
      if (res.success) {
        toast.success(`${projetos.length} projeto(s) excluído(s) definitivamente`);
        setSenha("");
        onOpenChange(false);
        onExcluido();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao excluir projetos");
      }
    } catch {
      toast.error("Erro de conexão ao excluir projetos");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="bg-slate-950/95 backdrop-blur-2xl border-white/10 rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-400" />
            Excluir projeto{projetos.length > 1 ? "s" : ""} definitivamente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <p className="text-xs text-slate-400">
            Esta ação é <span className="text-rose-400 font-medium">permanente e não pode ser desfeita</span>.
            Serão apagados o(s) {projetos.length} projeto(s) abaixo e tudo o que eles contêm: especificação, canvas,
            arquivos, requisitos, perguntas e comentários.
          </p>

          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-2.5 max-h-36 overflow-y-auto space-y-1">
            {projetos.map((p) => (
              <p key={p.id} className="text-xs text-slate-300 flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-500">{p.code}</span>
                {p.title}
              </p>
            ))}
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Digite sua senha para confirmar</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmar()}
              placeholder="Sua senha"
              autoFocus
              name="blueprint-confirmacao-exclusao"
              autoComplete="new-password"
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-400/40"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={fechar}
              disabled={excluindo}
              className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={excluindo || !senha}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 transition-colors disabled:opacity-50"
            >
              {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {excluindo ? "Excluindo..." : "Excluir definitivamente"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
