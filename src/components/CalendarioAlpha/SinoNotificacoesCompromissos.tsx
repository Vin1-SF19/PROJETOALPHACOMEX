"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, Inbox, X } from "lucide-react";

import {
  useCalendarioAlphaNotificacoes,
  type CalendarioAlphaNotificacao,
} from "@/store/useCalendarioAlphaNotificacoes";

const ROTULO_JANELA: Record<"10min" | "5min", string> = {
  "10min": "em 10 min",
  "5min": "em 5 min",
};

const ROTULO_PAPEL: Record<"VISUALIZADOR" | "EDITOR", string> = {
  VISUALIZADOR: "visualizador",
  EDITOR: "editor",
};

function formatarHorario(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function conteudoCartao(notificacao: CalendarioAlphaNotificacao): { corPonto: string; titulo: string; subtitulo: string } {
  if (notificacao.tipo === "COMPROMISSO") {
    return {
      corPonto: notificacao.calendarioCorHex ?? "#3b82f6",
      titulo: notificacao.titulo,
      subtitulo: `${formatarHorario(notificacao.inicioEm)} · ${ROTULO_JANELA[notificacao.janela]}`,
    };
  }
  if (notificacao.tipo === "SOLICITACAO_RECEBIDA") {
    return {
      corPonto: "#6366f1",
      titulo: `${notificacao.solicitanteNome} pediu acesso à sua agenda`,
      subtitulo: `Como ${ROTULO_PAPEL[notificacao.papelPedido]}`,
    };
  }
  const aceito = notificacao.status === "ACEITO";
  return {
    corPonto: aceito ? "#22c55e" : "#f43f5e",
    titulo: `${notificacao.alvoNome} ${aceito ? "aceitou" : "recusou"} seu pedido`,
    subtitulo: `Compartilhamento como ${ROTULO_PAPEL[notificacao.papelPedido]}`,
  };
}

function CartaoNotificacao({
  notificacao,
  onRemover,
  onAbrirAgenda,
}: {
  notificacao: CalendarioAlphaNotificacao;
  onRemover: (id: string) => void;
  onAbrirAgenda: () => void;
}) {
  const { corPonto, titulo, subtitulo } = conteudoCartao(notificacao);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="group flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2.5 hover:bg-white/5"
    >
      <span className="mt-1 size-2 shrink-0 rounded-full" style={{ backgroundColor: corPonto }} aria-hidden="true" />
      <button type="button" onClick={onAbrirAgenda} className="min-w-0 flex-1 text-left">
        <p className="truncate text-xs font-semibold text-white">{titulo}</p>
        <p className="text-[10px] text-slate-500">{subtitulo}</p>
      </button>
      <button
        type="button"
        onClick={() => onRemover(notificacao.notificacaoId)}
        aria-label="Remover notificação"
        className="rounded p-0.5 text-slate-600 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </motion.div>
  );
}

/**
 * Sino de notificações de compromisso — pedido explícito do usuário: fica ao lado do widget
 * de clima na barra de abas, discreto/apagado quando não há notificação, pulsa quando chega
 * uma nova. Estrutura inspirada em `NotificationCenter.tsx` (Chamados) — que está órfão/nunca
 * importado no projeto, então não é reaproveitado diretamente, só usado como referência de layout.
 */
export function SinoNotificacoesCompromissos() {
  const [aberto, setAberto] = useState(false);
  const [pulsar, setPulsar] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { notificacoes, marcarTodasLidas, removerNotificacao } = useCalendarioAlphaNotificacoes();
  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const quantidadeAnteriorRef = useRef(notificacoes.length);

  useEffect(() => {
    if (notificacoes.length > quantidadeAnteriorRef.current) {
      setPulsar(true);
      const timeout = setTimeout(() => setPulsar(false), 2000);
      quantidadeAnteriorRef.current = notificacoes.length;
      return () => clearTimeout(timeout);
    }
    quantidadeAnteriorRef.current = notificacoes.length;
  }, [notificacoes.length]);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  function handleAbrir() {
    setAberto((v) => !v);
    if (!aberto && naoLidas > 0) setTimeout(marcarTodasLidas, 1200);
  }

  const temNotificacoes = notificacoes.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleAbrir}
        title="Notificações de compromissos"
        aria-label="Notificações de compromissos"
        className={`relative inline-flex size-6 items-center justify-center rounded-full transition-all ${
          temNotificacoes ? "text-slate-300 hover:text-white" : "text-slate-700 hover:text-slate-500"
        }`}
      >
        <motion.span
          animate={pulsar ? { scale: [1, 1.25, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, repeat: pulsar ? 2 : 0 }}
          className="inline-flex"
        >
          <Bell className="size-3.5" />
        </motion.span>
        <AnimatePresence>
          {naoLidas > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center"
            >
              {naoLidas > 9 ? "9+" : naoLidas}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            key="dropdown"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="absolute right-0 top-full mt-2 w-80 z-50 rounded-2xl border border-white/10 bg-[#060c1a] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Bell size={13} className="text-indigo-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Agenda Alpha</span>
                {naoLidas > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-[8px] font-black text-rose-400">
                    {naoLidas}
                  </span>
                )}
              </div>
              {temNotificacoes && (
                <button
                  type="button"
                  onClick={marcarTodasLidas}
                  className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-600 hover:text-indigo-400 transition-colors"
                >
                  <CheckCheck size={10} />
                  Lidas
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto p-3 space-y-2">
              {!temNotificacoes ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-600">
                  <Inbox size={22} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Nenhuma notificação</span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {notificacoes.map((n) => (
                    <CartaoNotificacao
                      key={n.notificacaoId}
                      notificacao={n}
                      onRemover={removerNotificacao}
                      onAbrirAgenda={() => {
                        setAberto(false);
                        router.push("/PainelAlpha/CalendarioAlpha");
                      }}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
