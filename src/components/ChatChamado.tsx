"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { fmtTime } from "@/lib/format-date";
import { createPortal } from "react-dom";
import { pusherClient } from "@/lib/pusher";
import {
  MessageSquare, Send, Loader2, X, Paperclip,
  FileText, FileSpreadsheet, Download, ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { enviarMensagemAction, marcarComoLidaAction } from "@/actions/chamados";
import { toast } from "sonner";

type MensagemAutor = {
  id: number;
  nome: string;
  usuario: string;
};

type Mensagem = {
  id: number;
  texto: string | null;
  createdAt: Date | string;
  chamadoId: number;
  autorId: number;
  arquivoUrl: string | null;
  arquivoTipo: string | null;
  autor: MensagemAutor;
};

type Props = {
  chamadoId: number;
  titulo: string;
  mensagensIniciais: Mensagem[];
  contagem: number;
  status: string;
  usuarioAtualId: number;
  isAdmin: boolean;
};

export default function ChatChamado({
  chamadoId,
  titulo,
  mensagensIniciais,
  contagem,
  status,
  usuarioAtualId,
  isAdmin,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais || []);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [novasNoFront, setNovasNoFront] = useState(contagem || 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abertoRef = useRef(aberto);

  useEffect(() => {
    abertoRef.current = aberto;
  }, [aberto]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMensagens(mensagensIniciais || []);
    setNovasNoFront(contagem || 0);
  }, [chamadoId, contagem, mensagensIniciais]);

  useEffect(() => {
    if (!mounted || !chamadoId || !pusherClient) return;

    const channel = pusherClient.subscribe(`chat-${chamadoId}`);

    channel.bind("nova-mensagem", (novaMsg: Mensagem) => {
      setMensagens((prev) => {
        if (prev.some((m) => m.id === novaMsg.id)) return prev;
        return [...prev, novaMsg];
      });

      if (!abertoRef.current && novaMsg.autorId !== usuarioAtualId) {
        setNovasNoFront((prev) => prev + 1);
      }
    });

    return () => {
      try {
        channel.unbind("nova-mensagem");
        pusherClient.unsubscribe(`chat-${chamadoId}`);
      } catch {
        // ignore cleanup errors on closed connection
      }
    };
  }, [mounted, chamadoId, usuarioAtualId]);

  useEffect(() => {
    if (aberto && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [aberto, mensagens]);

  const limparNotificacoes = useCallback(async () => {
    setNovasNoFront(0);
    await marcarComoLidaAction(chamadoId, isAdmin);
  }, [chamadoId, isAdmin]);

  useEffect(() => {
    if (aberto && novasNoFront > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      limparNotificacoes();
    }
  }, [aberto, novasNoFront, limparNotificacoes]);

  const handleEnviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const res = await enviarMensagemAction(chamadoId, texto);
    if (!res.success) toast.error("Erro ao transmitir mensagem");
    else setTexto("");
    setEnviando(false);
  };

  const renderAnexo = (url: string, tipo: string) => {
    const t = tipo?.toUpperCase() || "";
    const isImg = ["JPG", "PNG", "JPEG", "WEBP"].some((ext) => t.includes(ext));
    const isPdf = t.includes("PDF");
    const isSheet = ["XLS", "CSV"].some((ext) => t.includes(ext));

    if (isImg) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-3 rounded-2xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all shadow-xl">
          <div className="relative w-full h-48">
            <Image src={url} alt="Anexo" fill className="object-cover" unoptimized />
          </div>
        </a>
      );
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="flex items-center gap-3 mt-3 p-4 bg-black/40 rounded-2xl border border-white/5 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group"
      >
        <div className="p-2 bg-white/5 rounded-lg">
          {isPdf ? (
            <FileText className="text-rose-400" size={20} />
          ) : isSheet ? (
            <FileSpreadsheet className="text-emerald-400" size={20} />
          ) : (
            <Paperclip className="text-slate-400" size={20} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-white uppercase truncate tracking-tighter">Documento anexado</p>
          <p className="text-[8px] text-slate-500 font-bold uppercase">{tipo}</p>
        </div>
        <Download size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
      </a>
    );
  };

  const temNotificacao = !aberto && novasNoFront > 0;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        onClick={() => setAberto(false)}
      />

      <div className="relative w-full max-w-2xl bg-[#080e1a] border border-blue-500/10 rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">

        {/* Cabeçalho */}
        <div className="p-6 border-b border-white/5 bg-gradient-to-b from-blue-600/5 to-transparent flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600/15 rounded-2xl border border-blue-500/20 shadow-inner">
              <MessageSquare className="text-blue-400" size={22} />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white uppercase italic tracking-tighter">Canal de Suporte</h3>
                <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Ao vivo</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate max-w-[260px]">
                #{chamadoId} • {titulo}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAberto(false)}
            className="cursor-pointer p-3 hover:bg-rose-500/10 rounded-xl text-slate-500 hover:text-rose-400 transition-all border border-white/5 hover:border-rose-500/20 group"
          >
            <X size={20} className="group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>

        {/* Área de mensagens */}
        <div
          ref={scrollRef}
          className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar bg-[#080e1a]"
        >
          {mensagens.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-20">
              <MessageSquare size={40} />
              <p className="text-xs font-black uppercase tracking-widest">Nenhuma mensagem ainda</p>
            </div>
          )}

          {mensagens.map((msg) => {
            const isMe = msg.autorId === usuarioAtualId;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-200`}
              >
                <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-2 mb-1 px-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {isMe ? "Você" : msg.autor?.nome}
                    </span>
                  </div>

                  <div
                    className={`relative p-4 shadow-xl border transition-all ${
                      isMe
                        ? "bg-blue-600 border-blue-500/30 text-white rounded-2xl rounded-tr-none shadow-blue-900/20"
                        : "bg-slate-800/80 border-white/5 text-slate-100 rounded-2xl rounded-tl-none backdrop-blur-sm"
                    }`}
                  >
                    {msg.texto && (
                      <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap break-words">
                        {msg.texto}
                      </p>
                    )}

                    {msg.arquivoUrl && (
                      <div className={msg.texto ? "mt-3 pt-3 border-t border-white/10" : ""}>
                        {renderAnexo(msg.arquivoUrl, msg.arquivoTipo || "")}
                      </div>
                    )}

                    <div
                      className={`text-[8px] mt-2 font-bold uppercase opacity-50 flex ${
                        isMe ? "justify-end" : "justify-start"
                      }`}
                    >
                      {fmtTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="p-6 bg-slate-950/60 border-t border-white/5 backdrop-blur-xl flex-shrink-0">
          {status !== "CONCLUIDO" ? (
            <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-2 focus-within:border-blue-500/40 transition-all shadow-inner">
              <input
                type="file"
                id={`file-${chamadoId}`}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setEnviando(true);
                  const toastId = toast.loading("Enviando arquivo...");

                  try {
                    const response = await fetch(
                      `/api/chat/upload?filename=${encodeURIComponent(file.name)}`,
                      { method: "POST", body: file }
                    );

                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || "Erro no servidor de storage");
                    }

                    const newBlob = await response.json();
                    const fileType = file.name.split(".").pop()?.toUpperCase() || "FILE";
                    await enviarMensagemAction(chamadoId, "", newBlob.url, fileType);
                    toast.success("Arquivo enviado!", { id: toastId });
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : "Erro desconhecido";
                    toast.error(`Falha: ${msg}`, { id: toastId });
                  } finally {
                    setEnviando(false);
                    e.target.value = "";
                  }
                }}
              />

              <label
                htmlFor={`file-${chamadoId}`}
                className="p-3 cursor-pointer hover:bg-white/5 rounded-xl text-slate-500 hover:text-blue-400 transition-all active:scale-90"
              >
                <Paperclip size={20} />
              </label>

              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escreva sua mensagem..."
                className="flex-1 bg-transparent px-2 py-3 text-sm outline-none text-white placeholder:text-slate-600 font-medium"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleEnviar();
                  }
                }}
              />

              <button
                disabled={enviando || !texto.trim()}
                onClick={handleEnviar}
                className="cursor-pointer p-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {enviando ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          ) : (
            <div className="py-5 text-center rounded-2xl bg-slate-800/40 border border-white/5">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] flex items-center justify-center gap-3">
                <ShieldCheck size={14} className="text-emerald-500" />
                Protocolo encerrado
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className={`cursor-pointer relative p-3 rounded-xl transition-all duration-300 group border ${
          temNotificacao
            ? "bg-blue-600/15 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
            : "bg-white/5 border-white/5 hover:border-blue-500/30 hover:bg-blue-600/10"
        }`}
      >
        <MessageSquare
          size={18}
          className={`${
            temNotificacao
              ? "text-blue-400 animate-pulse"
              : "text-slate-400 group-hover:text-blue-400"
          } transition-colors`}
        />
        {temNotificacao && (
          <>
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full animate-ping opacity-40" />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-[10px] font-black text-white rounded-full flex items-center justify-center shadow-xl border-2 border-slate-950 z-10">
              {novasNoFront}
            </span>
          </>
        )}
      </button>

      {aberto && mounted && createPortal(modalContent, document.body)}
    </>
  );
}
