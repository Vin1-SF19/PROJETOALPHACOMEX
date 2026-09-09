'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, LoaderCircle, RefreshCw, Bot } from 'lucide-react';
import {
  ListarMensagensChatbotx,
  EnviarMensagemChatbotx,
} from '@/actions/ChatBotAlphaChat';
import type { ChatbotxMensagem } from '@/lib/chatbot-alpha/chat-api';
import { rotuloRemetente, isMensagemDoContato } from '@/lib/chatbot-alpha/formatters';

interface ChatConversaProps {
  contactId: string;
  titulo: string;
}

type Estado = 'loading' | 'sucesso' | 'erro' | 'vazio';

export function ChatConversa({ contactId, titulo }: ChatConversaProps) {
  const [estado, setEstado] = useState<Estado>('loading');
  const [mensagens, setMensagens] = useState<ChatbotxMensagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const carregarMensagens = useCallback(async () => {
    setEstado('loading');
    setErro(null);
    const resultado = await ListarMensagensChatbotx(contactId);
    if (resultado.success) {
      setMensagens(resultado.data.data);
      setEstado(resultado.data.data.length === 0 ? 'vazio' : 'sucesso');
    } else {
      setErro(resultado.error);
      setEstado('erro');
    }
  }, [contactId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarMensagens();
  }, [carregarMensagens]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [mensagens]);

  const handleEnviar = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const textoEnviado = texto.trim();
    setTexto('');

    const resultado = await EnviarMensagemChatbotx(contactId, textoEnviado);
    if (resultado.success) {
      // POST /v1/contacts/{identifier}/messages responde 204 sem corpo;
      // a mensagem é anexada de forma otimista e reconciliada no próximo carregamento.
      setMensagens((prev) => [
        ...prev,
        {
          id: `pending-${Date.now()}`,
          createdAt: new Date().toISOString(),
          conversationId: '',
          contactInboxId: '',
          workspaceId: '',
          text: textoEnviado,
          messageType: 'outgoing',
          contentType: 'text',
          senderType: 'user',
        },
      ]);
      setEstado('sucesso');
    } else {
      setTexto(textoEnviado);
      setErro(resultado.error);
    }
    setEnviando(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  // ─── Loading ───
  if (estado === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#020617]">
        <LoaderCircle size={32} className="text-emerald-400 animate-spin" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Carregando conversa…</p>
      </div>
    );
  }

  // ─── Erro ───
  if (estado === 'erro') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#020617] p-6">
        <span className="text-4xl">⚠️</span>
        <p className="font-black uppercase tracking-widest text-sm text-red-400">Erro ao carregar</p>
        <p className="text-xs text-slate-500 text-center max-w-md">{erro}</p>
        <button
          onClick={carregarMensagens}
          className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest hover:bg-emerald-600/30 transition-colors"
        >
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      </div>
    );
  }

  // ─── Sucesso ou vazio (conversa selecionada — composer sempre visível para permitir a primeira mensagem) ───
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Área de mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {estado === 'vazio' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 h-full py-10">
            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <Bot size={32} className="text-emerald-400" />
            </div>
            <p className="font-black uppercase tracking-widest text-sm text-white">{titulo}</p>
            <p className="text-xs text-slate-500 text-center">Nenhuma mensagem ainda. Envie a primeira!</p>
          </div>
        )}
        {mensagens.map((msg) => {
          const isContato = isMensagemDoContato(msg.senderType);
          const rotulo = rotuloRemetente(msg.senderType);
          return (
            <div key={msg.id} className={`flex ${isContato ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] flex flex-col ${isContato ? 'items-start' : 'items-end'}`}>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 px-2">
                  {rotulo}
                </span>
                <div
                  className={`p-3 rounded-2xl border text-sm leading-relaxed ${
                    isContato
                      ? 'bg-slate-800/80 border-white/5 text-slate-100 rounded-tl-none'
                      : 'bg-emerald-600/20 border-emerald-500/20 text-white rounded-tr-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <span className="text-[9px] mt-1 block opacity-40 font-bold uppercase">
                    {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="shrink-0 p-4 border-t border-white/5 bg-[#060c1a]">
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-2xl p-2 focus-within:border-emerald-500/40 transition-all">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem…"
            disabled={enviando}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none px-2 py-1 disabled:opacity-50"
            aria-label="Mensagem"
          />
          <button
            onClick={handleEnviar}
            disabled={!texto.trim() || enviando}
            className="p-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Enviar mensagem"
          >
            {enviando ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
