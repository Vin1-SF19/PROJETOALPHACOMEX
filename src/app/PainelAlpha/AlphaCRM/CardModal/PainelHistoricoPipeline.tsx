"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2, Route } from "lucide-react";
import { fmtDateTime } from "@/lib/format-date";
import { ObterJornadaCardPipeline } from "@/actions/bpm/Jornada";

type Passagem = Awaited<ReturnType<typeof ObterJornadaCardPipeline>>["data"][number];

interface Props {
  cardId: string;
  pipelineId: string;
  pipelineNome: string;
  accent: string;
  realtimeRevision?: number;
  onAbrirCard: (cardId: string) => void;
}

export default function PainelHistoricoPipeline({ cardId, pipelineId, pipelineNome, accent, realtimeRevision = 0, onAbrirCard }: Props) {
  const chaveConsulta = `${cardId}:${pipelineId}:${realtimeRevision}`;
  const [resultado, setResultado] = useState<{ chave: string; dados: Passagem[]; erro: string | null } | null>(null);

  useEffect(() => {
    let cancelado = false;
    ObterJornadaCardPipeline(cardId, pipelineId).then((res) => {
      if (cancelado) return;
      if (!res.success) {
        setResultado({ chave: chaveConsulta, dados: [], erro: res.error });
        return;
      }
      setResultado({ chave: chaveConsulta, dados: res.data, erro: null });
    });
    return () => { cancelado = true; };
  }, [cardId, pipelineId, realtimeRevision, chaveConsulta]);

  if (resultado?.chave !== chaveConsulta) return <div role="status" aria-label="Carregando jornada" className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-500" size={22} /></div>;
  if (resultado.erro) return <p role="alert" className="text-sm text-rose-300">{resultado.erro}</p>;
  const dados = resultado.dados;

  return (
    <section aria-label={`Etapas percorridas em ${pipelineNome}`} className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4">
      <div className="mb-4 flex items-center gap-2">
        <Route size={15} style={{ color: `rgb(${accent})` }} aria-hidden="true" />
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-300">Etapas percorridas</h2>
      </div>
      {dados.length === 0 ? (
        <p className="text-xs text-slate-500">Este card ainda não passou por {pipelineNome}.</p>
      ) : (
        <ol className="space-y-3">
          {dados.map((passagem, indice) => (
            <li key={`${passagem.cardId}-${passagem.etapaId}-${passagem.entrouEm}-${indice}`} className="border-l-2 pl-3" style={{ borderColor: `rgba(${accent},0.45)` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{passagem.etapaNome}</p>
                  <p className="text-[11px] text-slate-500">{passagem.entrouEm ? `Entrada: ${fmtDateTime(passagem.entrouEm)}` : "Data de entrada indisponível"}</p>
                  {passagem.origem === "ESTADO_ATUAL" && <p className="text-[11px] text-slate-500">Etapa atual registrada no card</p>}
                </div>
                {!passagem.cardAtual && (
                  <button type="button" onClick={() => onAbrirCard(passagem.cardId)} aria-label={`Abrir card vinculado na etapa ${passagem.etapaNome}`} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
