"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bot,
  CheckCircle2,
  CirclePlay,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquareText,
  Send,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import {
  AprovarFaseRoadmapProduction,
  ListarHistoricoRoadmapProduction,
  RegistrarEventoRoadmapProduction,
} from "@/actions/RoadmapProduction";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RoadmapCompletionReportDialog } from "@/components/RoadmapAlpha/RoadmapCompletionReportDialog";

export interface RoadmapProductionEventView {
  id: string;
  kind: string;
  fromStatus: string | null;
  toStatus: string | null;
  content: string | null;
  authorKind: string;
  authorLabel: string;
  createdAt: string;
}

export interface RoadmapImplementationRoomRun {
  id: string;
  status: string;
  assignee: string;
  objective: { id: string; code: string; title: string; completionReportAvailable?: boolean };
  artifact: { phaseNumber: number; title: string } | null;
}

interface RoadmapImplementationRoomProps {
  run: RoadmapImplementationRoomRun | null;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void> | void;
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function eventIcon(event: RoadmapProductionEventView) {
  if (event.kind === "QUESTION") return HelpCircle;
  if (event.kind === "STATUS_CHANGE") return CheckCircle2;
  return event.authorKind === "assistant" ? Bot : UserRound;
}

export function RoadmapImplementationRoom({
  run,
  canManage,
  open,
  onOpenChange,
  onChanged,
}: RoadmapImplementationRoomProps) {
  const [events, setEvents] = useState<RoadmapProductionEventView[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [reportOpen, setReportOpen] = useState(false);

  const loadEvents = useMemo(
    () => async (runId: string) => {
      setLoading(true);
      const result = await ListarHistoricoRoadmapProduction(runId);
      if (result.success) setEvents(result.data);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (open && run) void loadEvents(run.id);
      else setEvents([]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, run, loadEvents]);

  async function sendNote() {
    if (!run || !draft.trim()) return;
    startTransition(async () => {
      const result = await RegistrarEventoRoadmapProduction({
        runId: run.id,
        kind: "NOTE",
        content: draft,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      toast.success("Nota registrada");
      await loadEvents(run.id);
      await onChanged();
    });
  }

  async function approve() {
    if (!run) return;
    startTransition(async () => {
      const result = await AprovarFaseRoadmapProduction(run.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Fase aprovada");
      await loadEvents(run.id);
      await onChanged();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-white/10 bg-slate-950 p-0 text-slate-100 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-white/10 bg-slate-900/40 pr-14">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquareText className="size-5 text-violet-300" /> Fase de
            Produção
          </SheetTitle>
          <SheetDescription>
            {run
              ? `${run.objective.code} · ${run.objective.title}`
              : "Selecione uma fase."}
          </SheetDescription>
          {run && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-300">
                {STATUS_LABEL[run.status] ?? run.status}
              </span>
              <span className="rounded-full border border-violet-400/20 bg-violet-400/[.07] px-2.5 py-1 text-[10px] text-violet-300">
                {ASSIGNEE_LABEL[run.assignee] ?? run.assignee}
              </span>
              {run.artifact && (
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400">
                  Fase {String(run.artifact.phaseNumber).padStart(2, "0")} ·{" "}
                  {run.artifact.title}
                </span>
              )}
              {run.objective.completionReportAvailable && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto border-white/10 text-slate-300 hover:bg-white/10"
                  onClick={() => setReportOpen(true)}
                >
                  <FileText className="size-4" /> Ver relatório de conclusão
                </Button>
              )}
              {canManage && run.status === "AWAITING_APPROVAL" && (
                <Button
                  size="sm"
                  disabled={pending}
                  className={`bg-emerald-500 hover:bg-emerald-400 ${run.objective.completionReportAvailable ? "" : "ml-auto"}`}
                  onClick={() => void approve()}
                >
                  <CirclePlay className="size-4" /> Aprovar
                </Button>
              )}
            </div>
          )}
        </SheetHeader>

        <RoadmapCompletionReportDialog
          objectiveId={run?.objective.id ?? null}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
              <Loader2 className="animate-spin" size={14} /> Carregando…
            </div>
          )}
          {!loading && events.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              Ainda não há histórico nesta fase.
            </p>
          )}
          <div className="space-y-3">
            {events.map((event) => {
              const Icon = eventIcon(event);
              return (
                <article
                  key={event.id}
                  className={`rounded-2xl border p-3 ${
                    event.kind === "QUESTION"
                      ? "border-amber-400/25 bg-amber-400/[.06]"
                      : "border-white/10 bg-white/[.025]"
                  }`}
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                    <Icon className="size-3.5" />
                    {event.authorLabel}
                    {event.kind === "STATUS_CHANGE" && event.fromStatus && event.toStatus && (
                      <span>
                        · {STATUS_LABEL[event.fromStatus] ?? event.fromStatus} →{" "}
                        {STATUS_LABEL[event.toStatus] ?? event.toStatus}
                      </span>
                    )}
                    <time className="ml-auto normal-case tracking-normal">
                      {formatDate(event.createdAt)}
                    </time>
                  </div>
                  {event.content && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
                      {event.content}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        {canManage && run && (
          <footer className="border-t border-white/10 bg-slate-900/40 p-4 sm:p-5">
            <div className="flex items-end gap-2">
              <label htmlFor="room-note" className="sr-only">
                Registrar nota
              </label>
              <textarea
                id="room-note"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={4_000}
                rows={2}
                placeholder="Registre uma nota ou orientação para esta fase…"
                className="min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-slate-950 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && draft.trim()) {
                    event.preventDefault();
                    void sendNote();
                  }
                }}
              />
              <Button
                aria-label="Registrar nota"
                disabled={!draft.trim() || pending}
                onClick={() => void sendNote()}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Ctrl/⌘ + Enter para enviar. Nunca cole credenciais ou segredos.
            </p>
          </footer>
        )}
      </SheetContent>
    </Sheet>
  );
}
