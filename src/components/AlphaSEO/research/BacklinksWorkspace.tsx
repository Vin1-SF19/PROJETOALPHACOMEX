"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Link2, Search } from "lucide-react";
import {
  ListarBacklinksAlphaSeo,
  ListarDominiosReferentesAlphaSeo,
  ListarTopPaginasBacklinksAlphaSeo,
  ObterOverviewBacklinksAlphaSeo,
} from "@/actions/AlphaSeoBacklinks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompleteExportButtons } from "../shared/CompleteExportButtons";
import { PaginationControls } from "../shared/PaginationControls";
import { SeoCard, StatePanel } from "../shared/PageHeader";

type Scope = "domain" | "subdomains" | "subfolder" | "exact_url";
type Tab = "backlinks" | "domains" | "pages";
type Mode = "one_per_domain" | "as_is";
interface PageState {
  rows: Array<Record<string, unknown>>;
  page: number;
  totalCount: number | null;
  hasMore: boolean;
  loaded: boolean;
}
const EMPTY_PAGE: PageState = { rows: [], page: 1, totalCount: null, hasMore: false, loaded: false };
const PAGE_SIZE = 100;
const EXPORT_PAGE_SIZE = 200;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function records(value: unknown) {
  return (Array.isArray(value) ? value : []).filter((row): row is Record<string, unknown> => Boolean(record(row)));
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function labelFor(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function BacklinksWorkspace({ projectId, defaultTarget }: { projectId: string; defaultTarget: string }) {
  const [target, setTarget] = useState(defaultTarget);
  const [scope, setScope] = useState<Scope>("domain");
  const [mode, setMode] = useState<Mode>("one_per_domain");
  const [activeTab, setActiveTab] = useState<Tab>("backlinks");
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [rows, setRows] = useState<Record<Tab, PageState>>({ backlinks: EMPTY_PAGE, domains: EMPTY_PAGE, pages: EMPTY_PAGE });
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const version = useRef(0);

  function invalidate() {
    version.current += 1;
    setOverview(null);
    setRows({ backlinks: EMPTY_PAGE, domains: EMPTY_PAGE, pages: EMPTY_PAGE });
    setMessage("Parâmetros alterados. Os resultados anteriores foram limpos.");
  }

  function payload(tab: Tab, page: number, limit = PAGE_SIZE) {
    return {
      projectId,
      target: target.trim(),
      scope,
      page,
      limit,
      sortField: tab === "domains" ? "domain_from_rank" : tab === "pages" ? "backlinks" : "rank",
      sortOrder: "desc",
      filters: { hideLost: false, hideBroken: false },
      mode,
      hideSpam: true,
      spamThreshold: 40,
    };
  }

  async function requestTab(tab: Tab, page: number, limit = PAGE_SIZE) {
    const data = payload(tab, page, limit);
    return tab === "backlinks"
      ? ListarBacklinksAlphaSeo(data)
      : tab === "domains"
        ? ListarDominiosReferentesAlphaSeo(data)
        : ListarTopPaginasBacklinksAlphaSeo(data);
  }

  function loadOverview() {
    const requestVersion = version.current;
    startTransition(async () => {
      const result = await ObterOverviewBacklinksAlphaSeo({ projectId, target, scope });
      if (requestVersion !== version.current) return;
      if (!result.success) return setMessage(result.error);
      setOverview(record(result.data));
      setMessage("Perfil e histórico anual atualizados.");
    });
  }

  function loadTab(tab: Tab, page = 1) {
    const requestVersion = version.current;
    startTransition(async () => {
      const result = await requestTab(tab, page);
      if (requestVersion !== version.current) return;
      if (!result.success) return setMessage(result.error);
      const data = record(result.data);
      setRows((current) => ({ ...current, [tab]: { rows: records(data?.rows), page, totalCount: numberOrNull(data?.totalCount), hasMore: data?.hasMore === true, loaded: true } }));
      setMessage(`${labelFor(tab)} · página ${page} carregada.`);
    });
  }

  async function loadAll(tab: Tab) {
    const all: Array<Record<string, unknown>> = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && all.length < 10_000) {
      const result = await requestTab(tab, page, EXPORT_PAGE_SIZE);
      if (!result.success) throw new Error(result.error);
      const data = record(result.data);
      all.push(...records(data?.rows));
      hasMore = data?.hasMore === true;
      page += 1;
    }
    if (hasMore) throw new Error("O conjunto excede o limite seguro de 10.000 linhas por exportação.");
    return all;
  }

  function activate(tab: Tab) {
    setActiveTab(tab);
    if (!rows[tab].loaded) loadTab(tab);
  }

  const summary = record(overview?.summary);
  const trends = records(overview?.trends);
  const newLost = records(overview?.newLostTrends);

  return <div className="space-y-4">
    <SeoCard className="p-5"><div className="grid gap-3 lg:grid-cols-[1fr_190px_auto]">
      <label className="text-xs font-semibold text-slate-300">Domínio ou URL<input value={target} onChange={(event) => { setTarget(event.target.value); invalidate(); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-[rgb(var(--seo-accent))]" /></label>
      <label className="text-xs font-semibold text-slate-300">Escopo<select value={scope} onChange={(event) => { setScope(event.target.value as Scope); invalidate(); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"><option value="domain">Domínio</option><option value="subdomains">Com subdomínios</option><option value="subfolder">Subpasta</option><option value="exact_url">URL exata</option></select></label>
      <button type="button" onClick={loadOverview} disabled={pending || !target.trim()} className="inline-flex min-h-11 self-end items-center justify-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-5 text-sm font-black text-slate-950 disabled:opacity-40"><Search size={15} aria-hidden="true" /> Analisar</button>
    </div>{message && <p role="status" className="mt-3 text-xs text-slate-400">{message}</p>}</SeoCard>
    {summary && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Backlinks" value={summary.backlinks} /><Metric label="Domínios referentes" value={summary.referringDomains} /><Metric label="Rank" value={summary.rank} /><Metric label="Spam score" value={summary.backlinksSpamScore} /></div><div className="grid gap-4 xl:grid-cols-2"><TrendTable title="Crescimento anual" rows={trends} /><TrendTable title="Novos e perdidos" rows={newLost} /></div></>}
    <Tabs value={activeTab} onValueChange={(value) => activate(value as Tab)} className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><TabsList className="bg-slate-900/70"><TabsTrigger value="backlinks">Backlinks</TabsTrigger><TabsTrigger value="domains">Domínios referentes</TabsTrigger><TabsTrigger value="pages">Top páginas</TabsTrigger></TabsList><label className="flex items-center gap-2 text-xs text-slate-400">Exibição<select value={mode} onChange={(event) => { setMode(event.target.value as Mode); invalidate(); }} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-white"><option value="one_per_domain">Um por domínio</option><option value="as_is">Todos os links</option></select></label></div>
      {(["backlinks", "domains", "pages"] as const).map((tab) => <TabsContent key={tab} value={tab}><GenericBacklinkTable projectId={projectId} title={labelFor(tab)} state={rows[tab]} pending={pending} onPage={(page) => loadTab(tab, page)} loadAll={() => loadAll(tab)} /></TabsContent>)}
    </Tabs>
  </div>;
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return <SeoCard className="p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><b className="mt-2 block text-2xl tabular-nums text-white">{typeof value === "number" ? value.toLocaleString("pt-BR") : String(value ?? "—")}</b></SeoCard>;
}

function TrendTable({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <StatePanel title={title} description="O provedor não retornou histórico para este escopo." />;
  const visible = rows.slice(-12);
  const keys = Object.keys(visible[0] ?? {}).filter((key) => key !== "date").slice(0, 4);
  return <SeoCard className="overflow-hidden"><div className="border-b border-white/5 px-4 py-3 text-sm font-bold text-white">{title}</div><div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-3">Data</th>{keys.map((key) => <th key={key} className="p-3">{labelFor(key)}</th>)}</tr></thead><tbody>{visible.map((row, index) => <tr key={`${String(row.date)}-${index}`} className="border-t border-white/[.04]"><td className="p-3 text-slate-400">{String(row.date ?? "—")}</td>{keys.map((key) => <td key={key} className="p-3 tabular-nums text-slate-300">{String(row[key] ?? "—")}</td>)}</tr>)}</tbody></table></div></SeoCard>;
}

function GenericBacklinkTable({ projectId, title, state, pending, onPage, loadAll }: { projectId: string; title: string; state: PageState; pending: boolean; onPage: (page: number) => void; loadAll: () => Promise<Array<Record<string, unknown>>> }) {
  const keys = useMemo(() => { const preferred = ["domain_from", "url_from", "url_to", "anchor", "rank", "backlinks", "referring_domains", "first_seen", "last_seen"]; const available = new Set(state.rows.flatMap((row) => Object.keys(row))); return [...preferred.filter((key) => available.has(key)), ...[...available].filter((key) => !preferred.includes(key))].slice(0, 8); }, [state.rows]);
  if (!state.rows.length) return <StatePanel title={`${title} sob demanda`} description={state.loaded ? "O provedor não retornou registros nesta página." : "Selecione a aba para consultar o provedor."} />;
  const columns = keys.map((key) => ({ key, label: labelFor(key) }));
  return <SeoCard className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-4"><div className="flex items-center gap-2"><Link2 size={15} className="text-[rgb(var(--seo-accent))]" aria-hidden="true" /><b className="text-sm text-white">Página {state.page} · {state.rows.length} {title.toLowerCase()}</b></div><CompleteExportButtons projectId={projectId} kind="BACKLINKS" columns={columns} title={`Alpha SEO — ${title}`} totalCount={state.totalCount} loadRows={loadAll} /></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><caption className="sr-only">{title}</caption><thead className="border-b border-white/5 uppercase text-slate-500"><tr>{columns.map((column) => <th key={column.key} className="p-3">{column.label}</th>)}</tr></thead><tbody>{state.rows.map((row, index) => <tr key={String(row.id ?? row.url_from ?? row.domain ?? index)} className="border-b border-white/[.04]">{columns.map((column) => <td key={column.key} title={String(row[column.key] ?? "")} className="max-w-xs truncate p-3 text-slate-300">{typeof row[column.key] === "object" ? JSON.stringify(row[column.key]) : String(row[column.key] ?? "—")}</td>)}</tr>)}</tbody></table></div><PaginationControls page={state.page} pageSize={PAGE_SIZE} totalCount={state.totalCount} hasMore={state.hasMore} pending={pending} onPageChange={onPage} /></SeoCard>;
}
