"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Search, Plus, ArrowUpRight, Building2, Calendar, ScanSearch, History } from "lucide-react";
import { motion, Variants } from "framer-motion";
import Velocimetro from "@/components/Checklist/Velocimetro";
import ModalCadastroCliente from "./Modais/CadastroCliente";
import { TIPO_LABELS, TIPO_CORES } from "@/lib/checklist/items";
import { getTema } from "@/lib/temas";
import type { EmpresaComProgresso } from "@/actions/checklist";
import ChecklistNotificacoesWidget from "@/components/Checklist/ChecklistNotificacoesWidget";

type TipoEmbasamento =
  | "RECEITA_BRUTA_DAS"
  | "RECEITA_BRUTA_CPRB"
  | "INICIO_RETOMADA"
  | "DISPONIBILIDADE_FINANCEIRA";

// ─── STATUS GLOW ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { text: string; glow: string; dot: string }> = {
  ATIVO:      { text: "text-emerald-400", glow: "0 0 12px rgba(52,211,153,0.35)", dot: "#34d399" },
  PENDENTE:   { text: "text-amber-400",   glow: "0 0 12px rgba(251,191,36,0.35)",  dot: "#fbbf24" },
  FINALIZADO: { text: "text-blue-400",    glow: "0 0 12px rgba(96,165,250,0.35)",  dot: "#60a5fa" },
};

// ─── ANIMATION VARIANTS ───────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function ListaChecklist({
  empresas,
  clientesAcesso = [],
  tema: temaNome = "blue",
  role = "",
}: {
  empresas: EmpresaComProgresso[];
  clientesAcesso?: { id: string; nome: string; email: string }[];
  tema?: string;
  role?: string;
}) {
  const tema = getTema(temaNome);
  const accentRgb = tema.accent;

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoEmbasamento | "TODOS">("TODOS");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const listaFiltrada = useMemo(
    () =>
      empresas.filter((e) => {
        const matchBusca =
          e.razaoSocial.toLowerCase().includes(busca.toLowerCase()) ||
          e.cnpj.includes(busca);
        const matchTipo = filtroTipo === "TODOS" || e.tipo === filtroTipo;
        return matchBusca && matchTipo;
      }),
    [busca, filtroTipo, empresas]
  );

  const concluidos = empresas.filter((e) => e.progressoReal === 100).length;

  return (
    <div className="relative min-h-screen pb-24">

      {/* ── CONTEÚDO ── */}
      <div className="relative z-10 px-6 md:px-8 pt-8 space-y-8">

        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-[10px] font-black uppercase tracking-[0.3em] mb-2"
              style={{ color: `rgb(${accentRgb})` }}
            >
              Módulo Operacional
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black text-white tracking-tighter italic uppercase"
            >
              Checklist <span style={{ color: `rgb(${accentRgb})` }}>RADAR</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.18 }}
              className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2"
            >
              Gestão de documentação e embasamento por empresa
            </motion.p>
          </div>

          {/* Counters + sino */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-3"
          >
            <div
              className="px-5 py-3 rounded-2xl border"
              style={{
                background: `rgba(${accentRgb}, 0.06)`,
                borderColor: `rgba(${accentRgb}, 0.2)`,
              }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total</p>
              <p className="text-3xl font-black text-white leading-none mt-0.5 tabular-nums">
                {empresas.length}
              </p>
            </div>
            <div className="px-5 py-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Concluídos</p>
              <p className="text-3xl font-black text-emerald-400 leading-none mt-0.5 tabular-nums">
                {concluidos}
              </p>
            </div>
            {/* Notificações de documentos de clientes */}
            {['Admin', 'CEO', 'OPERACIONAL'].includes(role) && (
              <ChecklistNotificacoesWidget role={role} />
            )}
          </motion.div>
        </header>

        {/* CONTROLES */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
        >
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Busca */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
              <input
                type="text"
                placeholder="Buscar empresa ou CNPJ..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-2xl py-3 pl-11 pr-4 text-sm outline-none text-white placeholder:text-slate-700 transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid rgba(${accentRgb}, 0.15)`,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = `rgba(${accentRgb}, 0.5)`)}
                onBlur={(e) => (e.currentTarget.style.borderColor = `rgba(${accentRgb}, 0.15)`)}
              />
            </div>

            {/* Filtro tipo */}
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as TipoEmbasamento | "TODOS")}
              className="rounded-2xl py-3 px-4 text-sm text-white outline-none appearance-none cursor-pointer transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid rgba(${accentRgb}, 0.15)`,
              }}
            >
              <option value="TODOS" className="bg-slate-900">Todos os tipos</option>
              {Object.entries(TIPO_LABELS).map(([k, v]) => (
                <option key={k} value={k} className="bg-slate-900">{v}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {/* Histórico de excluídos */}
            <Link
              href="/PainelAlpha/CheckList/Historico"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/8 text-[10px] font-black uppercase tracking-wider text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/15 transition-all"
            >
              <History size={14} />
              Histórico
            </Link>

            {/* Botão Nova Empresa */}
            <MagneticButton accentRgb={accentRgb} onClick={() => setIsModalOpen(true)}>
              <Plus size={16} />
              Nova Empresa
            </MagneticButton>
          </div>
        </motion.div>

        {/* GRID DE CARDS */}
        {listaFiltrada.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32 gap-4"
          >
            <Building2 size={40} className="text-slate-700" />
            <p className="text-slate-600 text-xs font-black uppercase tracking-widest">
              Nenhuma empresa encontrada
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
          >
            {listaFiltrada.map((emp, i) => (
              <EmpresaCard key={emp.id} emp={emp} accentRgb={accentRgb} index={i} />
            ))}
          </motion.div>
        )}
      </div>

      <ModalCadastroCliente
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clientesExistentes={clientesAcesso}
      />
    </div>
  );
}

// ─── EMPRESA CARD ─────────────────────────────────────────────────────────────

function EmpresaCard({
  emp,
  accentRgb,
  index,
}: {
  emp: EmpresaComProgresso;
  accentRgb: string;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const statusCfg = STATUS_CONFIG[emp.status] ?? STATUS_CONFIG.PENDENTE;

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !glowRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    glowRef.current.style.opacity = "1";
    glowRef.current.style.background = `radial-gradient(circle 260px at ${x}px ${y}px, rgba(${accentRgb}, 0.14), transparent 65%)`;
  };

  const onMouseLeave = () => {
    if (glowRef.current) glowRef.current.style.opacity = "0";
  };

  return (
    <motion.div
      ref={cardRef}
      variants={cardVariants}
      whileHover={{ y: -5, transition: { duration: 0.2, ease: "easeOut" } }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="relative overflow-hidden rounded-[1.75rem] flex flex-col"
      style={{
        background: "rgba(10,14,30,0.75)",
        backdropFilter: "blur(24px)",
        border: `1px solid rgba(255,255,255,0.06)`,
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        transition: "box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(${accentRgb}, 0.15)`;
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.3)";
      }}
    >
      {/* Spotlight layer */}
      <div
        ref={glowRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0, transition: "opacity 0.3s ease" }}
      />

      {/* Linha superior accent */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, rgba(${accentRgb}, 0.4), transparent)` }}
      />

      <div className="relative z-10 p-6 flex flex-col gap-5">

        {/* Row 1: Tipo + Status */}
        <div className="flex items-start justify-between gap-2">
          {emp.tipo ? (
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${TIPO_CORES[emp.tipo]}`}>
              {TIPO_LABELS[emp.tipo]}
            </span>
          ) : (
            <span className="text-[10px] text-slate-600 font-bold italic uppercase">Sem tipo</span>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: statusCfg.dot, boxShadow: statusCfg.glow }}
            />
            <span className={`text-[10px] font-black uppercase tracking-wide ${statusCfg.text}`}>
              {emp.status}
            </span>
          </div>
        </div>

        {/* Row 2: Nome + velocímetro */}
        <div className="flex items-center gap-4">
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-white italic uppercase tracking-tight leading-tight truncate">
              {emp.razaoSocial}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
              {emp.nomeFantasia || emp.clienteNome}
            </p>
          </div>

          {/* Velocímetro com anel de glow */}
          <div className="flex-shrink-0 relative">
            {/* Anel de glow radial atrás do velocímetro */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle at 50% 70%, rgba(${accentRgb}, 0.18), transparent 65%)`,
                transform: "scale(1.4)",
              }}
            />
            <Velocimetro
              percent={emp.progressoReal}
              size="sm"
              accentRgb={accentRgb}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

        {/* Row 3: CNPJ + dados */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">CNPJ</p>
            <p className="text-[11px] font-mono text-slate-300 mt-0.5">{emp.cnpj}</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Situação RADAR</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
              {emp.submodalidade || "—"}
            </p>
          </div>
          {emp.mesProtocolo && (
            <div className="col-span-2 flex items-center gap-1.5">
              <Calendar size={10} className="text-slate-600 flex-shrink-0" />
              <p className="text-[10px] text-slate-500 font-medium italic">
                Protocolo: {emp.mesProtocolo}
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <Link
          href={`/PainelAlpha/CheckList/${emp.id}`}
          className="group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200"
          style={{
            background: `rgba(${accentRgb}, 0.08)`,
            border: `1px solid rgba(${accentRgb}, 0.15)`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = `rgba(${accentRgb}, 0.16)`;
            (e.currentTarget as HTMLAnchorElement).style.borderColor = `rgba(${accentRgb}, 0.35)`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = `rgba(${accentRgb}, 0.08)`;
            (e.currentTarget as HTMLAnchorElement).style.borderColor = `rgba(${accentRgb}, 0.15)`;
          }}
        >
          <span
            className="text-[11px] font-black uppercase tracking-widest"
            style={{ color: `rgb(${accentRgb})` }}
          >
            Ver Checklist
          </span>
          <ArrowUpRight
            size={14}
            className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            style={{ color: `rgb(${accentRgb})` }}
          />
        </Link>
      </div>
    </motion.div>
  );
}

// ─── MAGNETIC BUTTON ─────────────────────────────────────────────────────────

function MagneticButton({
  children,
  accentRgb,
  onClick,
}: {
  children: React.ReactNode;
  accentRgb: string;
  onClick: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const onMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.2;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.2;
    btnRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const onMouseLeave = () => {
    if (btnRef.current) btnRef.current.style.transform = "translate(0,0)";
  };

  return (
    <button
      ref={btnRef}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="cursor-pointer flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-white whitespace-nowrap"
      style={{
        background: `rgb(${accentRgb})`,
        boxShadow: `0 4px 20px rgba(${accentRgb}, 0.35)`,
        transition: "transform 0.15s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 32px rgba(${accentRgb}, 0.55)`;
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 20px rgba(${accentRgb}, 0.35)`;
      }}
    >
      {children}
    </button>
  );
}
