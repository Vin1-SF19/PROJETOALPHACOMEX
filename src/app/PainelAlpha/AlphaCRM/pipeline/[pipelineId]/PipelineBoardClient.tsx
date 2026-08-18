"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Building2, CalendarClock, ClipboardList, Paperclip, PhoneCall, Plus, RefreshCw, StickyNote } from "lucide-react";
import { MoverCardBpm, CriarCardBpm, ListarCardsPipelineBpm } from "@/actions/bpm/Cards";
import {
  BPM_PIPELINE_EVENT,
  canalPipelineBpm,
  type BpmRealtimePayload,
} from "@/lib/bpm/realtime";
import { pusherClient } from "@/lib/pusher";
import type { TemaAlpha } from "@/lib/temas";
import NovoCardModal from "./NovoCardModal";
import CardFullViewModal from "../../CardModal/CardFullViewModal";
import { GrupoAvataresMembrosCard, type MembroCard } from "../../CardModal/SeletorMembrosCard";
import { obterStatusPosFechamentoVisivel } from "@/lib/bpm/status-pos-fechamento";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";
import { etapaEhBoasVindas } from "@/lib/bpm/boas-vindas";
import { campoEhResumoAlinhamento, etapaEhAlinhamentoEstrategico } from "@/lib/bpm/alinhamento-estrategico";
import {
  criarSnapshotBoard,
  moverCardOtimistaNoBoard,
  podeIniciarArrastoBoard,
  resolverMovimentoOtimistaBoard,
  restaurarSnapshotBoard,
} from "@/lib/bpm/drag-drop-board";
import { cn } from "@/lib/utils";
import { GradientBlobCard } from "@/components/ui/gradient-blob-card";

import { SkeletonColumn } from "./PipelineBoardSkeleton";
import { useLazyColumn } from "@/hooks/useLazyColumn";

interface EtapaBpm {
  id: string;
  nome: string;
  ordem: number;
  slaDias: number | null;
}

interface PipelineBpm {
  id: string;
  nome: string;
  etapas: EtapaBpm[];
}

interface CardBpm {
  id: string;
  etapaId: string;
  servico: string | null;
  status: string;
  primeiraVisualizacaoEm?: Date | string | null;
  statusPosFechamento?: string | null;
  empresa: { id: number; razaoSocial: string; nomeFantasia: string | null };
  responsavel: { id: number; nome: string };
  membros: MembroCard[];
  _count: { tarefas: number; anexos: number };
  tarefas: { titulo: string; prazo: Date | string | null; tipo: string }[];
  campoValores?: { valor: string | null; campo: { nome: string } }[];
  ligacoesHoje?: number;
  metaLigacoesDia?: number;
  diasUteisDecorridos?: number;
  diaCiclo?: number;
}

const CORES_ETAPA = ["94,234,212", "147,197,253", "196,181,253", "253,224,71", "251,191,36", "52,211,153", "248,113,113"];

function formatarPrazoNoCard(data: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));
}

function KanbanCard({
  card,
  etapaNome,
  accent,
  novosLeads,
  arrastoDesabilitado,
  onAbrir,
  index = 0,
}: {
  card: CardBpm;
  etapaNome: string;
  accent: string;
  novosLeads: boolean;
  arrastoDesabilitado: boolean;
  onAbrir: (cardId: string) => void;
  index?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: arrastoDesabilitado,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, animationDelay: `${index * 40}ms` };

  const naoAcessado = !card.primeiraVisualizacaoEm;
  const alertaBoasVindas = etapaEhBoasVindas(etapaNome) && naoAcessado;
  const canalOrigem = card.campoValores?.find((campo) => campo.campo.nome === "Canal de origem")?.valor;
  const resumoAlinhamento = card.campoValores?.find((campo) => campoEhResumoAlinhamento(campo.campo.nome))?.valor;
  const alertaAlinhamento = etapaEhAlinhamentoEstrategico(etapaNome) && !resumoAlinhamento?.trim();
  const statusConfig = obterStatusPosFechamentoVisivel({ etapaNome, status: card.statusPosFechamento });
  const nomeEmpresa = card.empresa.nomeFantasia || card.empresa.razaoSocial;
  const inicialEmpresa = nomeEmpresa.trim().charAt(0).toUpperCase() || "?";
  const proximaTarefaComPrazo = card.tarefas.find((tarefa) => tarefa.prazo);
  const anotacaoRapidaPendente = card.tarefas.find((tarefa) => tarefa.tipo === "LEMBRETE_RAPIDO");
  const membrosVisiveis = card.membros.length > 0
    ? card.membros
    : [{
        userId: card.responsavel.id,
        role: "RESPONSAVEL",
        usuario: { id: card.responsavel.id, nome: card.responsavel.nome, imagemUrl: null },
      }];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onAbrir(card.id)}
      aria-label={statusConfig ? `${nomeEmpresa}. Status pós-fechamento: ${statusConfig.label}` : nomeEmpresa}
      className={cn(
        "cursor-grab active:cursor-grabbing select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        (alertaBoasVindas || alertaAlinhamento) && "animate-pulse",
        alertaBoasVindas || alertaAlinhamento
          ? "animate-pulse"
          : naoAcessado
            ? "border-cyan-400/50 hover:border-cyan-400/70"
          : statusConfig
            ? "hover:brightness-110"
            : "",
        isDragging && "cursor-grabbing border-white/20 shadow-2xl shadow-black/40 ring-1 ring-white/15",
      )}
    >
      <GradientBlobCard
        accent={accent}
        className="rounded-2xl"
        surfaceClassName={statusConfig?.cardClassName}
      >
        <div className="relative space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-xs font-black tracking-tight text-white shadow-inner shadow-white/5"
            >
              {inicialEmpresa}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold leading-tight text-white">
                {naoAcessado && (
                  <span
                    className={cn("h-1.5 w-1.5 shrink-0 rounded-full animate-pulse", alertaBoasVindas ? "bg-red-400" : "bg-cyan-400")}
                    title="Nunca acessado"
                  />
                )}
                <Building2 size={12} className="shrink-0 text-slate-400" aria-hidden="true" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAbrir(card.id);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="line-clamp-2 text-left decoration-white/40 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  aria-label={`Abrir card de ${nomeEmpresa}`}
                >
                  {nomeEmpresa}
                </button>
              </div>
              {card.servico && <p className="mt-1 line-clamp-1 text-[11px] font-medium leading-tight text-slate-400">{card.servico}</p>}
            </div>
          </div>

        {(alertaBoasVindas || alertaAlinhamento) && (
          <div
            role="status"
            className="flex items-center gap-1.5 rounded-xl border border-red-400/35 bg-red-500/15 px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-wide text-red-100"
          >
            <AlertTriangle size={13} aria-hidden="true" className="shrink-0 text-red-300" />
            <span>{alertaBoasVindas ? "Nunca acessado — requer atenção" : "Chamada de alinhamento pendente"}</span>
          </div>
        )}

        {(canalOrigem || statusConfig) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {canalOrigem && (
              <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-300">
                {canalOrigem}
              </span>
            )}
            {statusConfig && (
              <span className={cn("rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-wide", statusConfig.badgeClassName)}>
                {statusConfig.label}
              </span>
            )}
          </div>
        )}

        {novosLeads && (
          <div className="grid grid-cols-2 gap-1.5 border-t border-white/[0.06] pt-2.5">
            <div
              className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-[9px] font-bold ${
                (card.ligacoesHoje ?? 0) >= (card.metaLigacoesDia ?? 5)
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              <PhoneCall size={11} aria-hidden="true" />
              <span className="tabular-nums">{card.ligacoesHoje ?? 0}/{card.metaLigacoesDia ?? 5}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-2 py-1.5 text-[9px] font-bold text-sky-300">
              <CalendarClock size={11} aria-hidden="true" />
              <span className="tabular-nums">Dia {card.diaCiclo ?? 1}/8</span>
            </div>
          </div>
        )}

        {(proximaTarefaComPrazo || anotacaoRapidaPendente) && (
          <div className="space-y-1.5 border-t border-white/[0.06] pt-2.5">
            {proximaTarefaComPrazo && (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-200" title={`Próximo prazo: ${proximaTarefaComPrazo.titulo}`}>
                <CalendarClock size={12} aria-hidden="true" className="shrink-0 text-sky-300" />
                <span className="shrink-0 uppercase tracking-wide text-sky-300/75">Prazo</span>
                <span className="truncate tabular-nums">{formatarPrazoNoCard(proximaTarefaComPrazo.prazo!)}</span>
              </div>
            )}
            {anotacaoRapidaPendente && (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-100" title={`Anotação rápida pendente: ${anotacaoRapidaPendente.titulo}`}>
                <StickyNote size={12} aria-hidden="true" className="shrink-0 text-amber-300" />
                <span className="shrink-0 uppercase tracking-wide text-amber-300/75">Anotação</span>
                <span className="truncate">{anotacaoRapidaPendente.titulo}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-2.5">
          <div className="flex min-h-6 items-center gap-2 text-[10px] font-medium text-slate-400">
            {card._count.tarefas > 0 && (
              <span className="inline-flex items-center gap-1" title={`${card._count.tarefas} tarefa(s)`}>
                <ClipboardList size={12} aria-hidden="true" />
                <span className="tabular-nums">{card._count.tarefas}</span>
                <span className="sr-only">tarefa(s)</span>
              </span>
            )}
            {card._count.anexos > 0 && (
              <span className="inline-flex items-center gap-1" title={`${card._count.anexos} anexo(s)`}>
                <Paperclip size={12} aria-hidden="true" />
                <span className="tabular-nums">{card._count.anexos}</span>
                <span className="sr-only">anexo(s)</span>
              </span>
            )}
            {card._count.tarefas === 0 && card._count.anexos === 0 && (
              <span className="text-slate-500">Sem pendências</span>
            )}
          </div>
          <GrupoAvataresMembrosCard
            membros={membrosVisiveis}
            limite={3}
            className="[&_[data-slot=avatar]]:shadow-sm [&_[data-slot=avatar]]:shadow-black/30"
          />
        </div>
        </div>
      </GradientBlobCard>
    </div>
  );
}

function KanbanColumn({
  etapa, cor, cards, accent, arrastoDesabilitado, onAdd, onAbrirCard,
}: {
  etapa: EtapaBpm; cor: string; cards: CardBpm[]; accent: string; arrastoDesabilitado: boolean; onAdd?: () => void; onAbrirCard: (cardId: string) => void;
}) {
  const novosLeads = etapaEhNovosLeads(etapa.nome);
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: etapa.id });
  return (
    <div className="alpha-pipeline-column-shell flex flex-col h-full min-h-0 w-full md:w-[220px] lg:w-[240px] xl:w-[260px] max-w-full">
      <div className="alpha-pipeline-column-header flex items-center justify-between mb-2 px-1 py-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: `rgb(${cor})` }} />
          <span className="text-xs font-bold text-white">{etapa.nome}</span>
          <span
            aria-live="polite"
            className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: `rgba(${cor},0.2)`, color: `rgb(${cor})` }}
          >
            {cards.length}
          </span>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label="Criar card em Novos Leads"
            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        )}
      </div>
      {etapa.slaDias && (
        <p className="text-[10px] text-slate-500 mb-2 px-1">SLA: {etapa.slaDias}d</p>
      )}
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setDroppableRef}
          className={cn("alpha-pipeline-column flex-1 min-h-0 overflow-y-auto rounded-2xl p-2 space-y-2 border border-dashed border-white/5", isOver && "is-over")}
          style={{
            background: isOver ? `rgba(${cor},0.1)` : `rgba(${cor},0.03)`,
            borderColor: isOver ? `rgba(${cor},0.5)` : undefined,
          }}
        >
          {cards.map((c, i) => (
            <KanbanCard
              key={c.id}
              card={c}
              etapaNome={etapa.nome}
              accent={accent}
              novosLeads={novosLeads}
              arrastoDesabilitado={arrastoDesabilitado}
              onAbrir={onAbrirCard}
              index={i}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function LazyPipelineColumn({
  etapa, cor, cards, accent, arrastoDesabilitado, onAdd, onAbrirCard, atualizandoManual,
}: {
  etapa: EtapaBpm; cor: string; cards: CardBpm[]; accent: string; arrastoDesabilitado: boolean; onAdd?: () => void; onAbrirCard: (cardId: string) => void; atualizandoManual: boolean;
}) {
  const [ref, inView] = useLazyColumn(200);
  const showSkeleton = atualizandoManual || !inView;

  return (
    <div ref={ref} className="h-full">
      {showSkeleton ? (
        <SkeletonColumn cardCount={cards.length || 4} />
      ) : (
        <div className="alpha-content-enter h-full">
          <KanbanColumn
            etapa={etapa}
            cor={cor}
            cards={cards}
            accent={accent}
            arrastoDesabilitado={arrastoDesabilitado}
            onAdd={onAdd}
            onAbrirCard={onAbrirCard}
          />
        </div>
      )}
    </div>
  );
}

interface Props {
  pipeline: PipelineBpm;
  cardsIniciais: CardBpm[];
  visual: TemaAlpha;
  currentUserId: number | null;
  currentUserRole: string | null;
}

interface SnapshotArrasto {
  cards: CardBpm[];
  generation: number;
}

interface OpcoesRecarregarCards {
  generation?: number;
  preservarErro?: boolean;
}

export default function PipelineBoardClient({ pipeline, cardsIniciais, visual, currentUserId, currentUserRole }: Props) {
  const accent = visual.accent;
  const router = useRouter();
  const [cards, setCards] = useState<CardBpm[]>(cardsIniciais);
  const [cardSelecionadoId, setCardSelecionadoId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novoCardAberto, setNovoCardAberto] = useState(false);
  const [movimentoPendente, setMovimentoPendente] = useState(false);
  const [atualizandoManual, setAtualizandoManual] = useState(false);
  const [realtimeRevision, setRealtimeRevision] = useState(0);
  const ultimaRequisicaoRef = useRef(0);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardSelecionadoIdRef = useRef<string | null>(null);
  const snapshotArrastoRef = useRef<SnapshotArrasto | null>(null);
  const generationBoardRef = useRef(0);
  const sincronizacaoRealtimePendenteRef = useRef(false);
  const movimentoPendenteRef = useRef(false);
  const atualizacaoManualRef = useRef(false);

  const etapasOrdenadas = [...pipeline.etapas].sort((a, b) => a.ordem - b.ordem);
  // A entrada de um lead é única: só a primeira coluna pode ser Novos Leads.
  // Se a configuração do pipeline estiver inconsistente, falhamos fechados e não
  // oferecemos criação em nenhuma outra etapa.
  const primeiraEtapa = etapasOrdenadas[0];
  const etapaNovosLeads = primeiraEtapa && etapaEhNovosLeads(primeiraEtapa.nome)
    ? primeiraEtapa
    : undefined;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getByEtapa = (etapaId: string) => cards.filter((c) => c.etapaId === etapaId);

  const recarregarCards = useCallback(async (opcoes: OpcoesRecarregarCards = {}) => {
    const requisicao = ++ultimaRequisicaoRef.current;
    const generation = opcoes.generation ?? generationBoardRef.current;
    let res: Awaited<ReturnType<typeof ListarCardsPipelineBpm>>;
    try {
      res = await ListarCardsPipelineBpm(pipeline.id);
    } catch {
      if (requisicao === ultimaRequisicaoRef.current && generation === generationBoardRef.current && !opcoes.preservarErro) {
        setErro("Nao foi possivel atualizar os cards");
      }
      return false;
    }

    if (requisicao !== ultimaRequisicaoRef.current || generation !== generationBoardRef.current) return false;
    if (!res.success) {
      if (!opcoes.preservarErro) {
        setErro(typeof res.error === "string" ? res.error : "Nao foi possivel atualizar os cards");
      }
      return false;
    }

    setCards(res.data);
    if (!opcoes.preservarErro) setErro(null);
    return true;
  }, [pipeline.id]);

  const atualizarPipeline = useCallback(async () => {
    if (atualizacaoManualRef.current || movimentoPendenteRef.current || snapshotArrastoRef.current) return;

    atualizacaoManualRef.current = true;
    setAtualizandoManual(true);
    try {
      await recarregarCards();
    } finally {
      atualizacaoManualRef.current = false;
      setAtualizandoManual(false);
    }
  }, [recarregarCards]);

  useEffect(() => {
    const canal = canalPipelineBpm(pipeline.id);
    const channel = pusherClient.subscribe(canal);

    const onAtualizado = (payload: BpmRealtimePayload) => {
      if (payload.pipelineId !== pipeline.id) return;

      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        if (snapshotArrastoRef.current) {
          sincronizacaoRealtimePendenteRef.current = true;
          return;
        }
        void recarregarCards();
        if (cardSelecionadoIdRef.current) setRealtimeRevision((revision) => revision + 1);
      }, 100);
    };

    channel.bind(BPM_PIPELINE_EVENT, onAtualizado);

    return () => {
      if (realtimeTimerRef.current) {
        clearTimeout(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
      ultimaRequisicaoRef.current += 1;
      channel.unbind(BPM_PIPELINE_EVENT, onAtualizado);
      pusherClient.unsubscribe(canal);
    };
  }, [pipeline.id, recarregarCards, router]);

  const abrirCard = useCallback((cardId: string) => {
    cardSelecionadoIdRef.current = cardId;
    setCardSelecionadoId(cardId);
  }, []);

  const fecharCard = useCallback(() => {
    cardSelecionadoIdRef.current = null;
    setCardSelecionadoId(null);
  }, []);

  function onDragStart({ active }: DragStartEvent) {
    if (!podeIniciarArrastoBoard(movimentoPendenteRef.current) || snapshotArrastoRef.current) return;
    const generation = ++generationBoardRef.current;
    snapshotArrastoRef.current = {
      cards: criarSnapshotBoard(cards),
      generation,
    };
    setActiveId(String(active.id));
    setErro(null);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (movimentoPendenteRef.current || !snapshotArrastoRef.current) return;
    if (!over) return;
    const activeCard = cards.find((c) => c.id === active.id);
    if (!activeCard) return;

    const overEtapa = etapasOrdenadas.find((e) => e.id === over.id)?.id;
    const overCard = cards.find((c) => c.id === over.id);
    const targetEtapaId = overEtapa || overCard?.etapaId;

    if (targetEtapaId && targetEtapaId !== activeCard.etapaId) {
      setCards((prev) => moverCardOtimistaNoBoard(prev, activeCard.id, targetEtapaId));
    }
  }

  async function restaurarArrasto(snapshot: SnapshotArrasto, mensagem?: string) {
    if (snapshotArrastoRef.current !== snapshot) return;
    const generationRollback = ++generationBoardRef.current;
    setCards(restaurarSnapshotBoard(snapshot.cards));
    if (mensagem) setErro(mensagem);

    // A c\u00f3pia local \u00e9 a fonte imediata de verdade. A recarga \u00e9 somente uma
    // reconcilia\u00e7\u00e3o em segundo plano e n\u00e3o pode apagar o motivo do bloqueio.
    try {
      await recarregarCards({ generation: generationRollback, preservarErro: Boolean(mensagem) });
    } finally {
      if (snapshotArrastoRef.current !== snapshot) return;
      snapshotArrastoRef.current = null;
      movimentoPendenteRef.current = false;
      setMovimentoPendente(false);

      if (sincronizacaoRealtimePendenteRef.current) {
        sincronizacaoRealtimePendenteRef.current = false;
        void recarregarCards({ generation: generationBoardRef.current, preservarErro: Boolean(mensagem) });
      }
    }
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const snapshot = snapshotArrastoRef.current;
    if (!snapshot) return;
    movimentoPendenteRef.current = true;
    setMovimentoPendente(true);

    if (!over) {
      await restaurarArrasto(snapshot);
      return;
    }

    const activeCard = snapshot.cards.find((c) => c.id === active.id);
    if (!activeCard) {
      await restaurarArrasto(snapshot);
      return;
    }

    const overEtapa = etapasOrdenadas.find((e) => e.id === over.id)?.id;
    const overCard = cards.find((c) => c.id === over.id);
    const etapaDestinoId = overEtapa || overCard?.etapaId;

    if (!etapaDestinoId || etapaDestinoId === activeCard.etapaId) {
      await restaurarArrasto(snapshot);
      return;
    }

    let motivoRejeicao = "Nao foi possivel mover o card";
    try {
      const resultado = await resolverMovimentoOtimistaBoard({
        mover: async () => {
          try {
            const res = await MoverCardBpm({ cardId: activeCard.id, etapaDestinoId });
            if (!res.success) {
              motivoRejeicao = typeof res.error === "string" ? res.error : motivoRejeicao;
              return false;
            }
            return true;
          } catch {
            return false;
          }
        },
        reconciliar: () => recarregarCards({ generation: snapshot.generation }),
        restaurar: () => restaurarArrasto(snapshot, motivoRejeicao),
      });

      if (snapshotArrastoRef.current !== snapshot) return;
      if (resultado === "SINCRONIZACAO_PENDENTE") {
        setErro("Movimento salvo, mas nao foi possivel sincronizar o board agora.");
      }
    } finally {
      if (snapshotArrastoRef.current !== snapshot) return;
      snapshotArrastoRef.current = null;
      movimentoPendenteRef.current = false;
      setMovimentoPendente(false);

      if (sincronizacaoRealtimePendenteRef.current) {
        sincronizacaoRealtimePendenteRef.current = false;
        void recarregarCards({ generation: generationBoardRef.current });
      }
    }
  }

  function onDragCancel() {
    setActiveId(null);
    const snapshot = snapshotArrastoRef.current;
    if (snapshot) {
      movimentoPendenteRef.current = true;
      setMovimentoPendente(true);
      void restaurarArrasto(snapshot);
    }
  }

  const activeCard = cards.find((c) => c.id === activeId);
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 p-6 pb-4">
        <h1 className="min-w-0 truncate text-xl font-black text-white">{pipeline.nome}</h1>
        <button
          type="button"
          onClick={() => void atualizarPipeline()}
          disabled={atualizandoManual || movimentoPendente}
          aria-label="Atualizar pipeline"
          title="Atualizar pipeline"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${atualizandoManual ? "animate-spin" : ""}`} aria-hidden="true" />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {erro && (
        <div
          role="alert"
          aria-live="assertive"
          className="mx-6 mb-3 flex items-center justify-between gap-3 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
        >
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => void atualizarPipeline()}
            className="shrink-0 rounded-lg border border-rose-400/30 px-2.5 py-1 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-6 pb-[clamp(8px,2vh,24px)]" style={{ perspective: "1200px" }}>
          <div className="flex gap-3 h-full min-w-max">
            <span role="status" aria-live="polite" className="sr-only">
              {atualizandoManual ? "Carregando pipeline…" : ""}
            </span>
            {etapasOrdenadas.map((etapa, i) => (
              <LazyPipelineColumn
                key={etapa.id}
                etapa={etapa}
                cor={CORES_ETAPA[i % CORES_ETAPA.length]}
                cards={getByEtapa(etapa.id)}
                accent={accent}
                arrastoDesabilitado={movimentoPendente}
                onAdd={etapa.id === etapaNovosLeads?.id ? () => setNovoCardAberto(true) : undefined}
                onAbrirCard={abrirCard}
                atualizandoManual={atualizandoManual}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="bg-slate-800 border border-white/20 rounded-xl p-3 shadow-2xl w-[240px] rotate-2 opacity-90">
              <p className="text-sm font-semibold text-white">
                {activeCard.empresa.nomeFantasia || activeCard.empresa.razaoSocial}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {novoCardAberto && etapaNovosLeads && (
        <NovoCardModal
          pipelineId={pipeline.id}
          etapaId={etapaNovosLeads.id}
          currentUserId={currentUserId}
          accent={accent}
          onClose={() => setNovoCardAberto(false)}
          onCriado={async (dados) => {
            const res = await CriarCardBpm(dados);
            if (res.success) {
              await recarregarCards();
              setNovoCardAberto(false);
              router.refresh();
              return { success: true as const };
            }
            return { success: false as const, error: typeof res.error === "string" ? res.error : "Erro ao criar card" };
          }}
        />
      )}

      {cardSelecionadoId && (
        <CardFullViewModal
          cardId={cardSelecionadoId}
          realtimeRevision={realtimeRevision}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          accent={accent}
          onClose={fecharCard}
          onAtualizado={async () => {
            await recarregarCards();
            router.refresh();
          }}
          onAbrirCard={abrirCard}
        />
      )}
    </div>
  );
}
