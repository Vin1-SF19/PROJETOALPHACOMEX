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
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Plus, Building2, User } from "lucide-react";
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

interface EtapaBpm {
  id: string;
  nome: string;
  ordem: number;
  slaDias: number | null;
}

interface CampoBpm {
  id: string;
  etapaId: string | null;
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  opcoesJson: string | null;
}

interface PipelineBpm {
  id: string;
  nome: string;
  etapas: EtapaBpm[];
  campos: CampoBpm[];
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
  _count: { tarefas: number; anexos: number };
  campoValores?: { valor: string | null }[];
}

const CORES_ETAPA = ["94,234,212", "147,197,253", "196,181,253", "253,224,71", "251,191,36", "52,211,153", "248,113,113"];

// Progressão do menos ao mais avançado no pós-fechamento (ver plano-novos-leads-bpm.md, Bloco 8).
const STATUS_POS_FECHAMENTO_CONFIG: Record<string, { label: string; classe: string }> = {
  AGUARDANDO_CONTRATO: { label: "Aguardando contrato", classe: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  CONTRATO_A_ENVIAR: { label: "Contrato a enviar", classe: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  CONTRATO_ENVIADO: { label: "Contrato enviado", classe: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  PAGAMENTO_CONFIRMADO: { label: "Pagamento confirmado", classe: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  CONTRATO_ASSINADO: { label: "Contrato assinado", classe: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

function KanbanCard({ card, accent, onAbrir }: { card: CardBpm; accent: string; onAbrir: (cardId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const naoAcessado = !card.primeiraVisualizacaoEm;
  const canalOrigem = card.campoValores?.[0]?.valor;
  const statusConfig = card.statusPosFechamento ? STATUS_POS_FECHAMENTO_CONFIG[card.statusPosFechamento] : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onAbrir(card.id)}
      className={`bg-slate-800/80 border rounded-xl p-3 space-y-2 cursor-grab active:cursor-grabbing transition-colors select-none ${
        naoAcessado ? "border-cyan-400/50 hover:border-cyan-400/70" : "border-white/5 hover:border-white/10"
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold text-white leading-tight">
        {naoAcessado && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 animate-pulse"
            title="Nunca acessado"
          />
        )}
        <Building2 size={12} className="text-slate-400 shrink-0" />
        <Link
          href={`/PainelAlpha/AlphaCRM/empresa/${card.empresa.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="hover:underline"
        >
          {card.empresa.nomeFantasia || card.empresa.razaoSocial}
        </Link>
      </div>
      {card.servico && <p className="text-[11px] text-slate-400 leading-tight">{card.servico}</p>}
      {(canalOrigem || statusConfig) && (
        <div className="flex flex-wrap items-center gap-1">
          {canalOrigem && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10">
              {canalOrigem}
            </span>
          )}
          {statusConfig && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${statusConfig.classe}`}>
              {statusConfig.label}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {card._count.tarefas > 0 && <span>{card._count.tarefas} tarefa(s)</span>}
          {card._count.anexos > 0 && <span>{card._count.anexos} anexo(s)</span>}
        </div>
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white"
          style={{ background: `rgba(${accent},0.5)` }}
          title={card.responsavel.nome}
        >
          {card.responsavel.nome?.[0]?.toUpperCase() || <User size={10} />}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({
  etapa, cor, cards, accent, onAdd, onAbrirCard,
}: {
  etapa: EtapaBpm; cor: string; cards: CardBpm[]; accent: string; onAdd: (etapaId: string) => void; onAbrirCard: (cardId: string) => void;
}) {
  return (
    <div className="flex flex-col min-w-[240px] max-w-[240px]">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: `rgb(${cor})` }} />
          <span className="text-xs font-bold text-white">{etapa.nome}</span>
          <span
            className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: `rgba(${cor},0.2)`, color: `rgb(${cor})` }}
          >
            {cards.length}
          </span>
        </div>
        <button
          onClick={() => onAdd(etapa.id)}
          className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>
      {etapa.slaDias && (
        <p className="text-[10px] text-slate-500 mb-2 px-1">SLA: {etapa.slaDias}d</p>
      )}
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          className="flex-1 rounded-2xl p-2 space-y-2 min-h-[60px] border border-dashed border-white/5"
          style={{ background: `rgba(${cor},0.03)` }}
        >
          {cards.map((c) => (
            <KanbanCard key={c.id} card={c} accent={accent} onAbrir={onAbrirCard} />
          ))}
        </div>
      </SortableContext>
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

export default function PipelineBoardClient({ pipeline, cardsIniciais, visual, currentUserId, currentUserRole }: Props) {
  const accent = visual.accent;
  const router = useRouter();
  const [cards, setCards] = useState<CardBpm[]>(cardsIniciais);
  const [cardSelecionadoId, setCardSelecionadoId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [etapaNovoCard, setEtapaNovoCard] = useState<string | null>(null);
  const [modalRevision, setModalRevision] = useState(0);
  const ultimaRequisicaoRef = useRef(0);
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardSelecionadoIdRef = useRef<string | null>(null);
  const etapaOrigemDragRef = useRef<string | null>(null);

  const etapasOrdenadas = [...pipeline.etapas].sort((a, b) => a.ordem - b.ordem);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getByEtapa = (etapaId: string) => cards.filter((c) => c.etapaId === etapaId);

  const recarregarCards = useCallback(async () => {
    const requisicao = ++ultimaRequisicaoRef.current;
    const res = await ListarCardsPipelineBpm(pipeline.id);

    if (requisicao !== ultimaRequisicaoRef.current) return false;
    if (!res.success) {
      setErro(typeof res.error === "string" ? res.error : "Nao foi possivel atualizar os cards");
      return false;
    }

    setCards(res.data);
    setErro(null);
    return true;
  }, [pipeline.id]);

  useEffect(() => {
    const canal = canalPipelineBpm(pipeline.id);
    const channel = pusherClient.subscribe(canal);

    const onAtualizado = (payload: BpmRealtimePayload) => {
      if (payload.pipelineId !== pipeline.id) return;

      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = setTimeout(() => {
        realtimeTimerRef.current = null;
        void recarregarCards();
        router.refresh();
        if (cardSelecionadoIdRef.current) {
          setModalRevision((revision) => revision + 1);
        }
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
    setActiveId(String(active.id));
    setErro(null);
    etapaOrigemDragRef.current = cards.find((card) => card.id === active.id)?.etapaId ?? null;
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeCard = cards.find((c) => c.id === active.id);
    if (!activeCard) return;

    const overEtapa = etapasOrdenadas.find((e) => e.id === over.id)?.id;
    const overCard = cards.find((c) => c.id === over.id);
    const targetEtapaId = overEtapa || overCard?.etapaId;

    if (targetEtapaId && targetEtapaId !== activeCard.etapaId) {
      setCards((prev) => prev.map((c) => (c.id === activeCard.id ? { ...c, etapaId: targetEtapaId } : c)));
    }
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) {
      etapaOrigemDragRef.current = null;
      await recarregarCards();
      return;
    }

    const activeCard = cards.find((c) => c.id === active.id);
    if (!activeCard) return;

    const overEtapa = etapasOrdenadas.find((e) => e.id === over.id)?.id;
    const overCard = cards.find((c) => c.id === over.id);
    const etapaDestinoId = overEtapa || overCard?.etapaId;

    const etapaOriginal = etapaOrigemDragRef.current;
    etapaOrigemDragRef.current = null;
    if (etapaDestinoId && etapaDestinoId !== etapaOriginal) {
      const res = await MoverCardBpm({ cardId: activeCard.id, etapaDestinoId });
      if (!res.success) {
        await recarregarCards();
        setErro(typeof res.error === "string" ? res.error : "Nao foi possivel mover o card");
        router.refresh();
        return;
      }
      await recarregarCards();
      router.refresh();
    }
  }

  const activeCard = cards.find((c) => c.id === activeId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 pb-4">
        <h1 className="text-xl font-black text-white">{pipeline.nome}</h1>
      </div>

      {erro && (
        <div className="mx-6 mb-3 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {erro}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex-1 overflow-x-auto px-6 pb-6">
          <div className="flex gap-4 h-full min-w-max">
            {etapasOrdenadas.map((etapa, i) => (
              <KanbanColumn
                key={etapa.id}
                etapa={etapa}
                cor={CORES_ETAPA[i % CORES_ETAPA.length]}
                cards={getByEtapa(etapa.id)}
                accent={accent}
                onAdd={setEtapaNovoCard}
                onAbrirCard={abrirCard}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeCard && (
            <div className="bg-slate-800 border border-white/20 rounded-xl p-3 shadow-2xl w-[220px] rotate-2 opacity-90">
              <p className="text-sm font-semibold text-white">
                {activeCard.empresa.nomeFantasia || activeCard.empresa.razaoSocial}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {etapaNovoCard && (
        <NovoCardModal
          pipelineId={pipeline.id}
          etapaId={etapaNovoCard}
          campos={pipeline.campos.filter((c) => !c.etapaId || c.etapaId === etapaNovoCard)}
          currentUserId={currentUserId}
          accent={accent}
          onClose={() => setEtapaNovoCard(null)}
          onCriado={async (dados) => {
            const res = await CriarCardBpm(dados);
            if (res.success) {
              await recarregarCards();
              setEtapaNovoCard(null);
              router.refresh();
              return { success: true as const };
            }
            return { success: false as const, error: typeof res.error === "string" ? res.error : "Erro ao criar card" };
          }}
        />
      )}

      {cardSelecionadoId && (
        <CardFullViewModal
          key={`${cardSelecionadoId}-${modalRevision}`}
          cardId={cardSelecionadoId}
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
