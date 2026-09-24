"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AtivarDesativarCadenciaBpm, ExcluirCadenciaBpm } from "@/actions/bpm/Cadencias";
import { CadenciaFormDialog } from "@/components/bpm/cadencias/CadenciaFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CadenciaView, PipelineCadenciaView } from "@/components/bpm/cadencias/types";

export function CadenciasWorkspace({ cadencias, pipelines, erro, accent }: { cadencias: CadenciaView[]; pipelines: PipelineCadenciaView[]; erro: string | null; accent: string }) {
  const router = useRouter();
  const [editor, setEditor] = useState<{ mode: "create" } | { mode: "edit"; cadencia: CadenciaView } | null>(null);
  const [excluindo, setExcluindo] = useState<CadenciaView | null>(null);
  const [idsExcluidos, setIdsExcluidos] = useState<string[]>([]);
  const [pendente, startTransition] = useTransition();

  function alternar(id: string, ativa: boolean) {
    startTransition(async () => {
      const r = await AtivarDesativarCadenciaBpm({ id, ativa });
      if (!r.success) { toast.error(typeof r.error === "string" ? r.error : "Erro"); return; }
      router.refresh();
    });
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    startTransition(async () => {
      const resultado = await ExcluirCadenciaBpm(excluindo.id);
      if (!resultado.success) { toast.error(resultado.error); return; }
      toast.success("Cadência excluída");
      setIdsExcluidos((atuais) => [...atuais, excluindo.id]);
      setExcluindo(null);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock size={18} style={{ color: `rgb(${accent})` }} />
          <h1 className="text-lg font-bold text-slate-100">Cadências</h1>
        </div>
        <Button onClick={() => setEditor({ mode: "create" })}><Plus size={15} className="mr-1" /> Nova cadência</Button>
      </div>
      <p className="text-xs text-slate-400">Orientações configuráveis por pipeline ou coluna. Elas geram tarefas e alertas, sem bloquear a movimentação dos cards.</p>

      {erro && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{erro}</div>}

      <div className="space-y-2">
        {cadencias.every((cadencia) => idsExcluidos.includes(cadencia.id)) && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">Nenhuma cadência cadastrada.</p>}
        {cadencias.filter((cadencia) => !idsExcluidos.includes(cadencia.id)).map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-100">{c.nome}</span>
                <Badge variant="outline" className="text-[10px]">{c.passos.length} passo(s)</Badge>
                {c._count && c._count.vinculos > 0 && <Badge variant="outline" className="text-[10px]">{c._count.vinculos} card(s) vinculado(s)</Badge>}
              </div>
              {c.descricao && <p className="truncate text-[11px] text-slate-500">{c.descricao}</p>}
              <p className="truncate text-[11px] text-slate-400">
                {c.pipeline && c.etapas.length > 0
                  ? `Colunas: ${c.pipeline.nome} / ${c.etapas.map((item) => item.etapa.nome).join(", ")}`
                  : c.pipeline ? `Entrada no pipeline: ${c.pipeline.nome}` : "Sem pipeline configurado"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={c.ativa} onCheckedChange={(v) => alternar(c.id, v)} disabled={pendente || !c.pipelineId} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditor({ mode: "edit", cadencia: c })}><Pencil size={14} /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400" aria-label={`Excluir ${c.nome}`} disabled={pendente} onClick={() => setExcluindo(c)}><Trash2 size={14} /></Button>
            </div>
          </div>
        ))}
      </div>

      {editor && (
        <CadenciaFormDialog
          cadencia={editor.mode === "edit" ? editor.cadencia : null}
          pipelines={pipelines}
          onClose={() => { setEditor(null); router.refresh(); }}
          onSaved={() => router.refresh()}
          onCreated={(cadencia) => { setEditor({ mode: "edit", cadencia }); router.refresh(); }}
        />
      )}
      <Dialog open={Boolean(excluindo)} onOpenChange={(aberto) => { if (!aberto && !pendente) setExcluindo(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cadência?</DialogTitle>
            <DialogDescription>
              A cadência {excluindo?.nome} deixará de gerar novas tarefas e será removida das colunas configuradas. Tarefas e histórico já criados serão preservados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pendente} onClick={() => setExcluindo(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={pendente} onClick={confirmarExclusao}>{pendente ? "Excluindo…" : "Excluir cadência"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
