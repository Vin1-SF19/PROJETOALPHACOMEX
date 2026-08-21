"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import {
  AdicionarKeywordsRankAlphaSeo,
  AprovarCustoMetricasKeywordsRankAlphaSeo,
  AprovarCustoRankAlphaSeo,
  AtualizarMetricasKeywordsRankAlphaSeo,
  AtualizarRankTrackerAlphaSeo,
  CriarRankTrackerAlphaSeo,
  EstimarCustoRankAlphaSeo,
  EstimarCustoMetricasKeywordsRankAlphaSeo,
  ExecutarRankTrackerAlphaSeo,
  ObterHistoricoKeywordRankAlphaSeo,
  ObterResultadosRankAlphaSeo,
  ObterTendenciaRankAlphaSeo,
  RemoverKeywordsRankAlphaSeo,
  SugerirKeywordsRankAlphaSeo,
} from "@/actions/AlphaSeoRankTracking";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeoCard } from "../shared/PageHeader";
import { SerpLocationPicker } from "./SerpLocationPicker";

interface RankConfigInput {
  domain: string;
  devices: string;
  serpDepth: number;
  scheduleInterval: string;
  locationCode: number;
  languageCode: string;
  isActive: boolean;
}

interface RankKeywordInput { id: string; keyword: string }
interface Estimate { requestHash: string; estimatedUnits: number; estimatedMicrosUsd: number }
interface ProviderEstimate { requestHash: string; units: number; estimatedMicrosUsd: number; approvalRequired: boolean }

export function CreateRankTracker({ projectId, defaultDomain = "" }: { projectId: string; defaultDomain?: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  function create(data: FormData) {
    start(async () => {
      const result = await CriarRankTrackerAlphaSeo({ projectId, domain: data.get("domain"), devices: data.get("devices"), serpDepth: Number(data.get("serpDepth")), scheduleInterval: data.get("scheduleInterval"), locationCode: Number(data.get("locationCode")), languageCode: "pt" });
      setMessage(result.success ? "Tracker criado." : result.error);
      if (result.success) { setOpen(false); router.refresh(); }
    });
  }
  return <div className="mb-4">{!open ? <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-sm font-black text-slate-950"><Plus size={15}/>Novo tracker</button> : <SeoCard className="p-4"><form action={create} className="grid gap-3 md:grid-cols-4"><input name="domain" defaultValue={defaultDomain} required placeholder="dominio.com" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"/><select name="devices" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"><option value="BOTH">Desktop + Mobile</option><option value="DESKTOP">Desktop</option><option value="MOBILE">Mobile</option></select><select name="serpDepth" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"><option value="40">Top 40</option><option value="100">Top 100</option></select><select name="scheduleInterval" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"><option value="WEEKLY">Semanal</option><option value="DAILY">Diário</option><option value="MONTHLY">Mensal</option><option value="MANUAL">Manual</option></select><SerpLocationPicker projectId={projectId} initialCode={2076}/><button disabled={pending} className="min-h-11 rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-xs font-black text-slate-950">Criar</button><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-bold">Cancelar</button></form>{message && <p className="mt-2 text-xs text-slate-400">{message}</p>}</SeoCard>}</div>;
}

export function RankDetailControls({ projectId, configId, config, keywordRows }: { projectId: string; configId: string; config: RankConfigInput; keywordRows: RankKeywordInput[] }) {
  const [keywords, setKeywords] = useState("");
  const [selectedKeywordId, setSelectedKeywordId] = useState(keywordRows[0]?.id ?? "");
  const [seed, setSeed] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [metricsEstimate, setMetricsEstimate] = useState<ProviderEstimate | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function add() {
    const list = keywords.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
    start(async () => {
      const response = await AdicionarKeywordsRankAlphaSeo({ projectId, configId, keywords: list });
      setMessage(response.success ? "Keywords adicionadas." : response.error);
      if (response.success) { setKeywords(""); router.refresh(); }
    });
  }

  function remove() {
    if (!selectedKeywordId) return;
    start(async () => {
      const response = await RemoverKeywordsRankAlphaSeo({ projectId, configId, keywordIds: [selectedKeywordId] });
      setMessage(response.success ? "Keyword removida; o histórico foi preservado." : response.error);
      if (response.success) router.refresh();
    });
  }

  function estimateRun() {
    start(async () => {
      const response = await EstimarCustoRankAlphaSeo({ projectId, configId });
      if (response.success) setEstimate(response.data);
      else setMessage(response.error);
    });
  }

  function run() {
    if (!estimate) return;
    start(async () => {
      const approval = await AprovarCustoRankAlphaSeo({ projectId, configId, requestHash: estimate.requestHash });
      if (!approval.success) return setMessage(approval.error);
      const response = await ExecutarRankTrackerAlphaSeo({ projectId, configId, approvalRequestHash: estimate.requestHash });
      setMessage(response.success ? "Execução enviada para a fila." : response.error);
      setEstimate(null);
      router.refresh();
    });
  }

  function updateConfig(data: FormData) {
    start(async () => {
      const response = await AtualizarRankTrackerAlphaSeo({ projectId, configId, domain: data.get("domain"), devices: data.get("devices"), serpDepth: Number(data.get("serpDepth")), scheduleInterval: data.get("scheduleInterval"), locationCode: Number(data.get("locationCode")), languageCode: config.languageCode, isActive: data.get("isActive") === "on" });
      setMessage(response.success ? "Configuração atualizada." : response.error);
      if (response.success) router.refresh();
    });
  }

  function loadView(kind: "results" | "history" | "trend" | "suggest") {
    start(async () => {
      const response = kind === "results" ? await ObterResultadosRankAlphaSeo({ projectId, configId, comparePeriod: "30d" })
        : kind === "history" ? await ObterHistoricoKeywordRankAlphaSeo({ projectId, configId, trackingKeywordId: selectedKeywordId, sinceDays: 365, limit: 500 })
          : kind === "trend" ? await ObterTendenciaRankAlphaSeo({ projectId, configId, device: config.devices === "MOBILE" ? "MOBILE" : "DESKTOP", sinceDays: 365, runLimit: 52 })
            : await SugerirKeywordsRankAlphaSeo({ projectId, configId, seed, limit: 50 });
      if (!response.success) return setMessage(response.error);
      setResult(response.data);
      setMessage("Consulta concluída.");
    });
  }

  function estimateMetrics() {
    start(async () => {
      const response = await EstimarCustoMetricasKeywordsRankAlphaSeo({ projectId, configId });
      if (!response.success) return setMessage(response.error);
      setMetricsEstimate(response.data as ProviderEstimate);
      setMessage("Estimativa de métricas calculada no servidor.");
    });
  }

  function runMetrics() {
    if (!metricsEstimate) return;
    start(async () => {
      if (metricsEstimate.approvalRequired) {
        const approval = await AprovarCustoMetricasKeywordsRankAlphaSeo({ projectId, configId, requestHash: metricsEstimate.requestHash });
        if (!approval.success) return setMessage(approval.error);
      }
      const response = await AtualizarMetricasKeywordsRankAlphaSeo({ projectId, configId });
      if (!response.success) return setMessage(response.error);
      setMetricsEstimate(null);
      setResult(response.data);
      setMessage("Métricas atualizadas.");
      router.refresh();
    });
  }

  return <div className="mb-5 space-y-4"><SeoCard className="p-4"><div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]"><textarea value={keywords} onChange={(event) => setKeywords(event.target.value)} rows={2} placeholder="Adicionar keywords, uma por linha" className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm"/><button type="button" onClick={add} disabled={!keywords.trim() || pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-bold"><Plus size={14}/>Adicionar</button><button type="button" onClick={estimateRun} disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-xs font-black text-slate-950"><RefreshCw size={14}/>Estimar run</button></div>{estimate && <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100"><span>{estimate.estimatedUnits} unidades · até US$ {(estimate.estimatedMicrosUsd / 1_000_000).toFixed(4)}</span><button type="button" onClick={run} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-300 px-3 font-black text-amber-950"><Play size={12}/>Aprovar e executar</button></div>}</SeoCard>
    <Tabs defaultValue="operations" className="space-y-4"><TabsList className="bg-slate-900/70"><TabsTrigger value="operations">Operações</TabsTrigger><TabsTrigger value="settings">Configuração</TabsTrigger></TabsList><TabsContent value="operations"><SeoCard className="p-4"><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><select value={selectedKeywordId} onChange={(event) => setSelectedKeywordId(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"><option value="">Selecione uma keyword</option>{keywordRows.map((row) => <option key={row.id} value={row.id}>{row.keyword}</option>)}</select><button type="button" onClick={remove} disabled={pending || !selectedKeywordId} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-400/20 px-3 text-xs font-bold text-rose-300"><Trash2 size={13}/>Remover</button></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><Action label="Resultados 30d" onClick={() => loadView("results")} icon={Search}/><Action label="Histórico keyword" onClick={() => loadView("history")} icon={Search}/><Action label="Tendência" onClick={() => loadView("trend")} icon={RefreshCw}/><Action label="Estimar métricas" onClick={estimateMetrics} icon={RefreshCw}/><div className="flex gap-2"><input value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Seed" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"/><button type="button" onClick={() => loadView("suggest")} disabled={!seed.trim()} aria-label="Sugerir keywords" className="grid size-11 place-items-center rounded-xl border border-white/10"><Search size={13}/></button></div></div>{metricsEstimate && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100"><span>{metricsEstimate.units} keywords · até US$ {(metricsEstimate.estimatedMicrosUsd / 1_000_000).toFixed(4)}{metricsEstimate.approvalRequired ? " · aprovação obrigatória" : ""}</span><button type="button" onClick={runMetrics} disabled={pending} className="min-h-11 rounded-lg bg-amber-300 px-3 font-black text-amber-950">{metricsEstimate.approvalRequired ? "Aprovar e atualizar" : "Atualizar métricas"}</button></div>}</SeoCard></TabsContent><TabsContent value="settings"><SeoCard className="p-4"><form action={updateConfig} className="grid gap-3 md:grid-cols-3"><input name="domain" defaultValue={config.domain} required className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"/><select name="devices" defaultValue={config.devices} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"><option value="BOTH">Desktop + Mobile</option><option value="DESKTOP">Desktop</option><option value="MOBILE">Mobile</option></select><input name="serpDepth" type="number" min={10} max={100} step={10} defaultValue={config.serpDepth} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"/><select name="scheduleInterval" defaultValue={config.scheduleInterval} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"><option value="MANUAL">Manual</option><option value="DAILY">Diário</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensal</option></select><SerpLocationPicker projectId={projectId} initialCode={config.locationCode}/><label className="flex min-h-11 items-center gap-2 text-xs text-slate-300"><input name="isActive" type="checkbox" defaultChecked={config.isActive}/>Tracker ativo</label><button disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-xs font-black text-slate-950"><Save size={13}/>Salvar configuração</button></form></SeoCard></TabsContent></Tabs>
    {message && <p role="status" className="text-xs text-slate-400">{message}</p>}{result != null && <SeoCard className="overflow-hidden"><div className="border-b border-white/5 px-4 py-3 text-sm font-bold text-white">Resultado operacional</div><pre className="max-h-96 overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-slate-300">{JSON.stringify(result, null, 2)}</pre></SeoCard>}</div>;
}

function Action({ label, onClick, icon: Icon }: { label: string; onClick: () => void; icon: typeof Search }) {
  return <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><Icon size={13}/>{label}</button>;
}
