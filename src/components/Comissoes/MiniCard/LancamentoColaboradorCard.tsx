"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "../lib/status-badge";
import { formatarCentavosBRL, formatarDataComissao } from "../lib/formatters";
import { ModalRegistrarPagamento } from "./ModalRegistrarPagamento";
import { ModalProgramarPagamento } from "./ModalProgramarPagamento";
import type { CommissionEntryComColaborador, EntryComponentResumo } from "@/actions/CommissionEntries";
import type { TemaAlpha } from "@/lib/temas";

const TIPO_LABEL: Record<string, string> = { COMISSAO: "Comissão", PREMIO: "Prêmio", DSR: "DSR", AJUSTE: "Ajuste" };
const STATUS_PERMITE_PAGAMENTO = ["Pendente", "ParcialmentePago", "Programado", "Vencido"];

function descricaoComponente(componente: EntryComponentResumo) {
  const tipo = TIPO_LABEL[componente.tipo] ?? componente.tipo;
  try {
    const memoria = JSON.parse(componente.memoriaCalculoJson) as { ruleName?: string };
    if (memoria.ruleName?.toLowerCase().includes("primeira tentativa")) return `${tipo} — 1ª tentativa`;
    if (memoria.ruleName?.toLowerCase().includes("êxito") || memoria.ruleName?.toLowerCase().includes("exito")) return `${tipo} — êxito`;
  } catch {
    // Mantém o tipo como rótulo seguro.
  }
  return tipo;
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return `${partes[0]?.[0] ?? ""}${partes.length > 1 ? partes.at(-1)?.[0] ?? "" : ""}`.toUpperCase();
}

interface LancamentoColaboradorCardProps {
  entry: CommissionEntryComColaborador;
  tema: TemaAlpha;
  onAbrirDetalhes: (entryId: string) => void;
  onPagamentoRegistrado?: () => void;
}

export function LancamentoColaboradorCard({ entry, tema, onAbrirDetalhes, onPagamentoRegistrado }: LancamentoColaboradorCardProps) {
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalProgramacaoAberto, setModalProgramacaoAberto] = useState(false);
  const podePagar = STATUS_PERMITE_PAGAMENTO.includes(entry.status) && entry.saldoPendenteCents > 0;

  return (
    <article className="rounded-2xl border border-white/5 bg-slate-950/60 p-3">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: `rgb(${tema.accent})` }}>
          {iniciais(entry.colaboradorNome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{entry.cargoNome ?? "Cargo não informado"}</p>
              <p className="truncate text-sm font-medium text-white">{entry.colaboradorNome}</p>
            </div>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">{entry.vinculo}</span>
          </div>

          <div className="mt-3 space-y-1">
            {entry.componentes.map((componente) => (
              <div key={componente.id} className="flex items-start justify-between gap-2 text-xs text-slate-400">
                <span>{descricaoComponente(componente)}</span>
                <span className="shrink-0 font-mono tabular-nums">{formatarCentavosBRL(componente.valorCents)}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1 border-t border-white/5 pt-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-mono text-white">{formatarCentavosBRL(entry.totalCents)}</span></div>
            {entry.saldoPagoCents !== 0 && <div className="flex justify-between"><span className="text-slate-500">Pago</span><span className="font-mono text-emerald-300">{formatarCentavosBRL(entry.saldoPagoCents)}</span></div>}
            <div className="flex justify-between"><span className="text-slate-500">Saldo</span><span className="font-mono text-amber-300">{formatarCentavosBRL(entry.saldoPendenteCents)}</span></div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <StatusBadge status={entry.status} />
            <span className="text-[11px] text-slate-500">
              {entry.scheduledPaymentDate
                ? `Programado: ${formatarDataComissao(entry.scheduledPaymentDate)}`
                : entry.contractualDueDate
                  ? `Previsto: ${formatarDataComissao(entry.contractualDueDate)}`
                  : "Sem data prevista"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button size="sm" variant="outline" className="h-8 border-white/10 px-2 text-xs" onClick={() => onAbrirDetalhes(entry.id)}>Detalhes</Button>
            <Button size="sm" variant="outline" className="h-8 border-white/10 px-2 text-xs" disabled={!podePagar} onClick={() => setModalProgramacaoAberto(true)}>Programar</Button>
            <Button size="sm" className="h-8 px-2 text-xs" disabled={!podePagar} onClick={() => setModalPagamentoAberto(true)}>Pagar</Button>
          </div>
        </div>
      </div>

      {modalPagamentoAberto && (
        <ModalRegistrarPagamento open onOpenChange={setModalPagamentoAberto} entryId={entry.id} colaboradorNome={entry.colaboradorNome} saldoPendenteCents={entry.saldoPendenteCents} onConfirmado={onPagamentoRegistrado} />
      )}
      {modalProgramacaoAberto && (
        <ModalProgramarPagamento open onOpenChange={setModalProgramacaoAberto} entryId={entry.id} colaboradorNome={entry.colaboradorNome} dataAtual={entry.scheduledPaymentDate} onConfirmado={onPagamentoRegistrado} />
      )}
    </article>
  );
}
