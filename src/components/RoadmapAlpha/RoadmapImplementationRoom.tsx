"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Bot, CheckCircle2, CirclePause, CirclePlay, FileCode2, Loader2, MessageSquareText, Send, ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";

import {
  EnviarMensagemRoadmapProduction,
  ResponderIntervencaoRoadmapProduction,
  TrocarAgenteFaseRoadmapProduction,
} from "@/actions/RoadmapProduction";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  ProductionActivity,
  ProductionIntervention,
  ProductionMessage,
} from "@/lib/roadmap-production/contracts";

interface Phase {
  phaseNumber: number;
  title: string;
  requestedAgent: string;
  resolvedAgent: string;
  status: string;
  summary: string | null;
  errorCode: string | null;
  changedFiles: string[];
  activities: ProductionActivity[];
}

export interface RoadmapImplementationRoomExecution {
  id: string;
  objectiveCode: string;
  objectiveTitle: string;
  status: string;
  phases: Phase[];
  messages: ProductionMessage[];
  interventions: ProductionIntervention[];
}

interface AgentOption {
  id: string;
  name: string;
  available: boolean;
}

interface RoadmapImplementationRoomProps {
  execution: RoadmapImplementationRoomExecution | null;
  agents: AgentOption[];
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onControl: (control: "PAUSE" | "RESUME") => Promise<void> | void;
  onChanged: () => Promise<void> | void;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Na fila",
  RUNNING: "Executando",
  NEEDS_INPUT: "Aguardando resposta",
  SUCCEEDED: "Concluída",
  FAILED: "Falhou",
  BLOCKED: "Bloqueada",
};

const FORBIDDEN_CATEGORIES = new Set(["DATABASE", "DESTRUCTIVE", "GIT_REMOTE"]);

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function phaseLabel(phase: Phase): string {
  return `${String(phase.phaseNumber).padStart(2, "0")} · ${phase.title}`;
}

export function RoadmapImplementationRoom({
  execution,
  agents,
  canManage,
  open,
  onOpenChange,
  onControl,
  onChanged,
}: RoadmapImplementationRoomProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [selectedPhase, setSelectedPhase] = useState<number | "ALL">("ALL");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [agentDrafts, setAgentDrafts] = useState<Record<string, string>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const phases = useMemo(() => execution?.phases ?? [], [execution?.phases]);
  const activeFilter =
    selectedPhase === "ALL" || phases.some((phase) => phase.phaseNumber === selectedPhase)
      ? selectedPhase
      : "ALL";
  const timeline = useMemo(() => {
    const messages = (execution?.messages ?? []).map((message) => ({ type: "MESSAGE" as const, at: message.createdAt, message }));
    const activities = phases.flatMap((phase) => phase.activities.map((activity) => ({ type: "ACTIVITY" as const, at: activity.at, phaseNumber: phase.phaseNumber, activity })));
    return [...messages, ...activities]
      .filter((item) => activeFilter === "ALL" || (item.type === "MESSAGE" ? item.message.phaseNumber : item.phaseNumber) === activeFilter)
      .sort((a, b) => a.at.localeCompare(b.at));
  }, [activeFilter, execution?.messages, phases]);
  const filteredInterventions = (execution?.interventions ?? []).filter(
    (item) => activeFilter === "ALL" || item.phaseNumber === activeFilter,
  );
  const pendingInterventions = filteredInterventions.filter((item) => item.status === "PENDING");
  const composerPhase = phases.find(
    (phase) =>
      (activeFilter === "ALL" || phase.phaseNumber === activeFilter) &&
      ["RUNNING", "NEEDS_INPUT", "PENDING", "BLOCKED"].includes(phase.status),
  );
  const draftKey = execution && composerPhase ? `${execution.id}:${composerPhase.phaseNumber}` : "none";
  const messageDraft = drafts[draftKey] ?? "";

  function runAction(key: string, action: () => Promise<{ success: boolean; error?: string }>) {
    if (pendingKey) return;
    setPendingKey(key);
    startTransition(async () => {
      const result = await action();
      setPendingKey(null);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível concluir a ação");
        return;
      }
      toast.success("Solicitação registrada");
      await onChanged();
    });
  }

  function answer(intervention: ProductionIntervention, decision: "ANSWER" | "AUTHORIZE" | "DENY") {
    if (!execution) return;
    const content = drafts[intervention.requestId]?.trim();
    if (decision === "ANSWER" && !content) return;
    runAction(`intervention:${intervention.requestId}`, () =>
      ResponderIntervencaoRoadmapProduction({
        executionId: execution.id,
        phaseNumber: intervention.phaseNumber,
        requestId: intervention.requestId,
        decision,
        content,
      }),
    );
  }

  async function control(control: "PAUSE" | "RESUME") {
    if (pendingKey) return;
    setPendingKey(`control:${control}`);
    await onControl(control);
    setPendingKey(null);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-white/10 bg-slate-950 p-0 text-slate-100 sm:max-w-3xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <SheetHeader className="border-b border-white/10 bg-slate-900/40 pr-14">
          <SheetTitle ref={titleRef} tabIndex={-1} className="flex items-center gap-2 outline-none">
            <MessageSquareText className="size-5 text-violet-300" /> Sala de Implementação
          </SheetTitle>
          <SheetDescription>
            {execution ? `${execution.objectiveCode} · ${execution.objectiveTitle}` : "Selecione uma execução."}
          </SheetDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-300">
              {execution?.status === "WAITING_FOR_ADMIN" ? "Aguardando administrador" : execution?.status}
            </span>
            {pendingInterventions.length > 0 && (
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10px] text-amber-200">
                {pendingInterventions.length} {pendingInterventions.length === 1 ? "intervenção" : "intervenções"}
              </span>
            )}
            {canManage && execution && ["RUNNING", "PENDING"].includes(execution.status) && (
              <Button size="sm" variant="outline" disabled={pendingKey !== null} className="ml-auto border-white/10" onClick={() => void control("PAUSE")}>
                <CirclePause className="size-4" /> Pausar
              </Button>
            )}
            {canManage && execution?.status === "PAUSED" && (
              <Button size="sm" variant="outline" disabled={pendingKey !== null} className="ml-auto border-white/10" onClick={() => void control("RESUME")}>
                <CirclePlay className="size-4" /> Retomar
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-5 py-3" aria-label="Filtrar histórico por fase">
          <PhaseFilter active={activeFilter === "ALL"} label="Todas" onClick={() => setSelectedPhase("ALL")} />
          {phases.map((phase) => (
            <PhaseFilter key={phase.phaseNumber} active={activeFilter === phase.phaseNumber} label={String(phase.phaseNumber).padStart(2, "0")} onClick={() => setSelectedPhase(phase.phaseNumber)} />
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <p className="sr-only" aria-live="polite">
            {pendingInterventions.length ? `${pendingInterventions.length} solicitação pendente.` : "Nenhuma solicitação pendente."}
          </p>

          {pendingInterventions.map((item) => {
            const forbidden = FORBIDDEN_CATEGORIES.has(item.category);
            const content = drafts[item.requestId] ?? "";
            const isPending = pendingKey === `intervention:${item.requestId}`;
            return (
              <section key={item.requestId} className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/[.06] p-4" aria-label={`Intervenção da fase ${item.phaseNumber}`}>
                <div className="flex items-start gap-3">
                  {forbidden ? <ShieldAlert className="mt-0.5 size-5 shrink-0 text-rose-300" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">{item.category} · fase {item.phaseNumber}</p>
                    <h3 className="mt-1 text-sm font-semibold text-white">{item.question}</h3>
                    <dl className="mt-3 space-y-2 text-xs leading-5">
                      <div><dt className="font-semibold text-slate-300">Ação e escopo</dt><dd className="break-words text-slate-400">{item.intendedAction} · {item.normalizedAction}</dd></div>
                      <div><dt className="font-semibold text-slate-300">Risco e escopo</dt><dd className="whitespace-pre-wrap break-words text-slate-400">{item.risk}</dd></div>
                    </dl>
                    {item.options.length > 0 && <p className="mt-2 text-[11px] text-slate-500">Opções: {item.options.join(" · ")}</p>}
                    {forbidden ? <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/[.06] p-3 text-xs leading-5 text-rose-200">Esta ação exige o protocolo específico de Vault ou DevOps e não pode ser liberada por autorização genérica.</p> : <p className="mt-2 text-[11px] text-slate-500">Duração: uso único, restrito a esta fase e à próxima tentativa.</p>}
                    {canManage && (
                      <div className="mt-3 space-y-2">
                        <label htmlFor={`answer-${item.requestId}`} className="text-xs font-medium text-slate-300">Resposta administrativa</label>
                        <textarea id={`answer-${item.requestId}`} value={content} onChange={(event) => setDrafts((current) => ({ ...current, [item.requestId]: event.target.value }))} maxLength={4_000} rows={3} placeholder="Explique a decisão sem inserir senhas, tokens ou credenciais." className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/80 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40" />
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={isPending} className="border-rose-400/20 text-rose-300" onClick={() => answer(item, "DENY")}>Negar</Button>
                          {!forbidden && <Button size="sm" variant="outline" disabled={isPending} className="border-emerald-400/20 text-emerald-300" onClick={() => answer(item, "AUTHORIZE")}>Autorizar uma vez</Button>}
                          <Button size="sm" disabled={!content.trim() || isPending} onClick={() => answer(item, "ANSWER")}>{isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Responder</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}

          <div className="space-y-3">
            {timeline.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">Ainda não há atividade nesta seleção.</p>}
            {timeline.map((item) => item.type === "MESSAGE" ? <MessageCard key={`message:${item.message.id}`} message={item.message} /> : <ActivityCard key={`activity:${item.phaseNumber}:${item.activity.at}:${item.activity.message}`} activity={item.activity} phaseNumber={item.phaseNumber} />)}
          </div>

          <section className="mt-5 space-y-3 border-t border-white/10 pt-4">
            {phases.filter((phase) => activeFilter === "ALL" || phase.phaseNumber === activeFilter).map((phase) => (
              <div key={phase.phaseNumber} className="rounded-2xl border border-white/10 bg-white/[.025] p-3">
                <div className="flex items-center gap-2 text-xs"><FileCode2 className="size-4 text-violet-300" /><span className="min-w-0 flex-1 truncate font-medium">{phaseLabel(phase)}</span><span className="text-slate-500">{STATUS_LABEL[phase.status] ?? phase.status}</span></div>
                <p className="mt-2 text-[11px] text-slate-500">Solicitado @{phase.requestedAgent} · resolvido @{phase.resolvedAgent}</p>
                {phase.summary && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">{phase.summary}</p>}
                {phase.errorCode && <p className="mt-2 text-[11px] text-rose-300">Erro sanitizado: {phase.errorCode}</p>}
                {phase.changedFiles.length > 0 && <p className="mt-2 break-words text-[11px] leading-5 text-slate-400">Arquivos: {phase.changedFiles.join(" · ")}</p>}
              </div>
            ))}
          </section>
        </div>

        {canManage && execution && composerPhase && (
          <footer className="border-t border-white/10 bg-slate-900/40 p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label htmlFor="room-agent" className="text-xs text-slate-400">Fase {composerPhase.phaseNumber} · agente</label>
              <select id="room-agent" value={agentDrafts[draftKey] ?? composerPhase.resolvedAgent} onChange={(event) => setAgentDrafts((current) => ({ ...current, [draftKey]: event.target.value }))} className="h-8 rounded-lg border border-white/10 bg-slate-950 px-2 text-xs">
                {agents.filter((agent) => agent.available).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
              <Button size="sm" variant="ghost" disabled={pendingKey !== null || (agentDrafts[draftKey] ?? composerPhase.resolvedAgent) === composerPhase.resolvedAgent} onClick={() => runAction(`agent:${draftKey}`, () => TrocarAgenteFaseRoadmapProduction({ executionId: execution.id, phaseNumber: composerPhase.phaseNumber, agentId: agentDrafts[draftKey] ?? composerPhase.resolvedAgent }))}>Trocar agente</Button>
            </div>
            <div className="flex items-end gap-2">
              <label htmlFor="room-message" className="sr-only">Mensagem para a fase</label>
              <textarea id="room-message" value={messageDraft} onChange={(event) => setDrafts((current) => ({ ...current, [draftKey]: event.target.value }))} maxLength={4_000} rows={2} placeholder="Envie contexto para o próximo limite seguro…" className="min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-slate-950 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && messageDraft.trim()) { event.preventDefault(); runAction(`message:${draftKey}`, async () => { const result = await EnviarMensagemRoadmapProduction({ executionId: execution.id, phaseNumber: composerPhase.phaseNumber, content: messageDraft }); if (result.success) setDrafts((current) => ({ ...current, [draftKey]: "" })); return result; }); } }} />
              <Button aria-label="Enviar mensagem" disabled={!messageDraft.trim() || pendingKey !== null} onClick={() => runAction(`message:${draftKey}`, async () => { const result = await EnviarMensagemRoadmapProduction({ executionId: execution.id, phaseNumber: composerPhase.phaseNumber, content: messageDraft }); if (result.success) setDrafts((current) => ({ ...current, [draftKey]: "" })); return result; })}>{pendingKey === `message:${draftKey}` ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</Button>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Ctrl/⌘ + Enter para enviar. Nunca cole credenciais ou segredos.</p>
          </footer>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PhaseFilter({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`shrink-0 rounded-full border px-3 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 ${active ? "border-violet-400/30 bg-violet-400/10 text-violet-200" : "border-white/10 text-slate-500 hover:text-slate-200"}`}>{label}</button>;
}

function MessageCard({ message }: { message: ProductionMessage }) {
  const Icon = message.role === "AGENT" ? Bot : message.role === "ADMIN" ? UserRound : CheckCircle2;
  return <article className={`rounded-2xl border p-3 ${message.role === "ADMIN" ? "border-violet-400/20 bg-violet-400/[.06]" : "border-white/10 bg-white/[.025]"}`}><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500"><Icon className="size-3.5" />{message.role} · fase {message.phaseNumber}<time className="ml-auto normal-case tracking-normal">{formatDate(message.createdAt)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{message.content}</p></article>;
}

function ActivityCard({ activity, phaseNumber }: { activity: ProductionActivity; phaseNumber: number }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[.015] p-3"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500"><CheckCircle2 className="size-3.5" />{activity.type} · fase {phaseNumber}<time className="ml-auto normal-case tracking-normal">{formatDate(activity.at)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-400">{activity.message}</p></article>;
}
