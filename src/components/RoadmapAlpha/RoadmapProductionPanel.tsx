"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Activity, ArrowLeft, Bot, CheckCircle2, Clock3, Cpu, Loader2,
  PauseCircle, PlayCircle, RefreshCw, Settings2, ShieldCheck, Users, X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlternarAcessoRoadmapProduction,
  ListarAcessosRoadmapProduction,
  ObterRoadmapProduction,
  RepetirExecucaoRoadmapProduction,
  SalvarConfiguracaoRoadmapProduction,
} from "@/actions/RoadmapProduction";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProviderView { id: "ollama" | "codex" | "claude"; label: string; available: boolean; ready: boolean; detail: string; models: string[] }
interface AgentView { id: string; name: string; title: string; icon: string; description: string; skillPath: string; available: boolean }
interface ActivityView { at: string; agentId: string; type: "STATUS" | "TOOL" | "RESULT" | "ERROR"; message: string }
interface PhaseView {
  phaseNumber: number; title: string; kind: string; requestedAgent: string; resolvedAgent: string;
  status: string; attemptCount: number; startedAt: string | null; finishedAt: string | null;
  summary: string | null; errorCode: string | null; activities: ActivityView[];
}
interface ExecutionView {
  id: string; objectiveCode: string; objectiveTitle: string; moduleKey: string; sourceVersion: number;
  globalPriority: number; status: string; createdAt: string; startedAt: string | null; finishedAt: string | null; phases: PhaseView[];
}
interface ProductionData {
  config: { version: 1; provider: "ollama" | "codex" | "claude"; model: string; autoRun: boolean; maxToolSteps: number; updatedAt: string };
  state: { updatedAt: string; executions: ExecutionView[] };
  agents: AgentView[];
  providers: ProviderView[];
}
interface AccessView { id: number; nome: string; usuario: string; role: string; status: string; imagemUrl: string | null; locked: boolean; hasAccess: boolean }

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Na fila", RUNNING: "Executando", SUCCEEDED: "Concluído", FAILED: "Falhou", BLOCKED: "Bloqueado",
};

function statusClass(status: string): string {
  if (status === "SUCCEEDED") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (status === "RUNNING") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-300";
  if (status === "FAILED" || status === "BLOCKED") return "border-rose-400/20 bg-rose-400/10 text-rose-300";
  return "border-amber-400/20 bg-amber-400/10 text-amber-300";
}

export function RoadmapProductionPanel({ canManage, onBack }: { canManage: boolean; onBack: () => void }) {
  const [data, setData] = useState<ProductionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const polling = useRef(false);

  const refresh = useCallback(async (includeCatalog = false) => {
    if (polling.current || document.visibilityState === "hidden") return;
    polling.current = true;
    try {
      const result = await ObterRoadmapProduction(includeCatalog);
      if (!result.success) { setError(result.error); return; }
      setData((current) => ({
        config: result.config,
        state: result.state,
        agents: result.agents.length ? result.agents : (current?.agents ?? []),
        providers: result.providers.length ? result.providers : (current?.providers ?? []),
      }));
      setError(null);
    } finally { polling.current = false; }
  }, []);

  useEffect(() => {
    void refresh(true);
    const interval = window.setInterval(() => void refresh(false), 2_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const executions = useMemo(() => data?.state.executions ?? [], [data?.state.executions]);
  const activePhase = useMemo(() => executions.flatMap((execution) => execution.phases.map((phase) => ({ execution, phase }))).find(({ phase }) => phase.status === "RUNNING") ?? null, [executions]);
  const selected = executions.find((execution) => execution.id === selectedExecution) ?? executions[0] ?? null;

  if (error && !data) return <div className="grid min-h-[680px] place-items-center rounded-2xl border border-rose-400/20 bg-[#07101f] text-rose-300">{error}</div>;

  return (
    <main className="relative flex h-[calc(100dvh-1rem)] min-h-[680px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#07101f] text-slate-100 shadow-2xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar ao Roadmap"><ArrowLeft size={18} /></Button>
          <span className="grid size-10 place-items-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-300"><Cpu size={20} /></span>
          <div><h1 className="font-semibold">Produção local</h1><p className="text-xs text-slate-400">Bibble Squad executando o Roadmap no working tree</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`hidden rounded-full border px-3 py-1 text-xs sm:inline-flex ${data?.config.autoRun ? "border-emerald-400/20 text-emerald-300" : "border-amber-400/20 text-amber-300"}`}>
            {data?.config.autoRun ? "Automação ativa" : "Automação pausada"}
          </span>
          <Button variant="outline" className="border-white/10" onClick={() => setAgentsOpen(true)}><Users size={16} /> Agentes</Button>
          {canManage && <Button variant="outline" className="border-white/10" onClick={() => setAccessOpen(true)}><ShieldCheck size={16} /> Acessos</Button>}
          {canManage && <Button className="bg-violet-500 hover:bg-violet-400" onClick={() => setSettingsOpen(true)}><Settings2 size={16} /> Configurar IA</Button>}
        </div>
      </header>

      <section className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-4">
        <Metric icon={Bot} label="Provedor" value={data ? data.providers.find((provider) => provider.id === data.config.provider)?.label ?? data.config.provider : "Carregando"} />
        <Metric icon={Users} label="Agentes disponíveis" value={String(data?.agents.filter((agent) => agent.available).length ?? 0)} />
        <Metric icon={Activity} label="Atividade atual" value={activePhase ? `${activePhase.phase.resolvedAgent} · fase ${activePhase.phase.phaseNumber}` : "Aguardando"} active={Boolean(activePhase)} />
        <Metric icon={CheckCircle2} label="Execuções concluídas" value={`${executions.filter((item) => item.status === "SUCCEEDED").length} / ${executions.length}`} />
      </section>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-white/10 p-3">
          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">Fila por prioridade global</p>
          <div className="space-y-2">
            {!executions.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Nenhum objetivo documentado aguardando produção.</p>}
            {executions.map((execution) => (
              <button key={execution.id} onClick={() => setSelectedExecution(execution.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === execution.id ? "border-violet-400/30 bg-violet-400/[.08]" : "border-white/10 bg-white/[.025] hover:bg-white/[.05]"}`}>
                <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-950 font-bold text-violet-300">{execution.globalPriority}</span><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wider text-slate-500">{execution.objectiveCode} · r{String(execution.sourceVersion).padStart(4, "0")}</p><p className="mt-1 line-clamp-2 text-sm font-medium">{execution.objectiveTitle}</p></div></div>
                <div className="mt-3 flex items-center justify-between"><span className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(execution.status)}`}>{STATUS_LABEL[execution.status] ?? execution.status}</span><span className="text-[10px] text-slate-500">{execution.phases.filter((phase) => phase.status === "SUCCEEDED").length}/{execution.phases.length} fases</span></div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto bg-[#081321] p-5">
          {!selected ? <div className="grid h-full place-items-center text-slate-500">Selecione uma execução.</div> : <>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-violet-300">{selected.objectiveCode} · {selected.moduleKey}</p><h2 className="mt-1 text-xl font-semibold">{selected.objectiveTitle}</h2><p className="mt-1 text-xs text-slate-500">Mudanças ficam locais. Aprovação e commit são sempre manuais.</p></div>{canManage && ["FAILED", "BLOCKED"].includes(selected.status) && <Button variant="outline" className="border-white/10" onClick={async () => { const result = await RepetirExecucaoRoadmapProduction(selected.id); if (result.success) toast.success("Execução reenfileirada"); else toast.error(result.error); await refresh(false); }}><RefreshCw size={15} /> Tentar novamente</Button>}</div>
            <div className="space-y-3">{selected.phases.map((phase) => <PhaseCard key={phase.phaseNumber} phase={phase} />)}</div>
          </>}
        </section>
      </div>

      <AgentDrawer open={agentsOpen} onClose={() => setAgentsOpen(false)} agents={data?.agents ?? []} active={activePhase} />
      {canManage && data && settingsOpen && <SettingsDialog open onOpenChange={setSettingsOpen} data={data} onSaved={() => refresh(true)} />}
      {canManage && accessOpen && <AccessDialog open onOpenChange={setAccessOpen} />}
    </main>
  );
}

function Metric({ icon: Icon, label, value, active = false }: { icon: typeof Bot; label: string; value: string; active?: boolean }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.025] p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><Icon size={14} className={active ? "animate-pulse text-cyan-300" : "text-violet-300"} />{label}</div><p className="mt-2 truncate text-sm font-medium">{value}</p></div>;
}

function PhaseCard({ phase }: { phase: PhaseView }) {
  const latest = phase.activities.at(-1);
  return <article className={`rounded-xl border p-4 ${phase.status === "RUNNING" ? "border-cyan-400/30 bg-cyan-400/[.05]" : "border-white/10 bg-white/[.025]"}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid size-9 place-items-center rounded-lg bg-slate-950 text-sm text-violet-300">{phase.phaseNumber}</span><div><h3 className="text-sm font-medium">{phase.title}</h3><p className="mt-1 text-xs text-slate-500">{phase.resolvedAgent} · solicitado: {phase.requestedAgent} · {phase.kind}</p></div></div><span className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(phase.status)}`}>{phase.status === "RUNNING" && <Loader2 className="mr-1 inline animate-spin" size={10} />}{STATUS_LABEL[phase.status] ?? phase.status}</span></div>
    {latest && <div className="mt-3 flex gap-2 rounded-lg bg-slate-950/60 px-3 py-2 text-xs text-slate-400"><Clock3 size={13} className="mt-0.5 shrink-0" /><span>{latest.message}</span></div>}
    {phase.summary && <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-slate-950/50 p-3 font-sans text-xs leading-5 text-slate-300">{phase.summary}</pre>}
  </article>;
}

function AgentDrawer({ open, onClose, agents, active }: { open: boolean; onClose: () => void; agents: AgentView[]; active: { execution: ExecutionView; phase: PhaseView } | null }) {
  if (!open) return null;
  return <div className="absolute inset-0 z-50 flex justify-end bg-black/55" onClick={onClose}><aside className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0a1423] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Agentes Bibble</h2><p className="text-xs text-slate-500">Skills instalados no projeto local</p></div><Button variant="ghost" size="icon" onClick={onClose}><X size={18} /></Button></div>{active && <div className="mb-4 rounded-xl border border-cyan-400/25 bg-cyan-400/[.07] p-3"><p className="text-[10px] uppercase tracking-wider text-cyan-300">Trabalhando agora</p><p className="mt-1 font-medium">{active.phase.resolvedAgent}</p><p className="mt-1 text-xs text-slate-400">{active.execution.objectiveCode} · {active.phase.title}</p><p className="mt-2 text-xs text-slate-300">{active.phase.activities.at(-1)?.message ?? "Iniciando fase"}</p></div>}<div className="space-y-2">{agents.map((agent) => { const isActive = active?.phase.resolvedAgent === agent.id; return <div key={agent.id} className={`rounded-xl border p-3 ${isActive ? "border-cyan-400/30 bg-cyan-400/[.06]" : "border-white/10 bg-white/[.02]"}`}><div className="flex items-start gap-3"><span className="text-xl">{agent.icon}</span><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium">{agent.name}</p>{isActive && <span className="size-2 animate-pulse rounded-full bg-cyan-400" />}</div><p className="text-xs text-violet-300">{agent.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{agent.description}</p></div></div></div>; })}</div></aside></div>;
}

function SettingsDialog({ open, onOpenChange, data, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; data: ProductionData; onSaved: () => Promise<void> | void }) {
  const [provider, setProvider] = useState(data.config.provider);
  const [model, setModel] = useState(data.config.model);
  const [autoRun, setAutoRun] = useState(data.config.autoRun);
  const [maxToolSteps, setMaxToolSteps] = useState(data.config.maxToolSteps);
  const [pending, startTransition] = useTransition();
  const selectedProvider = data.providers.find((item) => item.id === provider);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="border-white/10 bg-[#0b1524] text-slate-100"><DialogHeader><DialogTitle>Configurar motor de IA</DialogTitle><DialogDescription>Ollama é o padrão. Outros adapters só podem ser selecionados quando estiverem prontos.</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid gap-2 sm:grid-cols-3">{data.providers.map((item) => <button key={item.id} disabled={!item.ready} onClick={() => { setProvider(item.id); setModel(item.models[0] ?? ""); }} className={`rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-45 ${provider === item.id ? "border-violet-400/40 bg-violet-400/10" : "border-white/10"}`}><p className="text-sm font-medium">{item.label}</p><p className="mt-1 text-[10px] text-slate-500">{item.detail}</p></button>)}</div><label className="block text-xs text-slate-400">Modelo<select value={model} onChange={(event) => setModel(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm">{selectedProvider?.models.map((item) => <option key={item}>{item}</option>)}</select></label><label className="flex items-center justify-between rounded-xl border border-white/10 p-3"><span><span className="block text-sm">Execução automática</span><span className="text-xs text-slate-500">O worker recebe as próximas fases da fila.</span></span><input type="checkbox" checked={autoRun} onChange={(event) => setAutoRun(event.target.checked)} className="size-5 accent-violet-500" /></label><label className="block text-xs text-slate-400">Limite de tools por fase: {maxToolSteps}<input type="range" min={4} max={40} value={maxToolSteps} onChange={(event) => setMaxToolSteps(Number(event.target.value))} className="mt-2 w-full accent-violet-500" /></label><div className="flex justify-end"><Button disabled={pending || !selectedProvider?.ready || !model} onClick={() => startTransition(async () => { const result = await SalvarConfiguracaoRoadmapProduction({ provider, model, autoRun, maxToolSteps }); if (!result.success) { toast.error(result.error); return; } toast.success(autoRun ? "Automação configurada" : "Automação pausada"); onOpenChange(false); await onSaved(); })}>{pending ? <Loader2 className="animate-spin" size={15} /> : autoRun ? <PlayCircle size={15} /> : <PauseCircle size={15} />} Salvar</Button></div></div></DialogContent></Dialog>;
}

function AccessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [users, setUsers] = useState<AccessView[]>([]);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const load = useCallback(async () => { const result = await ListarAcessosRoadmapProduction(); if (result.success) setUsers(result.data); else toast.error(result.error); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[80vh] overflow-y-auto border-white/10 bg-[#0b1524] text-slate-100"><DialogHeader><DialogTitle>Acesso à Produção</DialogTitle><DialogDescription>Admin, CEO e TI têm acesso permanente. Conceda acesso individual aos demais usuários ativos.</DialogDescription></DialogHeader><div className="space-y-2">{users.map((user) => <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div><p className="text-sm font-medium">{user.nome}</p><p className="text-xs text-slate-500">{user.usuario} · {user.role}{user.status !== "ATIVO" ? " · inativo" : ""}</p></div><button disabled={user.locked || user.status !== "ATIVO" || pendingId === user.id} onClick={async () => { setPendingId(user.id); const result = await AlternarAcessoRoadmapProduction(user.id); if (!result.success) toast.error(result.error); else await load(); setPendingId(null); }} className={`rounded-full border px-3 py-1 text-xs disabled:opacity-60 ${user.hasAccess ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-slate-500"}`}>{pendingId === user.id ? "Salvando..." : user.locked ? "Administrativo" : user.hasAccess ? "Permitido" : "Sem acesso"}</button></div>)}</div></DialogContent></Dialog>;
}
