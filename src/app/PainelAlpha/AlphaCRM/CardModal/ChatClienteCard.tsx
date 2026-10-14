"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { LoaderCircle, MessageSquare, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  EnviarMensagemChatbotxDoCard,
  ListarConversasChatbotxDoCard,
  ListarMensagensChatbotxDoCard,
} from "@/actions/AlphaCrmChatbotx";
import type { ChatbotxConversaPublica, ChatbotxMensagem } from "@/lib/chatbot-alpha/chat-api";
import { mesclarMensagens } from "@/lib/chatbot-alpha/mesclar-mensagens";

interface Props { cardId: string; clienteNome: string; podeEnviar: boolean }
type Estado = "idle" | "loading" | "ready" | "empty" | "error";
const INTERVALO_ATUALIZACAO_MS = 8_000;
const INTERVALO_MAXIMO_FALHA_MS = 60_000;

function nomeContato(conversa: ChatbotxConversaPublica): string {
  const contato = conversa.contact;
  return contato?.fullName || [contato?.firstName, contato?.lastName].filter(Boolean).join(" ") || "Cliente sem nome";
}

function horario(valor: string): string {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

export function ChatClienteCard({ cardId, clienteNome, podeEnviar }: Props) {
  const [open, setOpen] = useState(false);
  const [conversas, setConversas] = useState<ChatbotxConversaPublica[]>([]);
  const [conversa, setConversa] = useState<ChatbotxConversaPublica | null>(null);
  const [mensagens, setMensagens] = useState<ChatbotxMensagem[]>([]);
  const [estado, setEstado] = useState<Estado>("idle");
  const [erro, setErro] = useState<string | null>(null);
  const [erroAtualizacao, setErroAtualizacao] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cursorAntigo, setCursorAntigo] = useState<string | null>(null);
  const [cursorConversas, setCursorConversas] = useState<string | null>(null);
  const [carregandoAntigas, setCarregandoAntigas] = useState(false);
  const [inboxId, setInboxId] = useState("");
  const versaoConversa = useRef(0);
  const painelMensagens = useRef<HTMLDivElement>(null);
  const ultimaMensagemExibida = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!open || !conversa || !mensagens.length) return;
    const ultimaId = mensagens[mensagens.length - 1].id;
    if (ultimaMensagemExibida.current === ultimaId) return;
    ultimaMensagemExibida.current = ultimaId;
    const painel = painelMensagens.current;
    if (painel) painel.scrollTop = painel.scrollHeight;
  }, [open, conversa, mensagens]);

  useEffect(() => {
    if (!open || !conversa || estado !== "ready") return;
    const conversationId = conversa.id;
    const versao = versaoConversa.current;
    let ativo = true;
    let pendente = false;
    let bloqueado = false;
    let falhas = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const conversaAtual = () => ativo && versaoConversa.current === versao;

    function programar(esperaMs: number) {
      if (timer) clearTimeout(timer);
      if (conversaAtual() && !bloqueado && document.visibilityState === "visible") {
        timer = setTimeout(() => void atualizar(), esperaMs);
      }
    }

    async function atualizar() {
      if (!conversaAtual() || pendente || document.visibilityState !== "visible") return;
      pendente = true;
      let esperaMs = INTERVALO_ATUALIZACAO_MS;
      try {
        // Sem cursor: a página mais recente recupera respostas recebidas durante a pausa.
        const resultado = await ListarMensagensChatbotxDoCard(cardId, conversationId);
        if (!conversaAtual()) return;
        if (resultado.success) {
          setMensagens((atuais) => mesclarMensagens(atuais, resultado.data.data));
          setErroAtualizacao(null);
          falhas = 0;
        } else {
          setErroAtualizacao(resultado.error);
          if (!resultado.retryable) { bloqueado = true; return; }
          falhas += 1;
          esperaMs = Math.max(
            resultado.retryAfterMs ?? 0,
            Math.min(INTERVALO_MAXIMO_FALHA_MS, INTERVALO_ATUALIZACAO_MS * 2 ** falhas),
          );
        }
      } catch {
        if (!conversaAtual()) return;
        setErroAtualizacao("Não foi possível atualizar as mensagens. Nova tentativa em breve.");
        falhas += 1;
        esperaMs = Math.min(INTERVALO_MAXIMO_FALHA_MS, INTERVALO_ATUALIZACAO_MS * 2 ** falhas);
      } finally {
        pendente = false;
        if (conversaAtual()) programar(esperaMs);
      }
    }

    function aoMudarVisibilidade() {
      if (timer) clearTimeout(timer);
      if (document.visibilityState === "visible" && !pendente && !bloqueado) void atualizar();
    }

    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    programar(INTERVALO_ATUALIZACAO_MS);
    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [cardId, conversa, estado, open]);

  const carregarConversas = useCallback(async () => {
    const versao = versaoConversa.current;
    setEstado("loading");
    setErro(null);
    setErroAtualizacao(null);
    const resultado = await ListarConversasChatbotxDoCard(cardId);
    if (versao !== versaoConversa.current) return;
    if (!resultado.success) { setErro(resultado.error); setEstado("error"); return; }
    setConversas(resultado.data.data);
    setCursorConversas(resultado.data.nextCursor);
    setEstado(resultado.data.data.length || resultado.data.nextCursor ? "ready" : "empty");
  }, [cardId]);

  async function selecionarConversa(selecionada: ChatbotxConversaPublica) {
    const versao = ++versaoConversa.current;
    ultimaMensagemExibida.current = null;
    setConversa(selecionada);
    setInboxId(selecionada.contactInboxes[0]?.inboxId ?? "");
    setMensagens([]);
    setCursorAntigo(null);
    setErro(null);
    setErroAtualizacao(null);
    setEstado("loading");
    const resultado = await ListarMensagensChatbotxDoCard(cardId, selecionada.id);
    if (versao !== versaoConversa.current) return;
    if (!resultado.success) { setErro(resultado.error); setEstado("error"); return; }
    setMensagens(mesclarMensagens([], resultado.data.data));
    setCursorAntigo(resultado.data.nextCursor);
    setEstado("ready");
  }

  async function carregarAntigas() {
    if (!conversa || !cursorAntigo || carregandoAntigas) return;
    const versao = versaoConversa.current;
    setCarregandoAntigas(true);
    const resultado = await ListarMensagensChatbotxDoCard(cardId, conversa.id, cursorAntigo);
    if (versao === versaoConversa.current) {
      if (resultado.success) {
        setMensagens((atuais) => {
          return mesclarMensagens(atuais, resultado.data.data);
        });
        setCursorAntigo(resultado.data.nextCursor);
      } else setErro(resultado.error);
    }
    setCarregandoAntigas(false);
  }

  async function carregarMaisConversas() {
    if (!cursorConversas || estado === "loading") return;
    setCarregandoAntigas(true);
    const resultado = await ListarConversasChatbotxDoCard(cardId, cursorConversas);
    if (resultado.success) {
      setConversas((atuais) => {
        const ids = new Set(atuais.map((item) => item.id));
        return [...atuais, ...resultado.data.data.filter((item) => !ids.has(item.id))];
      });
      setCursorConversas(resultado.data.nextCursor);
      setEstado(conversas.length || resultado.data.data.length || resultado.data.nextCursor ? "ready" : "empty");
    } else setErro(resultado.error);
    setCarregandoAntigas(false);
  }

  async function enviar() {
    if (!conversa || !texto.trim() || enviando) return;
    const mensagem = texto.trim();
    const conversaId = conversa.id;
    const versao = versaoConversa.current;
    setEnviando(true);
    setErro(null);
    const resultado = await EnviarMensagemChatbotxDoCard(cardId, conversaId, mensagem, inboxId || undefined);
    if (versao !== versaoConversa.current) return;
    if (!resultado.success) { setErro(resultado.error); setEnviando(false); return; }
    setTexto("");
    const atualizadas = await ListarMensagensChatbotxDoCard(cardId, conversaId);
    if (versao !== versaoConversa.current) return;
    if (atualizadas.success) {
      setMensagens((atuais) => mesclarMensagens(atuais, atualizadas.data.data));
      setErroAtualizacao(null);
    }
    else if (!atualizadas.success) setErro(atualizadas.error);
    setEnviando(false);
  }

  function fechar(aberto: boolean) {
    if (!aberto) {
      versaoConversa.current += 1;
      ultimaMensagemExibida.current = null;
      setConversa(null);
      setMensagens([]);
      setErroAtualizacao(null);
      setEstado("idle");
    }
    setOpen(aberto);
  }

  function abrirChat() {
    versaoConversa.current += 1;
    setOpen(true);
    void carregarConversas();
  }

  return <>
    {podeEnviar && (
      <TooltipPrimitive.Provider delayDuration={200}>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>
            <button type="button" onClick={abrirChat} aria-label="Conversar com o cliente no ChatbotX" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/5 text-cyan-200 transition-colors hover:border-cyan-300/50 hover:bg-cyan-400/15 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              <MessageSquare className="size-4" aria-hidden="true" />
            </button>
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content side="bottom" sideOffset={8} className="z-[120] rounded-lg border border-cyan-400/20 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-100 shadow-xl">
              Conversar com o cliente no ChatbotX
              <TooltipPrimitive.Arrow className="fill-slate-950" />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    )}
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="flex h-[min(720px,90vh)] max-w-3xl flex-col gap-0 overflow-hidden border-slate-700 bg-slate-950 p-0 text-slate-100">
        <DialogHeader className="border-b border-white/10 p-5 text-left">
          <DialogTitle>Chat com {clienteNome}</DialogTitle>
          <DialogDescription className="text-slate-400">Conversas do cliente no ChatbotX. Confirme a conversa antes de enviar uma resposta.</DialogDescription>
        </DialogHeader>
        {!conversa ? <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {estado === "loading" && <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400"><LoaderCircle className="size-4 animate-spin" /> Buscando conversas…</p>}
          {estado === "error" && <div role="alert" className="py-8 text-center"><p className="text-sm text-rose-300">{erro}</p><Button type="button" variant="ghost" onClick={() => void carregarConversas()} className="mt-2 gap-2"><RefreshCw className="size-4" /> Tentar novamente</Button></div>}
          {estado === "empty" && <p className="py-10 text-center text-sm text-slate-400">Nenhuma conversa encontrada para este cliente.</p>}
          {erro && estado !== "error" && <p role="alert" className="py-2 text-center text-sm text-rose-300">{erro}</p>}
          {conversas.map((item) => <button type="button" key={item.id} onClick={() => void selecionarConversa(item)} className="mb-2 block w-full rounded-xl border border-white/10 p-3 text-left hover:border-cyan-400/40 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-cyan-400">
            <span className="block text-sm font-semibold">{nomeContato(item)}</span>
            <span className="mt-1 block truncate text-xs text-slate-400">{item.messages[0]?.text || "Sem prévia de mensagem"}</span>
            <span className="mt-1 block text-[11px] text-slate-500">Conversa #{item.id}</span>
          </button>)}
          {cursorConversas && <div className="pt-2 text-center"><Button type="button" variant="ghost" size="sm" disabled={carregandoAntigas} onClick={() => void carregarMaisConversas()}>{carregandoAntigas ? "Carregando…" : "Carregar mais conversas"}</Button></div>}
        </div> : <>
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => { versaoConversa.current += 1; ultimaMensagemExibida.current = null; setConversa(null); setEstado(conversas.length ? "ready" : "empty"); }}>← Conversas</Button>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{nomeContato(conversa)}</p><p className="text-xs text-slate-500">Conversa #{conversa.id}</p></div>
          </div>
          {conversa.contactInboxes.length > 1 && <div className="border-b border-white/10 px-4 py-2"><label className="flex items-center gap-2 text-xs text-slate-400">Canal de envio<select aria-label="Canal de envio" value={inboxId} onChange={(event) => setInboxId(event.target.value)} className="min-h-9 flex-1 rounded-md border border-white/10 bg-slate-900 px-2 text-sm text-slate-100">{conversa.contactInboxes.map((canal) => <option key={canal.inboxId} value={canal.inboxId}>Canal {canal.inboxId}</option>)}</select></label></div>}
          <div ref={painelMensagens} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {cursorAntigo && <div className="text-center"><Button type="button" variant="ghost" size="sm" disabled={carregandoAntigas} onClick={() => void carregarAntigas()}>{carregandoAntigas ? "Carregando…" : "Carregar mensagens anteriores"}</Button></div>}
            {estado === "loading" && <p className="py-8 text-center text-sm text-slate-400">Carregando histórico…</p>}
            {mensagens.map((mensagem) => {
              const recebida = mensagem.senderType === "contact";
              return <div key={mensagem.id} className={`flex ${recebida ? "justify-start" : "justify-end"}`}><div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${recebida ? "rounded-bl-sm bg-slate-800 text-slate-100" : "rounded-br-sm bg-cyan-700 text-white"}`}>
                <p className="whitespace-pre-wrap break-words">{mensagem.text || "Mensagem de mídia não disponível neste chat."}</p>
                <time className="mt-1 block text-right text-[10px] opacity-65">{horario(mensagem.createdAt)}</time>
              </div></div>;
            })}
            {(erro || erroAtualizacao) && <p role="alert" className="text-center text-xs text-rose-300">{erro || erroAtualizacao}</p>}
          </div>
          <form className="flex gap-2 border-t border-white/10 p-3" onSubmit={(event) => { event.preventDefault(); void enviar(); }}>
            <textarea aria-label="Mensagem para o cliente" value={texto} onChange={(event) => setTexto(event.target.value.slice(0, 1000))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void enviar(); } }} placeholder="Digite sua mensagem…" rows={2} className="min-h-10 flex-1 resize-none rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none focus-visible:border-cyan-400" disabled={enviando} />
            <Button type="submit" disabled={!texto.trim() || enviando} aria-label="Enviar mensagem" className="self-end gap-2"><Send className="size-4" />{enviando ? "Enviando…" : "Enviar"}</Button>
          </form>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
