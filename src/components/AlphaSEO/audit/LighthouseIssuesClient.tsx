"use client";

import { useState, useTransition } from "react";
import { Download, FileSearch, RefreshCw } from "lucide-react";
import {
  ExportarIssuesLighthouseAlphaSeo,
  ObterIssuesLighthouseAlphaSeo,
} from "@/actions/AlphaSeoAudit";
import { SeoCard, StatePanel } from "../shared/PageHeader";

type RecordValue = Record<string, unknown>;
type LighthouseIssue = {
  category: string;
  auditKey: string;
  title: string;
  description: string;
  score: number | null;
  displayValue: string | null;
  impactMs: number | null;
  impactBytes: number | null;
  severity: string;
  items: string[];
};

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function issuesFrom(value: unknown): LighthouseIssue[] {
  const rows = record(value)?.issues;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((value) => {
    const row = record(value);
    if (!row || typeof row.auditKey !== "string" || typeof row.title !== "string") return [];
    return [{
      category: String(row.category ?? ""),
      auditKey: row.auditKey,
      title: row.title,
      description: String(row.description ?? ""),
      score: typeof row.score === "number" ? row.score : null,
      displayValue: typeof row.displayValue === "string" ? row.displayValue : null,
      impactMs: typeof row.impactMs === "number" ? row.impactMs : null,
      impactBytes: typeof row.impactBytes === "number" ? row.impactBytes : null,
      severity: String(row.severity ?? "info"),
      items: Array.isArray(row.items) ? row.items.filter((item): item is string => typeof item === "string") : [],
    }];
  });
}

function download(value: unknown) {
  const file = record(value);
  if (!file || typeof file.content !== "string" || typeof file.filename !== "string") return false;
  const blob = new Blob([file.content], { type: typeof file.contentType === "string" ? file.contentType : "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export function LighthouseIssuesClient({ projectId, resultId }: { projectId: string; resultId: string }) {
  const [report, setReport] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const issues = issuesFrom(report);

  function load() {
    start(async () => {
      const result = await ObterIssuesLighthouseAlphaSeo({ projectId, resultId });
      if (!result.success) return setMessage(result.error);
      setReport(result.data);
      setMessage("Diagnóstico Lighthouse carregado do payload persistido.");
    });
  }

  function exportReport(mode: "full" | "issues") {
    start(async () => {
      const result = await ExportarIssuesLighthouseAlphaSeo({ projectId, resultId, mode });
      if (!result.success) return setMessage(result.error);
      setMessage(download(result.data) ? "Arquivo Lighthouse exportado." : "Não foi possível preparar o arquivo.");
    });
  }

  return <SeoCard className="mt-5 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 font-bold text-white"><FileSearch size={16}/>Diagnóstico completo</h2><p className="mt-1 text-xs text-slate-500">O payload bruto permanece no storage; esta tela expõe apenas métricas e oportunidades normalizadas.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={load} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><RefreshCw size={13}/>Carregar issues</button>
        <button type="button" onClick={() => exportReport("issues")} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><Download size={13}/>Issues JSON</button>
        <button type="button" onClick={() => exportReport("full")} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold"><Download size={13}/>Payload JSON</button>
      </div>
    </div>
    {report != null && !issues.length && <StatePanel title="Nenhuma oportunidade Lighthouse" description="O relatório foi lido, mas não há auditorias com score abaixo do limiar configurado."/>}
    {issues.length > 0 && <div className="mt-4 divide-y divide-white/[.05] rounded-xl border border-white/5">{issues.map((issue) => <details key={`${issue.category}:${issue.auditKey}`} className="p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm"><span className="font-semibold text-white">{issue.title}</span><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-300">{issue.category} · {issue.score ?? "—"}</span></summary><p className="mt-3 text-xs leading-5 text-slate-400">{issue.description}</p><p className="mt-2 text-[10px] text-slate-500">{issue.severity} · {issue.displayValue ?? "sem valor exibido"} · {issue.impactMs ?? 0} ms · {issue.impactBytes ?? 0} bytes</p>{issue.items.length > 0 && <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-3 text-xs text-slate-400">{issue.items.join("\n")}</pre>}</details>)}</div>}
    {message && <p role="status" className="mt-4 text-xs text-slate-400">{message}</p>}
  </SeoCard>;
}
