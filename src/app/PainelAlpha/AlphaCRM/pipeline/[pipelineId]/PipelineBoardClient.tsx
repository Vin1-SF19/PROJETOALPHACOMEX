"use client";

import {
  obterErroProximoContatoParaMovimento,
  pipelineEhRevisaoRadar,
} from "@/lib/bpm/proximo-contato";
import { etapaEhAgendarReuniao } from "@/lib/bpm/agendar-reuniao";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AlertTriangle, Bot, Building2, CalendarClock, ClipboardList, Paperclip, Plus, RefreshCw, StickyNote, Users, Video } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoverCardBpm, CriarCardBpm, ListarCardsPipelineBpm } from "@/actions/bpm/Cards";
import { PromoverNolossLead } from "@/actions/bpm/NolossLeads";
import {
  BPM_PIPELINE_EVENT,
  canalPipelineBpm,
  type BpmRealtimePayload,
} from "@/lib/bpm/realtime";
import { pusherClient } from "@/lib/pusher";
import type { TemaAlpha } from "@/lib/temas";
import NovoCardModal from "./NovoCardModal";
import AtribuirResponsavelPromocaoModal from "./AtribuirResponsavelPromocaoModal";
import CardFullViewModal from "../../CardModal/CardFullViewModal";
import NolossLeadModal from "./NolossLeadModal";
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
import { formatCNPJ } from "@/lib/format-cnpj";
import { GradientBlobCard } from "@/components/ui/gradient-blob-card";
import { SlaStatusBadge } from "@/components/bpm/sla/SlaStatusBadge";

import { SkeletonColumn } from "./PipelineBoardSkeleton";
import { useLazyColumn } from "@/hooks/useLazyColumn";

interface AutomacaoBoard {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  gatilhoTipo: string;
  possuiCondicoes: boolean;
  acoes: string[];
  recorrencia: unknown | null;
}

interface EtapaBpm {
  id: string;
  nome: string;
  ordem: number;
  slaDias: number | null;
  automacoes?: AutomacaoBoard[];
}

interface PipelineBpm {
  id: string;
  nome: string;
  etapas: EtapaBpm[];
  automacoesGlobais?: AutomacaoBoard[];
}

interface CardBpm {
  id: string;
  etapaId: string;
  servico: string | null;
  status: string;
  origem: "real" | "noloss";
  nolossLeadId: string | null;
  nolossEmail?: string | null;
  nolossTelefone?: string | null;
  createdAt: Date | string;
  primeiraVisualizacaoEm?: Date | string | null;
  proximoContatoEm?: Date | string | null;
  dataReuniao?: Date | string | null;
  googleMeetLink?: string | null;
  statusPosFechamento?: string | null;
  empresa: { id: number; razaoSocial: string; nomeFantasia: string | null; cnpj: string | null };
  responsavel: { id: number; nome: string };
  membros: MembroCard[];
  _count: { tarefas: number; anexos: number };
  tarefas: { titulo: string; prazo: Date | string | null; tipo: string }[];
  campoValores?: { valor: string | null; campo: { nome: string } }[];
  ligacoesHoje?: number;
  metaLigacoesDia?: number;
  diasUteisDecorridos?: number;
  diaCiclo?: number;
  podeAgirEtapa: boolean;
  sla?: {
    id: string;
    nome: string;
    status: "DENTRO_PRAZO" | "PROXIMO_VENCIMENTO" | "ATRASADO" | "PAUSADO" | "CONCLUIDO";
    cor: string;
    deadline: Date | string | null;
    tempoRestanteMs: number | null;
    pausadoEm: Date | string | null;
  } | null;
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

type UrgenciaProximoContato = "ATRASADO" | "HOJE" | "FUTURO";

function calcularUrgenciaProximoContato(proximoContatoEm: Date | string): UrgenciaProximoContato {
  const hojeChave = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const contatoChave = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(proximoContatoEm));
  if (contatoChave < hojeChave) return "ATRASADO";
  if (contatoChave === hojeChave) return "HOJE";
  return "FUTURO";
}

const BADGE_URGENCIA_CLASSNAME: Record<UrgenciaProximoContato, string> = {
  ATRASADO: "border-red-500/40 bg-red-500/15 text-red-200 alpha-badge-blink",
  HOJE: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  FUTURO: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
};

function BadgeProximoContato({ proximoContatoEm }: { proximoContatoEm: Date | string | null | undefined }) {
  if (!proximoContatoEm) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-400"
        title="Próximo contato: sem data definida"
      >
        <CalendarClock size={11} aria-hidden="true" />
        Sem data
      </span>
    );
  }

  const urgencia = calcularUrgenciaProximoContato(proximoContatoEm);
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-wide",
        BADGE_URGENCIA_CLASSNAME[urgencia],
      )}
      title={`Próximo contato: ${formatarPrazoNoCard(proximoContatoEm)}`}
    >
      <CalendarClock size={11} aria-hidden="true" />
      {formatarPrazoNoCard(proximoContatoEm)}
    </span>
  );
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

  const ehLeadVirtual = card.origem === "noloss";
  const agendarReuniao = etapaEhAgendarReuniao(etapaNome);
  const naoAcessado = !card.primeiraVisualizacaoEm;
  const alertaBoasVindas = !ehLeadVirtual && etapaEhBoasVindas(etapaNome) && naoAcessado;
  const canalOrigem = card.campoValores?.find((campo) => campo.campo.nome === "Canal de origem")?.valor;
  const radarPretendido = card.campoValores?.find((campo) => campo.campo.nome === "Radar pretendido")?.valor;
  const resumoAlinhamento = card.campoValores?.find((campo) => campoEhResumoAlinhamento(campo.campo.nome))?.valor;
  const alertaAlinhamento = etapaEhAlinhamentoEstrategico(etapaNome) && !resumoAlinhamento?.trim();
  const statusConfig = obterStatusPosFechamentoVisivel({ etapaNome, status: card.statusPosFechamento });
  const razaoSocial = card.empresa.razaoSocial;
  const nomeFantasia = card.empresa.nomeFantasia;
  const cnpjFormatado = formatCNPJ(card.empresa.cnpj);
  const nomeEmpresa = razaoSocial || nomeFantasia || "";
  const nomeFantasiaSecundario = nomeFantasia && nomeFantasia !== nomeEmpresa ? nomeFantasia : null;
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
      aria-label={ehLeadVirtual ? `${nomeEmpresa}. Lead do site, ainda sem card` : statusConfig ? `${nomeEmpresa}. Status pós-fechamento: ${statusConfig.label}` : nomeEmpresa}
      className={cn(
        "cursor-grab active:cursor-grabbing select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        card.sla?.status === "ATRASADO" && "rounded-2xl ring-2 ring-rose-500/55 shadow-lg shadow-rose-950/40",
        (alertaBoasVindas || alertaAlinhamento) && "animate-pulse",
        ehLeadVirtual
          ? "border-dashed border-sky-400/40 hover:border-sky-400/60"
          : alertaBoasVindas || alertaAlinhamento
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
        surfaceClassName={cn(
          statusConfig?.cardClassName,
          card.sla?.status === "ATRASADO" && "border-rose-500/60 bg-rose-950/20",
        )}
      >
        <div className="relative space-y-2.5">
          {!ehLeadVirtual && card.sla && (
            <div className="flex justify-end">
              <SlaStatusBadge sla={card.sla} />
            </div>
          )}
          {agendarReuniao && !ehLeadVirtual ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CalendarClock size={14} className="shrink-0 text-slate-500" aria-hidden="true" />
                <span className="font-medium">Data e hora</span>
                <span className="ml-auto tabular-nums text-slate-200">
                  {card.dataReuniao ? formatarPrazoNoCard(card.dataReuniao) : "Não definida"}
                </span>
              </div>

              {card.googleMeetLink ? (
                <a
                  href={card.googleMeetLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  aria-label={`Abrir Google Meet de ${nomeEmpresa}`}
                >
                  <Video size={14} aria-hidden="true" />
                  Abrir Google Meet
                </a>
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAbrir(card.id);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  aria-label={`Agendar Google Meet para ${nomeEmpresa}`}
                >
                  <Video size={14} aria-hidden="true" />
                  Agendar pelo Google Meet
                </button>
              )}
            </div>
          ) : (
            <>
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
                {ehLeadVirtual ? (
                  <span className="line-clamp-2 text-left text-white">{nomeEmpresa}</span>
                ) : (
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
                )}
              </div>
              {!ehLeadVirtual && ((!novosLeads && nomeFantasiaSecundario) || cnpjFormatado) && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {!novosLeads && nomeFantasiaSecundario && <span className="line-clamp-1 text-[11px] font-medium leading-tight text-slate-400">{nomeFantasiaSecundario}</span>}
                  {cnpjFormatado && <span className="font-mono text-[10px] leading-tight text-slate-500">{cnpjFormatado}</span>}
                </div>
              )}
              {!novosLeads && card.servico && <p className="mt-1 line-clamp-1 text-[11px] font-medium leading-tight text-slate-400">{card.servico}</p>}
            </div>
          </div>

        {!novosLeads && (alertaBoasVindas || alertaAlinhamento) && (
          <div
            role="status"
            className="flex items-center gap-1.5 rounded-xl border border-red-400/35 bg-red-500/15 px-2.5 py-2 text-[10px] font-extrabold uppercase tracking-wide text-red-100"
          >
            <AlertTriangle size={13} aria-hidden="true" className="shrink-0 text-red-300" />
            <span>{alertaBoasVindas ? "Nunca acessado — requer atenção" : "Chamada de alinhamento pendente"}</span>
          </div>
        )}

        {ehLeadVirtual && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-sky-300"
              title="Lead recebido pelo formulário do site — ainda não é uma empresa/card real"
            >
              Lead do site
            </span>
            <span className="text-[10px] text-slate-500">
              Recebido em {formatarPrazoNoCard(card.createdAt)}
            </span>
          </div>
        )}

        {!ehLeadVirtual && ((!novosLeads && (canalOrigem || statusConfig)) || (novosLeads && radarPretendido) || card.proximoContatoEm !== undefined) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {!novosLeads && canalOrigem && (
              <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-300">
                {canalOrigem}
              </span>
            )}
            {!novosLeads && statusConfig && (
              <span className={cn("rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-wide", statusConfig.badgeClassName)}>
                {statusConfig.label}
              </span>
            )}
            {novosLeads && radarPretendido && (
              <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-300">
                {radarPretendido}
              </span>
            )}
            {card.proximoContatoEm !== undefined && (
              <BadgeProximoContato proximoContatoEm={card.proximoContatoEm} />
            )}
          </div>
        )}

        {((!novosLeads && proximaTarefaComPrazo) || anotacaoRapidaPendente) && (
          <div className="space-y-1.5 border-t border-white/[0.06] pt-2.5">
            {!novosLeads && proximaTarefaComPrazo && (
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

        {!ehLeadVirtual && (
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-2.5">
            <div className="flex min-h-6 items-center gap-2 text-[10px] font-medium text-slate-400">
              {!novosLeads && card._count.tarefas > 0 && (
                <span className="inline-flex items-center gap-1" title={`${card._count.tarefas} tarefa(s)`}>
                  <ClipboardList size={12} aria-hidden="true" />
                  <span className="tabular-nums">{card._count.tarefas}</span>
                  <span className="sr-only">tarefa(s)</span>
                </span>
              )}
              {!novosLeads && card._count.anexos > 0 && (
                <span className="inline-flex items-center gap-1" title={`${card._count.anexos} anexo(s)`}>
                  <Paperclip size={12} aria-hidden="true" />
                  <span className="tabular-nums">{card._count.anexos}</span>
                  <span className="sr-only">anexo(s)</span>
                </span>
              )}
              {!novosLeads && card._count.tarefas === 0 && card._count.anexos === 0 && (
                <span className="text-slate-500">Sem pendências</span>
              )}
            </div>
            <GrupoAvataresMembrosCard
              membros={membrosVisiveis}
              limite={3}
              className="[&_[data-slot=avatar]]:shadow-sm [&_[data-slot=avatar]]:shadow-black/30"
            />
          </div>
        )}
            </>
          )}
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
      {(etapa.automacoes?.length ?? 0) > 0 && (
        <details className="group mb-2 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.035] px-2 py-1.5">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-semibold text-cyan-300">
            <Bot size={11} aria-hidden="true" />
            {etapa.automacoes!.length} automação(ões)
          </summary>
          <div className="mt-1.5 space-y-1 border-t border-cyan-400/10 pt-1.5">
            {etapa.automacoes!.map((automacao) => (
              <div key={automacao.id} className="rounded-md bg-slate-950/50 px-2 py-1 text-[10px]" title={automacao.descricao ?? undefined}>
                <p className="truncate font-semibold text-slate-200">{automacao.nome}</p>
                <p className="truncate text-slate-500">{automacao.ativa ? "Ativa" : "Inativa"} · {automacao.gatilhoTipo.replaceAll("_", " ").toLocaleLowerCase("pt-BR")}</p>
              </div>
            ))}
          </div>
        </details>
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
              arrastoDesabilitado={arrastoDesabilitado || !c.podeAgirEtapa}
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

interface PromocaoLeadPendente {
  nolossLeadId: string;
  nomeLead: string;
  etapaDestinoId: string;
  etapaDestinoNome: string;
}

export default function PipelineBoardClient({ pipeline, cardsIniciais, visual, currentUserId, currentUserRole }: Props) {
  const accent = visual.accent;
  const router = useRouter();
  const [cards, setCards] = useState<CardBpm[]>(cardsIniciais);
  const [responsavelFiltro, setResponsavelFiltro] = useState<string | null>(null);
  const [cardSelecionadoId, setCardSelecionadoId] = useState<string | null>(null);
  const [nolossLeadAberto, setNolossLeadAberto] = useState<CardBpm | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novoCardAberto, setNovoCardAberto] = useState(false);
  const [promocaoLeadPendente, setPromocaoLeadPendente] = useState<PromocaoLeadPendente | null>(null);
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

  const responsaveisDisponiveis = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const card of cards) {
      if (card.responsavel.id > 0) {
        mapa.set(card.responsavel.id, card.responsavel.nome);
      }
      for (const m of card.membros) {
        mapa.set(m.usuario.id, m.usuario.nome);
      }
    }
    return Array.from(mapa, ([id, nome]) => ({ id, nome })).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );
  }, [cards]);

  const getByEtapa = (etapaId: string) =>
    cards.filter(
      (c) =>
        c.etapaId === etapaId &&
        (!responsavelFiltro ||
          String(c.responsavel.id) === responsavelFiltro ||
          c.membros.some((m) => String(m.usuario.id) === responsavelFiltro))
    );

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
    const card = cards.find((c) => c.id === cardId);
    if (card?.origem === "noloss") {
      setNolossLeadAberto(card);
      return;
    }
    cardSelecionadoIdRef.current = cardId;
    setCardSelecionadoId(cardId);
  }, [cards]);

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

    if (activeCard.origem === "noloss" && activeCard.nolossLeadId) {
      // Lead virtual: nunca move sozinho — reverte visualmente e abre o modal
      // de "quem assume esse lead?" antes de qualquer efeito real no banco.
      const etapaDestinoNome = etapasOrdenadas.find((etapa) => etapa.id === etapaDestinoId)?.nome ?? "";
      await restaurarArrasto(snapshot);
      setPromocaoLeadPendente({
        nolossLeadId: activeCard.nolossLeadId,
        nomeLead: activeCard.empresa.nomeFantasia || activeCard.empresa.razaoSocial,
        etapaDestinoId,
        etapaDestinoNome,
      });
      return;
    }

    if (pipelineEhRevisaoRadar(pipeline.nome)) {
      const erroProximoContato = obterErroProximoContatoParaMovimento(activeCard.proximoContatoEm);
      if (erroProximoContato) {
        await restaurarArrasto(snapshot, erroProximoContato);
        return;
      }
    }

    if (etapaEhAgendarReuniao(etapasOrdenadas.find((etapa) => etapa.id === activeCard.etapaId)?.nome ?? "")) {
      setErro("Verificando regra de 8 contatos consecutivos...");
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
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black text-white">{pipeline.nome}</h1>
          {(pipeline.automacoesGlobais?.length ?? 0) > 0 && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-cyan-300" title={pipeline.automacoesGlobais!.map((automacao) => automacao.nome).join(" · ")}>
              <Bot size={11} aria-hidden="true" /> {pipeline.automacoesGlobais!.length} automação(ões) global(is)
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={responsavelFiltro ?? "todos"}
            onValueChange={(v) => setResponsavelFiltro(v === "todos" ? null : v)}
          >
            <SelectTrigger
              aria-label="Filtrar cards por responsável"
              className="w-[180px] shrink-0 border-white/10 bg-white/[0.04] text-xs text-slate-200"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <SelectValue placeholder="Todos os responsáveis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {responsaveisDisponiveis.map((r) => (
                <SelectItem key={r.id} value={String(r.id)} aria-label={r.nome}>
                  {r.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

      {nolossLeadAberto && (
        <NolossLeadModal
          lead={{
            id: nolossLeadAberto.nolossLeadId ?? nolossLeadAberto.id,
            nome: nolossLeadAberto.empresa.razaoSocial,
            email: nolossLeadAberto.nolossEmail ?? null,
            telefone: nolossLeadAberto.nolossTelefone ?? null,
            receivedAt: nolossLeadAberto.createdAt,
          }}
          pipelineId={pipeline.id}
          accent={accent}
          currentUserId={currentUserId}
          onClose={() => setNolossLeadAberto(null)}
          onPromovido={async () => {
            setNolossLeadAberto(null);
            await recarregarCards();
            router.refresh();
          }}
          onConfirmarPromocao={async (responsavelId) => {
            const res = await PromoverNolossLead({
              nolossLeadId: nolossLeadAberto.nolossLeadId ?? nolossLeadAberto.id,
              etapaDestinoId: nolossLeadAberto.etapaId,
              responsavelId,
            });
            if (res.success) return { success: true as const };
            return { success: false as const, error: typeof res.error === "string" ? res.error : "Erro ao promover lead" };
          }}
        />
      )}

      {promocaoLeadPendente && (
        <AtribuirResponsavelPromocaoModal
          pipelineId={pipeline.id}
          nomeLead={promocaoLeadPendente.nomeLead}
          etapaDestinoNome={promocaoLeadPendente.etapaDestinoNome}
          currentUserId={currentUserId}
          accent={accent}
          onCancelar={() => setPromocaoLeadPendente(null)}
          onConfirmar={async (responsavelId) => {
            const res = await PromoverNolossLead({
              nolossLeadId: promocaoLeadPendente.nolossLeadId,
              etapaDestinoId: promocaoLeadPendente.etapaDestinoId,
              responsavelId,
            });
            if (res.success) {
              setPromocaoLeadPendente(null);
              await recarregarCards();
              router.refresh();
              return { success: true as const };
            }
            return { success: false as const, error: typeof res.error === "string" ? res.error : "Erro ao promover lead" };
          }}
        />
      )}
    </div>
  );
}
