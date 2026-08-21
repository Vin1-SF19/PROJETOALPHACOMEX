"use client";

import { CompleteExportButtons } from "../shared/CompleteExportButtons";
import { PaginationControls } from "../shared/PaginationControls";
import { ExportButtons } from "../shared/ExportButtons";
import { SeoCard, StatePanel } from "../shared/PageHeader";

export interface DomainKeyword {
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  traffic: number | null;
  cpc: number | null;
  url: string | null;
  keywordDifficulty: number | null;
}

export interface DomainPage {
  url: string | null;
  traffic: number | null;
  keywords: number | null;
}

export interface DomainPageState<T> {
  rows: T[];
  page: number;
  totalCount: number | null;
  hasMore: boolean;
  loaded: boolean;
}

interface TableProps<T> {
  projectId: string;
  state: DomainPageState<T>;
  pending: boolean;
  onPage: (page: number) => void;
  loadAll?: () => Promise<Array<Record<string, unknown>>>;
}

const KEYWORD_COLUMNS = [{ key: "keyword", label: "Keyword" }, { key: "position", label: "Posição" }, { key: "searchVolume", label: "Volume" }, { key: "traffic", label: "Tráfego" }, { key: "cpc", label: "CPC" }, { key: "keywordDifficulty", label: "KD" }, { key: "url", label: "URL" }];
const PAGE_COLUMNS = [{ key: "url", label: "URL" }, { key: "keywords", label: "Keywords" }, { key: "traffic", label: "Tráfego" }];

export function DomainKeywordTable({ projectId, state, pending, onPage, loadAll }: TableProps<DomainKeyword>) {
  if (!state.rows.length) return <StatePanel title="Nenhuma keyword carregada" description={state.loaded ? "O provedor não retornou keywords nesta página." : "Selecione a aba para consultar o provedor."} />;
  const rows = state.rows.map((row) => ({ ...row }));
  return <SeoCard className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-4"><b className="text-sm text-white">Página {state.page} · {rows.length} keywords</b>{loadAll ? <CompleteExportButtons projectId={projectId} kind="DOMAIN_KEYWORDS" columns={KEYWORD_COLUMNS} title="Alpha SEO — Domain Keywords" totalCount={state.totalCount} loadRows={loadAll} /> : <ExportButtons projectId={projectId} kind="DOMAIN_KEYWORDS" rows={rows} columns={KEYWORD_COLUMNS} title="Alpha SEO — Domain Keywords" />}</div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Keywords orgânicas do domínio</caption><thead className="border-b border-white/5 text-[10px] uppercase text-slate-500"><tr><th className="p-4">Keyword</th><th className="p-4">Posição</th><th className="p-4">Volume</th><th className="p-4">Tráfego</th><th className="p-4">CPC</th><th className="p-4">KD</th></tr></thead><tbody>{state.rows.map((row) => <tr key={`${row.keyword}-${row.url ?? ""}`} className="border-b border-white/[.04]"><td className="p-4 font-medium text-white">{row.keyword}</td><td className="p-4 tabular-nums text-slate-300">{row.position ?? "—"}</td><td className="p-4 tabular-nums text-slate-300">{row.searchVolume ?? "—"}</td><td className="p-4 tabular-nums text-slate-300">{row.traffic ?? "—"}</td><td className="p-4 tabular-nums text-slate-300">{row.cpc ?? "—"}</td><td className="p-4 tabular-nums text-slate-300">{row.keywordDifficulty ?? "—"}</td></tr>)}</tbody></table></div>{loadAll && <PaginationControls page={state.page} pageSize={100} totalCount={state.totalCount} hasMore={state.hasMore} pending={pending} onPageChange={onPage} />}</SeoCard>;
}

export function DomainPageTable({ projectId, state, pending, onPage, loadAll }: TableProps<DomainPage>) {
  if (!state.rows.length) return <StatePanel title="Nenhuma página carregada" description={state.loaded ? "O provedor não retornou páginas neste intervalo." : "Selecione a aba para consultar o provedor."} />;
  return <SeoCard className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-4"><b className="text-sm text-white">Página {state.page} · {state.rows.length} páginas</b>{loadAll && <CompleteExportButtons projectId={projectId} kind="DOMAIN_PAGES" columns={PAGE_COLUMNS} title="Alpha SEO — Domain Pages" totalCount={state.totalCount} loadRows={loadAll} />}</div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">Páginas orgânicas do domínio</caption><thead className="border-b border-white/5 text-[10px] uppercase text-slate-500"><tr><th className="p-4">URL</th><th className="p-4">Keywords</th><th className="p-4">Tráfego</th></tr></thead><tbody>{state.rows.map((row, index) => <tr key={`${row.url ?? "page"}-${index}`} className="border-b border-white/[.04]"><td className="max-w-2xl truncate p-4 font-mono text-xs text-white">{row.url ?? "—"}</td><td className="p-4 tabular-nums text-slate-300">{row.keywords ?? "—"}</td><td className="p-4 tabular-nums text-slate-300">{row.traffic ?? "—"}</td></tr>)}</tbody></table></div>{loadAll && <PaginationControls page={state.page} pageSize={100} totalCount={state.totalCount} hasMore={state.hasMore} pending={pending} onPageChange={onPage} />}</SeoCard>;
}
