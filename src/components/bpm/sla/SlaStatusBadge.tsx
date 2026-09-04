"use client";

import { AlertTriangle, CheckCircle2, Clock3, PauseCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type SlaStatusVisual =
  | "DENTRO_PRAZO"
  | "PROXIMO_VENCIMENTO"
  | "ATRASADO"
  | "PAUSADO"
  | "CONCLUIDO";

export interface SlaVisual {
  nome: string;
  status: SlaStatusVisual;
  cor: string;
  deadline: Date | string | null;
  tempoRestanteMs: number | null;
  pausadoEm: Date | string | null;
}

const PALETAS: Record<string, { borda: string; fundo: string; texto: string }> = {
  VERDE: { borda: "#34d39966", fundo: "#10b98126", texto: "#a7f3d0" },
  AMARELO: { borda: "#fbbf2466", fundo: "#f59e0b26", texto: "#fde68a" },
  VERMELHO: { borda: "#fb718566", fundo: "#f43f5e26", texto: "#fecdd3" },
  AZUL: { borda: "#60a5fa66", fundo: "#3b82f626", texto: "#bfdbfe" },
  CINZA: { borda: "#94a3b866", fundo: "#64748b26", texto: "#cbd5e1" },
};

function paleta(cor: string, status: SlaStatusVisual) {
  const normalizada = cor.trim().toUpperCase();
  if (PALETAS[normalizada]) return PALETAS[normalizada];
  if (/^#[0-9A-F]{6}$/i.test(cor)) {
    return { borda: `${cor}88`, fundo: `${cor}26`, texto: cor };
  }
  if (status === "ATRASADO") return PALETAS.VERMELHO;
  if (status === "PROXIMO_VENCIMENTO") return PALETAS.AMARELO;
  if (status === "PAUSADO") return PALETAS.AZUL;
  return PALETAS.VERDE;
}

function formatarDuracao(ms: number): string {
  const absoluto = Math.abs(ms);
  const minutos = Math.floor(absoluto / 60_000);
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `${horas}h ${minutos % 60}min`;
  const dias = Math.floor(horas / 24);
  return `${dias}d ${horas % 24}h`;
}

export function calcularTempoRestanteVisual(
  sla: Pick<SlaVisual, "deadline" | "tempoRestanteMs" | "pausadoEm">,
  agoraMs: number,
): number | null {
  if (sla.pausadoEm) return sla.tempoRestanteMs;
  if (!sla.deadline) return sla.tempoRestanteMs;
  return new Date(sla.deadline).getTime() - agoraMs;
}

export function SlaStatusBadge({ sla, className }: { sla: SlaVisual; className?: string }) {
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  useEffect(() => {
    if (sla.pausadoEm || sla.status === "CONCLUIDO") return;
    const id = window.setInterval(() => setAgoraMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [sla.pausadoEm, sla.status]);

  const tempo = calcularTempoRestanteVisual(sla, agoraMs);
  const cores = useMemo(() => paleta(sla.cor, sla.status), [sla.cor, sla.status]);
  const Icone = sla.status === "ATRASADO"
    ? AlertTriangle
    : sla.status === "PAUSADO"
      ? PauseCircle
      : sla.status === "CONCLUIDO"
        ? CheckCircle2
        : Clock3;
  const rotulo = sla.status === "ATRASADO"
    ? `Vencido${tempo === null ? "" : ` há ${formatarDuracao(tempo)}`}`
    : sla.status === "PAUSADO"
      ? `Pausado${tempo === null ? "" : ` · ${formatarDuracao(tempo)}`}`
      : sla.status === "CONCLUIDO"
        ? "Concluído"
        : tempo === null
          ? sla.status.replaceAll("_", " ")
          : `${sla.status === "PROXIMO_VENCIMENTO" ? "Atenção" : "No prazo"} · ${formatarDuracao(tempo)}`;

  return (
    <span
      role="status"
      title={`${sla.nome}: ${rotulo}`}
      className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-bold uppercase tracking-wide", className)}
      style={{ borderColor: cores.borda, backgroundColor: cores.fundo, color: cores.texto }}
      data-sla-status={sla.status}
      data-sla-cor={sla.cor}
    >
      <Icone size={11} aria-hidden="true" />
      {rotulo}
    </span>
  );
}
