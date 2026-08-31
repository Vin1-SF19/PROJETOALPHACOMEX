"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Plus, Star, CalendarClock, Building2, MapPin, ArrowLeftRight, Handshake, LogOut, Pencil, Target, Search, X } from "lucide-react";
import {
  DndContext, type DragEndEvent, DragOverlay, type DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getTema } from "@/lib/temas";
import {
  MoverLeadAquisicaoParceiro,
  RegistrarSaidaLateralLeadAquisicao,
  AtualizarPotencialLeadAquisicao,
  RegistrarProximaAcaoLeadAquisicao,
  AtualizarCadastroLeadAquisicao,
  PromoverLeadParaParceiro,
  ListarLeadsAquisicaoParceiros,
} from "@/actions/parceiros-aquisicao";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AnimatedShaderBackground from "@/components/ui/animated-shader-background";
import { GradientBlobCard } from "@/components/ui/gradient-blob-card";
import NovoLeadCompleto, { type LeadEdicao } from "@/components/Parceiros/Aquisicao/NovoLeadCompleto";
import { cn } from "@/lib/utils";

type Permissao = { isAdmin: boolean; podeEditar: boolean; podeExcluir: boolean; podeAprovar: boolean };
type Lead = Awaited<ReturnType<typeof ListarLeadsAquisicaoParceiros>>["leads"][number];
type Responsavel = { id: number; nome: string };

// Mesma paleta cíclica já usada no Kanban do Alpha CRM (PipelineBoardClient.tsx,
// CORES_ETAPA) — mantém a identidade visual do "produto Kanban" do painel.
const CORES_ETAPA = ["94,234,212", "147,197,253", "196,181,253", "253,224,71", "251,191,36", "52,211,153", "248,113,113", "125,211,252", "165,180,252"];

const ETAPAS: { status: string; label: string }[] = [
  { status: "NOVO_LEAD", label: "Novo Lead" },
  { status: "EM_PROSPECCAO", label: "Em Prospecção" },
  { status: "CONTATO_REALIZADO", label: "Contato Realizado" },
  { status: "EM_QUALIFICACAO", label: "Em Qualificação" },
  { status: "REUNIAO_AGENDADA", label: "Reunião Agendada" },
  { status: "REUNIAO_REALIZADA", label: "Reunião Realizada" },
  { status: "NEGOCIACAO_FOLLOWUP", label: "Negociação / Follow-up" },
  { status: "AGUARDANDO_CADASTRO", label: "Aguardando Cadastro" },
  { status: "PRE_CADASTRO", label: "Pré-cadastro" },
];

// Saídas laterais têm cor semântica própria (não a paleta cíclica do funil principal) —
// reforça visualmente que são desvios do fluxo, não etapas de progresso.
const SAIDAS: { status: string; label: string; cor: string }[] = [
  { status: "STANDBY", label: "Stand-by", cor: "251,191,36" }, // âmbar — pausado, pode voltar
  { status: "SEM_PERFIL", label: "Sem Perfil", cor: "148,163,184" }, // slate — neutro/encerrado
  { status: "PERDIDO", label: "Perdido", cor: "248,113,113" }, // vermelho — encerrado negativo
];

const PARTICULAS_FUNDO_AQUISICAO = [
  { x: 10, y: 18, duracao: 5.6, delay: 0 },
  { x: 85, y: 14, duracao: 6.1, delay: 0.6 },
  { x: 18, y: 65, duracao: 5.9, delay: 1.2 },
  { x: 90, y: 58, duracao: 6.4, delay: 0.3 },
  { x: 48, y: 88, duracao: 5.3, delay: 1.6 },
] as const;

function PotencialBadge({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-[10px] text-slate-500">Sem score</span>;
  return (
    <div className="flex items-center gap-0.5" title={`Potencial de recorrência: ${valor}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={11} className={i < valor ? "fill-amber-400 text-amber-400" : "text-slate-700"} />
      ))}
    </div>
  );
}

// Mesmo algoritmo/paleta de urgência já usado no card do Alpha CRM (PipelineBoardClient.tsx,
// calcularUrgenciaProximoContato/BADGE_URGENCIA_CLASSNAME) — RM-2026-3F263C alinha o card de
// Aquisição ao padrão visual do CRM.
type UrgenciaProximaAcao = "ATRASADO" | "HOJE" | "FUTURO";

function calcularUrgenciaProximaAcao(proximaAcaoEm: Date | string): UrgenciaProximaAcao {
  const hojeChave = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const acaoChave = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(proximaAcaoEm));
  if (acaoChave < hojeChave) return "ATRASADO";
  if (acaoChave === hojeChave) return "HOJE";
  return "FUTURO";
}

const BADGE_URGENCIA_CLASSNAME: Record<UrgenciaProximaAcao, string> = {
  ATRASADO: "border-red-500/40 bg-red-500/15 text-red-200",
  HOJE: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  FUTURO: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
};

const REGRAS_PRIORIDADE_FOLLOW_UP = {
  diasAtencao: 14,
  diasAlta: 30,
  potencialAlto: 4,
  potencialMedio: 3,
} as const;

function formatarDataCard(data: Date | string | null): string {
  return data ? new Date(data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

function diasDesde(data: Date | string): number {
  const inicio = new Date(data);
  const agora = new Date();
  return Math.max(0, Math.floor((agora.getTime() - inicio.getTime()) / 86_400_000));
}

function diasSemIndicacaoDoLead(lead: Lead): number {
  return diasDesde(lead.ultimaIndicacaoEm ?? lead.createdAt);
}

const LABEL_ACAO_HISTORICO: Record<string, string> = {
  LEAD_CRIADO: "Lead criado",
  LEAD_CRIADO_COMPLETO: "Lead criado com cadastro completo",
  LEAD_EDITADO_COMPLETO: "Cadastro completo atualizado",
  CADASTRO_EDITADO: "Cadastro atualizado",
  ETAPA_ALTERADA: "Etapa alterada",
  POTENCIAL_ALTERADO: "Potencial de recorrência atualizado",
  PROXIMA_ACAO_REGISTRADA: "Próxima ação registrada",
  SAIDA_LATERAL: "Saída lateral registrada",
};

function labelHistorico(acao: string): string {
  return LABEL_ACAO_HISTORICO[acao] ?? acao.replaceAll("_", " ").toLowerCase();
}

function BadgeProximaAcao({ proximaAcaoEm }: { proximaAcaoEm: Date | string }) {
  const urgencia = calcularUrgenciaProximaAcao(proximaAcaoEm);
  const formatado = new Date(proximaAcaoEm).toLocaleDateString("pt-BR");
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-wide",
        BADGE_URGENCIA_CLASSNAME[urgencia],
      )}
      title={`Próxima ação: ${formatado}`}
    >
      <CalendarClock size={11} aria-hidden="true" />
      {formatado}
    </span>
  );
}

function prioridadeFollowUp(lead: Lead): { label: string; detail: string; className: string } {
  const potencial = lead.potencialRecorrencia ?? 0;
  const diasSemIndicacao = diasSemIndicacaoDoLead(lead);
  if (!lead.proximaAcaoEm) return { label: "URGENTE", detail: `Sem próxima ação · ${diasSemIndicacao} dias sem indicação`, className: "text-red-200 bg-red-500/15 border-red-500/30" };
  const urgencia = calcularUrgenciaProximaAcao(lead.proximaAcaoEm);
  if (urgencia === "ATRASADO") return { label: "URGENTE", detail: `Próxima ação vencida · ${diasSemIndicacao} dias sem indicação`, className: "text-red-200 bg-red-500/15 border-red-500/30" };
  if (diasSemIndicacao >= REGRAS_PRIORIDADE_FOLLOW_UP.diasAlta || (potencial >= REGRAS_PRIORIDADE_FOLLOW_UP.potencialAlto && diasSemIndicacao >= REGRAS_PRIORIDADE_FOLLOW_UP.diasAtencao)) return { label: "ALTA", detail: `Potencial ${potencial}/5 · ${diasSemIndicacao} dias sem indicação`, className: "text-amber-200 bg-amber-500/15 border-amber-500/30" };
  if (diasSemIndicacao >= REGRAS_PRIORIDADE_FOLLOW_UP.diasAtencao || potencial >= REGRAS_PRIORIDADE_FOLLOW_UP.potencialMedio) return { label: "MÉDIA", detail: `Potencial ${potencial}/5 · ${diasSemIndicacao} dias sem indicação`, className: "text-sky-200 bg-sky-500/15 border-sky-500/30" };
  return { label: "NORMAL", detail: `Acompanhamento em dia · ${diasSemIndicacao} dias sem indicação`, className: "text-emerald-200 bg-emerald-500/15 border-emerald-500/30" };
}

/** Card individual do lead — arrastável (dnd-kit `useSortable`), mesmo padrão do
 * BlueprintProjectCard.tsx. */
function LeadCard({ lead, cor, onAbrirLead }: { lead: Lead; cor: string; onAbrirLead: (lead: Lead) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const inicial = lead.nome.trim().charAt(0).toUpperCase() || "?";

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging) onAbrirLead(lead); }}
      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-2xl cursor-grab active:cursor-grabbing"
      aria-label={`Abrir lead ${lead.nome}`}
    >
      <GradientBlobCard accent={cor} className="hover:brightness-110 transition-[filter]">
        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-xs font-black text-slate-200">
              {inicial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight text-slate-100 truncate">{lead.nomeFantasia || lead.nome}</p>
                <span className="shrink-0 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-300">{lead.status === "NOVO_LEAD" ? "NOVO" : lead.status.replaceAll("_", " ")}</span>
              </div>
              {lead.classificacao && <span className="mt-1 inline-flex rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300">{lead.classificacao}</span>}
              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                {lead.segmento && <span className="flex items-center gap-1"><Building2 size={10} /> {lead.segmento}</span>}
                {lead.uf && <span className="flex items-center gap-1"><MapPin size={10} /> {lead.uf}</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-2">
            <div><p className="text-[8px] uppercase tracking-wider text-slate-600">Última indicação</p><p className="text-[10px] font-bold text-slate-300">{formatarDataCard(lead.ultimaIndicacaoEm)}</p><p className="text-[9px] text-slate-500">há {diasSemIndicacaoDoLead(lead)} dias</p></div>
            <div><p className="text-[8px] uppercase tracking-wider text-slate-600">Próxima ação</p><p className="text-[10px] font-bold text-slate-300">{lead.proximaAcaoDescricao || "Não definida"}</p>{lead.proximaAcaoEm && <p className="text-[9px] text-slate-500">{formatarDataCard(lead.proximaAcaoEm)}</p>}</div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 border-y border-white/[0.06] py-2 text-center">
            <div><p className="text-[8px] uppercase tracking-wider text-slate-600">Indicações</p><p className="text-sm font-black text-slate-200">{lead.indicacoesCount}</p></div>
            <div><p className="text-[8px] uppercase tracking-wider text-slate-600">Contratos</p><p className="text-sm font-black text-slate-200">{lead.contratosCount}</p></div>
            <div><p className="text-[8px] uppercase tracking-wider text-slate-600">Conversão</p><p className="text-sm font-black text-slate-200">{lead.conversaoPercentual === null ? "—" : `${lead.conversaoPercentual.toLocaleString("pt-BR")}%`}</p></div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><Target size={11} /> Recorrência <PotencialBadge valor={lead.potencialRecorrencia} /></div>
            {lead.proximaAcaoEm ? <BadgeProximaAcao proximaAcaoEm={lead.proximaAcaoEm} /> : <span className="text-[9px] font-bold text-red-300">Sem próxima ação</span>}
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
            {(() => { const p = prioridadeFollowUp(lead); return <span className={cn("rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider", p.className)} title={p.detail}>Follow-up {p.label}</span>; })()}
            <span className="text-[9px] text-slate-600">{lead.origem || "Origem não informada"}</span>
          </div>

          {lead.responsavel && (
            <p className="text-[10px] text-slate-600 truncate">Resp.: {lead.responsavel.nome}</p>
          )}
        </div>
      </GradientBlobCard>
    </button>
  );
}

/** Cada etapa vira um "cartão" visualmente independente — cor própria no header,
 * contorno e fundo levemente tingidos, mesmo padrão de separação por coluna já
 * usado no Kanban do Alpha CRM (PipelineBoardClient.tsx). Droppable via dnd-kit,
 * mesmo padrão de BlueprintColumn.tsx. */
function KanbanColuna({
  status,
  label,
  cor,
  itens,
  onAbrirLead,
  tracejada = false,
}: {
  status: string;
  label: string;
  cor: string;
  itens: Lead[];
  onAbrirLead: (lead: Lead) => void;
  tracejada?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const permiteBusca = status === "NOVO_LEAD";
  const termoNormalizado = termoBusca.trim().toLocaleLowerCase("pt-BR");
  const itensVisiveis = termoNormalizado
    ? itens.filter((lead) => (lead.nomeFantasia || lead.nome).toLocaleLowerCase("pt-BR").includes(termoNormalizado))
    : itens;

  return (
    <div className="shrink-0 w-[280px] h-full flex flex-col rounded-2xl overflow-hidden" style={{ background: "rgba(8,11,20,0.55)", border: `1px solid rgba(${cor},0.22)`, boxShadow: `0 0 0 1px rgba(0,0,0,0.2), 0 12px 30px -18px rgba(${cor},0.35)` }}>
      <div className="shrink-0 border-b px-3.5 py-3" style={{ borderColor: `rgba(${cor},0.18)`, background: `rgba(${cor},0.06)` }}>
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `rgb(${cor})`, boxShadow: `0 0 8px rgba(${cor},0.7)` }} />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-200 truncate">{label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {permiteBusca && <button type="button" onClick={() => setBuscaAberta((aberta) => !aberta)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Pesquisar leads por nome" title="Pesquisar leads por nome"><Search size={13} /></button>}
          <span className="text-[10px] font-bold shrink-0 rounded-full px-2 py-0.5" style={{ background: `rgba(${cor},0.18)`, color: `rgb(${cor})` }}>
            {termoNormalizado ? `${itensVisiveis.length}/${itens.length}` : itens.length}
          </span>
        </div>
        </div>
        {permiteBusca && buscaAberta && <div className="relative mt-2"><Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" /><input autoFocus value={termoBusca} onChange={(event) => setTermoBusca(event.target.value)} placeholder="Buscar pelo nome..." className="h-8 w-full rounded-lg border border-white/10 bg-black/30 pl-8 pr-8 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-white/20" />{termoBusca && <button type="button" onClick={() => setTermoBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Limpar pesquisa"><X size={12} /></button>}</div>}
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 rounded-b-2xl transition-colors ${tracejada ? "border-dashed" : ""} ${isOver ? "bg-white/[0.04]" : ""}`}
        style={tracejada ? { border: `1px dashed rgba(${cor},0.12)`, borderTop: "none" } : undefined}
      >
        <SortableContext items={itensVisiveis.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {itensVisiveis.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-[10px] text-slate-600">{termoNormalizado ? "Nenhum lead encontrado" : "Vazio"}</p>
            </div>
          ) : (
            itensVisiveis.map((lead) => <LeadCard key={lead.id} lead={lead} cor={cor} onAbrirLead={onAbrirLead} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export default function AquisicaoParceirosClient({
  temaName,
  permissao,
  leadsIniciais,
  responsaveis,
}: {
  temaName: string;
  permissao: Permissao;
  leadsIniciais: Lead[];
  responsaveis: Responsavel[];
}) {
  const tema = getTema(temaName);
  const accent = tema.accent;
  const reduceMotion = useReducedMotion();
  const [leads, setLeads] = useState<Lead[]>(leadsIniciais);
  const [leadFoco, setLeadFoco] = useState<Lead | null>(null);
  const [novoLeadOpen, setNovoLeadOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const podeEditar = permissao.isAdmin || permissao.podeEditar;

  async function recarregar() {
    const r = await ListarLeadsAquisicaoParceiros();
    if (r.success) setLeads(r.leads);
  }

  const colunasFunil = useMemo(() => {
    return ETAPAS.map((col, i) => ({ ...col, cor: CORES_ETAPA[i % CORES_ETAPA.length], itens: leads.filter((l) => l.status === col.status) }));
  }, [leads]);

  const colunasSaida = useMemo(() => {
    return SAIDAS.map((col) => ({ ...col, itens: leads.filter((l) => l.status === col.status) }));
  }, [leads]);

  // Drag-and-drop — mesmo padrão de BlueprintKanban.tsx: PointerSensor só (sem teclado,
  // consistente com os outros 2 Kanbans do projeto), optimistic update local, servidor
  // valida a transição (podeMoverPara em parceiros-aquisicao.ts) e recusa se inválida.
  const [ativoLeadId, setAtivoLeadId] = useState<string | null>(null);
  const [saidaLateralPendente, setSaidaLateralPendente] = useState<{ leadId: string; status: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const leadAtivo = leads.find((l) => l.id === ativoLeadId) ?? null;
  const statusSaidaLateral = new Set(SAIDAS.map((s) => s.status));

  function handleDragStart(event: DragStartEvent) {
    setAtivoLeadId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setAtivoLeadId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const leadAtual = leads.find((l) => l.id === leadId);
    if (!leadAtual) return;

    const overId = String(over.id);
    const todosStatus = [...ETAPAS.map((e) => e.status), ...SAIDAS.map((s) => s.status)];
    const novoStatus = todosStatus.includes(overId) ? overId : leads.find((l) => l.id === overId)?.status;
    if (!novoStatus || novoStatus === leadAtual.status) return;

    // Saídas laterais exigem motivo (RegistrarSaidaLateralLeadAquisicao) — abre modal em vez
    // de mover direto, mesmo espírito do card noloss no Pipeline BPM (PipelineBoardClient.tsx).
    if (statusSaidaLateral.has(novoStatus)) {
      setSaidaLateralPendente({ leadId, status: novoStatus });
      return;
    }

    const statusAnterior = leadAtual.status;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: novoStatus as Lead["status"] } : l)));
    const res = await MoverLeadAquisicaoParceiro({ leadId, statusDestino: novoStatus as Lead["status"] });
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível mover o lead");
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: statusAnterior } : l)));
    }
  }

  return (
    <main className="relative h-screen w-full flex flex-col overflow-hidden" style={{ background: "#05070d" }}>
      {/* Fundo vivo — mesmo padrão do restante do módulo Parceiros (shader + glows + partículas) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {!reduceMotion && (
          <div className="absolute inset-0 opacity-60">
            <AnimatedShaderBackground />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "rgba(5,7,13,0.72)" }} />
        <motion.div
          className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full"
          style={{ background: `rgba(${accent},0.14)`, filter: "blur(140px)" }}
          animate={reduceMotion ? { opacity: 0.5 } : { scale: [1, 1.08, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={reduceMotion ? undefined : { duration: 9, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -right-24 w-[500px] h-[500px] rounded-full"
          style={{ background: "rgba(99,102,241,0.1)", filter: "blur(130px)" }}
          animate={reduceMotion ? { opacity: 0.5 } : { scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={reduceMotion ? undefined : { duration: 11, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: 1.2 }}
        />
        {!reduceMotion && PARTICULAS_FUNDO_AQUISICAO.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: `rgba(${accent},0.5)`, boxShadow: `0 0 8px rgba(${accent},0.5)` }}
            animate={{ y: [0, -14, 0], opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: p.duracao, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
      </div>

      <header className="relative z-10 shrink-0 px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(5,7,13,0.4)", backdropFilter: "blur(8px)" }}>
        <div className="flex items-center gap-3">
          <Link href="/PainelAlpha/Parceiros" className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white transition-colors" style={{ background: "rgba(255,255,255,0.05)" }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-black text-slate-100">Aquisição de Parceiros</h1>
            <p className="text-[11px] text-slate-500">Funil de potencial parceiro até o cadastro formal — {leads.length} em andamento</p>
          </div>
        </div>
        {podeEditar && (
          <button
            onClick={() => setNovoLeadOpen(true)}
            className="h-10 px-4 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest text-black hover:brightness-110 transition-all"
            style={{ background: `rgba(${accent},1)` }}
          >
            <Plus size={15} strokeWidth={2.6} /> Novo Lead
          </button>
        )}
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={(e) => void handleDragEnd(e)}>
        <div className="relative z-10 flex-1 min-h-0 p-6 flex gap-4 overflow-x-auto overflow-y-hidden">
          {colunasFunil.map((col) => (
            <KanbanColuna key={col.status} status={col.status} label={col.label} cor={col.cor} itens={col.itens} onAbrirLead={setLeadFoco} />
          ))}

          {/* Divisor visual — separa o fluxo principal das saídas laterais */}
          <div className="shrink-0 flex flex-col items-center justify-center px-1" aria-hidden>
            <div className="w-px flex-1" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent)" }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 py-2 [writing-mode:vertical-rl]">Saídas</span>
            <div className="w-px flex-1" style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent)" }} />
          </div>

          {colunasSaida.map((col) => (
            <KanbanColuna key={col.status} status={col.status} label={col.label} cor={col.cor} itens={col.itens} onAbrirLead={setLeadFoco} tracejada />
          ))}
        </div>

        <DragOverlay>
          {leadAtivo && (
            <div style={{ transform: "rotate(-2deg)", width: 280 }}>
              <GradientBlobCard accent="255,255,255">
                <p className="text-sm font-semibold text-slate-100">{leadAtivo.nome}</p>
              </GradientBlobCard>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {novoLeadOpen && (
        <NovoLeadCompleto
          accent={accent}
          responsaveis={responsaveis}
          onClose={() => setNovoLeadOpen(false)}
          onCriado={() => {
            setNovoLeadOpen(false);
            startTransition(() => void recarregar());
          }}
        />
      )}

      {leadFoco && (
        <LeadDetalheDialog
          lead={leadFoco}
          accent={accent}
          podeEditar={podeEditar}
          responsaveis={responsaveis}
          onClose={() => setLeadFoco(null)}
          onAtualizado={() => {
            setLeadFoco(null);
            startTransition(() => void recarregar());
          }}
        />
      )}

      {saidaLateralPendente && (
        <SaidaLateralDragDialog
          accent={accent}
          statusLabel={SAIDAS.find((s) => s.status === saidaLateralPendente.status)?.label ?? saidaLateralPendente.status}
          onCancelar={() => setSaidaLateralPendente(null)}
          onConfirmar={async (motivo) => {
            const { leadId, status } = saidaLateralPendente;
            setSaidaLateralPendente(null);
            const res = await RegistrarSaidaLateralLeadAquisicao({ leadId, status, motivo });
            if (!res.success) { toast.error(res.error ?? "Não foi possível registrar a saída lateral"); return; }
            toast.success("Saída lateral registrada");
            startTransition(() => void recarregar());
          }}
        />
      )}

      {isPending && (
        <div className="fixed bottom-4 right-4 text-[11px] text-slate-500 px-3 py-1.5 rounded-full" style={{ background: "rgba(15,23,42,0.9)" }}>
          Atualizando...
        </div>
      )}
    </main>
  );
}

/** Arrastar um lead pra uma coluna de saída lateral (Stand-by/Sem Perfil/Perdido) exige motivo
 * — a Server Action rejeita sem isso. Abre este modal em vez de mover direto, mesmo espírito do
 * card noloss no Pipeline BPM (PipelineBoardClient.tsx). */
function SaidaLateralDragDialog({
  accent,
  statusLabel,
  onCancelar,
  onConfirmar,
}: {
  accent: string;
  statusLabel: string;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.85)", backdropFilter: "blur(6px)" }} onClick={() => !salvando && onCancelar()}>
      <div className="w-full max-w-md rounded-3xl p-5" style={{ background: "#0a1020", border: `1px solid rgba(${accent},0.3)` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
            <LogOut size={17} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-[14px] font-black text-white">Mover para &ldquo;{statusLabel}&rdquo;</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Descreva o motivo da saída lateral antes de confirmar.</p>
          </div>
        </div>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Descreva o motivo..."
          autoFocus
          className="w-full min-h-20 rounded-xl px-3 py-2 text-[12px] outline-none text-slate-200 resize-none"
          style={{ background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)` }}
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancelar} disabled={salvando} className="px-4 py-2 rounded-xl text-[12px] font-bold text-slate-400 hover:text-white">Cancelar</button>
          <button
            onClick={async () => {
              if (!motivo.trim()) { toast.error("Descreva o motivo"); return; }
              setSalvando(true);
              await onConfirmar(motivo.trim());
              setSalvando(false);
            }}
            disabled={salvando}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-[12px] font-black uppercase tracking-wider text-red-300 disabled:opacity-60"
            style={{ background: "rgba(239,68,68,0.15)" }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadDetalheDialog({
  lead,
  accent,
  podeEditar,
  responsaveis,
  onClose,
  onAtualizado,
}: {
  lead: Lead;
  accent: string;
  podeEditar: boolean;
  responsaveis: Responsavel[];
  onClose: () => void;
  onAtualizado: () => void;
}) {
  const [statusDestino, setStatusDestino] = useState(lead.status);
  const [potencial, setPotencial] = useState<number>(lead.potencialRecorrencia ?? 0);
  const [proximaAcaoData, setProximaAcaoData] = useState("");
  const [proximaAcaoDesc, setProximaAcaoDesc] = useState("");
  const [motivoSaida, setMotivoSaida] = useState("");
  const [saidaSelecionada, setSaidaSelecionada] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [docPromocao, setDocPromocao] = useState(lead.documento ?? "");
  const [emailPromocao, setEmailPromocao] = useState(lead.email ?? "");
  const [editarCadastroAberto, setEditarCadastroAberto] = useState(false);

  const inputCls = "w-full h-10 rounded-xl px-3 text-[12px] outline-none text-slate-200";
  const inputStyle = { background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)` };

  async function mover() {
    if (statusDestino === lead.status) return;
    setSalvando(true);
    const r = await MoverLeadAquisicaoParceiro({ leadId: lead.id, statusDestino });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Etapa atualizada");
    onAtualizado();
  }

  async function salvarPotencial() {
    setSalvando(true);
    const r = await AtualizarPotencialLeadAquisicao({ leadId: lead.id, potencialRecorrencia: potencial });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Potencial atualizado");
    onAtualizado();
  }

  async function salvarProximaAcao() {
    if (!proximaAcaoData || !proximaAcaoDesc.trim()) return toast.error("Preencha data e descrição");
    setSalvando(true);
    const r = await RegistrarProximaAcaoLeadAquisicao({ leadId: lead.id, proximaAcaoEm: proximaAcaoData, proximaAcaoDescricao: proximaAcaoDesc.trim() });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Próxima ação registrada");
    onAtualizado();
  }

  async function registrarSaida() {
    if (!saidaSelecionada) return toast.error("Selecione o motivo da saída lateral");
    if (!motivoSaida.trim()) return toast.error("Descreva o motivo");
    setSalvando(true);
    const r = await RegistrarSaidaLateralLeadAquisicao({ leadId: lead.id, status: saidaSelecionada, motivo: motivoSaida.trim() });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Saída lateral registrada");
    onAtualizado();
  }

  async function promover() {
    setSalvando(true);
    const r = await PromoverLeadParaParceiro({
      leadId: lead.id,
      documento: docPromocao || undefined,
      email: emailPromocao || undefined,
    });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Parceiro cadastrado com sucesso!");
    onAtualizado();
  }

  const inicial = lead.nome.trim().charAt(0).toUpperCase() || "?";
  const etapaAtual = ETAPAS.findIndex((e) => e.status === lead.status);
  const prioridade = prioridadeFollowUp(lead);

  return (
    <>
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[94vh] max-h-[94vh] rounded-t-[2rem] border-t border-white/10 bg-[radial-gradient(ellipse_120%_60%_at_50%_-10%,rgba(var(--accent-rgb),0.12),transparent_60%)] bg-[#020617] p-0 overflow-hidden sm:max-w-none"
        style={{ ["--accent-rgb" as string]: accent }}
      >
        {/* Handle visual do bottom-sheet — mesmo padrão do card aberto do CRM */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        <div className="px-6 sm:px-8 pt-2 pb-5 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg text-sm font-black text-slate-100"
              style={{
                background: `linear-gradient(135deg, rgba(${accent},0.35), rgba(${accent},0.08))`,
                boxShadow: `0 8px 24px -8px rgba(${accent},0.5)`,
              }}
            >
              {inicial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <SheetTitle className="text-xl font-black text-white tracking-tight truncate">{lead.nome}</SheetTitle>
                <span className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-cyan-200">{ETAPAS[etapaAtual]?.label || lead.status.replaceAll("_", " ")}</span>
                {lead.classificacao && <span className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-200">{lead.classificacao}</span>}
                {podeEditar && (
                  <button
                    onClick={() => setEditarCadastroAberto(true)}
                    className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                    aria-label="Editar dados de cadastro do lead"
                    title="Editar dados de cadastro"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                {lead.segmento && <span className="flex items-center gap-1"><Building2 size={11} /> {lead.segmento}</span>}
                {lead.telefone && <span>{lead.telefone}</span>}
                {lead.email && <span className="truncate">{lead.email}</span>}
              </div>
              {lead.origem && (
                <span
                  className="inline-flex mt-2 items-center rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{ background: `rgba(${accent},0.1)`, borderColor: `rgba(${accent},0.3)`, color: `rgba(${accent},1)` }}
                >
                  {lead.origem}
                </span>
              )}
              {lead.motivoSaidaLateral && (
                <p className="mt-2 text-xs text-amber-400">Motivo saída: {lead.motivoSaidaLateral}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 gap-4 overflow-y-auto px-4 pb-6 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(260px,0.65fr)] lg:overflow-hidden min-h-0">
          <section className="min-h-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 border-b border-white/[0.07] pb-4">
              <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Última indicação</p><p className="mt-1 text-sm font-black text-white">{formatarDataCard(lead.ultimaIndicacaoEm)}</p><p className="text-[10px] text-slate-400">há {diasSemIndicacaoDoLead(lead)} dias</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Último contato</p><p className="mt-1 text-sm font-black text-white">{formatarDataCard(lead.ultimoContatoEm)}</p></div>
            </div>
            <div className="mt-4 space-y-3">
              {lead.historico.length ? lead.historico.map((item) => (
                <div key={item.id} className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: `rgb(${accent})`, boxShadow: `0 0 8px rgba(${accent},.6)` }} /><div className="min-w-0"><p className="text-xs font-semibold text-slate-200">{labelHistorico(item.acao)}</p><p className="text-[10px] text-slate-500">{formatarDataCard(item.createdAt)}{item.usuario?.nome ? ` · ${item.usuario.nome}` : ""}</p></div></div>
              )) : <p className="text-xs text-slate-500">Nenhuma atividade registrada.</p>}
            </div>
          </section>

          <section className="min-h-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:overflow-y-auto">
            <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-white">{ETAPAS[etapaAtual]?.label || lead.status.replaceAll("_", " ")}</p><p className="text-[11px] text-slate-400">{lead.responsavel?.nome || "Responsável não definido"}</p></div><span className={cn("rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-wider", prioridade.className)}>Follow-up {prioridade.label}</span></div>
            <p className="text-[10px] leading-4 text-slate-400">{prioridade.detail}</p>
            <div className="grid grid-cols-2 gap-3"><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Segmento</p><p className="mt-1 text-xs font-bold text-slate-200">{lead.segmento || "—"}</p></div><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Origem</p><p className="mt-1 text-xs font-bold text-slate-200">{lead.origem || "—"}</p></div><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Cidade/UF</p><p className="mt-1 text-xs font-bold text-slate-200">{lead.cidade ? `${lead.cidade}${lead.uf ? `/${lead.uf}` : ""}` : "—"}</p></div><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Próxima ação</p><p className="mt-1 text-xs font-bold text-slate-200">{lead.proximaAcaoDescricao || "Não definida"}</p><p className="text-[10px] text-slate-500">{formatarDataCard(lead.proximaAcaoEm)}</p></div></div>
            <div className="grid grid-cols-3 gap-2 border-y border-white/[0.07] py-3 text-center"><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Indicações</p><p className="text-xl font-black text-white">{lead.indicacoesCount}</p></div><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Contratos</p><p className="text-xl font-black text-white">{lead.contratosCount}</p></div><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Conversão</p><p className="text-xl font-black text-white">{lead.conversaoPercentual === null ? "—" : `${lead.conversaoPercentual.toLocaleString("pt-BR")}%`}</p></div></div>
            <div><div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Potencial de recorrência</p><span className="text-xs font-black text-amber-300">{lead.potencialRecorrencia ?? 0}/5</span></div><div className="mt-2 flex gap-1">{[0,1,2,3,4,5].map((n) => <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= (lead.potencialRecorrencia ?? 0) ? "bg-amber-400" : "bg-white/10")} />)}</div></div>
            {podeEditar && <><div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex flex-wrap items-center gap-1">{[0,1,2,3,4,5].map((n) => <button key={n} onClick={() => setPotencial(n)} className="h-8 w-8 rounded-lg text-[11px] font-bold" style={{ background: potencial === n ? `rgba(${accent},0.4)` : "rgba(255,255,255,0.05)" }}>{n}</button>)}<button onClick={() => void salvarPotencial()} disabled={salvando} className="ml-1 h-8 rounded-lg px-3 text-[10px] font-bold text-black disabled:opacity-40" style={{ background: `rgba(${accent},1)` }}>Salvar</button></div></div><div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="grid grid-cols-[130px_1fr] gap-2"><input type="date" value={proximaAcaoData} onChange={(e) => setProximaAcaoData(e.target.value)} className={inputCls} style={inputStyle} /><input value={proximaAcaoDesc} onChange={(e) => setProximaAcaoDesc(e.target.value)} placeholder="Ligação, WhatsApp, reunião..." className={inputCls} style={inputStyle} /></div><button onClick={() => void salvarProximaAcao()} disabled={salvando} className="h-9 px-4 rounded-xl text-[11px] font-bold text-black disabled:opacity-40" style={{ background: `rgba(${accent},1)` }}>Registrar próxima ação</button></div></>}
          </section>

          <aside className="min-h-0 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="space-y-2">{ETAPAS.filter((e) => e.status !== lead.status).map((e) => <button key={e.status} type="button" onClick={() => setStatusDestino(e.status)} className={cn("block w-full rounded-xl border px-3 py-2 text-left text-[11px] font-bold transition-colors", statusDestino === e.status ? "border-cyan-300/60 bg-cyan-300/20 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.1]")}>{e.label}</button>)}</div>
            <button type="button" onClick={() => void mover()} disabled={salvando || statusDestino === lead.status} className="h-10 w-full rounded-xl text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-40" style={{ background: `rgba(${accent},1)` }}>Mover para etapa selecionada</button>
            {podeEditar && <><div className="border-t border-white/[0.07] pt-4"><Select value={saidaSelecionada} onValueChange={setSaidaSelecionada}><SelectTrigger className={inputCls} style={inputStyle}><SelectValue placeholder="Saída lateral" /></SelectTrigger><SelectContent>{SAIDAS.map((s) => <SelectItem key={s.status} value={s.status}>{s.label}</SelectItem>)}</SelectContent></Select><textarea value={motivoSaida} onChange={(e) => setMotivoSaida(e.target.value)} placeholder="Motivo da saída..." className="mt-2 min-h-16 w-full rounded-xl px-3 py-2 text-[12px] text-slate-200" style={inputStyle} /><button onClick={() => void registrarSaida()} disabled={salvando} className="mt-2 h-9 w-full rounded-xl text-[11px] font-bold text-red-300 disabled:opacity-40" style={{ background: "rgba(239,68,68,0.15)" }}>Registrar saída</button></div>{lead.status === "PRE_CADASTRO" && <div className="space-y-2 border-t border-white/[0.07] pt-4"><input value={docPromocao} onChange={(e) => setDocPromocao(e.target.value)} placeholder="CPF/CNPJ *" className={inputCls} style={inputStyle} /><input value={emailPromocao} onChange={(e) => setEmailPromocao(e.target.value)} placeholder="E-mail *" className={inputCls} style={inputStyle} /><button onClick={() => void promover()} disabled={salvando} className="h-10 w-full rounded-xl text-[10px] font-black uppercase text-white disabled:opacity-40" style={{ background: "rgb(16,185,129)" }}>Cadastrar parceiro</button></div>}</>}
          </aside>
        </div>
      </SheetContent>
    </Sheet>

    {editarCadastroAberto && (
      <NovoLeadCompleto
        initialLead={lead as LeadEdicao}
        accent={accent}
        responsaveis={responsaveis}
        onClose={() => setEditarCadastroAberto(false)}
        onCriado={() => {
          setEditarCadastroAberto(false);
          onAtualizado();
        }}
      />
    )}
    </>
  );
}

function EditarLeadDialog({
  lead,
  accent,
  responsaveis,
  onClose,
  onSalvo,
}: {
  lead: Lead;
  accent: string;
  responsaveis: Responsavel[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(lead.nome);
  const [tipo, setTipo] = useState<"PF" | "PJ" | "">((lead.tipo as "PF" | "PJ" | null) ?? "");
  const [documento, setDocumento] = useState(lead.documento ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [telefone, setTelefone] = useState(lead.telefone ?? "");
  const [segmento, setSegmento] = useState(lead.segmento ?? "");
  const [origem, setOrigem] = useState(lead.origem ?? "");
  const [cidade, setCidade] = useState(lead.cidade ?? "");
  const [uf, setUf] = useState(lead.uf ?? "");
  const [responsavelId, setResponsavelId] = useState<string>(lead.responsavelId ? String(lead.responsavelId) : "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSalvando(true);
    const r = await AtualizarCadastroLeadAquisicao({
      leadId: lead.id,
      nome: nome.trim(),
      tipo: tipo || undefined,
      documento: documento || undefined,
      email: email || undefined,
      telefone: telefone || undefined,
      segmento: segmento || undefined,
      origem: origem || undefined,
      cidade: cidade || undefined,
      uf: uf || undefined,
      responsavelId: responsavelId ? Number(responsavelId) : null,
    });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Cadastro atualizado");
    onSalvo();
  }

  const inputCls = "w-full h-10 rounded-xl px-3 text-[12px] outline-none text-slate-200";
  const inputStyle = { background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)` };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[88vh] max-h-[88vh] rounded-t-[2rem] border-t border-white/10 bg-[#020617] p-0 overflow-hidden" style={{ ["--accent-rgb" as string]: accent }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-white/15" /></div>
        <div className="px-6 sm:px-8 pt-3 pb-5 border-b border-white/10">
          <SheetTitle className="flex items-center gap-2 text-xl font-black text-white"><Pencil size={16} /> Editar parceiro</SheetTitle>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Atualize os dados exibidos no card de aquisição</p>
        </div>
        <div className="max-w-2xl mx-auto overflow-y-auto px-6 sm:px-8 py-5 space-y-2.5">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome *" className={inputCls} style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={tipo} onValueChange={(v) => setTipo(v as "PF" | "PJ")}>
              <SelectTrigger className={inputCls} style={inputStyle}><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent><SelectItem value="PF">Pessoa Física</SelectItem><SelectItem value="PJ">Pessoa Jurídica</SelectItem></SelectContent>
            </Select>
            <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="CPF/CNPJ" className={inputCls} style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={inputCls} style={inputStyle} />
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone" className={inputCls} style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Segmento" className={inputCls} style={inputStyle} />
            <input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Origem" className={inputCls} style={inputStyle} />
          </div>
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" className={inputCls} style={inputStyle} />
            <input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="UF" className={inputCls} style={inputStyle} />
          </div>
          {responsaveis.length > 0 && (
            <Select value={responsavelId} onValueChange={setResponsavelId}>
              <SelectTrigger className={inputCls} style={inputStyle}><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                {responsaveis.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <button
            onClick={() => void salvar()}
            disabled={salvando}
            className="w-full h-11 rounded-xl font-black uppercase text-[11px] tracking-widest text-black disabled:opacity-50"
            style={{ background: `rgba(${accent},1)` }}
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
