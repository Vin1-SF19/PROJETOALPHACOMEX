"use client";

import { useMemo, useState, useTransition } from "react";
import { Play, ShieldCheck } from "lucide-react";
import { PesquisarPalavrasChaveAlphaSeo, EstimarCustoPesquisaPalavrasChaveAlphaSeo, AprovarCustoPesquisaPalavrasChaveAlphaSeo } from "@/actions/AlphaSeoKeywords";
import { ObterOverviewDominioAlphaSeo } from "@/actions/AlphaSeoDomain";
import { ObterOverviewBacklinksAlphaSeo } from "@/actions/AlphaSeoBacklinks";
import { AprovarCustoAuditoriaAlphaSeo, EstimarCustoAuditoriaAlphaSeo, IniciarAuditoriaAlphaSeo } from "@/actions/AlphaSeoAudit";
import { EstimarAlphaSeoAiVisibility, AprovarCustoAlphaSeoAiVisibility, ExecutarAlphaSeoAiVisibility } from "@/actions/AlphaSeoAiVisibility";
import { SeoCard } from "./PageHeader";
import { KeywordResearchResults } from "../research/KeywordResearchResults";

export type ConsoleKind = "keywords" | "domain" | "backlinks" | "audit" | "brand" | "prompt";
type Result = { success: boolean; data?: unknown; error?: string };
const copy: Record<ConsoleKind, { label: string; placeholder: string; help: string }> = {
  keywords: { label: "Seeds", placeholder: "despachante aduaneiro, consultoria importação", help: "Até 200 termos, um por linha ou separados por vírgula." },
  domain: { label: "Domínio ou URL", placeholder: "exemplo.com.br", help: "Analisa visão geral e abre caminho para keywords e páginas." },
  backlinks: { label: "Domínio ou URL", placeholder: "exemplo.com.br", help: "Consulta autoridade, domínios referentes e links novos/perdidos." },
  audit: { label: "URL inicial", placeholder: "https://exemplo.com.br", help: "Crawler protegido por robots, limites, SSRF e retomada em background." },
  brand: { label: "Marca ou pergunta", placeholder: "Como a Alpha Comex aparece nas respostas de IA?", help: "Compara ChatGPT, Claude, Gemini e Perplexity." },
  prompt: { label: "Prompt", placeholder: "Quais empresas ajudam importadores no Brasil?", help: "Executa quatro perspectivas com citações e falha parcial segura." },
};

export function FeatureConsole({ projectId, kind, defaultValue = "" }: { projectId: string; kind: ConsoleKind; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [scope, setScope] = useState("domain");
  const [keywordMode, setKeywordMode] = useState<"auto" | "related" | "suggestions" | "ideas">("auto");
  const [resultLimit, setResultLimit] = useState<150 | 300 | 500>(150);
  const [clickstream, setClickstream] = useState(false);
  const [locationCode, setLocationCode] = useState(2076);
  const [languageCode, setLanguageCode] = useState("pt");
  const [auditPages, setAuditPages] = useState(50);
  const [lighthouseStrategy, setLighthouseStrategy] = useState<"AUTO" | "NONE">("AUTO");
  const [brandName, setBrandName] = useState("");
  const [domain, setDomain] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [webSearch, setWebSearch] = useState(true);
  const [country, setCountry] = useState("BR");
  const [result, setResult] = useState<Result | null>(null);
  const [prepared, setPrepared] = useState<Record<string, unknown> | null>(null);
  const [phase, setPhase] = useState<"idle" | "estimated" | "completed">("idle");
  const [pending, startTransition] = useTransition();
  const text = copy[kind];
  const costly = kind === "keywords" || kind === "audit" || kind === "brand" || kind === "prompt";
  const canRun = value.trim().length > 0;
  const formatted = useMemo(() => result?.data ? JSON.stringify(result.data, null, 2) : "", [result]);
  function invalidate() { setPrepared(null); setResult(null); setPhase("idle"); }

  function execute(approved = false) {
    startTransition(async () => {
      setResult(null);
      let response: Result;
      if (kind === "keywords") {
        const request = prepared ?? { projectId, keywords: value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean), mode: keywordMode, resultLimit, clickstream, locationCode, languageCode };
        setPrepared(request);
        response = approved ? await PesquisarPalavrasChaveAlphaSeo(request) : await EstimarCustoPesquisaPalavrasChaveAlphaSeo(request);
      } else if (kind === "domain") response = await ObterOverviewDominioAlphaSeo({ projectId, domain: value, scope });
      else if (kind === "backlinks") response = await ObterOverviewBacklinksAlphaSeo({ projectId, target: value, scope });
      else if (kind === "audit") {
        const request = prepared ?? { projectId, startUrl: value, maxPages: auditPages, lighthouseStrategy };
        setPrepared(request);
        response = approved ? await IniciarAuditoriaAlphaSeo(request) : await EstimarCustoAuditoriaAlphaSeo(request);
      }
      else {
        const request = prepared ?? { projectId, kind: kind === "brand" ? "BRAND_LOOKUP" : "PROMPT_EXPLORER", query: value, brand: kind === "brand" ? (brandName.trim() || value.slice(0, 200)) : undefined, domain: domain.trim() || undefined, country: country.trim() || undefined, competitors: competitors.split(/[\n,]/).map((item) => item.trim()).filter(Boolean).slice(0, 5), webSearch, idempotencyKey: crypto.randomUUID() };
        setPrepared(request);
        response = approved ? await ExecutarAlphaSeoAiVisibility(request) : await EstimarAlphaSeoAiVisibility(request);
      }
      setResult(response);
      setPhase(response.success ? costly && !approved ? "estimated" : "completed" : "idle");
    });
  }
  function approveAndRun() {
    if (!prepared) return;
    startTransition(async () => {
      const approval = kind === "keywords"
        ? await AprovarCustoPesquisaPalavrasChaveAlphaSeo({ request: prepared })
        : kind === "audit"
          ? await AprovarCustoAuditoriaAlphaSeo(prepared)
          : await AprovarCustoAlphaSeoAiVisibility({ request: prepared });
      if (!approval.success) return setResult(approval);
      execute(true);
    });
  }
  return <div className="space-y-4">
    <SeoCard className="p-5"><div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <label className="text-xs font-semibold text-slate-300">{text.label}<textarea value={value} onChange={(event) => { setValue(event.target.value); invalidate(); }} rows={kind === "prompt" ? 5 : 3} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[rgb(var(--seo-accent))]" placeholder={text.placeholder}/><span className="mt-2 block font-normal text-slate-500">{text.help}</span></label>
      <div className="flex flex-col justify-end gap-3">{(kind === "domain" || kind === "backlinks") && <select value={scope} onChange={(event) => { setScope(event.target.value); invalidate(); }} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm"><option value="domain">Domínio</option><option value="subdomains">Com subdomínios</option><option value="subfolder">Subpasta</option><option value="exact_url">URL exata</option></select>}<button disabled={!canRun || pending} onClick={() => execute(false)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[rgb(var(--seo-accent))] px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-40"><Play size={16}/>{pending ? "Processando…" : costly ? "Estimar custo" : "Executar"}</button></div>
    </div>{kind === "keywords" && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><select value={keywordMode} onChange={(event) => { setKeywordMode(event.target.value as typeof keywordMode); invalidate(); }} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"><option value="auto">Auto</option><option value="related">Related</option><option value="suggestions">Suggestions</option><option value="ideas">Ideas</option></select><select value={resultLimit} onChange={(event) => { setResultLimit(Number(event.target.value) as typeof resultLimit); invalidate(); }} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"><option value={150}>150 resultados</option><option value={300}>300 resultados</option><option value={500}>500 resultados</option></select><input type="number" min={1} value={locationCode} onChange={(event) => { setLocationCode(Number(event.target.value)); invalidate(); }} aria-label="Location code" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"/><input value={languageCode} onChange={(event) => { setLanguageCode(event.target.value); invalidate(); }} aria-label="Idioma" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"/><label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-slate-300"><input type="checkbox" checked={clickstream} onChange={(event) => { setClickstream(event.target.checked); invalidate(); }}/>Clickstream (custo maior)</label></div>}
    {kind === "audit" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">Máximo de páginas<input type="number" min={10} max={10000} value={auditPages} onChange={(event) => { setAuditPages(Number(event.target.value)); invalidate(); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3"/></label><label className="text-xs text-slate-400">Lighthouse<select value={lighthouseStrategy} onChange={(event) => { setLighthouseStrategy(event.target.value as typeof lighthouseStrategy); invalidate(); }} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3"><option value="AUTO">Mobile + desktop</option><option value="NONE">Não executar</option></select></label></div>}
    {(kind === "brand" || kind === "prompt") && <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kind === "brand" && <input value={brandName} onChange={(event) => { setBrandName(event.target.value); invalidate(); }} placeholder="Nome exato da marca" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"/>}<input value={domain} onChange={(event) => { setDomain(event.target.value); invalidate(); }} placeholder="Domínio da marca (opcional)" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"/><input value={competitors} onChange={(event) => { setCompetitors(event.target.value); invalidate(); }} placeholder="Até 5 concorrentes" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs"/><div className="grid grid-cols-[70px_1fr] gap-2"><input value={country} onChange={(event) => { setCountry(event.target.value.toUpperCase().slice(0, 2)); invalidate(); }} aria-label="País" className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-xs uppercase"/><label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-slate-300"><input type="checkbox" checked={webSearch} onChange={(event) => { setWebSearch(event.target.checked); invalidate(); }}/>Web search</label></div></div>}</SeoCard>
    {result && !(kind === "keywords" && result.success && phase === "completed") && <SeoCard className="overflow-hidden"><div className="flex items-center justify-between border-b border-white/5 px-5 py-3"><div><b className="text-sm text-white">{result.success ? phase === "estimated" ? "Estimativa pronta" : "Resultado" : "Não foi possível concluir"}</b>{result.error && <p className="mt-1 text-xs text-rose-400">{result.error}</p>}</div>{result.success && costly && prepared && phase === "estimated" && <button disabled={pending} onClick={approveAndRun} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200"><ShieldCheck size={14}/> Aprovar e executar</button>}</div>{formatted && <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words p-5 text-xs leading-6 text-slate-300">{formatted}</pre>}</SeoCard>}
    {kind === "keywords" && result?.success && phase === "completed" && <KeywordResearchResults projectId={projectId} data={result.data} />}
  </div>;
}
