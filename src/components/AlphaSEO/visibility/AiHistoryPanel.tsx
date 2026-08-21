import { Clock3, Sparkles } from "lucide-react";
import { ExportButtons } from "../shared/ExportButtons";
import { SeoCard, StatePanel } from "../shared/PageHeader";

interface ProviderResult {
  id: string;
  provider: string;
  status: string;
  errorCode: string | null;
  result: unknown;
  durationMs: number | null;
  actualMicrosUsd: number | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function answerFrom(value: unknown) {
  const answer = record(value)?.answer;
  return typeof answer === "string" ? answer : "";
}

function citationsFrom(value: unknown) {
  const citations = record(value)?.citations;
  return (Array.isArray(citations) ? citations : []).filter((citation): citation is string => {
    if (typeof citation !== "string") return false;
    try { return ["http:", "https:"].includes(new URL(citation).protocol); }
    catch { return false; }
  });
}

interface AiRun {
  id: string;
  kind: string;
  query: string;
  status: string;
  createdAt: string | Date;
  completedAt: string | Date | null;
  providerResults: ProviderResult[];
}

export function AiHistoryPanel({ projectId, kind, rows }: { projectId: string; kind: "BRAND_LOOKUP" | "PROMPT_EXPLORER"; rows: AiRun[] }) {
  if (!rows.length) {
    return <StatePanel title="Sem execuções anteriores" description="As próximas respostas ficam registradas como execuções imutáveis, inclusive quando um provedor falhar." />;
  }
  const exportRows = rows.flatMap((row) => row.providerResults.map((provider) => ({
    query: row.query,
    runStatus: row.status,
    provider: provider.provider,
    providerStatus: provider.status,
    answer: answerFrom(provider.result),
    citations: citationsFrom(provider.result).join(" | "),
    durationMs: provider.durationMs,
    actualMicrosUsd: provider.actualMicrosUsd,
    errorCode: provider.errorCode,
    createdAt: new Date(row.createdAt).toISOString(),
  })));
  return (
    <SeoCard className="mt-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2"><Clock3 size={15} className="text-[rgb(var(--seo-accent))]" aria-hidden="true" /><h2 className="font-bold text-white">Histórico recente</h2></div>
        <ExportButtons projectId={projectId} kind={kind} rows={exportRows} columns={[{ key: "query", label: "Consulta" }, { key: "runStatus", label: "Status da execução" }, { key: "provider", label: "Provedor" }, { key: "providerStatus", label: "Status do provedor" }, { key: "answer", label: "Resposta persistida" }, { key: "citations", label: "Citações" }, { key: "durationMs", label: "Duração (ms)" }, { key: "actualMicrosUsd", label: "Custo (micros USD)" }, { key: "errorCode", label: "Erro" }, { key: "createdAt", label: "Criado em" }]} title={`Alpha SEO — ${kind === "BRAND_LOOKUP" ? "Brand Lookup" : "Prompt Explorer"}`} />
      </div>
      <div className="divide-y divide-white/[.04]">
        {rows.map((row) => (
          <article key={row.id} className="px-5 py-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="shrink-0 text-[rgb(var(--seo-accent))]" aria-hidden="true" />
                <p className="truncate text-sm font-semibold text-white">{row.query}</p>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {new Date(row.createdAt).toLocaleString("pt-BR")} · {row.kind}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">
                {row.status}
              </span>
              {row.providerResults.map((provider) => (
                <span key={provider.id} title={provider.errorCode ?? undefined} className="rounded-full bg-white/[.04] px-2 py-1 text-[10px] text-slate-400">
                  {provider.provider}: {provider.status}
                </span>
              ))}
            </div>
            </div>
            <div className="mt-3 space-y-2">
              {row.providerResults.map((provider) => {
                const answer = answerFrom(provider.result);
                const citations = citationsFrom(provider.result);
                return <details key={`${provider.id}:content`} className="rounded-xl border border-white/5 bg-white/[.02] p-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-300">Reabrir resposta de {provider.provider}</summary>
                  {answer ? <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950/70 p-4 font-sans text-xs leading-5 text-slate-300">{answer}</pre> : <p className="mt-3 text-xs text-slate-500">Nenhuma resposta foi persistida para este provedor{provider.errorCode ? ` · ${provider.errorCode}` : "."}</p>}
                  {citations.length > 0 && <ul aria-label={`Citações de ${provider.provider}`} className="mt-3 space-y-2">{citations.map((citation) => <li key={citation}><a href={citation} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-[rgb(var(--seo-accent))] underline-offset-4 hover:underline">{citation}</a></li>)}</ul>}
                </details>;
              })}
            </div>
          </article>
        ))}
      </div>
    </SeoCard>
  );
}
