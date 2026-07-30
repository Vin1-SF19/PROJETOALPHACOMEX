"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "../lib/status-badge";
import { formatarCentavosBRL, formatarDataComissao } from "../lib/formatters";
import { ModalRegistrarPagamento } from "./ModalRegistrarPagamento";
import type { CommissionEntryComColaborador } from "@/actions/CommissionEntries";
import type { TemaAlpha } from "@/lib/temas";

const TIPO_LABEL: Record<string, string> = {
  COMISSAO: "Comissão",
  PREMIO: "Prêmio",
  DSR: "DSR",
  AJUSTE: "Ajuste",
};

const STATUS_PERMITE_PAGAMENTO = ["Pendente", "ParcialmentePago", "Programado"];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

interface LancamentoColaboradorCardProps {
  entry: CommissionEntryComColaborador;
  tema: TemaAlpha;
  onAbrirDetalhes: (entryId: string) => void;
  onPagamentoRegistrado?: () => void;
}

export function LancamentoColaboradorCard({
  entry,
  tema,
  onAbrirDetalhes,
  onPagamentoRegistrado,
}: LancamentoColaboradorCardProps) {
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);

  const podePagar = STATUS_PERMITE_PAGAMENTO.includes(entry.status);

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-3">
      <div className="flex items-start gap-3">
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: `rgb(${tema.accent})` }}
          aria-hidden="true"
        >
          {iniciais(entry.colaboradorNome)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-wide text-slate-500">
                {entry.cargoNome ?? "Cargo não informado"}
              </p>
              <p className="truncate text-sm font-medium text-white">{entry.colaboradorNome}</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              {entry.vinculo}
            </span>
          </div>

          <div className="mt-2 space-y-0.5">
            {entry.componentes.map((componente) => (
              <div key={componente.id} className="flex justify-between text-xs text-slate-400">
                <span>{TIPO_LABEL[componente.tipo] ?? componente.tipo}</span>
                <span className="font-mono tabular-nums">{formatarCentavosBRL(componente.valorCents)}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2">
            <span className="text-sm font-semibold tabular-nums text-white">
              {formatarCentavosBRL(entry.totalCents)}
            </span>
            <StatusBadge status={entry.status} />
          </div>

          {entry.contractualDueDate && (
            <p className="mt-1 text-[11px] text-slate-500">
              Previsão: {formatarDataComissao(entry.contractualDueDate)}
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 flex-1 border-white/10 text-xs"
              onClick={() => onAbrirDetalhes(entry.id)}
            >
              Detalhes
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 flex-1 text-xs"
              disabled={!podePagar}
              onClick={() => setModalPagamentoAberto(true)}
              aria-label={podePagar ? "Registrar pagamento" : `Não é possível pagar — status ${entry.status}`}
            >
              Pagar
            </Button>
          </div>
        </div>
      </div>

      <ModalRegistrarPagamento
        open={modalPagamentoAberto}
        onOpenChange={setModalPagamentoAberto}
        entryId={entry.id}
        colaboradorNome={entry.colaboradorNome}
        totalCents={entry.totalCents}
        onConfirmado={onPagamentoRegistrado}
      />
    </div>
  );
}
