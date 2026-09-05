"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { ObterCardBpm, MoverCardBpm, type CardFilhoCriado } from "@/actions/bpm/Cards";
import { ObterResumoChecklistCardBpm } from "@/actions/bpm/Checklists";
import { useCardSave } from "./CardSaveContext";
import {
  ERRO_DATA_REUNIAO_OBRIGATORIA,
  etapaEhAgendarReuniao,
  destinoEhReuniaoAgendada,
} from "@/lib/bpm/agendar-reuniao";
import { etapaEhReuniaoAgendada } from "@/lib/bpm/reuniao-agendada";
import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";

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
  const router = useRouter();
  const { flushSaves } = useCardSave();
  const [movendoEtapa, setMovendoEtapa] = useState(false);
  const [pendenciasChecklist, setPendenciasChecklist] = useState<{
    quantidade: number;
    templates: string[];
    primeiroItemId: string | null;
  } | null>(null);
  const aguardandoDataHora = etapaEhAgendarReuniao(card.etapa.nome) && !card.dataReuniao;
  const aguardandoTranscricao = etapaEhReuniaoAgendada(card.etapa.nome)
    && !card.transcricaoReuniao?.trim();

  const carregarPendencias = useCallback(async () => {
    const resposta = await ObterResumoChecklistCardBpm({ cardId: card.id });
    if (!resposta.success) return;
    setPendenciasChecklist(resposta.data.pendentesObrigatorios > 0 ? {
      quantidade: resposta.data.pendentesObrigatorios,
      templates: resposta.data.templatesComPendencia.map((item) => item.nome),
      primeiroItemId: resposta.data.itensObrigatoriosPendentes[0]?.id ?? null,
    } : null);
  }, [card.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void carregarPendencias(), 0);
    function atualizarResumo(event: Event) {
      const detail = (event as CustomEvent<{
        cardId: string;
        pendentesObrigatorios: number;
        templates: string[];
        primeiroItemId: string | null;
      }>).detail;
      if (detail?.cardId !== card.id) return;
      setPendenciasChecklist(detail.pendentesObrigatorios > 0 ? {
        quantidade: detail.pendentesObrigatorios,
        templates: detail.templates,
        primeiroItemId: detail.primeiroItemId,
      } : null);
    }
    window.addEventListener("bpm:checklist-resumo", atualizarResumo);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("bpm:checklist-resumo", atualizarResumo);
    };
  }, [card.id, carregarPendencias]);

  function irParaPendencias() {
    window.dispatchEvent(new CustomEvent("bpm:abrir-pendencias-checklist", {
      detail: { cardId: card.id, itemId: pendenciasChecklist?.primeiroItemId ?? null },
    }));
  }

  async function handleMover(etapaDestinoId: string) {
    if (etapaDestinoId === card.etapa.id || movendoEtapa) return;
    setMovendoEtapa(true);
    try {
      // O autosave dos campos da etapa só dispara no onBlur do input. Se o
      // usuário editou um campo e clicou direto em "avançar" sem que o blur
      // natural do navegador tivesse ocorrido ainda, o valor existe no estado
      // da tela mas nunca chegou a ser registrado na fila de saves — e a
      // validação de movimento, que lê o valor persistido, o veria vazio.
      // Forçar o blur aqui garante que qualquer edição pendente seja salva
      // antes do flushSaves, então a tela e a validação nunca divergem.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const savesConcluidos = await flushSaves();
      if (!savesConcluidos) {
        toast.error("Não foi possível salvar os campos. O card não foi movido.");
        return;
      }
      const res = await MoverCardBpm({ cardId: card.id, etapaDestinoId });
      if (res.success) {
        toast.success("Card movido");
        const filhos = (res as { cardsFilhosCriados?: CardFilhoCriado[] }).cardsFilhosCriados;
        if (filhos && filhos.length > 0) {
          for (const filho of filhos) {
            toast.success(`Card interligado criado no pipeline ${filho.pipelineNome}.`, {
              action: {
                label: "Ver card",
                onClick: () => router.push(`/PainelAlpha/AlphaCRM/pipeline/${filho.pipelineId}`),
              },
            });
          }
        }
        onMovido();
      }
      else {
        toast.error(typeof res.error === "string" ? res.error : "Não foi possível mover o card");
        if (typeof res.error === "string" && res.error.startsWith("Avanço bloqueado:")) {
          await carregarPendencias();
        }
      }
    } finally {
      setMovendoEtapa(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent overflow-y-auto p-3 space-y-1.5">
      {pendenciasChecklist && (
        <div role="alert" className="mb-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-[11px] leading-relaxed text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-bold">
                {pendenciasChecklist.quantidade} {pendenciasChecklist.quantidade === 1 ? "item obrigatório pendente" : "itens obrigatórios pendentes"}
              </p>
              <p className="mt-1 text-amber-200/80">{pendenciasChecklist.templates.join(", ")}</p>
              <button type="button" onClick={irParaPendencias} className="mt-2 min-h-11 rounded-lg border border-amber-300/30 px-3 font-bold text-amber-100 transition hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                Ir para pendências
              </button>
            </div>
          </div>
        </div>
      )}
      
      {etapas.map((etapa) => {
        const ativa = etapa.id === card.etapa.id;
        const bloqueadaPorDataHora = aguardandoDataHora && destinoEhReuniaoAgendada(etapa.nome);
        const bloqueadaPorTranscricao = aguardandoTranscricao
          && ["Em tratativa", "Sem viabilidade"].map(normalizarNomeEtapa)
            .includes(normalizarNomeEtapa(etapa.nome));
        const motivoBloqueio = bloqueadaPorDataHora
          ? ERRO_DATA_REUNIAO_OBRIGATORIA
          : bloqueadaPorTranscricao
            ? "A transcrição da reunião ainda não foi recebida."
            : undefined;
        return (
          <button
            key={etapa.id}
            onClick={() => handleMover(etapa.id)}
            disabled={movendoEtapa || !podeMoverEtapa || bloqueadaPorDataHora || bloqueadaPorTranscricao}
            aria-busy={movendoEtapa}
            title={motivoBloqueio}
            className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 not-disabled:hover:bg-white/[0.07]"
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
            <span className="whitespace-nowrap">{etapa.nome}</span>
            {movendoEtapa && !ativa
              ? <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" />
              : ativa
                ? <Check size={15} className="shrink-0" />
                : <ArrowRight size={14} className="shrink-0 opacity-50" />}
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
