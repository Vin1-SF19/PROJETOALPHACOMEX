"use client";

import { useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import {
  ListarPaginasDominioAlphaSeo,
  ListarPalavrasChaveDominioAlphaSeo,
  ObterOverviewDominioAlphaSeo,
  SugerirPalavrasChaveDominioAlphaSeo,
} from "@/actions/AlphaSeoDomain";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeoCard, StatePanel } from "../shared/PageHeader";
import {
  DomainKeywordTable,
  DomainPageTable,
  type DomainKeyword,
  type DomainPage,
  type DomainPageState,
} from "./DomainResearchTables";

type Scope = "domain" | "subdomains" | "subfolder" | "exact_url";
type Tab = "keywords" | "pages" | "suggestions";
const PAGE_SIZE = 100;
const EXPORT_PAGE_SIZE = 200;
const EMPTY_PAGE = { rows: [], page: 1, totalCount: null, hasMore: false, loaded: false };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseKeyword(value: unknown): DomainKeyword | null {
  const row = record(value);
  if (!row || typeof row.keyword !== "string") return null;
  return {
    keyword: row.keyword,
    position: numberOrNull(row.position),
    searchVolume: numberOrNull(row.searchVolume),
    traffic: numberOrNull(row.traffic),
    cpc: numberOrNull(row.cpc),
    url: typeof row.url === "string" ? row.url : null,
    keywordDifficulty: numberOrNull(row.keywordDifficulty),
  };
}

function parsePage(value: unknown): DomainPage | null {
  const row = record(value);
  if (!row) return null;
  return {
    url: typeof row.url === "string" ? row.url : null,
    traffic: numberOrNull(row.traffic),
    keywords: numberOrNull(row.keywords),
  };
}

export function DomainResearchWorkspace({ projectId, defaultDomain }: { projectId: string; defaultDomain: string }) {
  const [target, setTarget] = useState(defaultDomain);
  const [scope, setScope] = useState<Scope>("domain");
  const [activeTab, setActiveTab] = useState<Tab>("keywords");
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [keywords, setKeywords] = useState<DomainPageState<DomainKeyword>>(EMPTY_PAGE);
  const [pages, setPages] = useState<DomainPageState<DomainPage>>(EMPTY_PAGE);
  const [suggestions, setSuggestions] = useState<DomainKeyword[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const version = useRef(0);

  function invalidate() {
    version.current += 1;
    setOverview(null);
    setKeywords(EMPTY_PAGE);
    setPages(EMPTY_PAGE);
    setSuggestions([]);
    setMessage("Parâmetros alterados. Execute uma nova consulta para atualizar os resultados.");
  }

  function input(page = 1, limit = PAGE_SIZE) {
    return { projectId, domain: target.trim(), scope, page, limit, sortField: "traffic", sortOrder: "desc", filters: {} };
  }

  function runOverview() {
    const requestVersion = version.current;
    startTransition(async () => {
      const result = await ObterOverviewDominioAlphaSeo({ projectId, domain: target, scope });
      if (requestVersion !== version.current) return;
      if (!result.success) return setMessage(result.error);
      setOverview(record(result.data));
      setMessage("Visão geral atualizada.");
    });
  }

  function loadKeywords(page = 1) {
    const requestVersion = version.current;
    startTransition(async () => {
      const result = await ListarPalavrasChaveDominioAlphaSeo(input(page));
      if (requestVersion !== version.current) return;
      if (!result.success) return setMessage(result.error);
      const data = record(result.data);
      const rows = (Array.isArray(data?.keywords) ? data.keywords : []).map(parseKeyword).filter((row): row is DomainKeyword => Boolean(row));
      setKeywords({ rows, page, totalCount: numberOrNull(data?.totalCount), hasMore: data?.hasMore === true, loaded: true });
      setMessage(`Página ${page} de keywords carregada.`);
    });
  }

  function loadPages(page = 1) {
    const requestVersion = version.current;
    startTransition(async () => {
      const result = await ListarPaginasDominioAlphaSeo(input(page));
      if (requestVersion !== version.current) return;
      if (!result.success) return setMessage(result.error);
      const data = record(result.data);
      const rows = (Array.isArray(data?.pages) ? data.pages : []).map(parsePage).filter((row): row is DomainPage => Boolean(row));
      setPages({ rows, page, totalCount: numberOrNull(data?.totalCount), hasMore: data?.hasMore === true, loaded: true });
      setMessage(`Página ${page} de páginas carregada.`);
    });
  }

  function loadSuggestions() {
    const requestVersion = version.current;
    startTransition(async () => {
      const result = await SugerirPalavrasChaveDominioAlphaSeo({ projectId, domain: target, scope });
      if (requestVersion !== version.current) return;
      if (!result.success) return setMessage(result.error);
      setSuggestions((Array.isArray(result.data) ? result.data : []).map(parseKeyword).filter((row): row is DomainKeyword => Boolean(row)));
      setMessage("Sugestões prontas para o rank tracker.");
    });
  }

  async function loadAll(kind: "keywords" | "pages") {
    const all: Array<DomainKeyword | DomainPage> = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && all.length < 10_000) {
      const result = kind === "keywords"
        ? await ListarPalavrasChaveDominioAlphaSeo(input(page, EXPORT_PAGE_SIZE))
        : await ListarPaginasDominioAlphaSeo(input(page, EXPORT_PAGE_SIZE));
      if (!result.success) throw new Error(result.error);
      const data = record(result.data);
      const rawRows = kind === "keywords" ? data?.keywords : data?.pages;
      const parsed = kind === "keywords"
        ? (Array.isArray(rawRows) ? rawRows : []).map(parseKeyword).filter((row): row is DomainKeyword => Boolean(row))
        : (Array.isArray(rawRows) ? rawRows : []).map(parsePage).filter((row): row is DomainPage => Boolean(row));
      all.push(...parsed);
      hasMore = data?.hasMore === true;
      page += 1;
    }
    if (hasMore) throw new Error("O conjunto excede o limite seguro de 10.000 linhas por exportação.");
    return all.map((row) => ({ ...row }));
  }

  function activate(tab: Tab) {
    setActiveTab(tab);
    if (tab === "keywords" && !keywords.loaded) loadKeywords();
    if (tab === "pages" && !pages.loaded) loadPages();
    if (tab === "suggestions" && !suggestions.length) loadSuggestions();
  }

  return <div className="space-y-4">
    <SeoCard className="p-5"><div className="grid gap-3 lg:grid-cols-[1fr_190px_auto]">
      <label className="text-xs font-semibold text-slate-300">Domínio ou URL<input value={target} onChange={(event) => { setTarget(event.target.value); invalidate(); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-[rgb(var(--seo-accent))]" /></label>
      <label className="text-xs font-semibold text-slate-300">Escopo<select value={scope} onChange={(event) => { setScope(event.target.value as Scope); invalidate(); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm"><option value="domain">Domínio</option><option value="subdomains">Com subdomínios</option><option value="subfolder">Subpasta</option><option value="exact_url">URL exata</option></select></label>
      <button type="button" onClick={runOverview} disabled={pending || !target.trim()} className="inline-flex min-h-11 self-end items-center justify-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-5 text-sm font-black text-slate-950 disabled:opacity-40"><Search size={15} aria-hidden="true" /> Analisar</button>
    </div>{message && <p role="status" className="mt-3 text-xs text-slate-400">{message}</p>}</SeoCard>
    {overview && <div className="grid gap-4 sm:grid-cols-3"><Metric label="Tráfego orgânico" value={overview.organicTraffic} /><Metric label="Keywords orgânicas" value={overview.organicKeywords} /><Metric label="Cache" value={overview.cached === true ? "Reutilizado" : "Atualizado"} /></div>}
    <Tabs value={activeTab} onValueChange={(value) => activate(value as Tab)} className="space-y-4"><TabsList className="bg-slate-900/70"><TabsTrigger value="keywords">Top keywords</TabsTrigger><TabsTrigger value="pages">Top páginas</TabsTrigger><TabsTrigger value="suggestions">Sugestões</TabsTrigger></TabsList>
      <TabsContent value="keywords"><DomainKeywordTable projectId={projectId} state={keywords} pending={pending} onPage={loadKeywords} loadAll={() => loadAll("keywords")} /></TabsContent>
      <TabsContent value="pages"><DomainPageTable projectId={projectId} state={pages} pending={pending} onPage={loadPages} loadAll={() => loadAll("pages")} /></TabsContent>
      <TabsContent value="suggestions">{suggestions.length ? <DomainKeywordTable projectId={projectId} state={{ rows: suggestions, page: 1, totalCount: suggestions.length, hasMore: false, loaded: true }} pending={pending} onPage={() => undefined} /> : <StatePanel title="Sugestões sob demanda" description="Carregue sugestões para reaproveitar as melhores oportunidades no rank tracker." />}</TabsContent>
    </Tabs>
  </div>;
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return <SeoCard className="p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><b className="mt-2 block text-2xl tabular-nums text-white">{typeof value === "number" ? value.toLocaleString("pt-BR") : String(value ?? "—")}</b></SeoCard>;
}
