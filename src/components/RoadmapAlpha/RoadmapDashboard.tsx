"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Archive,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  Layers3,
  Loader2,
  MapPinned,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import {
  ArquivarObjetivoRoadmap,
  AtualizarObjetivoRoadmap,
  CriarObjetivoRoadmap,
  ExcluirObjetivoRoadmap,
  ListarRoadmapAlpha,
  MelhorarCampoObjetivoRoadmap,
  MoverObjetivoRoadmap,
  ReenfileirarObjetivoRoadmap,
} from "@/actions/RoadmapAlpha";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RoadmapModuleSnapshot } from "@/lib/roadmap-alpha/catalog";
import type { RoadmapImproveField } from "@/lib/roadmap-alpha/improve-with-ai";
import { RoadmapProductionPanel } from "@/components/RoadmapAlpha/RoadmapProductionPanel";
import { SistemasExternosSection } from "@/components/RoadmapAlpha/SistemasExternosSection";

interface RoadmapArtifact {
  id: string;
  phaseNumber: number;
  slug: string;
  title: string;
  kind: string;
  agent: string;
  contentMarkdown: string;
  relativePath: string | null;
  status: string;
}

interface RoadmapObjectiveView {
  id: string;
  code: string;
  moduleKey: string;
  moduleLabelSnapshot: string;
  title: string;
  description: string;
  desiredOutcome: string | null;
  constraints: string | null;
  globalPriority: number;
  status: string;
  documentationStatus: string;
  sourceVersion: number;
  developmentProvider: "claude" | "codex" | "ollama";
  acceptanceCriteria: string[];
  createdAt: string;
  archivedAt: string | null;
  trashExpiresAt: string | null;
  createdBy: { id: number; nome: string };
  documentationJobs: Array<{
    status: string;
    attemptCount: number;
    maxAttempts: number;
    lastErrorCode: string | null;
  }>;
  promptArtifacts: RoadmapArtifact[];
}

interface Props {
  initialObjectives: RoadmapObjectiveView[];
  modules: RoadmapModuleSnapshot[];
  canMutate: boolean;
  canAccessProduction: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  operacional: "Operacional",
  comercial: "Comercial",
  financeiro: "Financeiro",
  pessoas: "Pessoas",
  infra: "Infra & Docs",
  admin: "Administração",
};

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  PENDING: {
    label: "Na fila",
    className: "text-amber-300 bg-amber-400/10 border-amber-400/20",
    icon: Clock3,
  },
  DOCUMENTING: {
    label: "Documentando",
    className: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
    icon: Loader2,
  },
  DOCUMENTED: {
    label: "Documentado",
    className: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
    icon: CheckCircle2,
  },
  RETRY_WAIT: {
    label: "Nova tentativa",
    className: "text-orange-300 bg-orange-400/10 border-orange-400/20",
    icon: RotateCcw,
  },
  FAILED: {
    label: "Falhou",
    className: "text-rose-300 bg-rose-400/10 border-rose-400/20",
    icon: AlertTriangle,
  },
};

type LifecycleFilter =
  "pending" | "development" | "completed" | "deleted" | "archived";
const LIFECYCLE_TABS: Array<{ id: LifecycleFilter; label: string }> = [
  { id: "pending", label: "Pendentes" },
  { id: "development", label: "Em desenvolvimento" },
  { id: "completed", label: "Concluídos" },
  { id: "deleted", label: "Excluídos" },
  { id: "archived", label: "Arquivados" },
];
const LIFECYCLE_META: Record<
  Exclude<LifecycleFilter, "pending">,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  development: {
    label: "Em desenvolvimento",
    className: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
    icon: Loader2,
  },
  completed: {
    label: "Concluído",
    className: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
    icon: CheckCircle2,
  },
  deleted: {
    label: "Na lixeira",
    className: "text-rose-300 bg-rose-400/10 border-rose-400/20",
    icon: Trash2,
  },
  archived: {
    label: "Arquivado",
    className: "text-slate-300 bg-slate-400/10 border-slate-400/20",
    icon: Archive,
  },
};

const DEVELOPMENT_PROVIDER_LABEL: Record<
  "claude" | "codex" | "ollama",
  string
> = { claude: "Claude", codex: "Codex", ollama: "Qwen" };

function lifecycleOf(objective: RoadmapObjectiveView): LifecycleFilter {
  if (objective.status === "DELETED") return "deleted";
  if (objective.status === "ARCHIVED") return "archived";
  if (objective.status === "COMPLETED") return "completed";
  if (objective.status === "IN_DEVELOPMENT") return "development";
  return "pending";
}

export function RoadmapDashboard({
  initialObjectives,
  modules,
  canMutate,
  canAccessProduction,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [objectives, setObjectives] = useState(initialObjectives);
  const [lastLiveUpdate, setLastLiveUpdate] = useState(() => new Date());
  const refreshInFlight = useRef(false);
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] =
    useState<LifecycleFilter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialObjectives[0]?.id ?? null,
  );
  const [selectedPhase, setSelectedPhase] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createNovoModuloPreset, setCreateNovoModuloPreset] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("novoModulo") !== "1") return;
    const timer = window.setTimeout(() => {
      if (canMutate) {
        setCreateNovoModuloPreset(true);
        setCreateOpen(true);
      }
      router.replace("/PainelAlpha/Roadmap");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams, router, canMutate]);
  const [mobilePane, setMobilePane] = useState<
    "modules" | "objectives" | "docs"
  >("objectives");
  const [view, setView] = useState<"roadmap" | "production">("roadmap");
  const [productionModuleKey, setProductionModuleKey] = useState<string | null>(
    null,
  );

  const refreshObjectives = useCallback(async () => {
    if (refreshInFlight.current || document.visibilityState === "hidden")
      return;
    refreshInFlight.current = true;
    try {
      const result = await ListarRoadmapAlpha();
      if (result.success) {
        setObjectives(result.data);
        setLastLiveUpdate(new Date());
      }
    } finally {
      refreshInFlight.current = false;
    }
  }, []);

  const hasActiveDocumentation = objectives.some((objective) =>
    ["PENDING", "DOCUMENTING", "RETRY_WAIT"].includes(
      objective.documentationStatus,
    ),
  );
  const activeObjectiveCount = objectives.filter(
    (objective) => objective.archivedAt === null,
  ).length;

  useEffect(() => {
    const interval = window.setInterval(
      () => void refreshObjectives(),
      hasActiveDocumentation ? 2_000 : 15_000,
    );
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshObjectives();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [hasActiveDocumentation, refreshObjectives]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return objectives.filter((objective) => {
      if (lifecycleOf(objective) !== lifecycleFilter) return false;
      if (moduleFilter && objective.moduleKey !== moduleFilter) return false;
      return (
        !query ||
        `${objective.code} ${objective.title} ${objective.description}`
          .toLocaleLowerCase("pt-BR")
          .includes(query)
      );
    });
  }, [objectives, lifecycleFilter, moduleFilter, search]);
  const selected =
    filtered.find((objective) => objective.id === selectedId) ??
    filtered[0] ??
    null;
  const artifact =
    selected?.promptArtifacts.find(
      (item) => item.phaseNumber === selectedPhase,
    ) ??
    selected?.promptArtifacts[0] ??
    null;

  function execute(
    operation: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string,
  ) {
    startTransition(async () => {
      const result = await operation();
      if (!result.success) {
        toast.error(result.error ?? "Operação não concluída");
        return;
      }
      toast.success(successMessage);
      await refreshObjectives();
      router.refresh();
    });
  }

  const moduleGroups = useMemo(() => {
    const groups = new Map<string, RoadmapModuleSnapshot[]>();
    modules.forEach((module) =>
      groups.set(module.category, [
        ...(groups.get(module.category) ?? []),
        module,
      ]),
    );
    return Array.from(groups);
  }, [modules]);

  if (view === "production" && productionModuleKey) {
    return (
      <RoadmapProductionPanel
        canManage={canMutate}
        moduleKey={productionModuleKey}
        moduleLabel={
          modules.find((module) => module.id === productionModuleKey)?.label ??
          null
        }
        onBack={() => setView("roadmap")}
      />
    );
  }

  return (
    <main className="flex h-[calc(100dvh-1rem)] min-h-[680px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#07101f] text-slate-100 shadow-2xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
            <MapPinned size={20} />
          </span>
          <div>
            <h1 className="font-semibold tracking-tight">Roadmap Alpha</h1>
            <p className="text-xs text-slate-400">
              Objetivos globais → documentação em prompt-phases
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAccessProduction && (
            <Button
              variant="outline"
              onClick={() => {
                const scopeModuleKey = moduleFilter ?? selected?.moduleKey;
                if (!scopeModuleKey) {
                  toast.error("Selecione um projeto antes de abrir Produção");
                  return;
                }
                setProductionModuleKey(scopeModuleKey);
                setView("production");
              }}
              className="border-violet-400/20 bg-violet-400/[.06] text-violet-200 hover:bg-violet-400/10"
            >
              <Workflow size={16} /> Produção
            </Button>
          )}
          <span className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400 sm:inline-flex">
            <span
              className={`size-1.5 rounded-full ${hasActiveDocumentation ? "animate-pulse bg-cyan-400" : "bg-emerald-400"}`}
            />
            {objectives.length} objetivos · ao vivo
          </span>
          {canMutate && (
            <Button
              variant="outline"
              onClick={() => {
                setCreateNovoModuloPreset(true);
                setCreateOpen(true);
              }}
              className="border-cyan-400/20 bg-cyan-400/[.06] text-cyan-200 hover:bg-cyan-400/10"
            >
              <Plus size={16} /> Novo módulo
            </Button>
          )}
          {canMutate && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              <Plus size={16} /> Novo objetivo
            </Button>
          )}
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-white/10 bg-slate-950/40 px-3 py-2">
        {LIFECYCLE_TABS.map((tab) => {
          const count = objectives.filter(
            (objective) => lifecycleOf(objective) === tab.id,
          ).length;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setLifecycleFilter(tab.id);
                setSelectedId(null);
              }}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs transition ${lifecycleFilter === tab.id ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300"}`}
            >
              {tab.label}{" "}
              <span className="ml-1 rounded bg-black/20 px-1.5 py-0.5">
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      <nav className="grid grid-cols-3 border-b border-white/10 lg:hidden">
        {(["modules", "objectives", "docs"] as const).map((pane) => (
          <button
            key={pane}
            onClick={() => setMobilePane(pane)}
            className={`px-2 py-2 text-xs font-medium ${mobilePane === pane ? "bg-cyan-400/10 text-cyan-300" : "text-slate-500"}`}
          >
            {pane === "modules"
              ? "Projetos"
              : pane === "objectives"
                ? "Objetivos"
                : "Documentação"}
          </button>
        ))}
      </nav>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[250px_400px_minmax(0,1fr)]">
        <aside
          className={`${mobilePane === "modules" ? "flex" : "hidden"} min-h-0 flex-col overflow-y-auto border-r border-white/10 bg-slate-950/30 lg:flex`}
        >
          <Accordion type="multiple" defaultValue={["painel-alpha"]}>
            <AccordionItem value="painel-alpha" className="border-white/10">
              <AccordionTrigger className="px-3 py-3 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:no-underline">
                Painel Alpha
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <div className="px-3 pb-2">
                  <button
                    onClick={() => {
                      setModuleFilter(null);
                      setMobilePane("objectives");
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${moduleFilter === null ? "bg-cyan-400/10 text-cyan-300" : "text-slate-300 hover:bg-white/5"}`}
                  >
                    <span className="flex items-center gap-2">
                      <Layers3 size={15} /> Todos
                    </span>
                    <span>
                      {
                        objectives.filter(
                          (objective) => lifecycleOf(objective) === lifecycleFilter,
                        ).length
                      }
                    </span>
                  </button>
                </div>
                <div className="p-2 pt-0">
                  {moduleGroups.map(([category, items]) => (
                    <div key={category} className="mb-4">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {CATEGORY_LABELS[category] ?? category}
                      </p>
                      {items.map((module) => {
                        const count = objectives.filter(
                          (objective) =>
                            objective.moduleKey === module.id &&
                            lifecycleOf(objective) === lifecycleFilter,
                        ).length;
                        return (
                          <button
                            key={module.id}
                            onClick={() => {
                              setModuleFilter(module.id);
                              setMobilePane("objectives");
                            }}
                            className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs ${moduleFilter === module.id ? "bg-cyan-400/10 text-cyan-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
                          >
                            <span className="truncate">{module.label}</span>
                            <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px]">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sistemas-externos" className="border-white/10">
              <AccordionTrigger className="px-3 py-3 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:no-underline">
                Sistemas Externos
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <SistemasExternosSection isAdmin={canMutate} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>

        <section
          className={`${mobilePane === "objectives" ? "flex" : "hidden"} min-h-0 flex-col border-r border-white/10 lg:flex`}
        >
          <div className="border-b border-white/10 p-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                size={15}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar objetivos..."
                className="border-white/10 bg-slate-950/60 pl-9"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {filtered.length === 0 && (
              <div className="grid h-full place-items-center text-center text-sm text-slate-500">
                <div>
                  <Sparkles className="mx-auto mb-3 text-slate-700" />
                  <p>Nenhum objetivo neste filtro.</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {filtered.map((objective) => {
                const lifecycle = lifecycleOf(objective);
                const meta =
                  lifecycle === "pending"
                    ? (STATUS_META[objective.documentationStatus] ??
                      STATUS_META.PENDING)
                    : LIFECYCLE_META[lifecycle];
                const StatusIcon = meta.icon;
                return (
                  <article
                    key={objective.id}
                    onClick={() => {
                      setSelectedId(objective.id);
                      setMobilePane("docs");
                    }}
                    className={`group cursor-pointer rounded-xl border p-3 transition ${selected?.id === objective.id ? "border-cyan-400/30 bg-cyan-400/[.07]" : "border-white/10 bg-white/[.025] hover:border-white/20 hover:bg-white/[.045]"}`}
                  >
                    <div className="flex gap-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-950 text-sm font-bold text-cyan-300">
                        {objective.globalPriority}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                              {objective.code} · {objective.moduleLabelSnapshot}
                            </p>
                            <h2 className="mt-1 line-clamp-2 text-sm font-medium text-slate-100">
                              {objective.title}
                            </h2>
                          </div>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                          {objective.description}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${meta.className}`}
                            >
                              <StatusIcon
                                size={11}
                                className={
                                  objective.documentationStatus ===
                                    "DOCUMENTING" || lifecycle === "development"
                                    ? "animate-spin"
                                    : ""
                                }
                              />
                              {meta.label}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/[.06] px-2 py-1 text-[10px] text-violet-300">
                              <BrainCircuit size={10} />
                              {
                                DEVELOPMENT_PROVIDER_LABEL[
                                  objective.developmentProvider
                                ]
                              }
                            </span>
                          </div>
                          {canMutate && (
                            <div className="flex opacity-70 transition group-hover:opacity-100">
                              {!["deleted", "archived"].includes(
                                lifecycleFilter,
                              ) && (
                                <>
                                  <button
                                    aria-label="Subir prioridade"
                                    disabled={
                                      isPending ||
                                      objective.globalPriority === 1
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      execute(
                                        () =>
                                          MoverObjetivoRoadmap({
                                            objectiveId: objective.id,
                                            globalPriority:
                                              objective.globalPriority - 1,
                                          }),
                                        "Prioridade atualizada",
                                      );
                                    }}
                                    className="rounded p-1 hover:bg-white/10 disabled:opacity-20"
                                  >
                                    <ChevronUp size={14} />
                                  </button>
                                  <button
                                    aria-label="Descer prioridade"
                                    disabled={
                                      isPending ||
                                      objective.globalPriority ===
                                        activeObjectiveCount
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      execute(
                                        () =>
                                          MoverObjetivoRoadmap({
                                            objectiveId: objective.id,
                                            globalPriority:
                                              objective.globalPriority + 1,
                                          }),
                                        "Prioridade atualizada",
                                      );
                                    }}
                                    className="rounded p-1 hover:bg-white/10 disabled:opacity-20"
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                  <button
                                    aria-label="Arquivar"
                                    disabled={isPending}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (
                                        window.confirm(
                                          "Arquivar este objetivo?",
                                        )
                                      )
                                        execute(
                                          () =>
                                            ArquivarObjetivoRoadmap(
                                              objective.id,
                                            ),
                                          "Objetivo arquivado",
                                        );
                                    }}
                                    className="rounded p-1 text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"
                                  >
                                    <Archive size={14} />
                                  </button>
                                  <button
                                    aria-label="Excluir"
                                    disabled={isPending}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (
                                        window.confirm(
                                          "Mover este objetivo para a lixeira por 3 dias?",
                                        )
                                      )
                                        execute(
                                          () =>
                                            ExcluirObjetivoRoadmap(
                                              objective.id,
                                            ),
                                          "Objetivo movido para a lixeira",
                                        );
                                    }}
                                    className="rounded p-1 text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        {lifecycleFilter === "deleted" &&
                          objective.trashExpiresAt && (
                            <p className="mt-2 text-[10px] text-rose-300/80">
                              Exclusão definitiva em{" "}
                              {new Date(
                                objective.trashExpiresAt,
                              ).toLocaleString("pt-BR")}
                            </p>
                          )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className={`${mobilePane === "docs" ? "flex" : "hidden"} min-h-0 flex-col bg-[#081321] lg:flex`}
        >
          {!selected ? (
            <div className="grid h-full place-items-center text-center text-slate-500">
              <div>
                <FileText className="mx-auto mb-3 text-slate-700" size={34} />
                <p>Selecione um objetivo para abrir a documentação.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-cyan-400">
                      {selected.code} · revisão{" "}
                      {String(selected.sourceVersion).padStart(4, "0")}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">
                      {selected.title}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Criado por {selected.createdBy.nome}
                    </p>
                  </div>
                  {canMutate && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setEditOpen(true)}
                        className="border-white/10"
                      >
                        <Pencil size={14} /> Editar
                      </Button>
                      {["FAILED", "DOCUMENTED"].includes(
                        selected.documentationStatus,
                      ) && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() =>
                            execute(
                              () => ReenfileirarObjetivoRoadmap(selected.id),
                              "Nova documentação enfileirada",
                            )
                          }
                          className="border-white/10"
                        >
                          <RotateCcw size={14} /> Gerar nova revisão
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {selected.promptArtifacts.length > 0 ? (
                <>
                  <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-4 py-2">
                    {selected.promptArtifacts.map((phase) => (
                      <button
                        key={phase.id}
                        onClick={() => setSelectedPhase(phase.phaseNumber)}
                        className={`shrink-0 rounded-lg px-3 py-2 text-xs ${artifact?.id === phase.id ? "bg-cyan-400/10 text-cyan-300" : "text-slate-500 hover:bg-white/5"}`}
                      >
                        {String(phase.phaseNumber).padStart(2, "0")} ·{" "}
                        {phase.title}
                      </button>
                    ))}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-4xl px-6 py-7">
                      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded bg-white/5 px-2 py-1">
                          {artifact?.kind}
                        </span>
                        <span className="rounded bg-white/5 px-2 py-1">
                          @{artifact?.agent}
                        </span>
                        {artifact?.relativePath && (
                          <code className="break-all text-[10px] text-slate-600">
                            {artifact.relativePath}
                          </code>
                        )}
                      </div>
                      {artifact && (
                        <article className="prose prose-invert prose-slate max-w-none prose-headings:scroll-mt-20 prose-a:text-cyan-400 prose-pre:border prose-pre:border-white/10 prose-pre:bg-slate-950">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                            {artifact.contentMarkdown}
                          </ReactMarkdown>
                        </article>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
                  <div className="max-w-md">
                    <span
                      className={`mx-auto mb-4 grid size-14 place-items-center rounded-2xl ${selected.documentationStatus === "FAILED" ? "bg-rose-400/10 text-rose-300" : "bg-cyan-400/10 text-cyan-300"}`}
                    >
                      {selected.documentationStatus === "FAILED" ? (
                        <AlertTriangle />
                      ) : selected.documentationStatus === "DOCUMENTING" ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Sparkles
                          className={
                            selected.documentationStatus === "PENDING"
                              ? "animate-pulse"
                              : ""
                          }
                        />
                      )}
                    </span>
                    <h3 className="font-medium">
                      {selected.documentationStatus === "FAILED"
                        ? "A documentação precisa de atenção"
                        : selected.documentationStatus === "DOCUMENTING"
                          ? "Qwen está criando os prompts"
                          : selected.documentationStatus === "RETRY_WAIT"
                            ? "Nova tentativa programada"
                            : "Objetivo aguardando o worker"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {selected.documentationStatus === "DOCUMENTING"
                        ? `Geração em andamento · tentativa ${selected.documentationJobs[0]?.attemptCount ?? 1} de ${selected.documentationJobs[0]?.maxAttempts ?? 3}. Os prompts aparecerão aqui automaticamente.`
                        : `Fila por prioridade global · objetivo #${selected.globalPriority}. Esta tela atualiza automaticamente.`}
                    </p>
                    <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-600">
                      Última atualização{" "}
                      {lastLiveUpdate.toLocaleTimeString("pt-BR")}
                    </p>
                    {selected.documentationJobs[0]?.lastErrorCode && (
                      <code className="mt-4 inline-block rounded bg-rose-400/10 px-3 py-2 text-xs text-rose-300">
                        {selected.documentationJobs[0].lastErrorCode}
                      </code>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {canMutate && (
      <CreateObjectiveDialog
        key={objectives.length}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateNovoModuloPreset(false);
        }}
        modules={modules}
        nextPriority={activeObjectiveCount + 1}
        novoModuloPreset={createNovoModuloPreset}
        onCreated={() => {
          setCreateOpen(false);
          setCreateNovoModuloPreset(false);
          void refreshObjectives();
          router.refresh();
        }}
      />
      )}
      {canMutate && selected && (
        <EditObjectiveDialog
          key={`${selected.id}:${selected.sourceVersion}`}
          open={editOpen}
          onOpenChange={setEditOpen}
          modules={modules}
          objective={selected}
          onUpdated={() => {
            setEditOpen(false);
            void refreshObjectives();
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function ImproveWithAIButton({
  field,
  value,
  context,
  onImproved,
}: {
  field: RoadmapImproveField;
  value: string;
  context: { title?: string; description?: string; desiredOutcome?: string };
  onImproved: (value: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await MelhorarCampoObjetivoRoadmap({
            field,
            value,
            context,
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          onImproved(result.improved);
          toast.success("Campo melhorado com Qwen 3.8");
        })
      }
      className="inline-flex items-center gap-1 rounded-md border border-violet-400/20 bg-violet-400/[.06] px-2 py-1 text-[10px] font-medium text-violet-300 transition hover:bg-violet-400/10 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="animate-spin" size={11} />
      ) : (
        <Sparkles size={11} />
      )}{" "}
      Melhorar com IA
    </button>
  );
}

const NOVO_MODULO_CONSTRAINTS =
  "Este objetivo cria um MÓDULO NOVO do PainelAlpha (não é ajuste em módulo existente). " +
  "Antes de qualquer implementação, a squad deve seguir a checklist obrigatória de registro de módulo: " +
  "(1) adicionar 1 entrada em MODULOS_REGISTRY (src/lib/modulos-registry.ts) — id, label, href, iconName, category, permission; " +
  "(2) confirmar que o ícone escolhido existe em ICON_MAP (src/components/layout/GlobalSidebar.tsx), importando se necessário; " +
  "(3) só depois criar a rota em src/app/PainelAlpha/[NomeDoModulo]/page.tsx, actions e componentes. " +
  "MODULOS_REGISTRY é a fonte única — não usar os 3 arrays manuais antigos (obsoletos). " +
  "A fase de documentação (Qwen) deve detalhar o propósito do módulo, dados que ele vai manipular e quem deve ter acesso, antes de qualquer fase de execução escrever código.";

function CreateObjectiveDialog({
  open,
  onOpenChange,
  modules,
  nextPriority,
  novoModuloPreset = false,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: RoadmapModuleSnapshot[];
  nextPriority: number;
  novoModuloPreset?: boolean;
  onCreated: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [moduleKey, setModuleKey] = useState(modules[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [constraints, setConstraints] = useState(
    novoModuloPreset ? NOVO_MODULO_CONSTRAINTS : "",
  );
  const [criteria, setCriteria] = useState("");
  const [priority, setPriority] = useState(nextPriority);
  const [developmentProvider, setDevelopmentProvider] = useState<
    "claude" | "codex" | "ollama"
  >("claude");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await CriarObjetivoRoadmap({
        contractVersion: 1,
        moduleKey,
        title,
        description,
        desiredOutcome: desiredOutcome || undefined,
        constraints: constraints || undefined,
        acceptanceCriteria: criteria
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        globalPriority: priority,
        developmentProvider,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Objetivo criado e enviado para documentação");
      setTitle("");
      setDescription("");
      setDesiredOutcome("");
      setConstraints("");
      setCriteria("");
      onCreated();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#0b1524] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {novoModuloPreset ? "Novo módulo do PainelAlpha" : "Novo objetivo"}
          </DialogTitle>
          <DialogDescription>
            {novoModuloPreset
              ? "Documentação e checklist de integração do módulo serão gerados pelo Qwen antes de qualquer código. A execução só começa depois de você aprovar explicitamente."
              : "Ao salvar, o objetivo entra imediatamente na fila do Qwen conforme sua prioridade global."}
          </DialogDescription>
        </DialogHeader>
        {novoModuloPreset && (
          <div className="rounded-xl border border-violet-400/20 bg-violet-400/[.06] px-3 py-2 text-[11px] leading-5 text-violet-200/90">
            As restrições já foram pré-preenchidas com a checklist obrigatória
            de registro de módulo (MODULOS_REGISTRY). Ajuste se necessário,
            mas não remova os passos de integração.
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs text-slate-400">
            Projeto
            <select
              value={moduleKey}
              onChange={(event) => setModuleKey(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-slate-100"
            >
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            <span className="flex items-center justify-between gap-2">
              Título{" "}
              <ImproveWithAIButton
                field="title"
                value={title}
                context={{ description, desiredOutcome }}
                onImproved={setTitle}
              />
            </span>
            <Input
              required
              minLength={3}
              maxLength={180}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1.5 border-white/10 bg-slate-950"
            />
          </label>
          <label className="block text-xs text-slate-400">
            <span className="flex items-center justify-between gap-2">
              Contexto{" "}
              <ImproveWithAIButton
                field="description"
                value={description}
                context={{ title, desiredOutcome }}
                onImproved={setDescription}
              />
            </span>
            <textarea
              required
              minLength={10}
              maxLength={10000}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </label>
          <label className="block text-xs text-slate-400">
            <span className="flex items-center justify-between gap-2">
              Resultado desejado{" "}
              <ImproveWithAIButton
                field="desiredOutcome"
                value={desiredOutcome}
                context={{ title, description }}
                onImproved={setDesiredOutcome}
              />
            </span>
            <textarea
              maxLength={4000}
              rows={2}
              value={desiredOutcome}
              onChange={(event) => setDesiredOutcome(event.target.value)}
              className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </label>
          <label className="block text-xs text-slate-400">
            <span className="flex items-center justify-between gap-2">
              Restrições{" "}
              <ImproveWithAIButton
                field="constraints"
                value={constraints}
                context={{ title, description, desiredOutcome }}
                onImproved={setConstraints}
              />
            </span>
            <textarea
              maxLength={8000}
              rows={2}
              value={constraints}
              onChange={(event) => setConstraints(event.target.value)}
              className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </label>
          <label className="block text-xs text-slate-400">
            <span className="flex items-center justify-between gap-2">
              <span>
                Critérios de aceite{" "}
                <span className="text-slate-600">(um por linha)</span>
              </span>
              <ImproveWithAIButton
                field="acceptanceCriteria"
                value={criteria}
                context={{ title, description, desiredOutcome }}
                onImproved={setCriteria}
              />
            </span>
            <textarea
              required
              rows={4}
              value={criteria}
              onChange={(event) => setCriteria(event.target.value)}
              className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Prioridade global
            <Input
              type="number"
              min={1}
              max={Math.max(1, nextPriority)}
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
              className="mt-1.5 border-white/10 bg-slate-950"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="flex items-center gap-2 text-xs text-slate-400">
              <BrainCircuit size={14} className="text-violet-300" /> Cérebro de
              desenvolvimento
            </legend>
            <p className="text-[11px] text-slate-500">
              Qwen 3.8 sempre documenta o objetivo. O cérebro escolhido aqui
              executa os prompts de desenvolvimento com os agentes Bibble; se
              ficar indisponível, os outros dois assumem automaticamente, na
              ordem de prioridade escolhida.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    id: "claude",
                    label: "Claude",
                    description: "Prioridade 1 · fallback Codex → Qwen",
                  },
                  {
                    id: "codex",
                    label: "Codex",
                    description: "Prioridade 1 · fallback Claude → Qwen",
                  },
                  {
                    id: "ollama",
                    label: "Qwen",
                    description: "Prioridade 1 · fallback Claude → Codex",
                  },
                ] as const
              ).map((brain) => (
                <button
                  key={brain.id}
                  type="button"
                  aria-pressed={developmentProvider === brain.id}
                  onClick={() => setDevelopmentProvider(brain.id)}
                  className={`rounded-xl border p-3 text-left transition ${developmentProvider === brain.id ? "border-violet-400/40 bg-violet-400/10" : "border-white/10 bg-slate-950 hover:border-white/20"}`}
                >
                  <span className="block text-sm font-medium text-slate-100">
                    {brain.label}
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-500">
                    {brain.description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={isPending}
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              {isPending && <Loader2 className="animate-spin" size={15} />}{" "}
              Criar e documentar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditObjectiveDialog({
  open,
  onOpenChange,
  modules,
  objective,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: RoadmapModuleSnapshot[];
  objective: RoadmapObjectiveView;
  onUpdated: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [moduleKey, setModuleKey] = useState(objective.moduleKey);
  const [title, setTitle] = useState(objective.title);
  const [description, setDescription] = useState(objective.description);
  const [desiredOutcome, setDesiredOutcome] = useState(
    objective.desiredOutcome ?? "",
  );
  const [constraints, setConstraints] = useState(objective.constraints ?? "");
  const [criteria, setCriteria] = useState(
    objective.acceptanceCriteria.join("\n"),
  );
  const [developmentProvider, setDevelopmentProvider] = useState<
    "claude" | "codex" | "ollama"
  >(objective.developmentProvider);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await AtualizarObjetivoRoadmap({
        objectiveId: objective.id,
        content: {
          contractVersion: 1,
          moduleKey,
          title,
          description,
          desiredOutcome: desiredOutcome || undefined,
          constraints: constraints || undefined,
          acceptanceCriteria: criteria
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          developmentProvider,
        },
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.regenerated
          ? "Objetivo atualizado e nova revisão enfileirada"
          : result.providerChanged
            ? `IA de desenvolvimento alterada para ${DEVELOPMENT_PROVIDER_LABEL[result.developmentProvider]}`
            : "Nenhuma alteração material detectada",
      );
      onUpdated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#0b1524] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar objetivo</DialogTitle>
          <DialogDescription>
            Alterações de conteúdo criam uma nova revisão; mudar apenas a
            prioridade não regenera a documentação.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs text-slate-400">
            Projeto
            <select
              value={moduleKey}
              onChange={(event) => setModuleKey(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-slate-100"
            >
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            <span className="flex items-center justify-between gap-2">
              Título{" "}
              <ImproveWithAIButton
                field="title"
                value={title}
                context={{ description, desiredOutcome }}
                onImproved={setTitle}
              />
            </span>
            <Input
              required
              minLength={3}
              maxLength={180}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1.5 border-white/10 bg-slate-950"
            />
          </label>
          <label className="block text-xs text-slate-400">
            <span className="flex items-center justify-between gap-2">
              Contexto{" "}
              <ImproveWithAIButton
                field="description"
                value={description}
                context={{ title, desiredOutcome }}
                onImproved={setDescription}
              />
            </span>
            <textarea
              required
              minLength={10}
              maxLength={10000}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-400">
            <span className="flex items-center justify-between gap-2">
              Resultado desejado{" "}
              <ImproveWithAIButton
                field="desiredOutcome"
                value={desiredOutcome}
                context={{ title, description }}
                onImproved={setDesiredOutcome}
              />
            </span>
            <textarea
              maxLength={4000}
              rows={2}
              value={desiredOutcome}
              onChange={(event) => setDesiredOutcome(event.target.value)}
              className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-400">
            <span className="flex items-center justify-between gap-2">
              Restrições{" "}
              <ImproveWithAIButton
                field="constraints"
                value={constraints}
                context={{ title, description, desiredOutcome }}
                onImproved={setConstraints}
              />
            </span>
            <textarea
              maxLength={8000}
              rows={2}
              value={constraints}
              onChange={(event) => setConstraints(event.target.value)}
              className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-400">
            <span className="flex items-center justify-between gap-2">
              <span>
                Critérios de aceite{" "}
                <span className="text-slate-600">(um por linha)</span>
              </span>
              <ImproveWithAIButton
                field="acceptanceCriteria"
                value={criteria}
                context={{ title, description, desiredOutcome }}
                onImproved={setCriteria}
              />
            </span>
            <textarea
              required
              rows={4}
              value={criteria}
              onChange={(event) => setCriteria(event.target.value)}
              className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="flex items-center gap-2 text-xs text-slate-400">
              <BrainCircuit size={14} className="text-violet-300" /> IA de
              desenvolvimento
            </legend>
            <p className="text-[11px] text-slate-500">
              A troca não regenera os prompts. Uma fase já em execução termina;
              próximas tentativas e fases usam a nova preferência, com fallback
              automático para as outras duas IAs, na ordem de prioridade.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    id: "claude",
                    label: "Claude",
                    description: "Preferencial · fallback Codex → Qwen",
                  },
                  {
                    id: "codex",
                    label: "Codex",
                    description: "Preferencial · fallback Claude → Qwen",
                  },
                  {
                    id: "ollama",
                    label: "Qwen",
                    description: "Preferencial · fallback Claude → Codex",
                  },
                ] as const
              ).map((brain) => (
                <button
                  key={brain.id}
                  type="button"
                  aria-pressed={developmentProvider === brain.id}
                  onClick={() => setDevelopmentProvider(brain.id)}
                  className={`rounded-xl border p-3 text-left transition ${developmentProvider === brain.id ? "border-violet-400/40 bg-violet-400/10" : "border-white/10 bg-slate-950 hover:border-white/20"}`}
                >
                  <span className="block text-sm font-medium text-slate-100">
                    {brain.label}
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-500">
                    {brain.description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={isPending}
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              {isPending && <Loader2 className="animate-spin" size={15} />}{" "}
              Salvar e revisar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
