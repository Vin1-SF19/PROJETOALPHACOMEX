'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Bot, Server, MessageSquare, RefreshCw, Search, UserRound, Mail, Phone } from 'lucide-react';
import { ListarConversasChatbotx } from '@/actions/ChatBotAlphaChat';
import type { ChatbotxConversa } from '@/lib/chatbot-alpha/chat-api';
import { tituloConversa, ultimaMensagemConversa } from '@/lib/chatbot-alpha/formatters';
import { ChatConversa } from './ChatConversa';
import { SeletorSistemaChatBot } from './SeletorSistemaChatBot';
import { IframeChatBotAlpha } from './IframeChatBotAlpha';
import { ObterUrlSistemaChatBot, type SistemaChatBot, type ResultadoUrlChatBot } from '@/actions/ChatBotAlpha';

type Aba = 'chat' | 'infra';

interface ChatBotAlphaClientProps {
  isAdmin: boolean;
  urlInicial: ResultadoUrlChatBot | null;
}

export default function ChatBotAlphaClient({ isAdmin, urlInicial }: ChatBotAlphaClientProps) {
  const [aba, setAba] = useState<Aba>('chat');

  // ─── Estado do chat ───
  const [conversas, setConversas] = useState<ChatbotxConversa[] | null>(null);
  const [conversasErro, setConversasErro] = useState<string | null>(null);
  const [conversasCarregando, setConversasCarregando] = useState(true);
  const [conversaAtiva, setConversaAtiva] = useState<ChatbotxConversa | null>(null);
  const [busca, setBusca] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Estado da infra ───
  const [sistema, setSistema] = useState<SistemaChatBot | null>(isAdmin ? null : 'mailhog');
  const [iframeUrl, setIframeUrl] = useState<string | null>(
    urlInicial?.success ? urlInicial.url : null,
  );
  const [infraErro, setInfraErro] = useState<string | null>(
    urlInicial && !urlInicial.success ? urlInicial.error : null,
  );
  const [infraCarregando, setInfraCarregando] = useState(false);

  // ─── Carregar conversas ───
  const carregarConversas = useCallback(async (filtro: { keyword?: string } = {}) => {
    setConversasCarregando(true);
    setConversasErro(null);
    const resultado = await ListarConversasChatbotx({
      keyword: filtro.keyword?.trim() ? filtro.keyword.trim() : undefined,
    });
    if (resultado.success) {
      setConversas(resultado.data.data);
      setConversaAtiva((atual) => {
        if (atual && resultado.data.data.some((c) => c.id === atual.id)) return atual;
        return resultado.data.data[0] ?? null;
      });
    } else {
      setConversasErro(resultado.error);
      setConversas([]);
      setConversaAtiva(null);
    }
    setConversasCarregando(false);
  }, []);

  const primeiraCargaRef = useRef(true);

  // Busca com debounce (300ms) — único filtro suportado por GET /v1/contacts neste inbox.
  // A primeira carga (montagem) roda imediatamente, sem esperar o debounce.
  useEffect(() => {
    if (primeiraCargaRef.current) {
      primeiraCargaRef.current = false;
      carregarConversas({ keyword: busca });
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      carregarConversas({ keyword: busca });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const escolherSistema = async (novoSistema: SistemaChatBot) => {
    setInfraCarregando(true);
    setInfraErro(null);
    try {
      const resultado = await ObterUrlSistemaChatBot(novoSistema);
      if (!resultado.success) {
        setInfraErro(resultado.error);
        return;
      }
      setSistema(novoSistema);
      setIframeUrl(resultado.url);
    } finally {
      setInfraCarregando(false);
    }
  };

  const voltarParaEscolha = () => {
    setSistema(null);
    setIframeUrl(null);
    setInfraErro(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tabs */}
      <div className="shrink-0 flex items-center gap-1 px-4 pt-3 pb-0 border-b border-white/5 bg-[#060c1a]" role="tablist">
        <button
          onClick={() => setAba('chat')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-colors ${
            aba === 'chat'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
          aria-selected={aba === 'chat'}
          role="tab"
        >
          <MessageSquare size={14} />
          Chat
        </button>
        <button
          onClick={() => setAba('infra')}
          className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest border-b-2 transition-colors ${
            aba === 'infra'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
          aria-selected={aba === 'infra'}
          role="tab"
        >
          <Server size={14} />
          Infra
        </button>
      </div>

      {/* Conteúdo da aba */}
      {aba === 'chat' ? (
        <div className="flex-1 flex min-h-0">
          {/* Sidebar de conversas */}
          <div className="w-72 shrink-0 border-r border-white/5 bg-[#040a14] flex flex-col">
            <div className="p-3 border-b border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Conversas</span>
                <button
                  onClick={() => carregarConversas({ keyword: busca })}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                  aria-label="Atualizar conversas"
                >
                  <RefreshCw size={12} className={conversasCarregando ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar conversa…"
                  aria-label="Buscar conversas"
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/40 transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {conversasCarregando && (
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-slate-800/60 animate-pulse" />
                  <div className="h-4 w-1/2 rounded bg-slate-800/40 animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-slate-800/50 animate-pulse" />
                </div>
              )}

              {!conversasCarregando && conversasErro && (
                <div className="p-4 flex flex-col items-center gap-3">
                  <p className="text-[11px] text-red-400 text-center">{conversasErro}</p>
                  <button
                    onClick={() => carregarConversas({ keyword: busca })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/30 transition-colors"
                  >
                    <RefreshCw size={11} />
                    Tentar novamente
                  </button>
                </div>
              )}

              {!conversasCarregando && !conversasErro && conversas && conversas.length === 0 && (
                <div className="p-4 flex flex-col items-center gap-2">
                  <Bot size={24} className="text-slate-600" />
                  <p className="text-[11px] text-slate-500 text-center">
                    {busca ? 'Nenhuma conversa encontrada para a busca atual.' : 'Nenhuma conversa disponível.'}
                  </p>
                </div>
              )}

              {!conversasCarregando && !conversasErro && conversas?.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setConversaAtiva(conv)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
                    conversaAtiva?.id === conv.id
                      ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <p className="text-xs font-bold text-white truncate">{tituloConversa(conv)}</p>
                  {ultimaMensagemConversa(conv) && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{ultimaMensagemConversa(conv)}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Área de chat */}
          <div className="flex-1 flex flex-col min-h-0">
            {conversaAtiva ? (
              <ChatConversa contactId={conversaAtiva.contactId} titulo={tituloConversa(conversaAtiva)} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#020617]">
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <Bot size={32} className="text-emerald-400" />
                </div>
                <p className="font-black uppercase tracking-widest text-sm text-white">ChatBot Alpha</p>
                <p className="text-xs text-slate-500">Selecione uma conversa para começar.</p>
              </div>
            )}
          </div>

          {/* Painel de detalhe do contato */}
          <div className="w-72 shrink-0 border-l border-white/5 bg-[#040a14] flex flex-col">
            <div className="p-3 border-b border-white/5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contato</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!conversaAtiva ? (
                <div className="p-6 flex flex-col items-center gap-2 text-center">
                  <UserRound size={24} className="text-slate-600" />
                  <p className="text-[11px] text-slate-500">Nenhuma conversa selecionada.</p>
                </div>
              ) : (
                <div className="p-4 flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center overflow-hidden">
                    {conversaAtiva.contact?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={conversaAtiva.contact.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserRound size={28} className="text-emerald-400" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">{tituloConversa(conversaAtiva)}</p>
                  <div className="w-full space-y-2 mt-2 text-left">
                    {conversaAtiva.contact?.phoneNumber && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Phone size={12} className="text-slate-600 shrink-0" />
                        <span className="truncate">{conversaAtiva.contact.phoneNumber}</span>
                      </div>
                    )}
                    {conversaAtiva.contact?.email && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Mail size={12} className="text-slate-600 shrink-0" />
                        <span className="truncate">{conversaAtiva.contact.email}</span>
                      </div>
                    )}
                    {!conversaAtiva.contact?.phoneNumber && !conversaAtiva.contact?.email && (
                      <p className="text-[11px] text-slate-600 text-center">Sem dados de contato adicionais.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // ─── Aba Infra ───
        <div className="flex-1 flex flex-col min-h-0">
          {isAdmin && !sistema ? (
            <SeletorSistemaChatBot onEscolher={escolherSistema} carregando={infraCarregando} erro={infraErro} />
          ) : (
            <div className="relative w-full h-full flex-1 min-h-0 flex flex-col">
              {isAdmin && (
                <div className="shrink-0 px-4 py-2 border-b border-white/5 bg-[#060c1a]">
                  <button
                    onClick={voltarParaEscolha}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                  >
                    <RefreshCw size={13} />
                    Trocar sistema
                  </button>
                </div>
              )}
              <IframeChatBotAlpha
                url={iframeUrl}
                erro={infraErro}
                titulo={sistema ?? 'mailhog'}
                onTentarNovamente={sistema ? () => escolherSistema(sistema) : undefined}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
