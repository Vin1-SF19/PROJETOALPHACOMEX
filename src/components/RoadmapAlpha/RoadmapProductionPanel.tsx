"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Cpu,
  Loader2,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlternarAcessoRoadmapProduction,
  AprovarFaseRoadmapProduction,
  ListarAcessosRoadmapProduction,
  ObterRoadmapProduction,
} from "@/actions/RoadmapProduction";
import { Button } from "@/components/ui/button";
import { RoadmapImplementationRoom } from "@/components/RoadmapAlpha/RoadmapImplementationRoom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RunView {
  id: string;
  status: string;
  assignee: string;
  startedAt: string | null;
  finishedAt: string | null;
  resultSummary: string | null;
  errorCode: string | null;
  updatedAt: string;
  objective: {
    id: string;
    code: string;
    title: string;
    moduleKey: string;
    moduleLabelSnapshot: string;
    completionReportAvailable: boolean;
  };
  artifact: { phaseNumber: number; title: string; kind: string; relativePath: string | null } | null;
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
  AWAITING_APPROVAL: "Aguardando aprovação",
  IN_PROGRESS: "Em progresso",
  NEEDS_INPUT: "Aguardando resposta",
  BLOCKED: "Bloqueada",
  SUCCEEDED: "Concluída",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

const ASSIGNEE_LABEL: Record<string, string> = {
  claude: "Claude",
  codex: "Codex",
  manual: "Manual",
};

function statusClass(status: string): string {
  if (status === "SUCCEEDED")
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (status === "IN_PROGRESS")
    return "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";
  if (status === "AWAITING_APPROVAL")
    return "border-violet-400/20 bg-violet-400/10 text-violet-300";
  if (status === "NEEDS_INPUT")
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  if (status === "FAILED" || status === "BLOCKED")
    return "border-rose-400/20 bg-rose-400/10 text-rose-300";
  if (status === "CANCELLED")
    return "border-slate-400/20 bg-slate-400/10 text-slate-400";
  return "border-amber-400/20 bg-amber-400/10 text-amber-300";
}

export function RoadmapProductionPanel({
  canManage,
  moduleKey,
  moduleLabel,
  onBack,
}: {
  canManage: boolean;
  moduleKey: string;
  moduleLabel: string | null;
  onBack: () => void;
}) {
  const [queue, setQueue] = useState<RunView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [roomRunId, setRoomRunId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await ObterRoadmapProduction(moduleKey);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setQueue(result.queue);
    setError(null);
  }, [moduleKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 5_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const runs = useMemo(() => queue ?? [], [queue]);
  const inProgress = runs.filter((run) => run.status === "IN_PROGRESS").length;
  const succeeded = runs.filter((run) => run.status === "SUCCEEDED").length;
  const needsAttention = runs.filter((run) =>
    ["NEEDS_INPUT", "BLOCKED"].includes(run.status),
  ).length;

  const roomRun = useMemo(
    () => runs.find((run) => run.id === roomRunId) ?? null,
    [runs, roomRunId],
  );

  async function approve(run: RunView) {
    const result = await AprovarFaseRoadmapProduction(run.id);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Fase aprovada");
    await refresh();
  }

  if (error && !queue)
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
            <h1 className="font-semibold">Produção</h1>
            <p className="text-xs text-slate-400">
              {moduleLabel ?? moduleKey} · quadro de status das fases
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => setAccessOpen(true)}
            >
              <ShieldCheck size={16} /> Acessos
            </Button>
          )}
        </div>
      </header>

      <section className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-3">
        <Metric
          icon={Activity}
          label="Em progresso"
          value={String(inProgress)}
          active={inProgress > 0}
        />
        <Metric
          icon={Clock}
          label="Precisando de atenção"
          value={String(needsAttention)}
          active={needsAttention > 0}
        />
        <Metric
          icon={CheckCircle2}
          label="Concluídas"
          value={`${succeeded} / ${runs.length}`}
        />
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {queue === null && !error && (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
            <Loader2 className="animate-spin" size={14} /> Carregando…
          </div>
        )}
        {queue !== null && runs.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
            Nenhuma fase de produção registrada para {moduleLabel ?? moduleKey}{" "}
            ainda. Fases são criadas a partir de objetivos documentados
            (Claude/Codex, via chat).
          </p>
        )}
        <div className="space-y-2">
          {runs.map((run) => (
            <article
              key={run.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[.025]"
            >
              <div className="flex items-start gap-3 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-950 font-bold text-violet-300">
                  {run.artifact ? String(run.artifact.phaseNumber).padStart(2, "0") : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-500">
                    {run.objective.code}
                  </span>
                  <span className="mt-1 line-clamp-1 block text-sm font-medium">
                    {run.artifact?.title ?? run.objective.title}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[10px] ${statusClass(run.status)}`}
                    >
                      {STATUS_LABEL[run.status] ?? run.status}
                    </span>
                    <span className="inline-flex rounded-full border border-violet-400/20 bg-violet-400/[.07] px-2 py-1 text-[10px] text-violet-300">
                      {ASSIGNEE_LABEL[run.assignee] ?? run.assignee}
                    </span>
                    {run.errorCode && (
                      <span className="inline-flex rounded-full border border-rose-400/20 bg-rose-400/[.07] px-2 py-1 text-[10px] text-rose-300">
                        {run.errorCode}
                      </span>
                    )}
                  </div>
                  {run.resultSummary && (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                      {run.resultSummary}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {canManage && run.status === "AWAITING_APPROVAL" && (
                    <button
                      type="button"
                      onClick={() => void approve(run)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-400/[.06] px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-400/10"
                    >
                      <CheckCircle2 size={11} /> Aprovar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRoomRunId(run.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"
                  >
                    <MessageSquareText size={11} /> Detalhes
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {canManage && accessOpen && (
        <AccessDialog open onOpenChange={setAccessOpen} />
      )}
      <RoadmapImplementationRoom
        open={Boolean(roomRunId && roomRun)}
        onOpenChange={(open) => !open && setRoomRunId(null)}
        run={roomRun}
        canManage={canManage}
        onChanged={() => refresh()}
      />
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  active = false,
}: {
  icon: typeof Activity;
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
