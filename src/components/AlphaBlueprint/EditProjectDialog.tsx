"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AtualizarProjetoBlueprint } from "@/actions/BlueprintProjects";
import { UserSelect } from "./UserSelect";
import { dataInputParaDate } from "./tipos";
import type { ProjetoDetalhado } from "./ProjectWorkspace";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projeto: ProjetoDetalhado;
  accent: string;
  onSalvo: () => void;
}

function formatarDataInput(data: string | Date | null | undefined): string {
  if (!data) return "";
  const d = new Date(data);
  return d.toISOString().slice(0, 10);
}

export function EditProjectDialog({ open, onOpenChange, projeto, accent, onSalvo }: EditProjectDialogProps) {
  const [summary, setSummary] = useState(projeto.summary ?? "");
  const [problem, setProblem] = useState(projeto.problem ?? "");
  const [objective, setObjective] = useState(projeto.objective ?? "");
  const [setor, setSetor] = useState(projeto.setor ?? "");
  const [priority, setPriority] = useState(projeto.priority);
  const [ownerId, setOwnerId] = useState<number | undefined>(projeto.ownerId ?? undefined);
  const [developerId, setDeveloperId] = useState<number | undefined>(projeto.developerId ?? undefined);
  const [dueDate, setDueDate] = useState(formatarDataInput(projeto.dueDate));
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    setSalvando(true);
    try {
      const res = await AtualizarProjetoBlueprint({
        projectId: projeto.id,
        summary: summary.trim() || null,
        problem: problem.trim() || null,
        objective: objective.trim() || null,
        setor: setor.trim() || null,
        priority,
        ownerId: ownerId ?? null,
        developerId: developerId ?? null,
        dueDate: dataInputParaDate(dueDate) ?? null,
      });
      if (res.success) {
        toast.success("Projeto atualizado");
        onOpenChange(false);
        onSalvo();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao atualizar projeto");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950/95 backdrop-blur-2xl border-white/10 rounded-3xl max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Editar dados do projeto</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Resumo</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 resize-none"
              maxLength={2000}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Problema</label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={2}
              className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 resize-none"
              maxLength={4000}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Objetivo</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={2}
              className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 resize-none"
              maxLength={4000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Setor</label>
              <input
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
                maxLength={60}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Prioridade</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full bg-slate-900/60 border-white/10 text-white text-sm rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                  <SelectItem value="CRITICA">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Responsável (especificação)</label>
              <UserSelect value={ownerId} onChange={setOwnerId} placeholder="Quem especifica" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Responsável (desenvolvimento)</label>
              <UserSelect value={developerId} onChange={setDeveloperId} placeholder="Quem desenvolve" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Prazo desejado</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white flex items-center gap-2 disabled:opacity-60"
            style={{ background: `rgba(${accent},0.9)` }}
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Salvar alterações
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
