import Link from "next/link";
import { BarChart3, Bot, BrainCircuit, FileSearch, Gauge, Link2, Radar, Search, Sparkles, Tags } from "lucide-react";
import db from "@/lib/prisma";
import { PageHeader, SeoCard, StatePanel } from "./PageHeader";
import { FeatureConsole, type ConsoleKind } from "./FeatureConsole";
import { SamStart } from "../sam/SamWorkspace";
import { ListarSessoesAlphaSeoSam } from "@/actions/AlphaSeoSam";
import { SavedKeywordsTable } from "../saved/SavedKeywordsTable";
import { ListarPalavrasChaveSalvasAlphaSeo } from "@/actions/AlphaSeoSavedKeywords";
import { CreateRankTracker } from "../rank/RankControls";
import { GscOverview } from "../gsc/GscOverview";
import { DomainResearchWorkspace } from "../research/DomainResearchWorkspace";
import { BacklinksWorkspace } from "../research/BacklinksWorkspace";
import { AiHistoryPanel } from "../visibility/AiHistoryPanel";
import { ObterAtivacaoDashboardAlphaSeo, ObterOverviewDashboardAlphaSeo } from "@/actions/AlphaSeoDashboard";
import { DashboardOverview } from "../dashboard/DashboardOverview";
import { ObterEstadoChatOnboardingAlphaSeo, ObterRespostasOnboardingAlphaSeo } from "@/actions/AlphaSeoOnboarding";

export type FeatureKind = "dashboard" | "keywords" | "saved" | "rank" | "domain" | "backlinks" | "audit" | "gsc" | "brand" | "prompt" | "sam";
const CONFIG = {
  dashboard: ["Visão geral", "Sinais essenciais do projeto, progresso de ativação e mudanças recentes.", Gauge],
  keywords: ["Keyword Research", "Descubra demanda, intenção, dificuldade e tendências a partir de até 200 seeds.", Search],
  saved: ["Keywords salvas", "Organize termos com tags, métricas atualizáveis, ações em massa e exportação segura.", Tags],
  rank: ["Rank Tracking", "Acompanhe posições em desktop e mobile com histórico e agendas sem drift.", Radar],
  domain: ["Domain Research", "Investigue a presença orgânica de um domínio, subpasta ou URL.", BarChart3],
  backlinks: ["Backlinks", "Autoridade, domínios referentes, páginas fortes e links novos ou perdidos.", Link2],
  audit: ["Site Audit", "Crawl em background, 27 verificações, páginas, issues e Lighthouse.", FileSearch],
  gsc: ["Search Performance", "Cliques, impressões, CTR e posição com comparação e oportunidades.", Gauge],
  brand: ["Brand Lookup", "Meça menções, share of voice, consultas e fontes em quatro mecanismos de IA.", Sparkles],
  prompt: ["Prompt Explorer", "Compare respostas, citações, fan-out e menções de marca por modelo.", BrainCircuit],
  sam: ["SAM", "Agente SEO com memória do projeto, skills e ferramentas seguras.", Bot],
} as const;

export async function FeatureRoute({ projectId, kind }: { projectId: string; kind: FeatureKind }) {
  const [title, description, Icon] = CONFIG[kind];
  const project = await db.alphaSeoProject.findUnique({ where: { id: projectId }, select: { domain: true } });
  if (!project) return <StatePanel title="Projeto indisponível" description="O projeto não existe ou não está acessível."/>;
  if (kind === "domain") return <><PageHeader title={title} description={description} icon={Icon}/><DomainResearchWorkspace projectId={projectId} defaultDomain={project.domain ?? ""}/></>;
  if (kind === "backlinks") return <><PageHeader title={title} description={description} icon={Icon}/><BacklinksWorkspace projectId={projectId} defaultTarget={project.domain ?? ""}/></>;
  if (["keywords", "audit", "brand", "prompt"].includes(kind)) return <><PageHeader title={title} description={description} icon={Icon}/><FeatureConsole projectId={projectId} kind={kind as ConsoleKind} defaultValue={kind === "audit" ? project.domain ?? "" : ""}/>{kind === "audit" && <AuditHistory projectId={projectId}/>} {(kind === "brand" || kind === "prompt") && <AiHistory projectId={projectId} kind={kind}/>}</>;
  if (kind === "dashboard") return <Dashboard projectId={projectId} title={title} description={description} icon={Icon}/>;
  if (kind === "saved") return <Saved projectId={projectId} title={title} description={description} icon={Icon}/>;
  if (kind === "rank") return <Rank projectId={projectId} title={title} description={description} icon={Icon}/>;
  if (kind === "gsc") return <GoogleState projectId={projectId} title={title} description={description} icon={Icon}/>;
  const sessions = await ListarSessoesAlphaSeoSam(projectId);
  return <><PageHeader title={title} description={description} icon={Icon}/><SamStart projectId={projectId} initialSessions={sessions.success && sessions.data ? sessions.data : []}/></>;
}

async function Dashboard({ projectId, title, description, icon: Icon }: Common) {
  const [activation, overview, onboarding, onboardingChat] = await Promise.all([ObterAtivacaoDashboardAlphaSeo({projectId}), ObterOverviewDashboardAlphaSeo({projectId}), ObterRespostasOnboardingAlphaSeo({projectId}), ObterEstadoChatOnboardingAlphaSeo({projectId})]);
  const error = !activation.success && "error" in activation ? activation.error : !overview.success && "error" in overview ? overview.error : "Falha ao consultar os sinais do projeto.";
  return <><PageHeader title={title} description={description} icon={Icon}/>{activation.success && overview.success ? <DashboardOverview projectId={projectId} activation={activation.data} overview={overview.data} onboarding={onboarding.success ? onboarding.data : null} onboardingChat={onboardingChat.success ? onboardingChat.data : null}/> : <StatePanel title="Dashboard temporariamente indisponível" description={error}/>}</>;
}
type Common = { projectId: string; title: string; description: string; icon: typeof Gauge };
async function Saved({ projectId, title, description, icon: Icon }: Common) { const result = await ListarPalavrasChaveSalvasAlphaSeo({ projectId, page: 1, limit: 50 }); return <><PageHeader title={title} description={description} icon={Icon}/>{result.success ? <SavedKeywordsTable projectId={projectId} initialData={result.data}/> : <StatePanel title="Keywords indisponíveis" description={result.error}/>}</> }
async function Rank({ projectId, title, description, icon: Icon }: Common) { const [rows,project] = await Promise.all([db.alphaSeoRankConfig.findMany({ where: { projectId }, include: { _count: { select: { keywords: true, runs: true } } }, orderBy: { updatedAt: "desc" } }),db.alphaSeoProject.findUnique({where:{id:projectId},select:{domain:true}})]); return <><PageHeader title={title} description={description} icon={Icon}/><CreateRankTracker projectId={projectId} defaultDomain={project?.domain??""}/>{rows.length?<div className="grid gap-4 lg:grid-cols-2">{rows.map(row=><Link key={row.id} href={`/PainelAlpha/AlphaSEO/${projectId}/rank/${row.id}`}><SeoCard className="p-5 transition hover:border-white/20"><div className="flex justify-between"><b className="text-white">{row.domain}</b><span className="text-xs text-slate-500">{row.scheduleInterval}</span></div><p className="mt-3 text-sm text-slate-400">{row._count.keywords} keywords · {row._count.runs} execuções · {row.devices}</p></SeoCard></Link>)}</div>:<StatePanel title="Nenhum tracker configurado" description="Crie uma configuração de domínio, mercado, devices e agenda para começar."/>}</> }
async function AuditHistory({ projectId }: { projectId: string }) { const rows = await db.alphaSeoSiteAudit.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 20 }); if(!rows.length)return null; return <SeoCard className="mt-5 overflow-hidden"><div className="border-b border-white/5 px-5 py-4 font-bold text-white">Histórico</div>{rows.map(row=><Link key={row.id} href={`/PainelAlpha/AlphaSEO/${projectId}/audit/${row.id}`} className="flex items-center justify-between border-b border-white/[.04] px-5 py-4 text-sm hover:bg-white/[.025]"><span className="truncate text-slate-300">{row.startUrl}</span><span className="ml-3 text-xs text-slate-500">{row.status} · {row.pagesCrawled}/{row.pagesTotal || "?"}</span></Link>)}</SeoCard> }
async function GoogleState({ projectId, title, description, icon: Icon }: Common) { const gsc=await db.alphaSeoGscConnection.findUnique({where:{projectId},select:{siteUrl:true}}); return <><PageHeader title={title} description={description} icon={Icon}/><GscOverview projectId={projectId} siteUrl={gsc?.siteUrl??null}/></> }
async function AiHistory({projectId,kind}:{projectId:string;kind:"brand"|"prompt"}){const exportKind=kind==="brand"?"BRAND_LOOKUP":"PROMPT_EXPLORER";const rows=await db.alphaSeoAiVisibilityRun.findMany({where:{projectId,kind:exportKind},include:{providerResults:{select:{id:true,provider:true,status:true,errorCode:true,result:true,durationMs:true,actualMicrosUsd:true}}},orderBy:{createdAt:"desc"},take:100});return <AiHistoryPanel projectId={projectId} kind={exportKind} rows={rows}/>}
