"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarRange, Download, ExternalLink, RefreshCw, SearchCheck, Unplug } from "lucide-react";
import {
  ConsultarOverviewAlphaSeoGsc,
  ConsultarPerformanceAlphaSeoGsc,
  DesconectarAlphaSeoGsc,
  ExportarPerformanceAlphaSeoGsc,
  InspecionarUrlAlphaSeoGsc,
} from "@/actions/AlphaSeoGsc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeoCard, StatePanel } from "../shared/PageHeader";
import { ExportButtons } from "../shared/ExportButtons";

type Dimension = "query" | "page" | "date";

function iso(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function rowsFrom(value: unknown) {
  const data = record(value);
  return Array.isArray(data?.rows) ? data.rows : [];
}

export function GscOverview({ projectId, siteUrl }: { projectId: string; siteUrl: string | null }) {
  const [range, setRange] = useState(28);
  const [dimension, setDimension] = useState<Dimension>("query");
  const [overview, setOverview] = useState<unknown>(null);
  const [performance, setPerformance] = useState<unknown>(null);
  const [inspection, setInspection] = useState<unknown>(null);
  const [inspectUrl, setInspectUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const overviewVersion = useRef(0);
  const performanceVersion = useRef(0);
  const inspectionVersion = useRef(0);
  const query = siteUrl ? { siteUrl, startDate: iso(range), endDate: iso(1), dimensions: [dimension], filters: [], rowLimit: 1000, startRow: 0 } : null;

  function changeRange(days: number) {
    overviewVersion.current += 1;
    performanceVersion.current += 1;
    setRange(days);
    setOverview(null);
    setPerformance(null);
    setError("Período alterado. Atualize os indicadores e consulte novamente a dimensão.");
  }

  function changeDimension(value: string) {
    performanceVersion.current += 1;
    setDimension(value as Dimension);
    setPerformance(null);
    setError("Dimensão alterada. Consulte para carregar resultados compatíveis.");
  }

  function loadOverview() {
    const requestVersion = overviewVersion.current;
    startTransition(async () => {
      const result = await ConsultarOverviewAlphaSeoGsc({ projectId, startDate: iso(range), endDate: iso(1) });
      if (requestVersion !== overviewVersion.current) return;
      if (!result.success) return setError(result.error ?? "Falha ao consultar Search Console");
      setOverview(result.data);
      setError("");
    });
  }

  function loadPerformance() {
    if (!query) return;
    const requestVersion = performanceVersion.current;
    startTransition(async () => {
      const result = await ConsultarPerformanceAlphaSeoGsc({ projectId, query });
      if (requestVersion !== performanceVersion.current) return;
      if (!result.success) return setError(result.error ?? "Falha na dimensão selecionada");
      setPerformance(result.data);
      setError("");
    });
  }

  function exportCsv() {
    if (!query) return;
    startTransition(async () => {
      const result = await ExportarPerformanceAlphaSeoGsc({ projectId, query });
      const data = result.success ? record(result.data) : null;
      if (!result.success || typeof data?.csv !== "string") {
        setError(result.success ? "CSV inválido" : ("error" in result ? result.error ?? "Falha ao exportar CSV" : "Falha ao exportar CSV"));
        return;
      }
      const url = URL.createObjectURL(new Blob([data.csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `gsc-${dimension}-${iso(1)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  function inspect() {
    if (!inspectUrl.trim()) return;
    const requestVersion = inspectionVersion.current;
    startTransition(async () => {
      const result = await InspecionarUrlAlphaSeoGsc({ projectId, url: inspectUrl });
      if (requestVersion !== inspectionVersion.current) return;
      if (!result.success) return setError(result.error ?? "Falha ao inspecionar URL");
      setInspection(result.data);
      setError("");
    });
  }

  function disconnect() {
    startTransition(async () => {
      const result = await DesconectarAlphaSeoGsc(projectId);
      if (!result.success) return setError(result.error ?? "Falha ao desconectar GSC");
      window.location.reload();
    });
  }

  if (!siteUrl) return <ProviderMissing projectId={projectId} />;
  const overviewData = record(overview);
  const totals = record(overviewData?.totals);
  const previous = record(overviewData?.previousTotals);
  const rows = rowsFrom(performance);

  return <div className="space-y-4">
    <SeoCard className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><b className="text-white">Google Search Console</b><p className="mt-1 text-sm text-slate-500">{siteUrl}</p></div><div className="flex flex-wrap gap-2">{[7, 28, 90].map((days) => <button key={days} type="button" onClick={() => changeRange(days)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-bold ${range === days ? "border-[rgb(var(--seo-accent))] text-white" : "border-white/10 text-slate-400"}`}><CalendarRange size={13}/>{days} dias</button>)}<button type="button" onClick={loadOverview} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-xs font-black text-slate-950"><RefreshCw size={13} className={pending ? "animate-spin motion-reduce:animate-none" : ""}/>Atualizar</button><button type="button" onClick={disconnect} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-400/20 px-3 text-xs font-bold text-rose-300"><Unplug size={13}/>Desconectar</button></div></div></SeoCard>
    {error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-300">{error}</p>}
    {totals && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{["clicks", "impressions", "ctr", "position"].map((key) => <SeoCard key={key} className="p-4"><p className="text-[10px] font-bold uppercase text-slate-500">{key}</p><b className="mt-2 block text-2xl tabular-nums text-white">{String(totals[key] ?? "—")}</b><p className="mt-1 text-[10px] text-slate-500">Anterior: {String(previous?.[key] ?? "—")}</p></SeoCard>)}</div>}
    <Tabs value={dimension} onValueChange={changeDimension} className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><TabsList className="bg-slate-900/70"><TabsTrigger value="query">Queries</TabsTrigger><TabsTrigger value="page">Páginas</TabsTrigger><TabsTrigger value="date">Tendência</TabsTrigger></TabsList><div className="flex gap-2"><button type="button" onClick={loadPerformance} disabled={pending} className="min-h-11 rounded-xl border border-white/10 px-3 text-xs font-bold">Consultar dimensão</button><button type="button" onClick={exportCsv} disabled={pending || rows.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><Download size={13}/>CSV</button></div></div>{(["query", "page", "date"] as const).map((tab) => <TabsContent key={tab} value={tab}><ResultTable projectId={projectId} rows={dimension === tab ? rows : []} /></TabsContent>)}</Tabs>
    <SeoCard className="p-5"><h2 className="font-bold text-white">Inspeção de URL</h2><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={inspectUrl} onChange={(event) => { inspectionVersion.current += 1; setInspectUrl(event.target.value); setInspection(null); }} type="url" placeholder="https://exemplo.com/pagina" className="min-h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm outline-none focus:border-[rgb(var(--seo-accent))]"/><button type="button" onClick={inspect} disabled={pending || !inspectUrl.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-bold"><SearchCheck size={14}/>Inspecionar</button></div>{inspection != null && <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-4 text-xs leading-5 text-slate-300">{JSON.stringify(inspection, null, 2)}</pre>}</SeoCard>
  </div>;
}

function ResultTable({ projectId, rows }: { projectId: string; rows: unknown[] }) {
  const parsed = rows.map(record).filter((row): row is Record<string, unknown> => Boolean(row));
  if (!parsed.length) return <StatePanel title="Sem dados para esta dimensão" description="Consulte a dimensão ativa. Um resultado vazio é preservado separadamente de uma falha do provedor." />;
  const keys = Object.keys(parsed[0] ?? {}).slice(0, 8);
  return <SeoCard className="overflow-x-auto"><div className="flex justify-end border-b border-white/5 p-3"><ExportButtons projectId={projectId} kind="SEARCH_PERFORMANCE" rows={parsed} columns={keys.map((key) => ({key,label:key}))} title="Alpha SEO — Search Performance" /></div><table className="w-full min-w-[760px] text-left text-xs"><caption className="sr-only">Dados de performance do Search Console</caption><thead className="border-b border-white/5 uppercase text-slate-500"><tr>{keys.map((key) => <th key={key} className="p-3">{key}</th>)}</tr></thead><tbody>{parsed.map((row, index) => <tr key={index} className="border-b border-white/[.04]">{keys.map((key) => <td key={key} className="max-w-sm truncate p-3 text-slate-300">{Array.isArray(row[key]) ? row[key].join(" · ") : String(row[key] ?? "—")}</td>)}</tr>)}</tbody></table></SeoCard>;
}

function ProviderMissing({ projectId }: { projectId: string }) {
  async function connect() { const response = await fetch("/api/alpha-seo/oauth/gsc/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId }) }); const body = await response.json() as unknown; const root = record(body); const data = record(root?.data); if (response.ok && typeof data?.url === "string") window.location.assign(data.url); }
  return <SeoCard className="p-8 text-center"><ExternalLink className="mx-auto text-[rgb(var(--seo-accent))]"/><h2 className="mt-4 font-bold text-white">Search Console não conectado</h2><p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">Conecte uma conta Google e selecione uma propriedade verificada para consultar performance.</p><div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" onClick={connect} className="inline-flex min-h-11 items-center rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-xs font-black text-slate-950">Conectar Google</button><Link href={`/PainelAlpha/AlphaSEO/${projectId}/settings/integrations`} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-xs font-bold">Abrir Integrações</Link></div></SeoCard>;
}
