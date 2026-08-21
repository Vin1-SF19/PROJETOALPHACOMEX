"use client";

import { useMemo, useState, useTransition } from "react";
import { BookmarkPlus, Search } from "lucide-react";
import { ObterAnaliseSerpAlphaSeo } from "@/actions/AlphaSeoKeywords";
import { SalvarPalavrasChaveAlphaSeo } from "@/actions/AlphaSeoSavedKeywords";
import { ExportButtons } from "../shared/ExportButtons";
import { SeoCard, StatePanel } from "../shared/PageHeader";

interface KeywordRow {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  keywordDifficulty: number | null;
  intent: string | null;
  monthlySearches: unknown[];
  source: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseRows(value: unknown): KeywordRow[] {
  const root = record(value);
  if (!root || !Array.isArray(root.rows)) return [];
  return root.rows.flatMap((entry) => {
    const row = record(entry);
    if (!row || typeof row.keyword !== "string") return [];
    const nullableNumber = (item: unknown) => typeof item === "number" ? item : null;
    return [{ keyword: row.keyword, searchVolume: nullableNumber(row.searchVolume), cpc: nullableNumber(row.cpc), competition: nullableNumber(row.competition), keywordDifficulty: nullableNumber(row.keywordDifficulty), intent: typeof row.intent === "string" ? row.intent : null, monthlySearches: Array.isArray(row.monthlySearches) ? row.monthlySearches : [], source: typeof row.source === "string" ? row.source : "provider" }];
  });
}

export function KeywordResearchResults({ projectId, data }: { projectId: string; data: unknown }) {
  const rows = useMemo(() => parseRows(data), [data]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [serp, setSerp] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  if (!rows.length) return <StatePanel title="Pesquisa concluída sem oportunidades" description="O provedor respondeu, mas nenhum termo aderente foi encontrado para as seeds e mercado selecionados." />;
  const chosen = rows.filter((row) => selected.includes(row.keyword));
  const exportRows = rows.map((row) => ({ keyword: row.keyword, searchVolume: row.searchVolume, cpc: row.cpc, competition: row.competition, keywordDifficulty: row.keywordDifficulty, intent: row.intent, source: row.source }));

  function save() {
    if (!chosen.length) return;
    startTransition(async () => {
      const result = await SalvarPalavrasChaveAlphaSeo({ projectId, keywords: chosen.map((row) => row.keyword), tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), tagMode: "append", metrics: chosen });
      setMessage(result.success ? `${chosen.length} keyword(s) salvas.` : result.error);
    });
  }

  function analyze(keyword: string) {
    startTransition(async () => {
      setMessage(`Consultando SERP de “${keyword}”…`);
      const result = await ObterAnaliseSerpAlphaSeo({ projectId, keyword });
      if (!result.success) return setMessage(result.error);
      setSerp(result.data);
      setMessage("Análise SERP carregada.");
    });
  }

  return <div className="space-y-4">
    <SeoCard className="flex flex-wrap items-center gap-3 p-4">
      <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags separadas por vírgula" className="min-h-11 min-w-56 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs outline-none focus:border-[rgb(var(--seo-accent))]" />
      <button type="button" onClick={save} disabled={pending || !chosen.length} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-xs font-black text-slate-950 disabled:opacity-40"><BookmarkPlus size={14} />Salvar {chosen.length || "seleção"}</button>
      <ExportButtons projectId={projectId} kind="KEYWORD_RESEARCH" rows={exportRows} columns={[{key:"keyword",label:"Keyword"},{key:"searchVolume",label:"Volume"},{key:"cpc",label:"CPC"},{key:"competition",label:"Concorrência"},{key:"keywordDifficulty",label:"Dificuldade"},{key:"intent",label:"Intenção"},{key:"source",label:"Fonte"}]} title="Alpha SEO — Keyword Research" />
      {message && <p role="status" className="w-full text-xs text-slate-400">{message}</p>}
    </SeoCard>
    <SeoCard className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><caption className="sr-only">Resultados da pesquisa de palavras-chave</caption><thead className="border-b border-white/5 uppercase text-slate-500"><tr><th className="p-3"><input aria-label="Selecionar todos" type="checkbox" checked={selected.length === rows.length} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.keyword) : [])} /></th><th className="p-3">Keyword</th><th className="p-3">Volume</th><th className="p-3">CPC</th><th className="p-3">KD</th><th className="p-3">Intenção</th><th className="p-3">SERP</th></tr></thead><tbody>{rows.map((row) => <tr key={row.keyword} className="border-b border-white/[.04]"><td className="p-3"><input aria-label={`Selecionar ${row.keyword}`} type="checkbox" checked={selected.includes(row.keyword)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.keyword] : current.filter((keyword) => keyword !== row.keyword))} /></td><td className="p-3 font-semibold text-white">{row.keyword}</td><td className="p-3 tabular-nums text-slate-300">{row.searchVolume ?? "—"}</td><td className="p-3 tabular-nums text-slate-300">{row.cpc == null ? "—" : `$ ${row.cpc.toFixed(2)}`}</td><td className="p-3 tabular-nums text-slate-300">{row.keywordDifficulty ?? "—"}</td><td className="p-3 text-slate-400">{row.intent ?? "—"}</td><td className="p-3"><button type="button" onClick={() => analyze(row.keyword)} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 font-bold text-slate-300"><Search size={13} />Analisar</button></td></tr>)}</tbody></table></SeoCard>
    {serp != null && <SeoCard className="p-4"><details open><summary className="cursor-pointer text-sm font-bold text-white">Análise SERP</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">{JSON.stringify(serp, null, 2)}</pre></details></SeoCard>}
  </div>;
}
