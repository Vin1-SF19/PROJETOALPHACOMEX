"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { AtivarDesativarCadenciaBpm } from "@/actions/bpm/Cadencias";
import { CadenciaFormDialog } from "@/components/bpm/cadencias/CadenciaFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CadenciaView, PipelineCadenciaView } from "@/components/bpm/cadencias/types";

export function CadenciasWorkspace({ cadencias, pipelines, erro, accent }: { cadencias: CadenciaView[]; pipelines: PipelineCadenciaView[]; erro: string | null; accent: string }) {
  const router = useRouter();
  const [editor, setEditor] = useState<{ mode: "create" } | { mode: "edit"; cadencia: CadenciaView } | null>(null);
  const [pendente, startTransition] = useTransition();

  function alternar(id: string, ativa: boolean) {
    startTransition(async () => {
      const r = await AtivarDesativarCadenciaBpm({ id, ativa });
      if (!r.success) { toast.error(typeof r.error === "string" ? r.error : "Erro"); return; }
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
      <p className="text-xs text-slate-400">Sequências configuráveis de atividades (ex.: 8 dias de ligação até resposta) aplicáveis a cards.</p>

      {erro && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{erro}</div>}

      <div className="space-y-2">
        {cadencias.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">Nenhuma cadência cadastrada.</p>}
        {cadencias.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-100">{c.nome}</span>
                <Badge variant="outline" className="text-[10px]">{c.passos.length} passo(s)</Badge>
                {c._count && c._count.vinculos > 0 && <Badge variant="outline" className="text-[10px]">{c._count.vinculos} card(s) vinculado(s)</Badge>}
              </div>
              {c.descricao && <p className="truncate text-[11px] text-slate-500">{c.descricao}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={c.ativa} onCheckedChange={(v) => alternar(c.id, v)} disabled={pendente} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditor({ mode: "edit", cadencia: c })}><Pencil size={14} /></Button>
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
    </div>
  );
}
