"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  ArrowLeft,
  Bot,
  Bug,
  CheckCircle2,
  ChevronDown,
  Cpu,
  FileText,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlternarAcessoRoadmapProduction,
  ControlarExecucaoRoadmapProduction,
  ListarAcessosRoadmapProduction,
  MelhorarFeedbackRoadmapProduction,
  ObterRoadmapProduction,
  RelatarErroRoadmapProduction,
  RepetirExecucaoRoadmapProduction,
  SalvarConfiguracaoRoadmapProduction,
} from "@/actions/RoadmapProduction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProviderView {
  id: "ollama" | "codex" | "claude";
  label: string;
  available: boolean;
  ready: boolean;
  detail: string;
  models: string[];
}
interface AgentView {
  id: string;
  name: string;
  title: string;
  icon: string;
  description: string;
  skillPath: string;
  available: boolean;
}
interface ActivityView {
  at: string;
  agentId: string;
  type: "STATUS" | "TOOL" | "RESULT" | "ERROR";
  message: string;
}
interface PhaseView {
  phaseNumber: number;
  title: string;
  kind: string;
  requestedAgent: string;
  resolvedAgent: string;
  status: string;
  attemptCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  autoRetryCount: number;
  retryAt: string | null;
  summary: string | null;
  errorCode: string | null;
  changedFiles: string[];
  activities: ActivityView[];
  promptMarkdown: string;
  promptPath: string | null;
}
interface ExecutionView {
  id: string;
  objectiveCode: string;
  objectiveTitle: string;
  moduleKey: string;
  developmentProvider: "claude" | "codex";
  sourceVersion: number;
  globalPriority: number;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  completionReportPath: string | null;
  completionReportMarkdown: string | null;
  reworkCount: number;
  manualFeedback: Array<{
    id: string;
    reportedAt: string;
    content: string;
    improvedWithAi: boolean;
    resolvedAt: string | null;
  }>;
  phases: PhaseView[];
}
interface ProductionData {
  config: {
    version: 1;
    provider: "ollama" | "codex" | "claude";
    model: string;
    autoRun: boolean;
    maxToolSteps: number;
    updatedAt: string;
  };
  state: { updatedAt: string; executions: ExecutionView[] };
  agents: AgentView[];
  providers: ProviderView[];
}
interface AccessView {
  id: number;
  nome: string;
  usuario: string;
  role: string;
  status: string;
  imagemUrl: string | null;
  locked: boolean;
  hasAccess: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Na fila",
  RUNNING: "Executando",
  PAUSED: "Pausado",
  SUCCEEDED: "Concluído",
  FAILED: "Falhou",
  BLOCKED: "Bloqueado",
};

function statusClass(status: string): string {
  if (status === "SUCCEEDED")
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (status === "RUNNING")
    return "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";
  if (status === "PAUSED")
    return "border-slate-400/20 bg-slate-400/10 text-slate-300";
  if (status === "FAILED" || status === "BLOCKED")
    return "border-rose-400/20 bg-rose-400/10 text-rose-300";
  return "border-amber-400/20 bg-amber-400/10 text-amber-300";
}

function executionStatusLabel(execution: ExecutionView): string {
  if (
    execution.phases.some(
      (phase) => phase.status === "PENDING" && phase.retryAt,
    )
  )
    return "Correção automática";
  return STATUS_LABEL[execution.status] ?? execution.status;
}

export function RoadmapProductionPanel({
  canManage,
  onBack,
}: {
  canManage: boolean;
  onBack: () => void;
}) {
  const [data, setData] = useState<ProductionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [expandedExecutionId, setExpandedExecutionId] = useState<
    string | null | undefined
  >(undefined);
  const [feedbackTarget, setFeedbackTarget] = useState<ExecutionView | null>(
    null,
  );
  const polling = useRef(false);

  const refresh = useCallback(async (includeCatalog = false) => {
    if (polling.current || document.visibilityState === "hidden") return;
    polling.current = true;
    try {
      const result = await ObterRoadmapProduction(includeCatalog);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setData((current) => ({
        config: result.config,
        state: result.state,
        agents: result.agents.length ? result.agents : (current?.agents ?? []),
        providers: result.providers.length
          ? result.providers
          : (current?.providers ?? []),
      }));
      setError(null);
    } finally {
      polling.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh(true);
    const interval = window.setInterval(() => void refresh(false), 2_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const executions = useMemo(
    () => data?.state.executions ?? [],
    [data?.state.executions],
  );
  const activePhase = useMemo(
    () =>
      executions
        .flatMap((execution) =>
          execution.phases.map((phase) => ({ execution, phase })),
        )
        .find(({ phase }) => phase.status === "RUNNING") ?? null,
    [executions],
  );
  const promptItems = useMemo(
    () =>
      executions.flatMap((execution) => [
        ...execution.phases.map((phase) => ({
          id: `${execution.id}:${phase.phaseNumber}`,
          execution,
          phase,
          isReport: false as const,
          markdown: phase.promptMarkdown,
          path: phase.promptPath,
        })),
        ...(execution.completionReportMarkdown
          ? [
              {
                id: `${execution.id}:report`,
                execution,
                phase: null,
                isReport: true as const,
                markdown: execution.completionReportMarkdown,
                path: execution.completionReportPath,
              },
            ]
          : []),
      ]),
    [executions],
  );
  const selectedItem =
    promptItems.find((item) => item.id === selectedPrompt) ??
    promptItems.find((item) => item.phase?.status === "RUNNING") ??
    promptItems[0] ??
    null;
  const resolvedExpandedExecutionId =
    expandedExecutionId === undefined
      ? (activePhase?.execution.id ?? executions[0]?.id ?? null)
      : expandedExecutionId;

  async function controlExecution(
    execution: ExecutionView,
    control: "PAUSE" | "RESUME" | "EXCLUDE",
  ) {
    if (
      control === "EXCLUDE" &&
      !window.confirm(
        `Excluir ${execution.objectiveCode} r${String(execution.sourceVersion).padStart(4, "0")} da fila local?`,
      )
    )
      return;
    const result = await ControlarExecucaoRoadmapProduction(
      execution.id,
      control,
    );
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(
      control === "PAUSE"
        ? "Pausa solicitada"
        : control === "RESUME"
          ? "Execução retomada"
          : "Exclusão solicitada",
    );
    window.setTimeout(() => void refresh(false), 1_000);
  }

  if (error && !data)
    return (
      <div className="grid min-h-[680px] place-items-center rounded-2xl border border-rose-400/20 bg-[#07101f] text-rose-300">
        {error}
      </div>
    );

  return (
    <main className="relative flex h-[calc(100dvh-1rem)] min-h-[680px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#07101f] text-slate-100 shadow-2xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Voltar ao Roadmap"
          >
            <ArrowLeft size={18} />
          </Button>
          <span className="grid size-10 place-items-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-300">
            <Cpu size={20} />
          </span>
          <div>
            <h1 className="font-semibold">Produção local</h1>
            <p className="text-xs text-slate-400">
              Bibble Squad executando o Roadmap no working tree
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`hidden rounded-full border px-3 py-1 text-xs sm:inline-flex ${data?.config.autoRun ? "border-emerald-400/20 text-emerald-300" : "border-amber-400/20 text-amber-300"}`}
          >
            {data?.config.autoRun ? "Automação ativa" : "Automação pausada"}
          </span>
          <Button
            variant="outline"
            className="border-white/10"
            onClick={() => setAgentsOpen(true)}
          >
            <Users size={16} /> Agentes
          </Button>
          {canManage && (
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => setAccessOpen(true)}
            >
              <ShieldCheck size={16} /> Acessos
            </Button>
          )}
          {canManage && (
            <Button
              className="bg-violet-500 hover:bg-violet-400"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={16} /> Configurar IA
            </Button>
          )}
        </div>
      </header>

      <section className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-4">
        <Metric
          icon={Bot}
          label="Provedor"
          value={
            data
              ? (data.providers.find(
                  (provider) => provider.id === data.config.provider,
                )?.label ?? data.config.provider)
              : "Carregando"
          }
        />
        <Metric
          icon={Users}
          label="Agentes disponíveis"
          value={String(
            data?.agents.filter((agent) => agent.available).length ?? 0,
          )}
        />
        <Metric
          icon={Activity}
          label="Atividade atual"
          value={
            activePhase
              ? `${activePhase.phase.resolvedAgent} · fase ${activePhase.phase.phaseNumber}`
              : "Aguardando"
          }
          active={Boolean(activePhase)}
        />
        <Metric
          icon={CheckCircle2}
          label="Execuções concluídas"
          value={`${executions.filter((item) => item.status === "SUCCEEDED").length} / ${executions.length}`}
        />
      </section>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[460px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-white/10 p-3">
          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">
            Prompts por prioridade global
          </p>
          <div className="space-y-3">
            {!executions.length && (
              <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                Nenhum prompt aguardando produção.
              </p>
            )}
            {executions.map((execution) => (
              <article
                key={execution.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[.025]"
              >
                <div className="flex items-start gap-2 border-b border-white/10 p-3">
                  <button
                    type="button"
                    aria-expanded={resolvedExpandedExecutionId === execution.id}
                    aria-controls={`production-prompts-${execution.id}`}
                    onClick={() =>
                      setExpandedExecutionId(
                        resolvedExpandedExecutionId === execution.id
                          ? null
                          : execution.id,
                      )
                    }
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-950 font-bold text-violet-300">
                      {execution.globalPriority}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                        {execution.objectiveCode} · r
                        {String(execution.sourceVersion).padStart(4, "0")}
                      </span>
                      <span className="mt-1 line-clamp-1 block text-sm font-medium">
                        {execution.objectiveTitle}
                      </span>
                      <span
                        className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] ${statusClass(execution.status)}`}
                      >
                        {executionStatusLabel(execution)}
                      </span>
                      <span className="ml-1 mt-2 inline-flex rounded-full border border-violet-400/20 bg-violet-400/[.07] px-2 py-1 text-[10px] text-violet-300">
                        {execution.developmentProvider === "claude"
                          ? "Claude → Codex"
                          : "Codex → Claude"}
                      </span>
                      {execution.reworkCount > 0 && (
                        <span className="ml-1 mt-2 inline-flex rounded-full border border-amber-400/20 bg-amber-400/[.07] px-2 py-1 text-[10px] text-amber-300">
                          Objetivo refeito {execution.reworkCount}{" "}
                          {execution.reworkCount === 1 ? "vez" : "vezes"}
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`mt-2 shrink-0 text-slate-500 transition-transform ${resolvedExpandedExecutionId === execution.id ? "rotate-180 text-cyan-300" : ""}`}
                    />
                  </button>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setFeedbackTarget(execution)}
                        className="mr-1 inline-flex items-center gap-1 rounded-md border border-rose-400/20 bg-rose-400/[.06] px-2 py-1 text-[10px] font-medium text-rose-300 hover:bg-rose-400/10"
                      >
                        <Bug size={11} /> Relatar erro
                      </button>
                    )}
                    {canManage &&
                      ["FAILED", "BLOCKED"].includes(execution.status) && (
                        <button
                          type="button"
                          title="Tentar novamente"
                          onClick={async () => {
                            const result =
                              await RepetirExecucaoRoadmapProduction(
                                execution.id,
                              );
                            if (result.success)
                              toast.success("Execução reenfileirada");
                            else toast.error(result.error);
                            await refresh(false);
                          }}
                          className="rounded p-1 text-amber-300 hover:bg-amber-400/10"
                        >
                          <RefreshCw size={13} />
                        </button>
                      )}
                    {canManage && execution.status === "PAUSED" && (
                      <button
                        type="button"
                        title="Retomar"
                        onClick={() =>
                          void controlExecution(execution, "RESUME")
                        }
                        className="rounded p-1 text-emerald-300 hover:bg-emerald-400/10"
                      >
                        <PlayCircle size={14} />
                      </button>
                    )}
                    {canManage &&
                      ["PENDING", "RUNNING"].includes(execution.status) && (
                        <button
                          type="button"
                          title="Pausar"
                          onClick={() =>
                            void controlExecution(execution, "PAUSE")
                          }
                          className="rounded p-1 text-slate-300 hover:bg-white/10"
                        >
                          <PauseCircle size={14} />
                        </button>
                      )}
                    {canManage && (
                      <button
                        type="button"
                        title="Excluir da fila local"
                        onClick={() =>
                          void controlExecution(execution, "EXCLUDE")
                        }
                        className="rounded p-1 text-rose-300 hover:bg-rose-400/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {resolvedExpandedExecutionId === execution.id && (
                  <div
                    id={`production-prompts-${execution.id}`}
                    className="animate-in slide-in-from-top-1 p-2 duration-200"
                  >
                    {execution.phases.map((phase) => {
                      const itemId = `${execution.id}:${phase.phaseNumber}`;
                      const latest = phase.activities.at(-1)?.message;
                      return (
                        <div
                          key={itemId}
                          className={`mb-1 rounded-lg border transition ${selectedItem?.id === itemId ? "border-cyan-400/30 bg-cyan-400/[.08]" : "border-transparent hover:bg-white/5"}`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedPrompt(itemId)}
                            className="flex w-full items-start gap-3 px-3 py-2 text-left"
                          >
                            <span
                              className={`mt-1 size-2 shrink-0 rounded-full ${phase.status === "RUNNING" ? "animate-pulse bg-cyan-400" : phase.status === "SUCCEEDED" ? "bg-emerald-400" : phase.status === "BLOCKED" || phase.status === "FAILED" ? "bg-rose-400" : "bg-slate-600"}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[10px] text-slate-500">
                                Prompt{" "}
                                {String(phase.phaseNumber).padStart(2, "0")} · @
                                {phase.resolvedAgent}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-200">
                                {phase.title}
                              </span>
                              {phase.status === "RUNNING" && (
                                <span className="mt-1 line-clamp-1 block text-[10px] text-cyan-300">
                                  Em desenvolvimento · {latest ?? "Iniciando"}
                                </span>
                              )}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-1 text-[9px] ${statusClass(phase.status)}`}
                            >
                              {STATUS_LABEL[phase.status] ?? phase.status}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                    {execution.completionReportMarkdown && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPrompt(`${execution.id}:report`)
                        }
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${selectedItem?.id === `${execution.id}:report` ? "border-emerald-400/30 bg-emerald-400/[.08]" : "border-transparent hover:bg-white/5"}`}
                      >
                        <FileText size={14} className="text-emerald-300" />
                        <span className="text-xs text-emerald-200">
                          Relatório final de conclusão
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-[#081321]">
          {!selectedItem ? (
            <div className="grid h-full place-items-center text-slate-500">
              Selecione um prompt.
            </div>
          ) : (
            <>
              <header className="border-b border-white/10 px-6 py-4">
                <p className="text-xs text-violet-300">
                  {selectedItem.execution.objectiveCode} ·{" "}
                  {selectedItem.execution.moduleKey}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {selectedItem.isReport
                    ? "Relatório final de conclusão"
                    : selectedItem.phase?.title}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                  {!selectedItem.isReport && selectedItem.phase && (
                    <>
                      <span className="rounded bg-white/5 px-2 py-1">
                        @{selectedItem.phase.resolvedAgent}
                      </span>
                      <span
                        className={`rounded border px-2 py-1 ${statusClass(selectedItem.phase.status)}`}
                      >
                        {STATUS_LABEL[selectedItem.phase.status] ??
                          selectedItem.phase.status}
                      </span>
                    </>
                  )}
                  {selectedItem.path && (
                    <code className="break-all rounded bg-white/5 px-2 py-1">
                      {selectedItem.path}
                    </code>
                  )}
                </div>
                {selectedItem.phase?.activities.at(-1) && (
                  <p className="mt-3 rounded-lg bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                    {selectedItem.phase.activities.at(-1)?.message}
                  </p>
                )}
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7">
                {selectedItem.execution.manualFeedback.length > 0 && (
                  <section className="mx-auto mb-6 max-w-5xl rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                      Feedback do administrador
                    </p>
                    <div className="mt-3 space-y-3">
                      {selectedItem.execution.manualFeedback.map((feedback) => (
                        <div
                          key={feedback.id}
                          className="rounded-lg bg-slate-950/50 p-3 text-xs leading-5 text-slate-300"
                        >
                          <p className="whitespace-pre-wrap">
                            {feedback.content}
                          </p>
                          <p className="mt-2 text-[10px] text-slate-500">
                            {new Date(feedback.reportedAt).toLocaleString(
                              "pt-BR",
                            )}{" "}
                            ·{" "}
                            {feedback.improvedWithAi
                              ? "melhorado com IA"
                              : "texto original"}{" "}
                            ·{" "}
                            {feedback.resolvedAt
                              ? "correção concluída"
                              : "aguardando correção"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <article className="prose prose-invert prose-slate mx-auto max-w-5xl prose-a:text-cyan-400 prose-pre:border prose-pre:border-white/10 prose-pre:bg-slate-950">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                    {selectedItem.markdown || "Prompt ainda não disponível."}
                  </ReactMarkdown>
                </article>
              </div>
            </>
          )}
        </section>
      </div>

      <AgentDrawer
        open={agentsOpen}
        onClose={() => setAgentsOpen(false)}
        agents={data?.agents ?? []}
        active={activePhase}
      />
      {canManage && data && settingsOpen && (
        <SettingsDialog
          open
          onOpenChange={setSettingsOpen}
          data={data}
          onSaved={() => refresh(true)}
        />
      )}
      {canManage && accessOpen && (
        <AccessDialog open onOpenChange={setAccessOpen} />
      )}
      {canManage && feedbackTarget && (
        <FeedbackDialog
          target={feedbackTarget}
          onClose={() => setFeedbackTarget(null)}
          onSubmitted={async () => {
            setFeedbackTarget(null);
            await refresh(false);
          }}
        />
      )}
    </main>
  );
}

function FeedbackDialog({
  target,
  onClose,
  onSubmitted,
}: {
  target: ExecutionView;
  onClose: () => void;
  onSubmitted: () => Promise<void> | void;
}) {
  const [feedback, setFeedback] = useState("");
  const [improvedWithAi, setImprovedWithAi] = useState(false);
  const [improving, startImproving] = useTransition();
  const [submitting, startSubmitting] = useTransition();
  const valid = feedback.trim().length >= 5;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-white/10 bg-[#0b1524] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Relatar erro na implementação</DialogTitle>
          <DialogDescription>
            Objetivo {target.objectiveCode} · {target.objectiveTitle}. Descreva
            o que ficou ruim na implementação completa e o resultado esperado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <textarea
            autoFocus
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            maxLength={4_000}
            rows={9}
            placeholder="Ex.: O card ainda quebra no celular. Ele deve manter os botões visíveis em 320 px e permitir rolagem apenas no conteúdo."
            className="w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-rose-400/30"
          />
          <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500">
            <span>{feedback.length} / 4000</span>
            {improvedWithAi && (
              <span className="inline-flex items-center gap-1 text-violet-300">
                <Sparkles size={11} /> Texto melhorado pelo Qwen 3.8
              </span>
            )}
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[.05] p-3 text-xs leading-5 text-amber-100/80">
            Este prompt e todas as fases posteriores serão reenfileirados. O
            agente receberá seu relato como requisito obrigatório, e o novo
            relatório final registrará o retrabalho.
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="border-violet-400/20 text-violet-300"
              disabled={!valid || improving || submitting}
              onClick={() =>
                startImproving(async () => {
                  const result = await MelhorarFeedbackRoadmapProduction({
                    executionId: target.id,
                    feedback,
                  });
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  setFeedback(result.improved);
                  setImprovedWithAi(true);
                  toast.success("Relato melhorado pelo Qwen 3.8");
                })
              }
            >
              {improving ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Sparkles size={14} />
              )}
              Melhorar com IA
            </Button>
            <Button
              className="bg-rose-500 hover:bg-rose-400"
              disabled={!valid || improving || submitting}
              onClick={() =>
                startSubmitting(async () => {
                  const result = await RelatarErroRoadmapProduction({
                    executionId: target.id,
                    feedback,
                    improvedWithAi,
                  });
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(
                    "Erro registrado; prompt reenfileirado para correção",
                  );
                  await onSubmitted();
                })
              }
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Send size={14} />
              )}
              Refazer com este feedback
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  active = false,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.025] p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon
          size={14}
          className={active ? "animate-pulse text-cyan-300" : "text-violet-300"}
        />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function AgentDrawer({
  open,
  onClose,
  agents,
  active,
}: {
  open: boolean;
  onClose: () => void;
  agents: AgentView[];
  active: { execution: ExecutionView; phase: PhaseView } | null;
}) {
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-50 flex justify-end bg-black/55"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0a1423] p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Agentes Bibble</h2>
            <p className="text-xs text-slate-500">
              Skills instalados no projeto local
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        {active && (
          <div className="mb-4 rounded-xl border border-cyan-400/25 bg-cyan-400/[.07] p-3">
            <p className="text-[10px] uppercase tracking-wider text-cyan-300">
              Trabalhando agora
            </p>
            <p className="mt-1 font-medium">{active.phase.resolvedAgent}</p>
            <p className="mt-1 text-xs text-slate-400">
              {active.execution.objectiveCode} · {active.phase.title}
            </p>
            <p className="mt-2 text-xs text-slate-300">
              {active.phase.activities.at(-1)?.message ?? "Iniciando fase"}
            </p>
          </div>
        )}
        <div className="space-y-2">
          {agents.map((agent) => {
            const isActive = active?.phase.resolvedAgent === agent.id;
            return (
              <div
                key={agent.id}
                className={`rounded-xl border p-3 ${isActive ? "border-cyan-400/30 bg-cyan-400/[.06]" : "border-white/10 bg-white/[.02]"}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{agent.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{agent.name}</p>
                      {isActive && (
                        <span className="size-2 animate-pulse rounded-full bg-cyan-400" />
                      )}
                    </div>
                    <p className="text-xs text-violet-300">{agent.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {agent.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
  data,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ProductionData;
  onSaved: () => Promise<void> | void;
}) {
  const [provider, setProvider] = useState<"codex" | "claude">(
    data.config.provider === "codex" ? "codex" : "claude",
  );
  const [model, setModel] = useState(
    data.config.provider === "codex" || data.config.provider === "claude"
      ? data.config.model
      : "default",
  );
  const [autoRun, setAutoRun] = useState(data.config.autoRun);
  const [maxToolSteps, setMaxToolSteps] = useState(data.config.maxToolSteps);
  const [pending, startTransition] = useTransition();
  const developmentProviders = data.providers.filter(
    (item) => item.id !== "ollama",
  );
  const selectedProvider = data.providers.find((item) => item.id === provider);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0b1524] text-slate-100">
        <DialogHeader>
          <DialogTitle>Configurar motor de IA</DialogTitle>
          <DialogDescription>
            Qwen 3.8 permanece exclusivo para documentação e melhoria dos
            prompts. Claude e Codex executam o desenvolvimento com os agentes
            Bibble, sem commit automático.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {developmentProviders.map((item) => (
              <button
                key={item.id}
                disabled={!item.ready}
                onClick={() => {
                  setProvider(item.id);
                  setModel(item.models[0] ?? "");
                }}
                className={`rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-45 ${provider === item.id ? "border-violet-400/40 bg-violet-400/10" : "border-white/10"}`}
              >
                <p className="text-sm font-medium">{item.label}</p>
                <p className="mt-1 text-[10px] text-slate-500">{item.detail}</p>
              </button>
            ))}
          </div>
          <p className="rounded-lg border border-cyan-400/15 bg-cyan-400/[.05] px-3 py-2 text-[11px] text-cyan-200/80">
            Ordem padrão: Claude primeiro, Codex como fallback automático. A
            escolha feita em cada objetivo prevalece sobre esta preferência.
          </p>
          <label className="block text-xs text-slate-400">
            Modelo
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm"
            >
              {selectedProvider?.models.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between rounded-xl border border-white/10 p-3">
            <span>
              <span className="block text-sm">Execução automática</span>
              <span className="text-xs text-slate-500">
                O worker recebe as próximas fases da fila.
              </span>
            </span>
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(event) => setAutoRun(event.target.checked)}
              className="size-5 accent-violet-500"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Limite de tools por fase: {maxToolSteps}
            <input
              type="range"
              min={4}
              max={40}
              value={maxToolSteps}
              onChange={(event) => setMaxToolSteps(Number(event.target.value))}
              className="mt-2 w-full accent-violet-500"
            />
          </label>
          <div className="flex justify-end">
            <Button
              disabled={pending || !selectedProvider?.ready || !model}
              onClick={() =>
                startTransition(async () => {
                  const result = await SalvarConfiguracaoRoadmapProduction({
                    provider,
                    model,
                    autoRun,
                    maxToolSteps,
                  });
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(
                    autoRun ? "Automação configurada" : "Automação pausada",
                  );
                  onOpenChange(false);
                  await onSaved();
                })
              }
            >
              {pending ? (
                <Loader2 className="animate-spin" size={15} />
              ) : autoRun ? (
                <PlayCircle size={15} />
              ) : (
                <PauseCircle size={15} />
              )}{" "}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccessDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [users, setUsers] = useState<AccessView[]>([]);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const load = useCallback(async () => {
    const result = await ListarAcessosRoadmapProduction();
    if (result.success) setUsers(result.data);
    else toast.error(result.error);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto border-white/10 bg-[#0b1524] text-slate-100">
        <DialogHeader>
          <DialogTitle>Acesso à Produção</DialogTitle>
          <DialogDescription>
            Admin, CEO e TI têm acesso permanente. Conceda acesso individual aos
            demais usuários ativos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
            >
              <div>
                <p className="text-sm font-medium">{user.nome}</p>
                <p className="text-xs text-slate-500">
                  {user.usuario} · {user.role}
                  {user.status !== "ATIVO" ? " · inativo" : ""}
                </p>
              </div>
              <button
                disabled={
                  user.locked ||
                  user.status !== "ATIVO" ||
                  pendingId === user.id
                }
                onClick={async () => {
                  setPendingId(user.id);
                  const result = await AlternarAcessoRoadmapProduction(user.id);
                  if (!result.success) toast.error(result.error);
                  else await load();
                  setPendingId(null);
                }}
                className={`rounded-full border px-3 py-1 text-xs disabled:opacity-60 ${user.hasAccess ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-slate-500"}`}
              >
                {pendingId === user.id
                  ? "Salvando..."
                  : user.locked
                    ? "Administrativo"
                    : user.hasAccess
                      ? "Permitido"
                      : "Sem acesso"}
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
