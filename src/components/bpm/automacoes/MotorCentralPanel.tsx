"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, KeyRound, Play, Plus, RefreshCw, Workflow } from "lucide-react";
import { toast } from "sonner";

import { AtivarVersaoAutomacaoCentralBpm, CriarWebhookAutomacaoCentralBpm, ReprocessarExecucaoAutomacaoCentralBpm } from "@/actions/bpm/AutomacoesCentrais";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PipelineAutomacaoView } from "./types";

type Passo = { id: string; nodeId: string; tipo: string; status: string; mensagemErro: string | null };
type Execucao = { id: string; cardId: string; status: string; tentativas: number; mensagemErro: string | null; correlationId: string | null; createdAt: string; iniciadoEm: string | null; executadoEm: string | null; automacao: { nome: string }; automacaoVersao: { versao: number } | null; passos: Passo[] };
type Versao = { id: string; versao: number; status: string; gatilhoTipo: string; createdAt: string; automacao: { id: string; nome: string; pipelineId: string } };
type Endpoint = { id: string; nome: string; caminhoSlug: string; ativo: boolean; _count: { entradas: number } };
export type MonitorCentral = { total: number; execucoes: Execucao[]; versoes: Versao[]; endpoints: Endpoint[] };

function data(valor: string | null) {
  return valor ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(valor)) : "—";
}

export function MotorCentralPanel({ monitor, pipelines, accent }: { monitor: MonitorCentral; pipelines: PipelineAutomacaoView[]; accent: string }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  const automacoes = useMemo(() => {
    const itens = pipelines.flatMap((p) => [
      ...(p.automacoesGlobais ?? []).map((a) => ({ ...a, pipeline: p.nome, etapa: "Global" })),
      ...p.etapas.flatMap((e) => e.automacoes.map((a) => ({ ...a, pipeline: p.nome, etapa: e.nome }))),
    ]);
    return [...new Map(itens.map((item) => [item.id, item])).values()];
  }, [pipelines]);
  const [automacaoId, setAutomacaoId] = useState(automacoes[0]?.id ?? "");
  const [nomeWebhook, setNomeWebhook] = useState(""); const [segredo, setSegredo] = useState<{ caminho: string; valor: string } | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [status, setStatus] = useState("TODOS");
  const execucoes = useMemo(() => status === "TODOS" ? monitor.execucoes : monitor.execucoes.filter((item) => item.status === status), [monitor.execucoes, status]);
  useEffect(() => { const timer = window.setInterval(() => router.refresh(), 15_000); return () => window.clearInterval(timer); }, [router]);

  function ativar(id: string) { startTransition(async () => { const r = await AtivarVersaoAutomacaoCentralBpm(id); if (!r.success) toast.error(r.error); else { toast.success("Versão ativada"); router.refresh(); } }); }
  function reprocessar(id: string) { startTransition(async () => { const r = await ReprocessarExecucaoAutomacaoCentralBpm(id); if (!r.success) toast.error(r.error); else { toast.success("Execução devolvida à fila"); router.refresh(); } }); }
  function criarWebhook() { startTransition(async () => { const pipelineId = automacoes.find((a) => a.id === automacaoId) && pipelines.find((p) => p.etapas.some((e) => e.automacoes.some((a) => a.id === automacaoId)))?.id; const r = await CriarWebhookAutomacaoCentralBpm({ nome: nomeWebhook, automacaoId: automacaoId || undefined, pipelineId }); if (!r.success) toast.error(r.error); else { setSegredo({ caminho: `/api/bpm/webhooks/${r.data.caminhoSlug}`, valor: r.data.segredo }); setNomeWebhook(""); toast.success("Webhook criado; copie o segredo agora"); router.refresh(); } }); }

  return (
    <section className="rounded-2xl border border-cyan-400/15 bg-slate-950/80 p-4 shadow-xl sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Workflow size={18} style={{ color: `rgb(${accent})` }} /><h2 className="font-black text-white">Motor Central</h2><Badge variant="outline" className="border-emerald-400/20 text-emerald-300">Gatilho → condições → ações</Badge></div><p className="mt-1 text-xs text-slate-400">Versões imutáveis, branches IF/THEN/ELSE, esperas, recorrência, webhooks e rastreio de cada passo.</p></div><Button variant="outline" size="sm" onClick={() => router.refresh()}><RefreshCw size={14} /> Atualizar</Button></div>
      <Tabs defaultValue="versoes">
        <TabsList className="grid h-auto w-full grid-cols-3"><TabsTrigger value="versoes"><Workflow size={14} /> Versões</TabsTrigger><TabsTrigger value="execucoes"><Activity size={14} /> Execuções ({monitor.total})</TabsTrigger><TabsTrigger value="webhooks"><KeyRound size={14} /> Webhooks</TabsTrigger></TabsList>
        <TabsContent value="versoes" className="mt-4 space-y-2">{monitor.versoes.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhuma versão central criada.</p>}{monitor.versoes.map((v) => <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3"><div><p className="text-sm font-semibold text-white">{v.automacao.nome} · v{v.versao}</p><p className="text-xs text-slate-500">{v.gatilhoTipo.replaceAll("_", " ")} · {data(v.createdAt)}</p></div><div className="flex items-center gap-2"><Badge className={v.status === "ATIVA" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700 text-slate-300"}>{v.status}</Badge>{v.status === "RASCUNHO" && <Button size="sm" onClick={() => ativar(v.id)} disabled={pending}><Play size={13} /> Ativar</Button>}</div></div>)}</TabsContent>
        <TabsContent value="execucoes" className="mt-4 space-y-2"><div className="flex justify-end"><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent>{["TODOS", "PENDENTE", "EM_EXECUCAO", "AGUARDANDO", "SUCESSO", "FALHA", "IGNORADA"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>{execucoes.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhuma execução central registrada.</p>}{execucoes.map((e) => <div key={e.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><button type="button" onClick={() => setDetalhe(detalhe === e.id ? null : e.id)} className="text-left"><p className="text-sm font-semibold text-white">{e.automacao.nome} · v{e.automacaoVersao?.versao ?? "?"}</p><p className="text-xs text-slate-500">Card {e.cardId} · {data(e.executadoEm ?? e.createdAt)} · tentativa {e.tentativas}{e.iniciadoEm && e.executadoEm ? ` · ${Math.max(0, new Date(e.executadoEm).getTime() - new Date(e.iniciadoEm).getTime())} ms` : ""}</p><p className="mt-0.5 font-mono text-[10px] text-slate-600">correlation: {e.correlationId ?? "—"}</p>{e.mensagemErro && <p className="mt-1 max-w-3xl text-xs text-rose-300">{e.mensagemErro}</p>}</button><div className="flex gap-2"><Badge variant="outline">{e.status}</Badge>{e.status === "FALHA" && <Button size="sm" variant="outline" onClick={() => reprocessar(e.id)} disabled={pending}><RefreshCw size={13} /> Reprocessar</Button>}</div></div>{detalhe === e.id && <div className="mt-3 space-y-1 border-t border-white/10 pt-3">{e.passos.map((p) => <div key={p.id} className="flex items-center justify-between text-xs"><span className="text-slate-300">{p.nodeId} · {p.tipo}</span><span className={p.status === "FALHA" ? "text-rose-300" : "text-emerald-300"}>{p.status}{p.mensagemErro ? ` · ${p.mensagemErro}` : ""}</span></div>)}</div>}</div>)}</TabsContent>
        <TabsContent value="webhooks" className="mt-4 space-y-3"><div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><Input value={nomeWebhook} onChange={(e) => setNomeWebhook(e.target.value)} placeholder="Nome do endpoint" /><Select value={automacaoId} onValueChange={setAutomacaoId}><SelectTrigger><SelectValue placeholder="Automação vinculada" /></SelectTrigger><SelectContent>{automacoes.map((automacao) => <SelectItem key={automacao.id} value={automacao.id}>{automacao.nome}</SelectItem>)}</SelectContent></Select><Button onClick={criarWebhook} disabled={pending || !nomeWebhook.trim()}><Plus size={14} /> Criar</Button></div>{segredo && <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-100"><p className="font-bold">Copie agora; o segredo não será exibido novamente.</p><p className="mt-1 break-all font-mono">{segredo.caminho}</p><p className="break-all font-mono">x-bpm-webhook-secret: {segredo.valor}</p></div>}{monitor.endpoints.map((e) => <div key={e.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 p-3"><div><p className="text-sm font-semibold text-white">{e.nome}</p><p className="text-xs text-slate-500">/api/bpm/webhooks/{e.caminhoSlug} · {e._count.entradas} entrada(s)</p><p className="mt-1 font-mono text-[10px] text-slate-600">endpointId: {e.id}</p></div><Badge variant="outline">{e.ativo ? "ATIVO" : "PAUSADO"}</Badge></div>)}</TabsContent>
      </Tabs>
    </section>
  );
}
