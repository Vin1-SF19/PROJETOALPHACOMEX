"use client";

import { toast } from "sonner";
import { ArrowRight, Check } from "lucide-react";
import { ObterCardBpm, MoverCardBpm } from "@/actions/bpm/Cards";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; nome: string; ordem: number; script: string | null };

interface Props {
  card: CardDetalhe;
  etapas: EtapaOpcao[];
  podeMoverEtapa: boolean;
  accent: string;
  onMovido: () => void;
}

export default function PainelProximaEtapa({ card, etapas, podeMoverEtapa, accent, onMovido }: Props) {
  async function handleMover(etapaDestinoId: string) {
    if (etapaDestinoId === card.etapa.id) return;
    const res = await MoverCardBpm({ cardId: card.id, etapaDestinoId });
    if (res.success) { toast.success("Card movido"); onMovido(); }
    else toast.error(typeof res.error === "string" ? res.error : "Não foi possível mover o card");
  }

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent overflow-y-auto p-4 space-y-2">
      {etapas.map((etapa) => {
        const ativa = etapa.id === card.etapa.id;
        return (
          <button
            key={etapa.id}
            onClick={() => handleMover(etapa.id)}
            disabled={!podeMoverEtapa}
            className="w-full flex items-center justify-between gap-2 text-left px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 not-disabled:hover:-translate-y-0.5 not-disabled:active:translate-y-0"
            style={
              ativa
                ? {
                    background: `linear-gradient(135deg, rgb(${accent}), rgba(${accent},0.75))`,
                    color: "#0f172a",
                    boxShadow: `0 10px 30px -8px rgba(${accent},0.65), inset 0 1px 0 rgba(255,255,255,0.3)`,
                  }
                : {
                    background: "rgba(255,255,255,0.03)",
                    color: "#cbd5e1",
                    border: "1px solid rgba(255,255,255,0.06)",
                    boxShadow: "0 4px 12px -4px rgba(0,0,0,0.3)",
                  }
            }
          >
            <span>{etapa.nome}</span>
            {ativa ? <Check size={15} /> : <ArrowRight size={14} className="opacity-50" />}
          </button>
        );
      })}

      {!podeMoverEtapa && (
        <p className="text-[11px] text-slate-500 mt-3 px-1">
          Somente o responsável ou um administrador pode mover este card.
        </p>
      )}
    </div>
  );
}
