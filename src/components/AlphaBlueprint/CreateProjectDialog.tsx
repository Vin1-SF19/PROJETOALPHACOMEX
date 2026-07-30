"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { CriarProjetoBlueprint } from "@/actions/BlueprintProjects";
import { UserSelect } from "./UserSelect";
import { dataInputParaDate } from "./tipos";
import { formatarPremioParaInput, parsePremioReaisParaCents } from "@/lib/blueprint/premio";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requesterId: number;
  accent: string;
  onCriado: () => void;
}

export function CreateProjectDialog({ open, onOpenChange, requesterId, accent, onCriado }: CreateProjectDialogProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [problem, setProblem] = useState("");
  const [setor, setSetor] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [ownerId, setOwnerId] = useState<number | undefined>(undefined);
  const [developerId, setDeveloperId] = useState<number | undefined>(undefined);
  const [dueDate, setDueDate] = useState("");
  const [premio, setPremio] = useState("");
  const [salvando, setSalvando] = useState(false);

  function limpar() {
    setTitle(""); setSummary(""); setProblem(""); setSetor(""); setPriority("NORMAL");
    setOwnerId(undefined); setDeveloperId(undefined); setDueDate(""); setPremio("");
  }

  async function handleSalvar() {
    if (!title.trim()) {
      toast.error("Nome do sistema é obrigatório");
      return;
    }
    const premioParseado = parsePremioReaisParaCents(premio);
    if (!premioParseado.success) {
      toast.error(premioParseado.error);
      return;
    }
    setSalvando(true);
    try {
      const res = await CriarProjetoBlueprint({
        title: title.trim(),
        summary: summary.trim() || undefined,
        problem: problem.trim() || undefined,
        setor: setor.trim() || undefined,
        requesterId,
        priority,
        status: "IDEA",
        ownerId,
        developerId,
        dueDate: dataInputParaDate(dueDate),
        premioCents: premioParseado.value ?? undefined,
      });
      if (res.success) {
        toast.success("Projeto criado");
        limpar();
        onOpenChange(false);
        onCriado();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao criar projeto");
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950/95 backdrop-blur-2xl border-white/10 rounded-3xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Novo sistema</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Nome do sistema *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Sistema de Gestão de Contratos"
              type="text"
              name="blueprint-create-nome-sistema"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
              maxLength={200}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Resumo inicial</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Do que se trata essa ideia?"
              rows={2}
              className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 resize-none"
              maxLength={2000}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Problema que precisa ser resolvido</label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={2}
              className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 resize-none"
              maxLength={4000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Setor solicitante</label>
              <input
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                placeholder="Ex: Comercial"
                type="text"
                name="blueprint-create-setor"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
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
              name="blueprint-create-prazo"
              autoComplete="off"
              className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 [color-scheme:dark]"
            />
          </div>

          <div>
            <label htmlFor="blueprint-create-premio" className="text-xs text-slate-400 mb-1 block">
              Prêmio
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</span>
              <input
                id="blueprint-create-premio"
                type="text"
                inputMode="decimal"
                value={premio}
                onChange={(e) => setPremio(e.target.value)}
                onBlur={() => {
                  const resultado = parsePremioReaisParaCents(premio);
                  if (resultado.success && resultado.value !== null) {
                    setPremio(formatarPremioParaInput(resultado.value));
                  }
                }}
                placeholder="0,00"
                autoComplete="off"
                className="w-full rounded-xl bg-slate-900/60 border border-white/10 pl-10 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
                aria-describedby="blueprint-create-premio-ajuda"
              />
            </div>
            <p id="blueprint-create-premio-ajuda" className="mt-1 text-[10px] text-slate-500">
              Opcional. Depois de criado, somente você poderá alterar este valor.
            </p>
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
            Criar sistema
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
