"use client";

import { LancamentoColaboradorCard } from "../MiniCard/LancamentoColaboradorCard";
import type { CommissionEntryComColaborador } from "@/actions/CommissionEntries";
import type { TemaAlpha } from "@/lib/temas";

interface SetorColaboradoresProps {
  titulo: string;
  entries: CommissionEntryComColaborador[];
  tema: TemaAlpha;
  onAbrirDetalhes: (entryId: string) => void;
  onPagamentoRegistrado?: () => void;
}

/**
 * Renderiza os mini cards de 1 setor a partir dos participantes REAIS do evento — nunca
 * uma lista de cargos hardcoded (seção 7 do prompt). Se não há colaborador algum, o
 * componente pai (EventoComissaoCard) simplesmente não renderiza esta coluna.
 */
export function SetorColaboradores({ titulo, entries, tema, onAbrirDetalhes, onPagamentoRegistrado }: SetorColaboradoresProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <div className="space-y-2">
        {entries.map((entry) => (
          <LancamentoColaboradorCard
            key={entry.id}
            entry={entry}
            tema={tema}
            onAbrirDetalhes={onAbrirDetalhes}
            onPagamentoRegistrado={onPagamentoRegistrado}
          />
        ))}
      </div>
    </div>
  );
}
