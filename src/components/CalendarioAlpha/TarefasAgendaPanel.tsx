"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { concluirTarefaAgendaAlpha, criarTarefaAgendaAlpha, sincronizarTarefasAgendaAlpha } from "@/actions/google-calendar-tarefas";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import type { TarefaAgendaExibicao } from "./lib/tipos";

export function TarefasAgendaPanel({ tema, tarefas, onAtualizar }: { tema: TemaAlpha; tarefas: TarefaAgendaExibicao[]; onAtualizar: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [isPending, startTransition] = useTransition();
  const pendentes = tarefas.filter((tarefa) => tarefa.status !== "completed");
  const listaPadrao = pendentes[0]?.taskListGoogleId ?? tarefas[0]?.taskListGoogleId;

  function sincronizar() {
    startTransition(async () => {
      const resultado = await sincronizarTarefasAgendaAlpha();
      if (!resultado.success) return toast.error(resultado.error);
      toast.success(`${resultado.data.tarefas} tarefa(s) sincronizada(s).`);
      onAtualizar();
    });
  }

  function criar() {
    if (!titulo.trim()) return;
    if (!listaPadrao) return toast.info("Sincronize as tarefas para selecionar uma lista do Google.");
    startTransition(async () => {
      const resultado = await criarTarefaAgendaAlpha({ taskListId: listaPadrao, titulo });
      if (!resultado.success) return toast.error(resultado.error);
      setTitulo("");
      onAtualizar();
    });
  }

  function concluir(id: string) {
    startTransition(async () => {
      const resultado = await concluirTarefaAgendaAlpha({ tarefaCacheId: id });
      if (!resultado.success) return toast.error(resultado.error);
      onAtualizar();
    });
  }

  return (
    <section className="mb-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3 backdrop-blur-xl" aria-label="Tarefas do Google">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white"><CheckCircle2 className="size-4" /> Tarefas</h2>
        <button type="button" onClick={sincronizar} disabled={isPending} className="text-xs font-bold text-slate-300 hover:text-white"><RefreshCw className={cn("mr-1 inline size-3.5", isPending && "animate-spin")} />Sincronizar tarefas</button>
      </div>
      <div className="flex gap-2">
        <Input value={titulo} onChange={(event) => setTitulo(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); criar(); } }} placeholder="Nova tarefa" maxLength={1024} />
        <button type="button" onClick={criar} disabled={isPending} className={cn("rounded-xl px-3 text-white", tema.bg)} aria-label="Criar tarefa"><Plus className="size-4" /></button>
      </div>
      <div className="mt-2 flex max-h-32 flex-wrap gap-x-4 gap-y-1 overflow-y-auto">
        {pendentes.length === 0 ? <p className="text-xs text-slate-500">Sem tarefas pendentes. Sincronize para buscar as tarefas do Google.</p> : pendentes.map((tarefa) => (
          <label key={tarefa.id} className="flex min-w-44 items-center gap-2 text-xs text-slate-200">
            <Checkbox checked={false} disabled={isPending} onCheckedChange={(checked) => { if (checked === true) concluir(tarefa.id); }} />
            <span className="truncate">{tarefa.titulo}</span>
          </label>
        ))}
      </div>
      {isPending && <Loader2 className="mt-2 size-3 animate-spin text-slate-400" />}
    </section>
  );
}
