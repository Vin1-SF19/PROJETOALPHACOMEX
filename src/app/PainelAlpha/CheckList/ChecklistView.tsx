"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, FileText, CheckCircle2,
  ChevronDown, ChevronUp, BarChart3, Sparkles,
  Download, ExternalLink, Trash2, Clock, History, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Velocimetro from "@/components/Checklist/Velocimetro";
import {
  criarChecklist, atualizarItemChecklist, atualizarObservacaoDocumento,
  excluirDocumentoAnalista, trocarEmbasamentoChecklist,
} from "@/actions/checklist";
import ChecklistNotificacoesWidget from "@/components/Checklist/ChecklistNotificacoesWidget";
import {
  TIPO_LABELS, TIPO_CORES, STATUS_LABELS, STATUS_CORES,
  STATUS_CONCLUIDOS, SECOES, calcularProgressoItens,
} from "@/lib/checklist/items";
import { getTema } from "@/lib/temas";
import { isAdminRole } from "@/lib/roles";

type TipoEmbasamento =
  | "RECEITA_BRUTA_DAS"
  | "RECEITA_BRUTA_CPRB"
  | "INICIO_RETOMADA"
  | "DISPONIBILIDADE_FINANCEIRA";

type StatusItemChecklist =
  | "PENDENTE"
  | "OK"
  | "IRREGULAR"
  | "PARCIALMENTE_IRREGULAR"
  | "REVISAR"
  | "DESNECESSARIO"
  | "EM_ANALISE"
  | "AGUARDANDO_DOCUMENTOS"
  | "PRIORIDADE";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Documento {
  id: string; nome: string; url: string;
  uploadedByCliente: boolean; observacao: string | null;
  deletadoEm: Date | null; deletadoPorCliente: boolean;
  criadoEm: Date;
}
interface Item {
  id: string; codigo: string; secao: string; descricao: string;
  complemento: string | null; status: StatusItemChecklist;
  observacao: string | null; obrigatorio: boolean; documentos: Documento[];
}
interface ChecklistData { id: string; tipo: TipoEmbasamento; itens: Item[]; }
interface Empresa {
  id: string; cnpj: string | null; razaoSocial: string; nomeFantasia: string | null;
  status: string; embasamento: string; tipo: TipoEmbasamento | null;
  progresso: number; mesProtocolo: string | null;
  regimeTributario: string | null;
  cliente: { nome: string; email: string }; checklists: ChecklistData[];
}

const STATUS_OPTIONS: StatusItemChecklist[] = [
  "PENDENTE", "OK", "IRREGULAR", "PARCIALMENTE_IRREGULAR",
  "REVISAR", "DESNECESSARIO", "EM_ANALISE", "AGUARDANDO_DOCUMENTOS",
  "PRIORIDADE",
];
const TIPOS: TipoEmbasamento[] = [
  "RECEITA_BRUTA_DAS", "RECEITA_BRUTA_CPRB", "INICIO_RETOMADA", "DISPONIBILIDADE_FINANCEIRA",
];

// ─── HOOK: gradient que segue o mouse ─────────────────────────────────────────

function useMouseGlow(accentRgb: string, intensity = 0.12) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ref.current.style.setProperty("--gx", `${x}px`);
    ref.current.style.setProperty("--gy", `${y}px`);
    ref.current.style.setProperty("--gi", `${intensity}`);
  }, [intensity]);

  const onMouseLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.setProperty("--gi", "0");
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function ChecklistView({
  empresa: empresaInicial,
  userNome,
  tema: temaNome = "blue",
  role = "",
}: {
  empresa: Empresa;
  userNome: string;
  tema?: string;
  role?: string;
}) {
  const router = useRouter();
  const tema = getTema(temaNome);
  const accentRgb = tema.accent;

  const [criandoChecklist, setCriandoChecklist] = useState(false);
  const [mudandoEmbasamento, setMudandoEmbasamento] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoEmbasamento | null>(
    empresaInicial.tipo ?? null
  );
  const [secaoAtiva, setSecaoAtiva] = useState<string>(SECOES.CONSTITUICAO);

  const checklistBase = empresaInicial.checklists.find(
    (checklist) => checklist.tipo === empresaInicial.tipo
  ) ?? empresaInicial.checklists[0] ?? null;
  const [itens, setItens] = useState<Item[]>(checklistBase?.itens ?? []);

  const progresso = calcularProgressoItens(itens);
  const secoesUnicas = [...new Set(itens.map((i) => i.secao))];

  // ─── ACTIONS ────────────────────────────────────────────────────────────────

  const handleCriarChecklist = async () => {
    if (!tipoSelecionado) return;
    setCriandoChecklist(true);
    try {
      const res = await criarChecklist(empresaInicial.id, tipoSelecionado);
      if (res.data) router.refresh();
    } finally {
      setCriandoChecklist(false);
    }
  };

  const handleTrocarEmbasamento = async () => {
    if (!tipoSelecionado) return;
    setMudandoEmbasamento(true);
    const res = await trocarEmbasamentoChecklist(empresaInicial.id, tipoSelecionado);
    setMudandoEmbasamento(false);
    if (res.data) router.refresh();
  };

  const handleStatusChange = (itemId: string, status: StatusItemChecklist) => {
    setItens((prev) => prev.map((i) => (i.id === itemId ? { ...i, status } : i)));
    atualizarItemChecklist(itemId, { status }).catch(() => {
      setItens((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, status: checklistBase?.itens.find((x) => x.id === itemId)?.status ?? i.status }
            : i
        )
      );
    });
  };

  const handleObsBlur = (itemId: string, observacao: string, statusAtual: StatusItemChecklist) => {
    atualizarItemChecklist(itemId, { status: statusAtual, observacao });
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen text-white pb-24">

      {/* HEADER sticky */}
      <div
        className="sticky top-0 z-30 border-b border-white/5 backdrop-blur-2xl"
        style={{ background: `rgba(2,6,23,0.75)` }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/PainelAlpha/CheckList"
              className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all active:scale-95"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-base font-black text-white italic uppercase tracking-tight leading-none">
                {empresaInicial.razaoSocial}
              </h1>
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">{empresaInicial.cnpj}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {checklistBase && (
              <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border ${TIPO_CORES[checklistBase.tipo]}`}>
                {TIPO_LABELS[checklistBase.tipo]}
              </span>
            )}
            <Velocimetro percent={progresso} size="sm" showLabel={false} />
            <span className="text-sm font-black text-white tabular-nums">{progresso}%</span>
            <a
              href={"/api/checklist/" + empresaInicial.id + "/documentos/zip"}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-blue-300 transition hover:bg-blue-500/20"
              title="Baixar documentos ativos em ZIP"
            >
              <Download size={13} />
              ZIP
            </a>
            {(isAdminRole(role) || role === 'OPERACIONAL') && (
              <ChecklistNotificacoesWidget role={role} />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 space-y-6">

        {/* ── CARD PRINCIPAL DA EMPRESA ── */}
        <GlowCard accentRgb={accentRgb} className="rounded-[2rem] overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            {/* Info da empresa */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-white/5">
              {[
                { label: "Razão Social", value: empresaInicial.razaoSocial, full: true },
                { label: "CNPJ", value: empresaInicial.cnpj },
                { label: "Situação", value: empresaInicial.status,
                  highlight: empresaInicial.status === "ATIVO" ? "text-emerald-400" : "text-rose-400" },
                { label: "Cliente", value: empresaInicial.cliente.nome, full: true },
                { label: "Regime Tributário", value: empresaInicial.regimeTributario || "—" },
                { label: "Mês Protocolo", value: empresaInicial.mesProtocolo || "—" },
              ].map((cell, i) => (
                <div
                  key={i}
                  className={`p-4 flex flex-col gap-1 ${(cell as any).full ? "col-span-2 sm:col-span-3" : ""}`}
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">
                    {cell.label}
                  </span>
                  <span className={`text-xs font-bold uppercase truncate ${(cell as any).highlight ?? "text-white"}`}>
                    {cell.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Velocímetro — separador vertical */}
            <div
              className="lg:w-52 flex flex-col items-center justify-center gap-2 p-6 border-t lg:border-t-0 lg:border-l border-white/5"
              style={{
                background: `radial-gradient(circle at 50% 50%, rgba(${accentRgb}, 0.1), transparent 70%)`,
              }}
            >
              <Velocimetro percent={progresso} size="lg" />
            </div>
          </div>
        </GlowCard>

        {checklistBase && (
          <GlowCard accentRgb={accentRgb} className="rounded-[1.5rem] border border-blue-400/15 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Trocar embasamento</p>
                <p className="mt-1 text-[11px] text-slate-400">O checklist anterior fica preservado com seus documentos; o novo tipo passa a ser o checklist ativo.</p>
              </div>
              <select
                value={tipoSelecionado ?? ""}
                onChange={(event) => setTipoSelecionado(event.target.value as TipoEmbasamento)}
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-blue-400/50"
              >
                {TIPOS.map((tipo) => <option key={tipo} value={tipo}>{TIPO_LABELS[tipo]}</option>)}
              </select>
              <button
                onClick={() => void handleTrocarEmbasamento()}
                disabled={!tipoSelecionado || tipoSelecionado === checklistBase.tipo || mudandoEmbasamento}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
              >
                {mudandoEmbasamento ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <RefreshCw size={13} />}
                Aplicar troca
              </button>
            </div>
          </GlowCard>
        )}

        {/* ── SEM CHECKLIST — escolher tipo ── */}
        {!checklistBase && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-white/5 p-10 text-center space-y-8"
            style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(20px)" }}
          >
            <div>
              <div
                className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `rgba(${accentRgb}, 0.12)`, border: `1px solid rgba(${accentRgb}, 0.3)` }}
              >
                <BarChart3 size={28} style={{ color: `rgb(${accentRgb})` }} />
              </div>
              <h2 className="text-xl font-black text-white uppercase italic">Selecionar Embasamento</h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">
                Escolha o tipo para gerar o checklist automaticamente
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {TIPOS.map((tipo) => (
                <GlowCard
                  key={tipo}
                  accentRgb={accentRgb}
                  as="button"
                  onClick={() => setTipoSelecionado(tipo)}
                  className={`p-6 rounded-[1.5rem] text-left transition-all cursor-pointer w-full ${
                    tipoSelecionado === tipo
                      ? `border border-[rgba(${accentRgb},0.5)] shadow-lg`
                      : "border border-white/5"
                  }`}
                  style={
                    tipoSelecionado === tipo
                      ? { background: `rgba(${accentRgb}, 0.12)` }
                      : undefined
                  }
                >
                  <Sparkles size={18} className="mb-3" style={{ color: `rgb(${accentRgb})` }} />
                  <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${TIPO_CORES[tipo]}`}>
                    {TIPO_LABELS[tipo]}
                  </span>
                </GlowCard>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleCriarChecklist}
              disabled={!tipoSelecionado || criandoChecklist}
              className="inline-flex items-center gap-2 px-10 py-4 text-white font-black uppercase text-xs tracking-widest rounded-2xl transition-all disabled:opacity-40 cursor-pointer"
              style={{ background: `rgb(${accentRgb})`, boxShadow: `0 8px 32px rgba(${accentRgb}, 0.4)` }}
            >
              {criandoChecklist
                ? <span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
                : <CheckCircle2 size={16} />
              }
              Criar Checklist
            </motion.button>
          </motion.div>
        )}

        {/* ── CHECKLIST ── */}
        {checklistBase && itens.length > 0 && (
          <div className="space-y-5">

            {/* Tabs de seção */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {secoesUnicas.map((secao) => {
                const itensSecao = itens.filter((i) => i.secao === secao && i.obrigatorio);
                const done = itensSecao.filter((i) => STATUS_CONCLUIDOS.has(i.status)).length;
                const pct = itensSecao.length > 0 ? Math.round((done / itensSecao.length) * 100) : 0;
                const ativo = secaoAtiva === secao;

                return (
                  <GlowCard
                    key={secao}
                    accentRgb={accentRgb}
                    as="button"
                    onClick={() => setSecaoAtiva(secao)}
                    className={`cursor-pointer p-4 rounded-2xl border text-left transition-all w-full ${
                      ativo
                        ? `border-[rgba(${accentRgb},0.6)] shadow-lg`
                        : "border-slate-700/60 hover:border-slate-600/80"
                    }`}
                    style={
                      ativo
                        ? { background: `rgba(${accentRgb}, 0.14)` }
                        : { background: "rgba(15,23,42,0.75)" }
                    }
                  >
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] leading-tight block ${ativo ? "text-white" : "text-slate-400"}`}>
                      {secao}
                    </span>
                    <div className="flex items-center gap-2 mt-2.5">
                      <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          style={{
                            background: pct < 34 ? "#ef4444" : pct < 67 ? "#eab308" : "#22c55e",
                            boxShadow: pct === 100 ? "0 0 8px #22c55e" : undefined,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-black text-white tabular-nums flex-shrink-0">
                        {done}/{itensSecao.length}
                      </span>
                    </div>
                  </GlowCard>
                );
              })}
            </div>

            {/* Lista de itens */}
            <AnimatePresence mode="wait">
              <motion.div
                key={secaoAtiva}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-[2rem] overflow-hidden border border-slate-700/60"
                style={{ background: "rgba(10,18,38,0.92)", backdropFilter: "blur(24px)" }}
              >
                {/* Header da seção */}
                <div
                  className="p-5 border-b border-slate-700/60 flex items-center gap-3"
                  style={{ background: `rgba(${accentRgb}, 0.10)` }}
                >
                  <div
                    className="p-2 rounded-xl"
                    style={{ background: `rgba(${accentRgb}, 0.15)` }}
                  >
                    <FileText size={14} style={{ color: `rgb(${accentRgb})` }} />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">
                    {secaoAtiva}
                  </h3>
                  <span className="ml-auto text-[10px] font-bold text-slate-300">
                    {itens.filter((i) => i.secao === secaoAtiva).length} itens
                  </span>
                </div>

                <div className="divide-y divide-slate-700/50">
                  {itens
                    .filter((i) => i.secao === secaoAtiva)
                    .map((item, idx) => (
                      <ChecklistItem
                        key={item.id}
                        item={item}
                        accentRgb={accentRgb}
                        onStatusChange={handleStatusChange}
                        onObsBlur={handleObsBlur}
                        index={idx}
                      />
                    ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GLOW CARD — container com gradient que segue o mouse ─────────────────────

function GlowCard({
  children,
  accentRgb,
  className = "",
  style,
  as: Tag = "div",
  onClick,
}: {
  children: React.ReactNode;
  accentRgb: string;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "button";
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement & HTMLButtonElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!ref.current || !glowRef.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    glowRef.current.style.opacity = "1";
    glowRef.current.style.background = `radial-gradient(circle 280px at ${x}px ${y}px, rgba(${accentRgb}, 0.13), transparent 70%)`;
  };

  const onMouseLeave = () => {
    if (glowRef.current) glowRef.current.style.opacity = "0";
  };

  const baseStyle: React.CSSProperties = {
    background: "rgba(15,23,42,0.82)",
    backdropFilter: "blur(24px)",
    ...style,
  };

  return (
    <Tag
      ref={ref as any}
      className={`relative overflow-hidden ${className}`}
      style={baseStyle}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Glow layer */}
      <div
        ref={glowRef}
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{ opacity: 0 }}
      />
      <div className="relative z-10">{children}</div>
    </Tag>
  );
}

// ─── CHECKLIST ITEM ──────────────────────────────────────────────────────────

function ChecklistItem({
  item,
  accentRgb,
  onStatusChange,
  onObsBlur,
  index,
}: {
  item: Item;
  accentRgb: string;
  onStatusChange: (id: string, status: StatusItemChecklist) => void;
  onObsBlur: (id: string, obs: string, status: StatusItemChecklist) => void;
  index: number;
}) {
  const [obs, setObs] = useState(item.observacao ?? "");
  const [expandido, setExpandido] = useState(false);
  const [verExcluidos, setVerExcluidos] = useState(false);
  const concluido = STATUS_CONCLUIDOS.has(item.status);

  const dotColor =
    item.status === "OK" ? "#22c55e" :
    item.status === "IRREGULAR" || item.status === "PRIORIDADE" ? "#ef4444" :
    item.status === "PARCIALMENTE_IRREGULAR" ? "#f97316" :
    item.status === "AGUARDANDO_DOCUMENTOS" ? "#eab308" :
    item.status === "EM_ANALISE" ? "#a855f7" :
    item.status === "REVISAR" ? "#3b82f6" :
    "#475569";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className="group relative overflow-hidden"
    >
      {/* Hover glow layer */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `linear-gradient(90deg, rgba(${accentRgb}, 0.08) 0%, transparent 60%)` }}
      />

      <div className={`relative p-5 flex items-start gap-4 transition-colors duration-300 ${concluido ? "opacity-60" : ""}`}>

        {/* Dot de status com glow */}
        <motion.div
          layout
          className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            (item.status === "IRREGULAR" || item.status === "PRIORIDADE") ? "animate-pulse" : ""
          }`}
          style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}80` }}
        />

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-3 flex-wrap">
            <span className="font-mono text-[10px] text-slate-500 flex-shrink-0 mt-0.5">{item.codigo}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold uppercase tracking-tight transition-all duration-300 ${
                concluido ? "text-slate-500 line-through" : "text-white"
              }`}>
                {item.descricao}
              </p>
              {item.complemento && (
                <p className="text-[11px] text-slate-400 mt-0.5 italic">{item.complemento}</p>
              )}
            </div>
            {!item.obrigatorio && (
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest border border-slate-600/50 px-1.5 py-0.5 rounded-md flex-shrink-0">
                Condicional
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <motion.select
              layout
              value={item.status}
              onChange={(e) => onStatusChange(item.id, e.target.value as StatusItemChecklist)}
              className={`border rounded-xl py-1.5 px-3 text-[10px] font-black uppercase outline-none cursor-pointer transition-all duration-200 appearance-none ${
                STATUS_CORES[item.status] ?? "border-slate-700/40 text-slate-400 bg-slate-800/80"
              }`}
              style={{ backdropFilter: "blur(8px)" }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="bg-slate-900 text-white">{STATUS_LABELS[s]}</option>
              ))}
            </motion.select>

            {/* Botão docs ativos */}
            {(() => {
              const ativos = item.documentos.filter((d) => !d.deletadoEm);
              const excluidos = item.documentos.filter((d) => d.deletadoEm);
              return (
                <>
                  {ativos.length > 0 && (
                    <button
                      onClick={() => setExpandido((v) => !v)}
                      className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/50 bg-slate-800/60 text-[10px] font-black text-slate-300 hover:border-slate-500 hover:text-white transition-all"
                    >
                      {expandido ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      <FileText size={11} className="text-blue-400" />
                      {ativos.length} doc{ativos.length !== 1 ? "s" : ""}
                    </button>
                  )}
                  {excluidos.length > 0 && (
                    <button
                      onClick={() => setVerExcluidos((v) => !v)}
                      className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-500/25 bg-rose-500/8 text-[10px] font-black text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/15 transition-all"
                    >
                      <History size={11} />
                      {excluidos.length} excluído{excluidos.length !== 1 ? "s" : ""}
                      {verExcluidos ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  )}
                </>
              );
            })()}
          </div>

          <textarea
            rows={1}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={() => onObsBlur(item.id, obs, item.status)}
            placeholder="Adicionar observação técnica..."
            className="w-full bg-transparent border border-transparent hover:border-slate-700/50 focus:border-slate-600/60 focus:bg-slate-800/30 rounded-xl p-2.5 text-[11px] text-slate-300 outline-none transition-all resize-none italic placeholder:text-slate-600"
          />

          <AnimatePresence>
            {expandido && item.documentos.filter((d) => !d.deletadoEm).length > 0 && (
              <motion.div
                key="ativos"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {item.documentos.filter((d) => !d.deletadoEm).map((doc) => (
                  <DocRow key={doc.id} doc={doc} />
                ))}
              </motion.div>
            )}
            {verExcluidos && item.documentos.filter((d) => d.deletadoEm).length > 0 && (
              <motion.div
                key="excluidos"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-1 border-t border-rose-500/10 mt-1">
                  <div className="flex items-center gap-1.5 py-1.5">
                    <History size={10} className="text-rose-500/60" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-500/60">
                      Histórico — excluídos pelo cliente
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {item.documentos.filter((d) => d.deletadoEm).map((doc) => (
                      <DocRow key={doc.id} doc={doc} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── DOC ROW ─────────────────────────────────────────────────────────────────

function DocRow({ doc }: { doc: Documento }) {
  const [obs, setObs] = useState(doc.observacao ?? "");
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [removido, setRemovido] = useState(false);
  const excluido = !!doc.deletadoEm;

  const handleBlur = () => {
    if (obs !== (doc.observacao ?? "")) {
      atualizarObservacaoDocumento(doc.id, obs);
    }
  };

  const handleExcluir = async () => {
    setExcluindo(true);
    await excluirDocumentoAnalista(doc.id);
    setRemovido(true);
  };

  const dataFormatada = (d: Date | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={`rounded-xl overflow-hidden border transition-all ${
      removido
        ? "opacity-0 h-0 border-0 overflow-hidden"
        : excluido
          ? "bg-slate-900/40 border-rose-500/15 opacity-60"
          : doc.uploadedByCliente
            ? "bg-blue-950/40 border-blue-500/25"
            : "bg-slate-800/60 border-slate-600/30"
    }`}>
      {/* Barra colorida lateral */}
      <div className="flex">
        <div className={`w-0.5 flex-shrink-0 ${
          excluido ? "bg-rose-500/40" : doc.uploadedByCliente ? "bg-blue-500/60" : "bg-slate-600/40"
        }`} />

        <div className="flex-1 min-w-0">
          {/* Linha principal */}
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <FileText size={14} className={`flex-shrink-0 ${
              excluido ? "text-rose-500/60" : doc.uploadedByCliente ? "text-blue-400" : "text-slate-400"
            }`} />

            {excluido ? (
              <span className="text-[11px] font-bold text-slate-500 line-through flex-1 truncate">
                {doc.nome}
              </span>
            ) : (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-white hover:text-blue-300 transition-colors flex-1 truncate group flex items-center gap-1"
              >
                {doc.nome}
                <ExternalLink size={10} className="opacity-0 group-hover:opacity-60 flex-shrink-0 transition-opacity" />
              </a>
            )}

            <div className="flex items-center gap-2 flex-shrink-0">
              {excluido && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border bg-rose-500/10 border-rose-500/30 text-rose-400 text-[8px] font-black uppercase">
                  <Trash2 size={8} />
                  Excluído
                </span>
              )}
              {doc.uploadedByCliente && !excluido && (
                <span className="px-1.5 py-0.5 rounded-md border bg-blue-500/15 border-blue-500/30 text-blue-400 text-[8px] font-black uppercase">
                  Cliente
                </span>
              )}
              {!doc.uploadedByCliente && !excluido && (
                <span className="px-1.5 py-0.5 rounded-md border bg-slate-700/50 border-slate-600/40 text-slate-500 text-[8px] font-black uppercase">
                  Analista
                </span>
              )}

              {/* Botão excluir — só para docs ativos */}
              {!excluido && (
                confirmando ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleExcluir}
                      disabled={excluindo}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-500/50 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-all text-[8px] font-black uppercase cursor-pointer disabled:opacity-50"
                    >
                      {excluindo
                        ? <span className="w-3 h-3 border border-rose-400/40 border-t-rose-400 rounded-full animate-spin" />
                        : <Trash2 size={9} />}
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmando(false)}
                      className="px-2 py-1 rounded-lg border border-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors text-[8px] font-black uppercase cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmando(true)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                    title="Mover para histórico"
                  >
                    <Trash2 size={12} />
                  </button>
                )
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="flex items-center gap-3 px-3 pb-1.5">
            <span className="flex items-center gap-1 text-[9px] text-slate-600">
              <Clock size={9} />
              {dataFormatada(doc.criadoEm)}
            </span>
            {excluido && doc.deletadoEm && (
              <span className="flex items-center gap-1 text-[9px] text-rose-500/60">
                <Trash2 size={9} />
                {dataFormatada(doc.deletadoEm)}
              </span>
            )}
          </div>

          {/* Observação — só para docs ativos */}
          {!excluido && (
            <div className="px-3 pb-2.5">
              <textarea
                rows={1}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                onBlur={handleBlur}
                placeholder="Adicionar observação sobre este documento..."
                className="w-full bg-transparent border border-transparent hover:border-white/8 focus:border-slate-600/50 focus:bg-slate-800/40 rounded-lg px-2 py-1.5 text-[10px] text-slate-400 outline-none transition-all resize-none italic placeholder:text-slate-700"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
