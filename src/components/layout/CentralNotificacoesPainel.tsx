"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  FileCheck2,
  Headphones,
  Inbox,
  NotebookPen,
  ReceiptText,
  X,
} from "lucide-react";

import { intencaoParaNotificacaoAgenda, type IntencaoAgendaAlpha } from "@/lib/google-calendar/navegacao";
import { useCalendarioAlphaNotificacoes, type CalendarioAlphaNotificacao } from "@/store/useCalendarioAlphaNotificacoes";
import { useChamadoNotificacoes } from "@/store/useChamadoNotificacoes";
import { useChecklistNotificacoes } from "@/store/useChecklistNotificacoes";
import { useHoleriteNotificacoes } from "@/store/useHoleriteNotificacoes";
import { useNotasNotificacoes } from "@/store/useNotasNotificacoes";

interface ItemCentralNotificacoes {
  id: string;
  origem: string;
  titulo: string;
  subtitulo: string;
  criadoEm: string;
  cor: string;
  lida: boolean;
  Icone: ComponentType<{ className?: string }>;
  abrir: () => void;
  remover: () => void;
}

const ROTULO_JANELA: Record<"10min" | "5min", string> = {
  "10min": "em 10 minutos",
  "5min": "em 5 minutos",
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

function formatarMomento(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "agora";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function conteudoAgenda(notificacao: CalendarioAlphaNotificacao): {
  titulo: string;
  subtitulo: string;
  cor: string;
} {
  if (notificacao.tipo === "COMPROMISSO") {
    return {
      titulo: notificacao.titulo,
      subtitulo: `${formatarHorario(notificacao.inicioEm)} · ${ROTULO_JANELA[notificacao.janela]}`,
      cor: notificacao.calendarioCorHex ?? "#3b82f6",
    };
  }

  if (notificacao.tipo === "SOLICITACAO_RECEBIDA") {
    return {
      titulo: `${notificacao.solicitanteNome} pediu acesso à sua agenda`,
      subtitulo: `Como ${ROTULO_PAPEL[notificacao.papelPedido]}`,
      cor: "#6366f1",
    };
  }

  const aceito = notificacao.status === "ACEITO";
  return {
    titulo: `${notificacao.alvoNome} ${aceito ? "aceitou" : "recusou"} seu pedido`,
    subtitulo: `Compartilhamento como ${ROTULO_PAPEL[notificacao.papelPedido]}`,
    cor: aceito ? "#22c55e" : "#f43f5e",
  };
}

function CartaoCentral({
  item,
  onAbrir,
}: {
  item: ItemCentralNotificacoes;
  onAbrir: (item: ItemCentralNotificacoes) => void;
}) {
  const Icone = item.Icone;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className={`group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors hover:bg-white/5 ${
        item.lida ? "border-white/5 bg-white/[0.018] opacity-70" : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <span
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg"
        style={{ color: item.cor, backgroundColor: `${item.cor}1f` }}
        aria-hidden="true"
      >
        <Icone className="size-3.5" />
      </span>
      <button type="button" onClick={() => onAbrir(item)} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{item.origem}</span>
          {!item.lida && <span className="size-1.5 rounded-full bg-sky-400" aria-label="Não lida" />}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-white">{item.titulo}</span>
        <span className="block truncate text-[10px] text-slate-400">{item.subtitulo}</span>
        <span className="mt-1 block text-[9px] font-medium text-slate-600">{formatarMomento(item.criadoEm)}</span>
      </button>
      <button
        type="button"
        onClick={item.remover}
        aria-label={`Remover notificação de ${item.origem}`}
        className="rounded p-0.5 text-slate-600 opacity-0 transition-opacity hover:text-rose-400 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 group-hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </motion.div>
  );
}

export function CentralNotificacoesPainel({
  onAbrirAgenda,
  onAbrirModulo,
  onAbrirNota,
}: {
  onAbrirAgenda: (intencao: IntencaoAgendaAlpha) => void;
  onAbrirModulo: (url: string, label: string) => void;
  onAbrirNota: (noteId: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [pulsar, setPulsar] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const calendario = useCalendarioAlphaNotificacoes();
  const chamados = useChamadoNotificacoes();
  const checklist = useChecklistNotificacoes();
  const notas = useNotasNotificacoes();
  const holerite = useHoleriteNotificacoes();

  const itens: ItemCentralNotificacoes[] = [
    ...calendario.notificacoes.map((notificacao) => {
      const conteudo = conteudoAgenda(notificacao);
      return {
        id: `agenda-${notificacao.notificacaoId}`,
        origem: "Agenda Alpha",
        titulo: conteudo.titulo,
        subtitulo: conteudo.subtitulo,
        criadoEm: notificacao.createdAt,
        cor: conteudo.cor,
        lida: notificacao.lida,
        Icone: CalendarDays,
        abrir: () => onAbrirAgenda(intencaoParaNotificacaoAgenda(notificacao)),
        remover: () => calendario.removerNotificacao(notificacao.notificacaoId),
      };
    }),
    ...chamados.notificacoes.map((notificacao) => ({
      id: `chamado-${notificacao.id}`,
      origem: "Chamados",
      titulo: notificacao.titulo,
      subtitulo: notificacao.usuario,
      criadoEm: notificacao.createdAt,
      cor: notificacao.urgencia === "CONCLUIDO"
        ? "#34d399"
        : notificacao.urgencia === "EM_ATENDIMENTO"
          ? "#38bdf8"
          : notificacao.urgencia === "MENSAGEM"
            ? "#a78bfa"
            : "#fb7185",
      lida: notificacao.lida,
      Icone: Headphones,
      abrir: () => onAbrirModulo("/PainelAlpha/Chamados", "Chamados"),
      remover: () => chamados.removerNotificacao(notificacao.id),
    })),
    ...checklist.notificacoes.map((notificacao) => ({
      id: `checklist-${notificacao.id}`,
      origem: "Checklist",
      titulo: notificacao.razaoSocial,
      subtitulo: `${notificacao.nomeArquivo} · ${notificacao.nomeCliente}`,
      criadoEm: notificacao.criadoEm,
      cor: "#60a5fa",
      lida: notificacao.lida,
      Icone: FileCheck2,
      abrir: () => onAbrirModulo(`/PainelAlpha/CheckList/${notificacao.empresaId}`, "Checklist"),
      remover: () => checklist.removerNotificacao(notificacao.id),
    })),
    ...notas.notificacoes.map((notificacao) => ({
      id: `nota-${notificacao.id}`,
      origem: "Notas",
      titulo: notificacao.noteTitle,
      subtitulo: `${notificacao.autorNome} · ${notificacao.mensagem}`,
      criadoEm: notificacao.createdAt,
      cor: "#a78bfa",
      lida: notificacao.lida,
      Icone: NotebookPen,
      abrir: () => onAbrirNota(notificacao.noteId),
      remover: () => notas.removerNotificacao(notificacao.id),
    })),
    ...(holerite.alertaAtivo ? [{
      id: `holerite-${holerite.alertaAtivo.id}`,
      origem: "Holerites",
      titulo: holerite.alertaAtivo.titulo,
      subtitulo: holerite.alertaAtivo.mensagem.replace(/\s+/g, " ").trim(),
      criadoEm: holerite.alertaAtivo.disparadoEm,
      cor: holerite.alertaAtivo.tipo === "FINAL" ? "#fb7185" : "#fbbf24",
      lida: holerite.alertaLido,
      Icone: ReceiptText,
      abrir: () => onAbrirModulo("/PainelAlpha/Holerites", "Holerites"),
      remover: () => holerite.descartarAlerta(holerite.alertaAtivo!.id),
    }] : []),
  ].sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());

  const naoLidas = itens.filter((item) => !item.lida).length;
  const quantidadeAnteriorRef = useRef(itens.length);

  useEffect(() => {
    if (itens.length > quantidadeAnteriorRef.current) {
      setPulsar(true);
      const timeout = window.setTimeout(() => setPulsar(false), 2000);
      quantidadeAnteriorRef.current = itens.length;
      return () => window.clearTimeout(timeout);
    }
    quantidadeAnteriorRef.current = itens.length;
  }, [itens.length]);

  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  function marcarTodasLidas() {
    calendario.marcarTodasLidas();
    chamados.marcarTodasLidas();
    checklist.marcarTodasLidas();
    notas.marcarTodasLidas();
    holerite.marcarAlertaComoLido();
  }

  function handleAbrir() {
    setAberto((valor) => !valor);
    if (!aberto && naoLidas > 0) window.setTimeout(marcarTodasLidas, 1200);
  }

  function abrirItem(item: ItemCentralNotificacoes) {
    setAberto(false);
    item.abrir();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleAbrir}
        title="Notificações"
        aria-label="Notificações"
        data-guia-agenda="sino-notificacoes"
        className={`relative inline-flex size-6 items-center justify-center rounded-full transition-all ${
          itens.length > 0 ? "text-slate-300 hover:text-white" : "text-slate-700 hover:text-slate-500"
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
              className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white"
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
            className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#060c1a] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="size-3.5 text-indigo-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Notificações</span>
                {naoLidas > 0 && (
                  <span className="rounded-full border border-rose-500/30 bg-rose-500/15 px-1.5 py-0.5 text-[8px] font-black text-rose-400">
                    {naoLidas}
                  </span>
                )}
              </div>
              {itens.length > 0 && (
                <button
                  type="button"
                  onClick={marcarTodasLidas}
                  className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-600 transition-colors hover:text-indigo-400"
                >
                  <CheckCheck className="size-2.5" />
                  Marcar lidas
                </button>
              )}
            </div>

            <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
              {itens.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-600">
                  <Inbox className="size-6" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Nenhuma notificação</span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {itens.map((item) => (
                    <CartaoCentral key={item.id} item={item} onAbrir={abrirItem} />
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
