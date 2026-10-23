"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BPM_CARD_ABERTO_EVENT, BPM_CARD_ABRIR_EVENT, BPM_CARD_PRONTO_EVENT } from "@/lib/bpm/notificacoes-tarefas";
import { intencaoNotificacaoBpmSchema, type IntencaoNotificacaoBpm } from "@/lib/bpm/notificacoes-navegacao";
import { ObterLeadPendenteNotificacaoBpm } from "@/actions/bpm/NotificacoesLeads";
import type { CardBpm } from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";

interface BoardNavigationProps {
  pipelineId: string;
  usuarioId: number | null;
  inicial?: IntencaoNotificacaoBpm | null;
  abrirCard: (intencao: IntencaoNotificacaoBpm) => void;
  abrirLead: (lead: CardBpm) => void;
  onErro: (mensagem: string) => void;
}
/** Resolve a captura para seu detalhe atual autorizado. Abrir nunca promove nem assume o lead. */
export function useBpmNotificacaoBoardNavigation({ pipelineId, usuarioId, inicial, abrirCard, abrirLead, onErro }: BoardNavigationProps) {
  const sequencia = useRef(0);
  const inicialRef = useRef(inicial);
  const [confirmacao, setConfirmacao] = useState<IntencaoNotificacaoBpm | null>(null);
  const executar = useCallback(async (intencao: IntencaoNotificacaoBpm) => {
    const atual = ++sequencia.current;
    if (intencao.pipelineId !== pipelineId) return;
    if (intencao.origemLead) {
      try {
        const resultado = await ObterLeadPendenteNotificacaoBpm({ tipo: "LEAD_VIRTUAL", pipelineId,
          origemLead: intencao.origemLead, leadId: intencao.leadId });
        if (atual !== sequencia.current) return;
        if (!resultado.success) {
          const mensagem = resultado.codigo === "NAO_AUTORIZADO" ? "Entre novamente para abrir os detalhes deste lead."
            : resultado.codigo === "DESTINO_INVALIDO" ? "Não foi possível identificar o lead desta notificação."
              : resultado.codigo === "LEITURA_INDISPONIVEL" ? "Este lead não está disponível para leitura ou seu acesso mudou."
                : "Não foi possível carregar os detalhes do lead. Tente novamente.";
          onErro(mensagem); return;
        }
        if (resultado.tipo === "CARD") abrirCard({ pipelineId: resultado.destino.pipelineId, cardId: resultado.destino.cardId });
        else abrirLead(resultado.data);
      } catch {
        if (atual === sequencia.current) onErro("Não foi possível abrir o lead. Tente novamente pela central.");
        return;
      }
    } else abrirCard(intencao);
    if (atual === sequencia.current) setConfirmacao(intencao);
  }, [pipelineId, abrirCard, abrirLead, onErro]);
  useEffect(() => {
    const receber = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent
        || event.data?.type !== BPM_CARD_ABRIR_EVENT) return;
      const parsed = intencaoNotificacaoBpmSchema.safeParse(event.data);
      if (parsed.success && parsed.data.pipelineId === pipelineId) void executar(parsed.data);
    };
    const receberLocal = (event: Event) => {
      const parsed = intencaoNotificacaoBpmSchema.safeParse((event as CustomEvent<unknown>).detail);
      if (parsed.success && parsed.data.pipelineId === pipelineId) void executar(parsed.data);
    };
    window.addEventListener("message", receber);
    window.addEventListener(BPM_CARD_ABRIR_EVENT, receberLocal);
    if (window.parent !== window) window.parent.postMessage({ type: BPM_CARD_PRONTO_EVENT }, window.location.origin);
    return () => { sequencia.current += 1; window.removeEventListener("message", receber); window.removeEventListener(BPM_CARD_ABRIR_EVENT, receberLocal); };
  }, [pipelineId, usuarioId, executar]);
  useEffect(() => {
    if (inicialRef.current) { void executar(inicialRef.current); inicialRef.current = null; }
  }, [executar]);
  useEffect(() => {
    if (confirmacao && window.parent !== window) window.parent.postMessage({ type: BPM_CARD_ABERTO_EVENT, ...confirmacao }, window.location.origin);
  }, [confirmacao]);
}
