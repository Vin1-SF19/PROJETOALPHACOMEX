"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BarChart3, FileSearch, Link2, Radar, RefreshCw, Settings2, X } from "lucide-react";
import { AtualizarSnapshotBacklinksDashboardAlphaSeo, DispensarGa4DashboardAlphaSeo, DispensarMcpDashboardAlphaSeo, MarcarCompetidorDashboardAlphaSeo } from "@/actions/AlphaSeoDashboard";
import { SeoCard, StatePanel } from "../shared/PageHeader";
import { OnboardingPanel } from "./OnboardingPanel";

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function number(value: unknown) { return typeof value === "number" ? value : null; }
function text(value: unknown) { return typeof value === "string" ? value : null; }

export function DashboardOverview({ projectId, activation, overview, onboarding, onboardingChat }: { projectId: string; activation: unknown; overview: unknown; onboarding: unknown; onboardingChat: unknown }) {
  const [data, setData] = useState(overview);
  const [activationData, setActivationData] = useState<unknown>(activation);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const active = record(activationData);
  const rank = record(record(data)?.rank);
  const audit = record(record(data)?.audit);
  const backlinks = record(record(data)?.backlinks);
  const gsc = record(active?.gsc);
  const ga4 = record(active?.ga4);
  const mcp = record(active?.mcp);
  const steps = [
    { label: "Domínio", done: Boolean(active?.domain), href: `/PainelAlpha/AlphaSEO/${projectId}/settings` },
    { label: "Search Console", done: gsc?.connected === true, href: `/PainelAlpha/AlphaSEO/${projectId}/settings/integrations` },
    { label: "Concorrentes", done: active?.competitorClickedAt != null, href: `/PainelAlpha/AlphaSEO/${projectId}/settings/context` },
    { label: "MCP", done: mcp?.authorizedAt != null, href: `/PainelAlpha/AlphaSEO/${projectId}/settings/mcp` },
  ];
  function refreshBacklinks() { start(async () => { const result = await AtualizarSnapshotBacklinksDashboardAlphaSeo({ projectId }); if (!result.success) return setMessage(result.error); setData(result.data); setMessage("Snapshot de backlinks atualizado."); }); }
  function openCompetitors() { start(async () => { const result = await MarcarCompetidorDashboardAlphaSeo({ projectId }); if (!result.success) return setMessage(result.error); setActivationData((current: unknown) => ({ ...record(current), competitorClickedAt: new Date().toISOString() })); window.location.assign(`/PainelAlpha/AlphaSEO/${projectId}/settings/context`); }); }
  function dismiss(kind: "ga4" | "mcp") { start(async () => { const result = kind === "ga4" ? await DispensarGa4DashboardAlphaSeo({ projectId }) : await DispensarMcpDashboardAlphaSeo({ projectId }); if (!result.success) return setMessage(result.error); setActivationData((current: unknown) => { const root = record(current) ?? {}; const nested = record(root[kind]) ?? {}; return { ...root, [kind]: { ...nested, cardDismissedAt: new Date().toISOString() } }; }); setMessage(`Cartão ${kind.toUpperCase()} dispensado.`); }); }
  return <div className="space-y-4">
    <OnboardingPanel projectId={projectId} data={onboarding} chatState={onboardingChat} domain={text(active?.domain)} gscConnected={gsc?.connected === true}/>
    <SeoCard className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">Ativação do observatório</h2><p className="mt-1 text-xs text-slate-500">{steps.filter((step) => step.done).length} de {steps.length} sinais configurados</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">GA4 {ga4?.connected === true ? "conectado" : "pendente"}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{steps.map((step, index) => <Link key={step.label} href={step.href} onClick={step.label === "Concorrentes" ? (event) => { event.preventDefault(); openCompetitors(); } : undefined} className={`min-h-20 rounded-xl border p-4 text-sm transition ${step.done ? "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-200" : "border-white/5 bg-white/[.025] text-slate-300 hover:border-white/15"}`}><b className="mr-2">{step.done ? "✓" : index + 1}.</b>{step.label}</Link>)}</div></SeoCard>
    {(ga4?.connected !== true && ga4?.cardDismissedAt == null || mcp?.authorizedAt == null && mcp?.cardDismissedAt == null) && <div className="grid gap-3 lg:grid-cols-2">{ga4?.connected !== true && ga4?.cardDismissedAt == null && <SetupCard label="Google Analytics 4" description="Conecte conversões, landing pages e aquisição orgânica." href={`/PainelAlpha/AlphaSEO/${projectId}/settings/integrations`} onDismiss={() => dismiss("ga4")}/>} {mcp?.authorizedAt == null && mcp?.cardDismissedAt == null && <SetupCard label="MCP Alpha SEO" description="Autorize clientes externos nas 46 ferramentas do projeto." href={`/PainelAlpha/AlphaSEO/${projectId}/settings/mcp`} onDismiss={() => dismiss("mcp")}/>}</div>}
    <div className="grid gap-4 xl:grid-cols-3">
      <SignalCard icon={Radar} title="Rank Tracking" href={`/PainelAlpha/AlphaSEO/${projectId}/rank`} empty={!rank} items={[["Keywords",number(rank?.trackedKeywords)],["Top 10",number(rank?.top10)],["Subiram",number(rank?.improved)],["Caíram",number(rank?.declined)]]}/>
      <SignalCard icon={FileSearch} title="Auditoria" href={`/PainelAlpha/AlphaSEO/${projectId}/audit`} empty={!audit} items={[["Páginas",number(audit?.pagesCrawled)],["Tipos de issue",number(audit?.totalIssueTypes)],["Status",text(audit?.status)], ["Início",audit?.startedAt ? new Date(String(audit.startedAt)).toLocaleDateString("pt-BR") : null]]}/>
      <SeoCard className="p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold text-white"><Link2 size={16} className="text-[rgb(var(--seo-accent))]"/>Backlinks</h2><button type="button" onClick={refreshBacklinks} disabled={pending} className="grid size-11 place-items-center rounded-xl border border-white/10" aria-label="Atualizar backlinks"><RefreshCw size={14} className={pending ? "animate-spin motion-reduce:animate-none" : ""}/></button></div>{backlinks ? <div className="mt-5 grid grid-cols-2 gap-3">{[["Rank",number(backlinks.rank)],["Links",number(backlinks.backlinks)],["Domínios",number(backlinks.referringDomains)],["Novos",number(backlinks.newBacklinks)]].map(([label,value]) => <Metric key={String(label)} label={String(label)} value={value}/>)}</div> : <StatePanel title="Sem snapshot" description="Atualize para buscar o primeiro panorama de backlinks."/>}{backlinks?.stale === true && <p className="mt-3 text-xs text-amber-300">Snapshot desatualizado há mais de 24 horas.</p>}</SeoCard>
    </div>
    <SeoCard className="flex flex-wrap items-center gap-3 p-4"><BarChart3 size={16} className="text-[rgb(var(--seo-accent))]"/><p className="min-w-0 flex-1 text-sm text-slate-300">GSC: {text(gsc?.siteUrl) ?? "não conectado"} · GA4: {text(ga4?.propertyDisplayName) ?? "não conectado"}</p><Link href={`/PainelAlpha/AlphaSEO/${projectId}/settings/integrations`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><Settings2 size={13}/>Configurar</Link></SeoCard>
    {message && <p role="status" className="text-xs text-slate-400">{message}</p>}
  </div>;
}

function SignalCard({ icon: Icon, title, href, empty, items }: { icon: typeof Radar; title: string; href: string; empty: boolean; items: Array<[string, string | number | null]> }) { return <SeoCard className="p-5"><Link href={href} className="flex min-h-11 items-center gap-2 font-bold text-white"><Icon size={16} className="text-[rgb(var(--seo-accent))]"/>{title}</Link>{empty ? <StatePanel title="Ainda sem dados" description="Abra o fluxo para configurar o primeiro acompanhamento."/> : <div className="mt-5 grid grid-cols-2 gap-3">{items.map(([label,value]) => <Metric key={label} label={label} value={value}/>)}</div>}</SeoCard>; }
function Metric({ label, value }: { label: string; value: string | number | null }) { return <div className="rounded-xl border border-white/5 bg-white/[.025] p-3"><b className="block truncate text-lg text-white">{value ?? "—"}</b><span className="text-[10px] uppercase text-slate-500">{label}</span></div>; }
function SetupCard({ label, description, href, onDismiss }: { label: string; description: string; href: string; onDismiss: () => void }) { return <SeoCard className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><b className="text-sm text-white">{label}</b><p className="mt-1 text-xs text-slate-500">{description}</p></div><Link href={href} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-3 text-xs font-bold">Configurar</Link><button type="button" onClick={onDismiss} aria-label={`Dispensar cartão ${label}`} className="grid size-11 place-items-center rounded-xl border border-white/10"><X size={13}/></button></SeoCard>; }
