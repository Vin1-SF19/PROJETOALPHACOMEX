"use client";

import { motion } from "framer-motion";
import type { IndicadoresComissao } from "@/actions/CommissionDashboard";
import { formatarCentavosBRL } from "../lib/formatters";

interface CardsIndicadoresProps {
  indicadores: IndicadoresComissao | null;
  carregando?: boolean;
}

interface IndicadorSpec {
  label: string;
  valor: string;
  cor: "verde" | "amarelo" | "vermelho" | "neutro";
}

const CORES: Record<IndicadorSpec["cor"], string> = {
  verde: "text-emerald-400",
  amarelo: "text-amber-400",
  vermelho: "text-rose-400",
  neutro: "text-slate-300",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } },
};

export function CardsIndicadores({ indicadores, carregando }: CardsIndicadoresProps) {
  if (carregando || !indicadores) {
    return (
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/5 bg-slate-900/40" />
        ))}
      </div>
    );
  }

  const specs: IndicadorSpec[] = [
    { label: "Total de Eventos", valor: String(indicadores.totalEventos), cor: "neutro" },
    { label: "Pendente", valor: String(indicadores.totalPendente), cor: "amarelo" },
    { label: "Pago", valor: String(indicadores.totalPago), cor: "verde" },
    { label: "Vencido", valor: String(indicadores.totalVencido), cor: "vermelho" },
    { label: "Bloqueado", valor: String(indicadores.totalBloqueado), cor: "vermelho" },
    { label: "Divergências", valor: String(indicadores.totalDivergencias), cor: "vermelho" },
    { label: "Valor Previsto", valor: formatarCentavosBRL(indicadores.valorPrevistoCents), cor: "neutro" },
    { label: "Pago no Período", valor: formatarCentavosBRL(indicadores.valorPagoNoPeriodoCents), cor: "verde" },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8"
    >
      {specs.map((spec) => (
        <motion.div
          key={spec.label}
          variants={item}
          className="rounded-2xl border border-white/5 bg-slate-900/40 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">{spec.label}</p>
          <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${CORES[spec.cor]}`}>
            {spec.valor}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}
