"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AlternarAtivacaoRegraBpm, ExcluirRegraBpm } from "@/actions/bpm/Regras";
import { RegraFormDialog } from "@/components/bpm/regras/RegraFormDialog";
import type { PipelineRegraView, RegraBpmView } from "@/components/bpm/regras/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Props = {
  pipelines: PipelineRegraView[];
  regras: RegraBpmView[];
  erro: string | null;
  accent: string;
};

const RESULTADO_RESUMO: Record<string, string> = {
  campo_obrigatorio: "Torna campo(s) obrigatório(s)",
  bloqueio_movimentacao: "Bloqueia movimentação",
  mensagem_validacao: "Exibe mensagem",
  calculo: "Executa cálculo",
  formula_segura: "Aplica fórmula",
  tabela_decisao: "Consulta tabela de decisão",
  resultado_condicional: "Determina resultado condicional",
};

export function RegrasWorkspace({ pipelines, regras, erro, accent }: Props) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [editor, setEditor] = useState<{ mode: "create" } | { mode: "edit"; regra: RegraBpmView } | null>(null);
  const [excluindo, setExcluindo] = useState<RegraBpmView | null>(null);
  const [pendente, startTransition] = useTransition();

  const regrasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return regras;
    return regras.filter((regra) => regra.nome.toLowerCase().includes(termo) || regra.pipelineNome?.toLowerCase().includes(termo));
  }, [regras, busca]);

  function alternarAtiva(regra: RegraBpmView, ativa: boolean) {
    startTransition(async () => {
      const resposta = await AlternarAtivacaoRegraBpm({ id: regra.id, ativa });
      if (!resposta.success) { toast.error(resposta.error); return; }
      router.refresh();
    });
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    startTransition(async () => {
      const resposta = await ExcluirRegraBpm({ id: excluindo.id });
      if (!resposta.success) { toast.error(resposta.error); setExcluindo(null); return; }
      toast.success("Regra removida");
      setExcluindo(null);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} style={{ color: `rgb(${accent})` }} />
          <h1 className="text-lg font-bold text-slate-100">Motor de Regras e Validações</h1>
        </div>
        <Button onClick={() => setEditor({ mode: "create" })}>
          <Plus size={15} className="mr-1" /> Nova regra
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        Regras SE/ENTÃO reutilizáveis pelo CRM/BPM: tornam campos obrigatórios, bloqueiam movimentações, exibem mensagens, calculam valores e aplicam fórmulas — sem precisar editar código.
      </p>

      {erro && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{erro}</div>
      )}

      <Input placeholder="Buscar por nome ou pipeline…" value={busca} onChange={(event) => setBusca(event.target.value)} />

      <div className="space-y-2">
        {regrasFiltradas.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
            Nenhuma regra configurada ainda.
          </p>
        )}
        {regrasFiltradas.map((regra) => (
          <div key={regra.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-100">{regra.nome}</span>
                <Badge variant={regra.ativa ? "default" : "secondary"} className="text-[10px]">v{regra.versaoAtual}</Badge>
                {regra.pipelineNome && <Badge variant="outline" className="text-[10px]">{regra.pipelineNome}</Badge>}
              </div>
              {regra.descricao && <p className="truncate text-[11px] text-slate-500">{regra.descricao}</p>}
              <p className="text-[11px] text-slate-400">
                Prioridade {regra.prioridade} · {regra.resultado ? RESULTADO_RESUMO[regra.resultado.tipo] ?? regra.resultado.tipo : "sem resultado"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={regra.ativa} onCheckedChange={(checked) => alternarAtiva(regra, checked)} disabled={pendente} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditor({ mode: "edit", regra })}>
                <Pencil size={14} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400" onClick={() => setExcluindo(regra)}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editor && (
        <RegraFormDialog
          regra={editor.mode === "edit" ? editor.regra : null}
          pipelines={pipelines}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); router.refresh(); }}
        />
      )}

      <AlertDialog open={Boolean(excluindo)} onOpenChange={(open) => !open && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{excluindo?.nome}&quot; deixará de ser avaliada imediatamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} disabled={pendente}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
