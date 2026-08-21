import { notFound } from "next/navigation";
import { Activity, FileSearch, Radar } from "lucide-react";
import db from "@/lib/prisma";
import { AuditResultsWorkspace } from "../audit/AuditResultsWorkspace";
import { LighthouseIssuesClient } from "../audit/LighthouseIssuesClient";
import { RankDetailControls } from "../rank/RankControls";
import { PageHeader, SeoCard, StatePanel } from "./PageHeader";

export async function RankDetail({ projectId, trackerId }: { projectId: string; trackerId: string }) {
  const config = await db.alphaSeoRankConfig.findFirst({
    where: { id: trackerId, projectId },
    include: {
      keywords: { orderBy: { createdAt: "asc" }, take: 1_000 },
      runs: { orderBy: { startedAt: "desc" }, take: 20 },
    },
  });
  if (!config) notFound();
  const latest = config.runs[0];
  const snapshots = latest ? await db.alphaSeoRankSnapshot.findMany({ where: { runId: latest.id }, orderBy: [{ position: "asc" }, { checkedAt: "desc" }], take: 2_000 }) : [];
  return <>
    <PageHeader eyebrow="Rank Tracking" title={config.domain} description={`${config.devices} · profundidade ${config.serpDepth} · ${config.scheduleInterval}`} icon={Radar}/>
    <RankDetailControls
      projectId={projectId}
      configId={trackerId}
      config={{
        domain: config.domain,
        devices: config.devices,
        serpDepth: config.serpDepth,
        scheduleInterval: config.scheduleInterval,
        locationCode: config.locationCode,
        languageCode: config.languageCode,
        isActive: config.isActive,
      }}
      keywordRows={config.keywords.map((keyword) => ({ id: keyword.id, keyword: keyword.keyword }))}
    />
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Keywords" value={config.keywords.length}/><Metric label="Execuções" value={config.runs.length}/><Metric label="Status" value={latest?.status ?? "Ainda não executado"}/></div>
    {snapshots.length ? <SeoCard className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/5 text-[10px] uppercase text-slate-500"><tr><th className="p-4">Keyword</th><th className="p-4">Device</th><th className="p-4">Posição</th><th className="p-4">URL</th></tr></thead><tbody>{snapshots.map((row) => <tr key={row.id} className="border-b border-white/[.04]"><td className="p-4 font-medium text-white">{row.keyword}</td><td className="p-4 text-slate-400">{row.device}</td><td className="p-4 font-bold text-[rgb(var(--seo-accent))]">{row.position ?? "—"}</td><td className="max-w-md truncate p-4 text-slate-500">{row.rankedUrl ?? "—"}</td></tr>)}</tbody></table></SeoCard> : <StatePanel title="Sem snapshots" description="Adicione keywords e execute o tracker. Operações agendadas usam a fila econômica e mantêm fallback auditável."/>}
  </>;
}

export async function AuditDetail({ projectId, auditId }: { projectId: string; auditId: string }) {
  const audit = await db.alphaSeoSiteAudit.findFirst({ where: { id: auditId, projectId }, include: { _count: { select: { issues: true, pages: true } }, issues: { orderBy: [{ severity: "asc" }, { issueType: "asc" }], take: 100 }, pages: { orderBy: { url: "asc" }, take: 100 }, lighthouse: { include: { page: { select: { url: true } } }, take: 100 } } });
  if (!audit) notFound();
  return <>
    <PageHeader eyebrow="Site Audit" title={audit.startUrl} description={`${audit.currentPhase} · ${audit.status} · ${audit.pagesCrawled} páginas processadas`} icon={FileSearch}/>
    <div className="grid gap-4 sm:grid-cols-4"><Metric label="Páginas" value={audit._count.pages}/><Metric label="Issues" value={audit._count.issues}/><Metric label="Lighthouse" value={`${audit.lighthouseCompleted}/${audit.lighthouseTotal}`}/><Metric label="Status" value={audit.status}/></div>
    {audit.errorDetail && <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">Resultado parcial: {audit.errorDetail}</p>}
    <AuditResultsWorkspace projectId={projectId} auditId={auditId} status={audit.status} initialIssues={audit.issues.map((issue) => ({ id: issue.id, severity: issue.severity, issueType: issue.issueType, pageUrl: issue.pageUrl, details: issue.details }))} initialPages={audit.pages.map((page) => ({ id: page.id, url: page.url, statusCode: page.statusCode, title: page.title, h1Count: page.h1Count, wordCount: page.wordCount, imagesTotal: page.imagesTotal, imagesMissingAlt: page.imagesMissingAlt, responseTimeMs: page.responseTimeMs }))} issuesTotal={audit._count.issues} pagesTotal={audit._count.pages} lighthouse={audit.lighthouse.map((row) => ({ id: row.id, strategy: row.strategy, performanceScore: row.performanceScore, accessibilityScore: row.accessibilityScore, bestPracticesScore: row.bestPracticesScore, seoScore: row.seoScore, page: row.page }))}/>
  </>;
}

export async function LighthouseDetail({ projectId, auditId, resultId }: { projectId: string; auditId: string; resultId: string }) {
  const row = await db.alphaSeoAuditLighthouse.findFirst({ where: { id: resultId, auditId, audit: { projectId } }, include: { page: { select: { url: true } } } });
  if (!row) notFound();
  return <>
    <PageHeader eyebrow="Lighthouse" title={row.page.url} description={`${row.strategy} · ${row.errorMessage ? "resultado parcial" : "concluído"}`} icon={Activity}/>
    <div className="grid gap-4 sm:grid-cols-4"><Metric label="Performance" value={row.performanceScore ?? "—"}/><Metric label="SEO" value={row.seoScore ?? "—"}/><Metric label="Acessibilidade" value={row.accessibilityScore ?? "—"}/><Metric label="Boas práticas" value={row.bestPracticesScore ?? "—"}/></div>
    <SeoCard className="mt-5 p-5"><h2 className="font-bold text-white">Core Web Vitals</h2><pre className="mt-4 overflow-auto text-xs leading-6 text-slate-300">{JSON.stringify({ lcpMs: row.lcpMs, cls: row.cls, inpMs: row.inpMs, ttfbMs: row.ttfbMs, payloadSizeBytes: row.payloadSizeBytes }, null, 2)}</pre></SeoCard>
    <LighthouseIssuesClient projectId={projectId} resultId={resultId}/>
  </>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <SeoCard className="p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><b className="mt-2 block truncate text-xl text-white">{value}</b></SeoCard>;
}
