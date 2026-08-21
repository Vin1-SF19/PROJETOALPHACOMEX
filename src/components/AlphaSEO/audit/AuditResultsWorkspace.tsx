"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { FileDown, RefreshCw, Trash2 } from "lucide-react";
import { ObterResultadosAuditoriaAlphaSeo, ObterStatusAuditoriaAlphaSeo, RemoverAuditoriaAlphaSeo } from "@/actions/AlphaSeoAudit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompleteExportButtons } from "../shared/CompleteExportButtons";
import { ExportButtons } from "../shared/ExportButtons";
import { PaginationControls } from "../shared/PaginationControls";
import { SeoCard, StatePanel } from "../shared/PageHeader";

export interface AuditIssueRow { id: string; severity: string; issueType: string; pageUrl: string; details: unknown }
export interface AuditPageRow { id: string; url: string; statusCode: number | null; title: string | null; h1Count: number; wordCount: number; imagesTotal: number; imagesMissingAlt: number; responseTimeMs: number | null }
export interface LighthouseRow { id: string; strategy: string; performanceScore: number | null; accessibilityScore: number | null; bestPracticesScore: number | null; seoScore: number | null; page: { url: string } }
interface PageState<T> { rows: T[]; page: number; totalCount: number; hasMore: boolean }
interface Props { projectId: string; auditId: string; status: string; initialIssues: AuditIssueRow[]; initialPages: AuditPageRow[]; issuesTotal: number; pagesTotal: number; lighthouse: LighthouseRow[] }
const PAGE_SIZE = 100;
const ISSUE_COLUMNS = [{key:"severity",label:"Severidade"},{key:"issueType",label:"Tipo"},{key:"pageUrl",label:"Página"},{key:"details",label:"Detalhes"}];
const PAGE_COLUMNS = [{key:"url",label:"URL"},{key:"statusCode",label:"HTTP"},{key:"title",label:"Título"},{key:"h1Count",label:"H1"},{key:"wordCount",label:"Palavras"},{key:"imagesMissingAlt",label:"Imagens sem alt"},{key:"responseTimeMs",label:"Tempo (ms)"}];

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function issueRows(value: unknown): AuditIssueRow[] { return (Array.isArray(value) ? value : []).flatMap((value) => { const row=record(value); return row && typeof row.id === "string" && typeof row.issueType === "string" && typeof row.pageUrl === "string" ? [{id:row.id,severity:String(row.severity??"INFO"),issueType:row.issueType,pageUrl:row.pageUrl,details:row.details}] : []; }); }
function pageRows(value: unknown): AuditPageRow[] { return (Array.isArray(value) ? value : []).flatMap((value) => { const row=record(value); return row && typeof row.id === "string" && typeof row.url === "string" ? [{id:row.id,url:row.url,statusCode:typeof row.statusCode === "number"?row.statusCode:null,title:typeof row.title === "string"?row.title:null,h1Count:Number(row.h1Count??0),wordCount:Number(row.wordCount??0),imagesTotal:Number(row.imagesTotal??0),imagesMissingAlt:Number(row.imagesMissingAlt??0),responseTimeMs:typeof row.responseTimeMs === "number"?row.responseTimeMs:null}] : []; }); }

export function AuditResultsWorkspace({ projectId, auditId, status, initialIssues, initialPages, issuesTotal, pagesTotal, lighthouse }: Props) {
  const [issues, setIssues] = useState<PageState<AuditIssueRow>>({ rows: initialIssues, page: 1, totalCount: issuesTotal, hasMore: initialIssues.length < issuesTotal });
  const [pages, setPages] = useState<PageState<AuditPageRow>>({ rows: initialPages, page: 1, totalCount: pagesTotal, hasMore: initialPages.length < pagesTotal });
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [auditOperation, setAuditOperation] = useState<"IDLE" | "REFRESH" | "MUTATE">("IDLE");
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pending, startTransition] = useTransition();
  const statusRequestVersion = useRef(0);
  const isActive = currentStatus === "PENDING" || currentStatus === "RUNNING";
  const auditBusy = auditOperation !== "IDLE";

  async function fetchPage(page: number, limit = PAGE_SIZE) {
    const result = await ObterResultadosAuditoriaAlphaSeo({ projectId, auditId, page, limit });
    if (!result.success) throw new Error(result.error);
    return record(result.data);
  }

  function load(kind: "issues" | "pages", page: number) {
    startTransition(async () => {
      try {
        const data = await fetchPage(page);
        const pagination = record(data?.pagination);
        if (kind === "issues") { const rows=issueRows(data?.issues); const total=Number(pagination?.issuesTotal??0); setIssues({rows,page,totalCount:total,hasMore:page*PAGE_SIZE<total}); }
        else { const rows=pageRows(data?.pages); const total=Number(pagination?.pagesTotal??0); setPages({rows,page,totalCount:total,hasMore:page*PAGE_SIZE<total}); }
        setMessage(`${kind === "issues" ? "Issues" : "Páginas"} · página ${page} atualizada.`);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao atualizar resultados."); }
    });
  }

  async function loadAll(kind: "issues" | "pages") {
    const total = kind === "issues" ? issues.totalCount : pages.totalCount;
    if (total > 10_000) throw new Error("O conjunto excede o limite seguro de 10.000 linhas por exportação.");
    const rows: Array<Record<string, unknown>> = [];
    for (let page=1; rows.length<total; page+=1) {
      const data=await fetchPage(page,200);
      const batch=kind === "issues" ? issueRows(data?.issues) : pageRows(data?.pages);
      rows.push(...batch.map((row)=>({...row})));
      if (batch.length<200) break;
    }
    return rows;
  }

  async function refreshCurrentStatus() {
    const requestVersion = ++statusRequestVersion.current;
    const result = await ObterStatusAuditoriaAlphaSeo({projectId,auditId});
    if (requestVersion !== statusRequestVersion.current) return null;
    if (!result.success) return { success: false as const, error: result.error };
    const nextStatus = record(result.data)?.status;
    if (typeof nextStatus === "string") setCurrentStatus(nextStatus);
    return { success: true as const, status: typeof nextStatus === "string" ? nextStatus : currentStatus };
  }
  function refreshStatus() {
    if (auditBusy) return;
    setAuditOperation("REFRESH");
    void refreshCurrentStatus()
      .then((result) => setMessage(result?.success ? `Status atualizado: ${result.status}.` : result?.error ?? "Consulta de status superada por uma atualização mais recente."))
      .finally(() => setAuditOperation("IDLE"));
  }
  function refreshResults() { load("issues",issues.page); load("pages",pages.page); }
  function mutateAudit() {
    if (auditBusy) return;
    const mode = isActive ? "CANCEL" : "DELETE";
    statusRequestVersion.current += 1;
    setAuditOperation("MUTATE");
    startTransition(() => { void executeMutation(mode); });
  }
  async function executeMutation(mode: "CANCEL" | "DELETE") {
    try {
      const result=await RemoverAuditoriaAlphaSeo({projectId,auditId,mode});
      if(result.success){
        setConfirmDelete(false);
        if(mode === "DELETE") {
          window.location.assign(`/PainelAlpha/AlphaSEO/${projectId}/audit`);
          return;
        }
        const refreshed = await refreshCurrentStatus();
        setMessage(refreshed?.success ? `Auditoria cancelada. Status atual: ${refreshed.status}.` : "Auditoria cancelada; atualize o status para confirmar.");
        return;
      }
      if (["AUDIT_CANCEL_STATE_CONFLICT", "AUDIT_DELETE_STATE_CONFLICT", "AUDIT_NOT_FOUND"].includes(result.error)) {
        const refreshed = await refreshCurrentStatus();
        setConfirmDelete(false);
        setMessage(`${result.error}. ${refreshed?.success ? `Status atual: ${refreshed.status}.` : "Não foi possível obter o status atual."} Revise a tela e confirme novamente.`);
        return;
      }
      setMessage(result.error);
    } finally {
      setAuditOperation("IDLE");
    }
  }

  return <div className="mt-5 space-y-4">
    <SeoCard className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Operação persistente</p><p className="mt-1 text-sm text-slate-300">Status atual: {currentStatus}. Você pode sair da página e voltar depois.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={refreshStatus} disabled={pending || auditBusy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><RefreshCw size={14}/> Status</button><button type="button" onClick={refreshResults} disabled={pending || auditBusy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><FileDown size={14}/> Atualizar resultados</button><button type="button" onClick={()=>setConfirmDelete(true)} disabled={pending || auditBusy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-400/20 px-3 text-xs font-bold text-rose-300"><Trash2 size={14}/> {isActive ? "Cancelar" : "Excluir"}</button></div>
      {confirmDelete&&<div role="alertdialog" aria-labelledby="audit-delete-title" className="w-full rounded-xl border border-rose-400/20 bg-rose-400/10 p-4"><p id="audit-delete-title" className="text-sm font-bold text-rose-200">{isActive ? "Cancelar auditoria em execução?" : "Excluir auditoria e todos os resultados?"}</p><div className="mt-3 flex gap-2"><button type="button" onClick={mutateAudit} disabled={pending || auditBusy} className="min-h-11 rounded-xl bg-rose-400 px-4 text-xs font-black text-rose-950">{isActive ? "Confirmar cancelamento" : "Confirmar exclusão"}</button><button type="button" onClick={()=>setConfirmDelete(false)} disabled={auditBusy} className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-bold">Voltar</button></div></div>}
      {message&&<p role="status" className="w-full break-words text-xs text-slate-400">{message}</p>}
    </SeoCard>
    <Tabs defaultValue="issues" className="space-y-4"><TabsList className="bg-slate-900/70"><TabsTrigger value="issues">Issues ({issues.totalCount})</TabsTrigger><TabsTrigger value="pages">Pages ({pages.totalCount})</TabsTrigger><TabsTrigger value="performance">Performance ({lighthouse.length})</TabsTrigger></TabsList><TabsContent value="issues"><IssuesPanel projectId={projectId} state={issues} pending={pending} onPage={(page)=>load("issues",page)} loadAll={()=>loadAll("issues")}/></TabsContent><TabsContent value="pages"><PagesPanel projectId={projectId} state={pages} pending={pending} onPage={(page)=>load("pages",page)} loadAll={()=>loadAll("pages")}/></TabsContent><TabsContent value="performance"><PerformancePanel projectId={projectId} auditId={auditId} rows={lighthouse}/></TabsContent></Tabs>
  </div>;
}

function IssuesPanel({projectId,state,pending,onPage,loadAll}:{projectId:string;state:PageState<AuditIssueRow>;pending:boolean;onPage:(page:number)=>void;loadAll:()=>Promise<Array<Record<string,unknown>>>}) {
  if(!state.rows.length)return <StatePanel title="Nenhum issue encontrado" description="A auditoria não encontrou problemas ou ainda não finalizou esta fase."/>;
  return <SeoCard className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-4"><b className="text-sm text-white">Issues por severidade · página {state.page}</b><CompleteExportButtons projectId={projectId} kind="AUDIT_ISSUES" columns={ISSUE_COLUMNS} title="Alpha SEO — Audit Issues" totalCount={state.totalCount} loadRows={loadAll}/></div><div className="divide-y divide-white/[.04]">{state.rows.map((row)=><details key={row.id} className="group p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm"><span className="font-semibold text-white">{row.issueType}</span><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-300">{row.severity}</span></summary><p className="mt-3 break-all text-xs leading-5 text-slate-400">{row.pageUrl}</p>{row.details!=null&&<pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-3 text-xs text-slate-400">{JSON.stringify(row.details,null,2)}</pre>}</details>)}</div><PaginationControls page={state.page} pageSize={PAGE_SIZE} totalCount={state.totalCount} hasMore={state.hasMore} pending={pending} onPageChange={onPage}/></SeoCard>;
}

function PagesPanel({projectId,state,pending,onPage,loadAll}:{projectId:string;state:PageState<AuditPageRow>;pending:boolean;onPage:(page:number)=>void;loadAll:()=>Promise<Array<Record<string,unknown>>>}) {
  if(!state.rows.length)return <StatePanel title="Nenhuma página disponível" description="As páginas aparecem conforme o crawler persiste os resultados."/>;
  return <SeoCard className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-4"><b className="text-sm text-white">Páginas processadas · página {state.page}</b><CompleteExportButtons projectId={projectId} kind="AUDIT_PAGES" columns={PAGE_COLUMNS} title="Alpha SEO — Audit Pages" totalCount={state.totalCount} loadRows={loadAll}/></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-white/5 uppercase text-slate-500"><tr><th className="p-3">URL</th><th className="p-3">HTTP</th><th className="p-3">Título</th><th className="p-3">H1</th><th className="p-3">Palavras</th><th className="p-3">Imagens sem alt</th><th className="p-3">Tempo</th></tr></thead><tbody>{state.rows.map((row)=><tr key={row.id} className="border-b border-white/[.04]"><td className="max-w-md truncate p-3 font-mono text-white">{row.url}</td><td className="p-3 text-slate-300">{row.statusCode??"—"}</td><td className="max-w-xs truncate p-3 text-slate-300">{row.title??"—"}</td><td className="p-3 text-slate-300">{row.h1Count}</td><td className="p-3 text-slate-300">{row.wordCount}</td><td className="p-3 text-slate-300">{row.imagesMissingAlt}/{row.imagesTotal}</td><td className="p-3 text-slate-300">{row.responseTimeMs==null?"—":`${row.responseTimeMs} ms`}</td></tr>)}</tbody></table></div><PaginationControls page={state.page} pageSize={PAGE_SIZE} totalCount={state.totalCount} hasMore={state.hasMore} pending={pending} onPageChange={onPage}/></SeoCard>;
}

function PerformancePanel({projectId,auditId,rows}:{projectId:string;auditId:string;rows:LighthouseRow[]}) {
  if(!rows.length)return <StatePanel title="Sem resultados Lighthouse" description="Ative Lighthouse no lançamento da auditoria para obter métricas."/>;
  const exportRows=rows.map((row)=>({url:row.page.url,strategy:row.strategy,performance:row.performanceScore,accessibility:row.accessibilityScore,bestPractices:row.bestPracticesScore,seo:row.seoScore}));
  return <div className="space-y-4"><SeoCard className="flex items-center justify-between gap-3 p-4"><b className="text-sm text-white">Performance por página</b><ExportButtons projectId={projectId} kind="AUDIT_LIGHTHOUSE" rows={exportRows} columns={[{key:"url",label:"URL"},{key:"strategy",label:"Estratégia"},{key:"performance",label:"Performance"},{key:"accessibility",label:"Acessibilidade"},{key:"bestPractices",label:"Boas práticas"},{key:"seo",label:"SEO"}]} title="Alpha SEO — Audit Lighthouse"/></SeoCard><div className="grid gap-4 lg:grid-cols-2">{rows.map((row)=><Link key={row.id} href={`/PainelAlpha/AlphaSEO/${projectId}/audit/${auditId}/performance/${row.id}`}><SeoCard className="h-full p-4 transition hover:border-white/20"><p className="truncate text-sm font-semibold text-white">{row.page.url}</p><p className="mt-1 text-xs text-slate-500">{row.strategy}</p></SeoCard></Link>)}</div></div>;
}
