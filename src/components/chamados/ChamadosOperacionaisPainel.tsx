"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Headphones,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  UserCheck,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  assumirChamado,
  enviarMensagemChamadoAtendidoTIAction,
  listarChamadosAtivosTIAction,
  updateChamadosStatus,
  type ChamadoOperacionalTI,
} from "@/actions/chamados";
import { CHAMADOS_OPERACIONAIS_ATUALIZAR_EVENT } from "@/lib/chamados/notificacoes";
import { fmtDateTime, fmtTime } from "@/lib/format-date";

interface ChamadosOperacionaisPainelProps {
  usuarioAtualId: number;
  onAbrirModulo: () => void;
}

const PRIORIDADE: Record<string, string> = {
  URGENTE: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  ALTA: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  MEDIA: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  BAIXA: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

const INTERVALO_RECONCILIACAO_MS = 20_000;

export function ChamadosOperacionaisPainel({
  usuarioAtualId,
  onAbrirModulo,
}: ChamadosOperacionaisPainelProps) {
  const [chamados, setChamados] = useState<ChamadoOperacionalTI[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [solucao, setSolucao] = useState("");
  const [acaoId, setAcaoId] = useState<number | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const consultaEmVooRef = useRef(false);
  const montadoRef = useRef(true);

  const carregar = useCallback(async () => {
    if (consultaEmVooRef.current) return;
    consultaEmVooRef.current = true;

    try {
      const resposta = await listarChamadosAtivosTIAction();
      if (!montadoRef.current) return;
      if (!resposta.success) {
        setErro(resposta.error ?? "Não foi possível carregar os chamados.");
        return;
      }
      setChamados(resposta.chamados);
      if (resposta.chamados.length === 0) setAberto(false);
      setExpandidoId((atual) =>
        atual !== null && resposta.chamados.some((chamado) => chamado.id === atual)
          ? atual
          : null,
      );
      setErro(null);
    } catch {
      if (montadoRef.current) setErro("Não foi possível carregar os chamados.");
    } finally {
      consultaEmVooRef.current = false;
      if (montadoRef.current) setCarregandoInicial(false);
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    const carregamentoInicial = window.setTimeout(() => void carregar(), 0);
    const intervalo = window.setInterval(() => void carregar(), INTERVALO_RECONCILIACAO_MS);
    const atualizar = () => void carregar();
    window.addEventListener("focus", atualizar);
    window.addEventListener(CHAMADOS_OPERACIONAIS_ATUALIZAR_EVENT, atualizar);
    return () => {
      montadoRef.current = false;
      window.clearTimeout(carregamentoInicial);
      window.clearInterval(intervalo);
      window.removeEventListener("focus", atualizar);
      window.removeEventListener(CHAMADOS_OPERACIONAIS_ATUALIZAR_EVENT, atualizar);
    };
  }, [carregar]);

  useEffect(() => {
    if (!aberto) return;
    const fecharAoClicarFora = (event: PointerEvent) => {
      if (raizRef.current && !raizRef.current.contains(event.target as Node)) setAberto(false);
    };
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fecharAoClicarFora);
    document.addEventListener("keydown", fecharComEscape);
    return () => {
      document.removeEventListener("pointerdown", fecharAoClicarFora);
      document.removeEventListener("keydown", fecharComEscape);
    };
  }, [aberto]);

  async function assumir(chamadoId: number) {
    setAcaoId(chamadoId);
    try {
      const resposta = await assumirChamado(chamadoId);
      if (!resposta.success) {
        toast.error(resposta.error ?? "Não foi possível assumir o chamado.");
        return;
      }
      toast.success(`Chamado #${chamadoId} assumido.`);
      await carregar();
    } catch {
      toast.error("Não foi possível assumir o chamado.");
    } finally {
      setAcaoId(null);
    }
  }

  async function enviar(chamadoId: number) {
    const texto = mensagem.trim();
    if (!texto || acaoId !== null) return;
    setAcaoId(chamadoId);
    try {
      const resposta = await enviarMensagemChamadoAtendidoTIAction(chamadoId, texto);
      if (!resposta.success) {
        toast.error(resposta.error ?? "Não foi possível enviar a mensagem.");
        return;
      }
      setMensagem("");
      toast.success("Mensagem enviada.");
      await carregar();
    } catch {
      toast.error("Não foi possível enviar a mensagem.");
    } finally {
      setAcaoId(null);
    }
  }

  async function finalizar(chamadoId: number) {
    const textoSolucao = solucao.trim();
    if (!textoSolucao || acaoId !== null) {
      if (!textoSolucao) toast.error("Informe a solução aplicada antes de finalizar.");
      return;
    }
    setAcaoId(chamadoId);
    try {
      const resposta = await updateChamadosStatus(chamadoId, "CONCLUIDO", textoSolucao);
      if (!resposta.success) {
        toast.error(resposta.error ?? "Não foi possível finalizar o chamado.");
        return;
      }
      setSolucao("");
      toast.success(`Chamado #${chamadoId} finalizado.`);
      await carregar();
    } catch {
      toast.error("Não foi possível finalizar o chamado.");
    } finally {
      setAcaoId(null);
    }
  }

  function alternarChamado(chamadoId: number) {
    setExpandidoId((atual) => (atual === chamadoId ? null : chamadoId));
    setMensagem("");
    setSolucao("");
  }

  if (carregandoInicial || chamados.length === 0) return null;

  return (
    <div ref={raizRef} className="relative" data-chamados-operacionais-ti>
      <button
        type="button"
        onClick={() => {
          setAberto((valor) => !valor);
          void carregar();
        }}
        title={`${chamados.length} chamado${chamados.length === 1 ? "" : "s"} ativo${chamados.length === 1 ? "" : "s"}`}
        aria-label="Chamados ativos da equipe de TI"
        aria-expanded={aberto}
        aria-controls="chamados-operacionais-ti"
        className="relative inline-flex size-6 items-center justify-center rounded-full text-blue-300 transition-colors hover:bg-blue-500/10 hover:text-white"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/25" aria-hidden="true" />
        <Headphones className="relative size-3.5 animate-pulse" aria-hidden="true" />
        <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-blue-500 px-1 text-[8px] font-black text-white shadow-lg">
          {chamados.length > 99 ? "99+" : chamados.length}
        </span>
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            id="chamados-operacionais-ti"
            role="dialog"
            aria-label="Chamados ativos da equipe de TI"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="absolute right-0 top-full z-50 mt-2 w-[26rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-blue-500/20 bg-[#060c1a] shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Headphones className="size-3.5 text-blue-400" aria-hidden="true" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">Fila de chamados</span>
                <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-1.5 py-0.5 text-[8px] font-black text-blue-300">
                  {chamados.length}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void carregar()}
                  className="text-slate-600 transition-colors hover:text-blue-300"
                  aria-label="Atualizar chamados"
                >
                  <RefreshCw className="size-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    onAbrirModulo();
                  }}
                  className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-500 transition-colors hover:text-blue-300"
                >
                  Ver módulo <ExternalLink className="size-2.5" aria-hidden="true" />
                </button>
              </div>
            </header>

            {erro && (
              <div role="alert" className="flex items-center gap-2 border-b border-rose-500/10 bg-rose-500/5 px-4 py-2 text-[10px] font-medium text-rose-300">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                {erro}
              </div>
            )}

            <div className="max-h-[min(70vh,34rem)] space-y-2 overflow-y-auto p-3">
              {chamados.map((chamado) => {
                const expandido = expandidoId === chamado.id;
                const proprioAtendimento = chamado.status === "EM_ATENDIMENTO" && chamado.tecnicoId === usuarioAtualId;
                const podeAssumir = chamado.status === "ABERTO"
                  && (chamado.tecnicoSolicitadoId === null || chamado.tecnicoSolicitadoId === usuarioAtualId);
                const ocupado = acaoId === chamado.id;
                return (
                  <article key={chamado.id} className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03]">
                    <button
                      type="button"
                      onClick={() => alternarChamado(chamado.id)}
                      aria-expanded={expandido}
                      className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <span className={`mt-1 size-2 shrink-0 rounded-full ${chamado.status === "ABERTO" ? "animate-pulse bg-amber-400" : "bg-blue-400"}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-black text-white">#{chamado.id} · {chamado.titulo}</span>
                          <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[7px] font-black uppercase ${PRIORIDADE[chamado.prioridade] ?? PRIORIDADE.MEDIA}`}>
                            {chamado.prioridade}
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-medium text-slate-500">
                          <span>{chamado.solicitante.nome}</span>
                          <span>·</span>
                          <span>{chamado.status === "ABERTO" ? "Pendente" : `Em atendimento por ${chamado.tecnico?.nome ?? "TI"}`}</span>
                          <span>·</span>
                          <span>{fmtDateTime(chamado.updatedAt)}</span>
                        </span>
                        {chamado.tecnicoSolicitado && (
                          <span className="mt-1 block truncate text-[8px] font-bold text-cyan-500">Solicitado: {chamado.tecnicoSolicitado.nome}</span>
                        )}
                      </span>
                      <ChevronDown className={`mt-0.5 size-3.5 shrink-0 text-slate-600 transition-transform ${expandido ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>

                    <AnimatePresence initial={false}>
                      {expandido && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 border-t border-white/5 p-3">
                            <p className="line-clamp-3 text-[10px] leading-relaxed text-slate-400">{chamado.descricao}</p>

                            {chamado.mensagens.length > 0 && (
                              <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-white/5 bg-black/20 p-2">
                                {chamado.mensagens.map((item) => (
                                  <div key={item.id} className={`flex ${item.autorId === usuarioAtualId ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[88%] rounded-lg px-2.5 py-1.5 ${item.autorId === usuarioAtualId ? "bg-blue-600/30 text-blue-100" : "bg-white/5 text-slate-300"}`}>
                                      <p className="text-[8px] font-black text-slate-500">{item.autorId === usuarioAtualId ? "Você" : item.autor.nome} · {fmtTime(item.createdAt)}</p>
                                      <p className="whitespace-pre-wrap break-words text-[10px]">{item.texto?.trim() || (item.arquivoTipo ? `Anexo ${item.arquivoTipo}` : "Nova mensagem")}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {chamado.status === "ABERTO" && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (podeAssumir) void assumir(chamado.id);
                                }}
                                disabled={!podeAssumir || acaoId !== null}
                                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
                              >
                                {ocupado ? <Loader2 className="size-3.5 animate-spin" /> : <UserCheck className="size-3.5" />}
                                {ocupado
                                  ? "Assumindo..."
                                  : podeAssumir
                                    ? "Assumir chamado"
                                    : `Reservado para ${chamado.tecnicoSolicitado?.nome ?? "outro técnico"}`}
                              </button>
                            )}

                            {proprioAtendimento ? (
                              <div className="space-y-3">
                                <div className="flex gap-2">
                                  <label htmlFor={`mensagem-chamado-${chamado.id}`} className="sr-only">Mensagem para o chamado #{chamado.id}</label>
                                  <input
                                    id={`mensagem-chamado-${chamado.id}`}
                                    value={mensagem}
                                    onChange={(event) => setMensagem(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        void enviar(chamado.id);
                                      }
                                    }}
                                    placeholder="Responder ao solicitante..."
                                    maxLength={1000}
                                    className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-[10px] text-white outline-none placeholder:text-slate-700 focus:border-blue-500/50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void enviar(chamado.id)}
                                    disabled={!mensagem.trim() || acaoId !== null}
                                    aria-label={`Enviar mensagem no chamado #${chamado.id}`}
                                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-30"
                                  >
                                    {ocupado ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                                  </button>
                                </div>

                                <div className="space-y-2 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03] p-2.5">
                                  <label htmlFor={`solucao-chamado-${chamado.id}`} className="text-[8px] font-black uppercase tracking-wider text-emerald-400">Solução aplicada</label>
                                  <textarea
                                    id={`solucao-chamado-${chamado.id}`}
                                    value={solucao}
                                    onChange={(event) => setSolucao(event.target.value)}
                                    placeholder="Descreva brevemente como o chamado foi resolvido..."
                                    rows={2}
                                    maxLength={1000}
                                    className="w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2.5 text-[10px] text-white outline-none placeholder:text-slate-700 focus:border-emerald-500/40"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void finalizar(chamado.id)}
                                    disabled={!solucao.trim() || acaoId !== null}
                                    className="flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-[8px] font-black uppercase tracking-wider text-white transition-colors hover:bg-emerald-500 disabled:opacity-30"
                                  >
                                    {ocupado ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                                    {ocupado ? "Processando..." : "Finalizar chamado"}
                                  </button>
                                </div>
                              </div>
                            ) : chamado.status === "EM_ATENDIMENTO" ? (
                              <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[9px] font-medium text-slate-500">
                                <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
                                Atendimento vinculado a {chamado.tecnico?.nome ?? "outro técnico"}.
                              </div>
                            ) : null}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
