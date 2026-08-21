"use client";

import { useState, useTransition } from "react";
import { BarChart3, ExternalLink, Link2, PlugZap, Unplug } from "lucide-react";
import {
  DesconectarAlphaSeoGsc,
  ListarSitesAlphaSeoGsc,
  SelecionarSiteAlphaSeoGsc,
} from "@/actions/AlphaSeoGsc";
import {
  ConsultarRelatorioAlphaSeoGa4,
  DesconectarAlphaSeoGa4,
  ListarPropriedadesAlphaSeoGa4,
  SelecionarPropriedadeAlphaSeoGa4,
} from "@/actions/AlphaSeoGa4";
import { SeoCard } from "../shared/PageHeader";

interface GscSite { siteUrl: string; permissionLevel: string }
interface GscAccount { grantId: string; email: string | null; sites: GscSite[] }
interface Ga4Property { name: string; displayName: string; accountName: string; timeZone: string; currencyCode: string }
interface Ga4Account { grantId: string; email: string | null; properties: Ga4Property[] }

const REPORTS = [
  "organic_landing_pages", "page_performance", "key_events", "search_opportunities",
  "organic_overview", "traffic_acquisition", "measurement_health", "ecommerce_performance",
  "site_search", "audience_breakdown",
] as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseGscAccounts(value: unknown): GscAccount[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.grantId !== "string") return [];
    const sites = (Array.isArray(row.sites) ? row.sites : []).flatMap((site) => {
      const parsed = record(site);
      return parsed && typeof parsed.siteUrl === "string" && typeof parsed.permissionLevel === "string" ? [{ siteUrl: parsed.siteUrl, permissionLevel: parsed.permissionLevel }] : [];
    });
    return [{ grantId: row.grantId, email: typeof row.email === "string" ? row.email : null, sites }];
  });
}

function parseGa4Accounts(value: unknown): Ga4Account[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.grantId !== "string") return [];
    const properties = (Array.isArray(row.properties) ? row.properties : []).flatMap((property) => {
      const parsed = record(property);
      if (!parsed || typeof parsed.name !== "string" || typeof parsed.displayName !== "string") return [];
      return [{ name: parsed.name, displayName: parsed.displayName, accountName: String(parsed.accountName ?? ""), timeZone: String(parsed.timeZone ?? "UTC"), currencyCode: String(parsed.currencyCode ?? "USD") }];
    });
    return [{ grantId: row.grantId, email: typeof row.email === "string" ? row.email : null, properties }];
  });
}

function iso(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export function GoogleIntegrations({ projectId, selectedGsc, selectedGa4, providerStatus }: { projectId: string; selectedGsc: string | null; selectedGa4: string | null; providerStatus: { dataForSeo: boolean; sam: boolean } }) {
  const [gsc, setGsc] = useState(selectedGsc);
  const [ga4, setGa4] = useState(selectedGa4);
  const [gscAccounts, setGscAccounts] = useState<GscAccount[]>([]);
  const [ga4Accounts, setGa4Accounts] = useState<Ga4Account[]>([]);
  const [report, setReport] = useState<(typeof REPORTS)[number]>("organic_overview");
  const [reportData, setReportData] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  async function connect(product: "gsc" | "ga4") {
    setMessage("Preparando conexão segura…");
    const response = await fetch(`/api/alpha-seo/oauth/${product}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId }) });
    const body = await response.json() as unknown;
    const data = record(record(body)?.data);
    if (response.ok && typeof data?.url === "string") window.location.assign(data.url);
    else setMessage(String(record(body)?.error ?? "Não foi possível iniciar OAuth."));
  }

  function loadGscSites() {
    startTransition(async () => {
      const result = await ListarSitesAlphaSeoGsc(projectId);
      if (!result.success) return setMessage(result.error ?? "Falha ao listar sites GSC");
      setGscAccounts(parseGscAccounts(result.data));
      setMessage("Selecione uma propriedade verificada do Search Console.");
    });
  }

  function chooseGsc(grantId: string, siteUrl: string) {
    startTransition(async () => {
      const result = await SelecionarSiteAlphaSeoGsc({ projectId, grantId, siteUrl });
      if (!result.success) return setMessage(result.error ?? "Falha ao selecionar site GSC");
      setGsc(siteUrl);
      setMessage("Propriedade GSC selecionada.");
    });
  }

  function loadGa4Properties() {
    startTransition(async () => {
      const result = await ListarPropriedadesAlphaSeoGa4(projectId);
      if (!result.success) return setMessage(result.error ?? "Falha ao listar propriedades GA4");
      setGa4Accounts(parseGa4Accounts(result.data));
      setMessage("Selecione uma propriedade GA4.");
    });
  }

  function chooseGa4(grantId: string, property: Ga4Property) {
    startTransition(async () => {
      const result = await SelecionarPropriedadeAlphaSeoGa4({ projectId, grantId, propertyId: property.name });
      if (!result.success) return setMessage(result.error ?? "Falha ao selecionar propriedade GA4");
      setGa4(property.displayName);
      setMessage("Propriedade GA4 selecionada.");
    });
  }

  function runGa4Report() {
    startTransition(async () => {
      const result = await ConsultarRelatorioAlphaSeoGa4({ projectId, report, startDate: iso(28), endDate: iso(1), limit: 100 });
      if (!result.success) return setMessage(result.error ?? "Falha ao consultar relatório GA4");
      setReportData(result.data);
      setMessage("Relatório GA4 atualizado.");
    });
  }

  function disconnect(product: "gsc" | "ga4") {
    startTransition(async () => {
      const result = product === "gsc" ? await DesconectarAlphaSeoGsc(projectId) : await DesconectarAlphaSeoGa4(projectId);
      if (!result.success) return setMessage(result.error ?? "Falha ao desconectar integração");
      if (product === "gsc") { setGsc(null); setGscAccounts([]); }
      else { setGa4(null); setGa4Accounts([]); setReportData(null); }
      setMessage("Integração desconectada. O histórico local foi preservado.");
    });
  }

  return <div className="space-y-4">
    <SeoCard className="grid gap-3 p-4 sm:grid-cols-2"><ProviderStatus label="DataForSEO" ready={providerStatus.dataForSeo} description="Pesquisa, SERP, backlinks e rank tracking"/><ProviderStatus label="OpenRouter / SAM" ready={providerStatus.sam} description="SAM, Brand Lookup e Prompt Explorer"/></SeoCard>
    <div className="grid gap-4 lg:grid-cols-2">
      <ConnectionCard title="Google Search Console" selected={gsc} icon={Link2} onConnect={() => connect("gsc")} onLoad={loadGscSites} onDisconnect={() => disconnect("gsc")} pending={pending} />
      <ConnectionCard title="Google Analytics 4" selected={ga4} icon={BarChart3} onConnect={() => connect("ga4")} onLoad={loadGa4Properties} onDisconnect={() => disconnect("ga4")} pending={pending} />
    </div>
    {gscAccounts.length > 0 && <SelectionPanel title="Propriedades GSC">{gscAccounts.flatMap((account) => account.sites.map((site) => <button key={`${account.grantId}-${site.siteUrl}`} type="button" onClick={() => chooseGsc(account.grantId, site.siteUrl)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] px-3 text-left text-xs hover:bg-white/[.07]"><span className="truncate text-white">{site.siteUrl}</span><span className="shrink-0 text-slate-500">{site.permissionLevel}</span></button>))}</SelectionPanel>}
    {ga4Accounts.length > 0 && <SelectionPanel title="Propriedades GA4">{ga4Accounts.flatMap((account) => account.properties.map((property) => <button key={`${account.grantId}-${property.name}`} type="button" onClick={() => chooseGa4(account.grantId, property)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] px-3 text-left text-xs hover:bg-white/[.07]"><span className="truncate text-white">{property.displayName}</span><span className="shrink-0 text-slate-500">{property.accountName}</span></button>))}</SelectionPanel>}
    {ga4 && <SeoCard className="p-5"><h2 className="font-bold text-white">Relatórios GA4</h2><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><select value={report} onChange={(event) => setReport(event.target.value as typeof report)} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm">{REPORTS.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select><button type="button" onClick={runGa4Report} disabled={pending} className="min-h-11 rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-xs font-black text-slate-950">Executar relatório</button></div>{reportData != null && <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-4 text-xs leading-5 text-slate-300">{JSON.stringify(reportData, null, 2)}</pre>}</SeoCard>}
    {message && <p role="status" className="rounded-xl border border-white/5 bg-white/[.03] p-3 text-xs text-slate-400">{message}</p>}
  </div>;
}

function ProviderStatus({ label, ready, description }: { label: string; ready: boolean; description: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[.025] p-3"><div><b className="text-sm text-white">{label}</b><p className="mt-1 text-[10px] text-slate-500">{description}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${ready ? "border-emerald-400/20 text-emerald-300" : "border-amber-400/20 text-amber-300"}`}>{ready ? "Configurado" : "Pendente"}</span></div>;
}

function ConnectionCard({ title, selected, icon: Icon, onConnect, onLoad, onDisconnect, pending }: { title: string; selected: string | null; icon: typeof Link2; onConnect: () => void; onLoad: () => void; onDisconnect: () => void; pending: boolean }) {
  return <SeoCard className="p-5"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-white/[.05] text-[rgb(var(--seo-accent))]"><Icon size={18}/></span><span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-300"><PlugZap size={11}/>{selected ? "Conectado" : "Não conectado"}</span></div><h2 className="mt-4 font-bold text-white">{title}</h2><p className="mt-2 truncate text-sm text-slate-500">{selected ?? "OAuth com state, PKCE e tokens criptografados."}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={onConnect} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.05] px-3 text-xs font-bold">Conectar <ExternalLink size={13}/></button><button type="button" onClick={onLoad} disabled={pending} className="min-h-11 rounded-xl border border-white/10 px-3 text-xs font-bold">Selecionar propriedade</button>{selected && <button type="button" onClick={onDisconnect} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-400/20 px-3 text-xs font-bold text-rose-300"><Unplug size={13}/>Desconectar</button>}</div></SeoCard>;
}

function SelectionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <SeoCard className="p-5"><h2 className="font-bold text-white">{title}</h2><div className="mt-4 grid gap-2 md:grid-cols-2">{children}</div></SeoCard>;
}
