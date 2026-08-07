"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, Phone, ExternalLink, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { isAdminRole } from "@/lib/roles";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";
import PainelHistorico from "./PainelHistorico";
import PainelRegistrar from "./PainelRegistrar";
import PainelProximaEtapa from "./PainelProximaEtapa";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; nome: string; ordem: number; script: string | null };
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];

const SERVICOS_FIXOS = ["Radar", "TTD-409", "Recuperação Tributária"];

interface Props {
  cardId: string;
  accent: string;
  currentUserId: number | null;
  currentUserRole: string | null;
  onClose: () => void;
  onAtualizado: () => void;
  onAbrirCard: (cardId: string) => void;
}

export default function CardFullViewModal({ cardId, accent, currentUserId, currentUserRole, onClose, onAtualizado, onAbrirCard }: Props) {
  const [card, setCard] = useState<CardDetalhe | null>(null);
  const [etapas, setEtapas] = useState<EtapaOpcao[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregando = card?.id !== cardId && erro === null;

  useEffect(() => {
    let cancelado = false;

    ObterCardBpm(cardId).then((res) => {
      if (cancelado) return;
      if (!res.success || !res.data) {
        setErro(typeof res.error === "string" ? res.error : "Erro ao carregar card");
        return;
      }
      setCard(res.data);

      Promise.all([
        ObterPipelineBpm(res.data.pipeline.id),
        ListarInteracoesCardBpm(cardId),
      ]).then(([pipelineRes, interacoesRes]) => {
        if (cancelado) return;
        if (pipelineRes.success && pipelineRes.data) {
          setEtapas([...pipelineRes.data.etapas].sort((a, b) => a.ordem - b.ordem));
        }
        setInteracoes(interacoesRes.data ?? []);
      });
    });

    return () => { cancelado = true; };
  }, [cardId]);

  async function recarregar() {
    const res = await ObterCardBpm(cardId);
    if (res.success && res.data) setCard(res.data);
  }

  const meuVinculo = card?.membros.find((m) => m.userId === currentUserId);
  const podeMoverEtapa = isAdminRole(currentUserRole) || meuVinculo?.role === "RESPONSAVEL" || meuVinculo?.role === "ADMINISTRADOR";
  const etapaAtual = card ? etapas.find((e) => e.id === card.etapa.id) ?? null : null;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="bottom"
        className="h-[94vh] max-h-[94vh] rounded-t-[2rem] border-t border-white/10 bg-[radial-gradient(ellipse_120%_60%_at_50%_-10%,rgba(var(--accent-rgb),0.12),transparent_60%)] p-0 overflow-hidden sm:max-w-none"
        style={{ ["--accent-rgb" as string]: accent }}
      >
        {carregando ? (
          <>
            <SheetTitle className="sr-only">Carregando card</SheetTitle>
            <div className="flex-1 flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-slate-500" size={28} />
            </div>
          </>
        ) : erro || !card ? (
          <>
            <SheetTitle className="sr-only">Erro ao carregar card</SheetTitle>
            <div className="p-8 text-sm text-rose-300">{erro || "Card não encontrado"}</div>
          </>
        ) : (
          <div className="flex flex-col h-full">
            <SheetTitle className="sr-only">
              {card.empresa.nomeFantasia || card.empresa.razaoSocial}
            </SheetTitle>

            {/* Handle visual do bottom-sheet */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="px-6 sm:px-8 pt-2 pb-5 shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, rgba(${accent},0.35), rgba(${accent},0.08))`,
                      boxShadow: `0 8px 24px -8px rgba(${accent},0.5)`,
                    }}
                  >
                    <Building2 size={19} style={{ color: `rgb(${accent})` }} />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-black text-white tracking-tight truncate">
                      {card.empresa.nomeFantasia || card.empresa.razaoSocial}
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>{card.empresa.cnpj}</span>
                      <span className="text-slate-700">·</span>
                      <Link
                        href={`/PainelAlpha/AlphaCRM/empresa/${card.empresa.id}`}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        Perfil da empresa <ExternalLink size={10} />
                      </Link>
                    </div>
                  </div>
                  <button
                    disabled
                    title="Em breve"
                    className="p-1.5 rounded-lg text-slate-600 opacity-40 cursor-not-allowed shrink-0"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                <button
                  disabled
                  title="Em breve"
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 opacity-90 cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, rgba(52,211,153,0.35), rgba(52,211,153,0.1))",
                    boxShadow: "0 10px 28px -8px rgba(52,211,153,0.55)",
                  }}
                >
                  <Phone size={28} className="text-emerald-400" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {SERVICOS_FIXOS.map((servico) => {
                  const marcado = card.servico?.toLowerCase().includes(servico.toLowerCase());
                  return (
                    <button
                      key={servico}
                      disabled
                      title="Em breve"
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-not-allowed backdrop-blur-sm transition-colors"
                      style={
                        marcado
                          ? { background: `rgba(${accent},0.18)`, color: `rgb(${accent})`, border: `1px solid rgba(${accent},0.35)` }
                          : { background: "rgba(255,255,255,0.03)", color: "#64748b", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      {servico}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3 painéis */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_0.8fr] gap-4 px-4 sm:px-6 pb-6 overflow-hidden min-h-0">
              <PainelHistorico
                card={card}
                interacoes={interacoes}
                accent={accent}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onAtualizado={() => { recarregar(); onAtualizado(); }}
                onAbrirCard={onAbrirCard}
              />
              <PainelRegistrar
                card={card}
                etapaAtual={etapaAtual}
                accent={accent}
                onInteracaoCriada={(nova) => setInteracoes((prev) => [nova, ...prev])}
              />
              <PainelProximaEtapa
                card={card}
                etapas={etapas}
                podeMoverEtapa={podeMoverEtapa}
                accent={accent}
                onMovido={() => { recarregar(); onAtualizado(); }}
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
