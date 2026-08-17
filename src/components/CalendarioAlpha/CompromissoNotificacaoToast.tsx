"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useCalendarioAlphaNotificacoes } from "@/store/useCalendarioAlphaNotificacoes";

const ROTULO_JANELA: Record<"10min" | "5min", string> = {
  "10min": "em 10 minutos",
  "5min": "em 5 minutos",
};

const ROTULO_PAPEL: Record<"VISUALIZADOR" | "EDITOR", string> = {
  VISUALIZADOR: "visualizador",
  EDITOR: "editor",
};

/** Espelha `NotaNotificacaoToast.tsx` (sonner). */
export function CompromissoNotificacaoToast() {
  const notificacoes = useCalendarioAlphaNotificacoes((s) => s.notificacoes);
  const router = useRouter();
  const exibidasRef = useRef(new Set<string>());

  useEffect(() => {
    for (const notificacao of notificacoes) {
      if (exibidasRef.current.has(notificacao.notificacaoId)) continue;
      exibidasRef.current.add(notificacao.notificacaoId);

      const abrirAgenda = () => router.push("/PainelAlpha/CalendarioAlpha");

      if (notificacao.tipo === "COMPROMISSO") {
        toast.info(`Compromisso ${ROTULO_JANELA[notificacao.janela]}`, {
          description: notificacao.titulo,
          action: { label: "Abrir agenda", onClick: abrirAgenda },
        });
      } else if (notificacao.tipo === "SOLICITACAO_RECEBIDA") {
        toast.info("Pedido de compartilhamento de agenda", {
          description: `${notificacao.solicitanteNome} quer ${ROTULO_PAPEL[notificacao.papelPedido]} da sua agenda.`,
          action: { label: "Responder", onClick: abrirAgenda },
        });
      } else {
        const aceito = notificacao.status === "ACEITO";
        toast[aceito ? "success" : "warning"](
          aceito ? "Compartilhamento aceito" : "Compartilhamento recusado",
          {
            description: `${notificacao.alvoNome} ${aceito ? "aceitou" : "recusou"} seu pedido de ${ROTULO_PAPEL[notificacao.papelPedido]}.`,
            action: { label: "Abrir agenda", onClick: abrirAgenda },
          },
        );
      }
    }
  }, [notificacoes, router]);

  return null;
}
