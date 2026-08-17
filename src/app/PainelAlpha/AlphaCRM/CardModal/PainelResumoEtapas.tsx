"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ClipboardList } from "lucide-react";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { fmtDateTime } from "@/lib/format-date";
import { etapaResumoInicialId, etapasAnterioresParaResumo, type EtapaResumoPipeline } from "@/lib/bpm/resumo-etapas";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

interface Props {
  card: CardDetalhe;
  etapas: EtapaResumoPipeline[];
  accent: string;
  ocultarTitulo?: boolean;
}

function obterEtapaDoHistorico(valorJson: string | null): string | null {
  if (!valorJson) return null;
  try {
    const valor = JSON.parse(valorJson) as { etapaId?: unknown };
    return typeof valor.etapaId === "string" ? valor.etapaId : null;
  } catch {
    return null;
  }
}

function formatarValorResumo(valor: string): string {
  if (valor === "true") return "Sim";
  if (valor === "false") return "Não";
  return valor;
}

export function PainelResumoEtapas({ card, etapas, accent, ocultarTitulo }: Props) {
  const etapasAnteriores = etapasAnterioresParaResumo(etapas, card.etapa.id);
  const [etapaAbertaId, setEtapaAbertaId] = useState(() => etapaResumoInicialId(etapas, card.etapa.id));

  if (etapasAnteriores.length === 0) {
    if (!ocultarTitulo) return null;
    return <p className="text-xs text-slate-600">Nenhuma etapa concluída ainda.</p>;
  }

  return (
    <section aria-label="Resumo das etapas anteriores" className="space-y-2">
      {!ocultarTitulo && (
        <div className="flex items-center gap-2 px-1 pt-1">
          <ClipboardList size={14} style={{ color: `rgb(${accent})` }} aria-hidden="true" />
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Etapas concluídas</p>
        </div>
      )}

      {etapasAnteriores.map((etapa) => {
        const aberta = etapaAbertaId === etapa.id;
        const registroEntrada = card.historico.find(
          (historico) => (
            (historico.acao === "CARD_CRIADO" || historico.acao === "CARD_MOVIDO")
            && obterEtapaDoHistorico(historico.valorNovoJson) === etapa.id
          ),
        );
        const camposPreenchidos = card.campoValores.filter(
          (campoValor) => campoValor.campo.etapaId === etapa.id && Boolean(campoValor.valor?.trim()),
        );
        return (
          <div key={etapa.id} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-colors hover:border-white/10">
            <button
              type="button"
              onClick={() => setEtapaAbertaId((atual) => (atual === etapa.id ? null : etapa.id))}
              aria-expanded={aberta}
              aria-controls={`resumo-etapa-${card.id}-${etapa.id}`}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `rgba(${accent},0.15)` }}
                >
                  <CheckCircle2 size={14} style={{ color: `rgb(${accent})` }} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-white">{etapa.nome}</span>
                  <span className="block text-[10px] text-slate-500">{registroEntrada ? "Etapa registrada" : "Resumo da etapa"}</span>
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${aberta ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {aberta && (
              <div id={`resumo-etapa-${card.id}-${etapa.id}`} className="space-y-3 border-t border-white/[0.05] px-4 pb-4 pt-3">
                <div className="rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Entrada na etapa</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {registroEntrada ? fmtDateTime(registroEntrada.createdAt) : "Não há movimentação registrada para esta etapa."}
                  </p>
                </div>

                {camposPreenchidos.length > 0 ? (
                  <dl className="space-y-2">
                    {camposPreenchidos.map((campoValor) => (
                      <div key={campoValor.id} className="border-l-2 border-white/10 pl-2.5">
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{campoValor.campo.nome}</dt>
                        <dd className="mt-0.5 break-words text-xs leading-relaxed text-slate-300">{formatarValorResumo(campoValor.valor ?? "")}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs leading-relaxed text-slate-500">Nenhum campo específico desta etapa foi preenchido.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
