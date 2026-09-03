"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Clock3,
  Copy,
  FileSignature,
  FileText,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlternarAutomacaoBpm,
  DuplicarAutomacaoBpm,
  ExcluirAutomacaoBpm,
} from "@/actions/bpm/Automacoes";
import { AutomacaoFormDialog } from "@/components/bpm/automacoes/AutomacaoFormDialog";
import type {
  AutomacaoBpmView,
  PipelineAutomacaoView,
  TemplateAutomacao,
} from "@/components/bpm/automacoes/types";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Editor =
  | { mode: "create"; pipelineId?: string; etapaId?: string }
  | { mode: "edit"; automacao: AutomacaoBpmView }
  | null;

type Props = {
  pipelines: PipelineAutomacaoView[];
  templates: TemplateAutomacao[];
  erro: string | null;
  accent: string;
};

const GATILHO_LABEL: Record<string, string> = {
  ENTRAR_COLUNA: "Ao entrar",
  SAIR_COLUNA: "Ao sair",
  TEMPO_NA_COLUNA: "Tempo na coluna",
};

const ACAO_LABEL: Record<string, string> = {
  ENVIAR_EMAIL: "Enviar e-mail",
  GERAR_CONTRATO: "Gerar contrato",
  GERAR_FICHA: "Gerar ficha",
};

function AcaoIcon({ tipo }: { tipo: string }) {
  if (tipo === "ENVIAR_EMAIL") return <Mail size={15} />;
  if (tipo === "GERAR_CONTRATO") return <FileSignature size={15} />;
  return <FileText size={15} />;
}

function dataCurta(valor: string | null) {
  if (!valor) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(valor));
}

export function AutomacoesWorkspace({ pipelines, templates, erro, accent }: Props) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [excluir, setExcluir] = useState<AutomacaoBpmView | null>(null);
  const [duplicar, setDuplicar] = useState<AutomacaoBpmView | null>(null);
  const [destinoPipelineId, setDestinoPipelineId] = useState("");
  const [destinoEtapaId, setDestinoEtapaId] = useState("");
  const [isPending, startTransition] = useTransition();

  const pipelinesFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return pipelines;
    return pipelines
      .map((pipeline) => ({
        ...pipeline,
        etapas: pipeline.etapas
          .map((etapa) => ({
            ...etapa,
            automacoes: etapa.automacoes.filter((automacao) =>
              [automacao.nome, automacao.descricao, ACAO_LABEL[automacao.acaoTipo], GATILHO_LABEL[automacao.gatilhoTipo]]
                .filter(Boolean)
                .some((valor) => valor!.toLocaleLowerCase("pt-BR").includes(termo)),
            ),
          }))
          .filter((etapa) =>
            pipeline.nome.toLocaleLowerCase("pt-BR").includes(termo)
            || etapa.nome.toLocaleLowerCase("pt-BR").includes(termo)
            || etapa.automacoes.length > 0,
          ),
      }))
      .filter((pipeline) =>
        pipeline.nome.toLocaleLowerCase("pt-BR").includes(termo)
        || pipeline.etapas.length > 0,
      );
  }, [busca, pipelines]);

  const totalAutomacoes = pipelines.reduce(
    (total, pipeline) => total + pipeline.etapas.reduce(
      (subtotal, etapa) => subtotal + etapa.automacoes.length,
      0,
    ),
    0,
  );

  function atualizar() {
    setEditor(null);
    setDuplicar(null);
    setExcluir(null);
    router.refresh();
  }

  function alternar(automacao: AutomacaoBpmView, ativa: boolean) {
    startTransition(async () => {
      const resultado = await AlternarAutomacaoBpm(automacao.id, ativa);
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      toast.success(ativa ? "Automação ativada" : "Automação pausada");
      router.refresh();
    });
  }

  function confirmarExclusao() {
    if (!excluir) return;
    startTransition(async () => {
      const resultado = await ExcluirAutomacaoBpm(excluir.id);
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Automação excluída");
      atualizar();
    });
  }

  const pipelineDestino = pipelines.find((pipeline) => pipeline.id === destinoPipelineId);
  const etapaDestino = destinoEtapaId || pipelineDestino?.etapas[0]?.id || "";

  function confirmarDuplicacao() {
    if (!duplicar || !destinoPipelineId || !etapaDestino) return;
    startTransition(async () => {
      const resultado = await DuplicarAutomacaoBpm({
        automacaoId: duplicar.id,
        pipelineId: destinoPipelineId,
        etapaId: etapaDestino,
      });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      toast.success("Automação duplicada como inativa para revisão");
      atualizar();
    });
  }

  if (erro) return <div className="p-6 text-sm text-rose-300">{erro}</div>;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl" style={{ background: `rgba(${accent},0.16)`, color: `rgb(${accent})` }}><Bot size={18} /></div>
            <h1 className="text-2xl font-black text-white">Automações</h1>
          </div>
          <p className="max-w-2xl text-sm text-slate-400">Configure ações por entrada, saída ou permanência nas colunas de todos os pipelines do Alpha CRM.</p>
          <p className="mt-2 text-xs text-slate-500">{pipelines.length} pipeline(s) · {totalAutomacoes} automação(ões)</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar pipeline, coluna ou automação" className="pl-9" />
          </div>
          <Button onClick={() => setEditor({ mode: "create" })} disabled={pipelines.length === 0} style={{ background: `rgb(${accent})` }}>
            <Plus size={16} /> Nova automação
          </Button>
        </div>
      </header>

      {pipelinesFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center">
          <Zap className="mx-auto mb-3 text-slate-600" size={28} />
          <p className="text-sm text-slate-400">Nenhum pipeline ou automação encontrado.</p>
        </div>
      ) : pipelinesFiltrados.map((pipeline) => (
        <section key={pipeline.id} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-950/55 shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div>
              <h2 className="font-bold text-white">{pipeline.nome}</h2>
              <p className="text-xs text-slate-500">{pipeline.etapas.length} coluna(s){!pipeline.ativo ? " · pipeline inativo" : ""}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditor({ mode: "create", pipelineId: pipeline.id })} aria-label={`Criar automação em ${pipeline.nome}`}>
              <Plus size={14} /> Adicionar
            </Button>
          </div>
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            {pipeline.etapas.map((etapa) => (
              <div key={etapa.id} className="rounded-xl border border-white/[0.06] bg-slate-900/55 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{etapa.nome}</h3>
                    <p className="text-[11px] text-slate-500">{etapa.automacoes.length} automação(ões){!etapa.ativo ? " · coluna inativa" : ""}</p>
                  </div>
                  <button type="button" onClick={() => setEditor({ mode: "create", pipelineId: pipeline.id, etapaId: etapa.id })} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white" aria-label={`Nova automação na coluna ${etapa.nome}`}><Plus size={15} /></button>
                </div>
                <div className="space-y-2">
                  {etapa.automacoes.length === 0 && <p className="rounded-lg border border-dashed border-white/[0.06] px-3 py-5 text-center text-xs text-slate-600">Nenhuma automação nesta coluna.</p>}
                  {etapa.automacoes.map((automacao) => (
                    <article key={automacao.id} className="rounded-xl border border-white/[0.07] bg-slate-950/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">{automacao.nome}</p>
                            <Badge variant="outline" className="gap-1 border-cyan-400/20 text-cyan-300"><AcaoIcon tipo={automacao.acaoTipo} />{ACAO_LABEL[automacao.acaoTipo] ?? automacao.acaoTipo}</Badge>
                          </div>
                          {automacao.descricao && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{automacao.descricao}</p>}
                        </div>
                        <Switch checked={automacao.ativa} onCheckedChange={(valor) => alternar(automacao, valor)} disabled={isPending} aria-label={`${automacao.ativa ? "Pausar" : "Ativar"} automação ${automacao.nome}`} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <Badge variant="secondary" className="gap-1"><Clock3 size={12} />{GATILHO_LABEL[automacao.gatilhoTipo] ?? automacao.gatilhoTipo}{automacao.tempoMinutos ? ` · ${automacao.tempoMinutos} min` : ""}</Badge>
                        <span>{automacao._count.execucoes} execução(ões)</span>
                        {automacao.ultimaExecucao && (
                          <span className={automacao.ultimaExecucao.status === "FALHA" ? "text-rose-300" : automacao.ultimaExecucao.status === "SUCESSO" ? "text-emerald-300" : "text-amber-300"} title={automacao.ultimaExecucao.mensagemErro ?? undefined}>
                            Última: {automacao.ultimaExecucao.status.toLocaleLowerCase("pt-BR")} {dataCurta(automacao.ultimaExecucao.executadoEm ?? automacao.ultimaExecucao.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex justify-end gap-1 border-t border-white/[0.05] pt-2">
                        <button type="button" onClick={() => { setDuplicar(automacao); setDestinoPipelineId(pipeline.id); setDestinoEtapaId(""); }} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white" aria-label={`Duplicar ${automacao.nome}`}><Copy size={14} /></button>
                        <button type="button" onClick={() => setEditor({ mode: "edit", automacao })} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white" aria-label={`Editar ${automacao.nome}`}><Pencil size={14} /></button>
                        <button type="button" onClick={() => setExcluir(automacao)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300" aria-label={`Excluir ${automacao.nome}`}><Trash2 size={14} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {editor && (
        <AutomacaoFormDialog
          automacao={editor.mode === "edit" ? editor.automacao : null}
          pipelineInicialId={editor.mode === "create" ? editor.pipelineId : pipelines.find((pipeline) => pipeline.etapas.some((etapa) => etapa.automacoes.some((item) => item.id === editor.automacao.id)))?.id}
          etapaInicialId={editor.mode === "create" ? editor.etapaId : pipelines.flatMap((pipeline) => pipeline.etapas).find((etapa) => etapa.automacoes.some((item) => item.id === editor.automacao.id))?.id}
          pipelines={pipelines}
          templates={templates}
          onClose={() => setEditor(null)}
          onSaved={atualizar}
        />
      )}

      <AlertDialog open={Boolean(excluir)} onOpenChange={(open) => { if (!open && !isPending) setExcluir(null); }}>
        <AlertDialogContent className="border-white/10 bg-slate-950 text-white">
          <AlertDialogHeader><AlertDialogTitle>Excluir automação?</AlertDialogTitle><AlertDialogDescription>Esta ação remove a configuração e seu histórico de execuções. O movimento dos cards não será alterado.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmarExclusao} disabled={isPending} className="bg-rose-600 hover:bg-rose-500">{isPending ? "Excluindo..." : "Excluir"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(duplicar)} onOpenChange={(open) => { if (!open && !isPending) setDuplicar(null); }}>
        <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-md">
          <DialogHeader><DialogTitle>Duplicar automação</DialogTitle><DialogDescription>A cópia será criada inativa para que você revise os parâmetros antes de ativá-la.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <div><span className="mb-1.5 block text-xs font-semibold text-slate-300">Pipeline de destino</span><Select value={destinoPipelineId} onValueChange={(value) => { setDestinoPipelineId(value); setDestinoEtapaId(""); }}><SelectTrigger aria-label="Pipeline de destino"><SelectValue /></SelectTrigger><SelectContent>{pipelines.map((pipeline) => <SelectItem key={pipeline.id} value={pipeline.id}>{pipeline.nome}</SelectItem>)}</SelectContent></Select></div>
            <div><span className="mb-1.5 block text-xs font-semibold text-slate-300">Coluna de destino</span><Select value={etapaDestino} onValueChange={setDestinoEtapaId}><SelectTrigger aria-label="Coluna de destino"><SelectValue /></SelectTrigger><SelectContent>{(pipelineDestino?.etapas ?? []).map((etapa) => <SelectItem key={etapa.id} value={etapa.id}>{etapa.nome}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDuplicar(null)} disabled={isPending}>Cancelar</Button><Button onClick={confirmarDuplicacao} disabled={isPending || !destinoPipelineId || !etapaDestino}>{isPending ? "Duplicando..." : "Duplicar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
