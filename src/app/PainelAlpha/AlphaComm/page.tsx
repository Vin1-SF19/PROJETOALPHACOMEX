"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Send, User, Search, Hash, ShieldCheck, Zap, X, Volume2, VolumeX } from "lucide-react";
import { getTema } from "@/lib/temas";

import { getContatosChat } from "@/actions/get-contatos";
import { pusherClient } from "@/lib/pusher";
import { enviarMensagemChatAction, getHistoricoMensagens, marcarChatComoLido } from "@/actions/ChatAction";
import { redirect } from "next/navigation";
import { toast } from "sonner";
import { usePresence } from "@/components/PusherGlobal.tsx";

interface Agente {
  id: number;
  nome: string;
  imagemUrl: string | null;
  tema_interface: string | null;
  ultimaMsg?: string;
  naoLidas?: number;
  updatedAt?: string | Date;
}

export default function AlphaCommPage() {
  const { data: session } = useSession();
  const [contatos, setContatos] = useState<Agente[]>([]);
  const { usuariosOnline } = usePresence();
  const [agenteAtivo, setAgenteAtivo] = useState<Agente | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (session && session.user?.role !== "Admin" && (session.user as any).usuario !== "Weslei") {
    toast.error("Acesso restrito ao núcleo Alpha.");
    redirect("/PainelAlpha");
  }

  const meuId = Number((session?.user as any)?.id);
  const style = getTema((session?.user as any)?.tema_interface || "blue");

  const idsOnlineNumericos = useMemo(() => {
    return usuariosOnline.map(id => Number(id));
  }, [usuariosOnline]);

  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3");
    const carregar = async () => {
      const data = await getContatosChat();
      setContatos(data);
      setLoading(false);
    };
    carregar();
  }, []);

  useEffect(() => {
    if (!meuId) return;
    
    const notifyChannel = pusherClient.subscribe(`user-notifications-${meuId}`);
    
    notifyChannel.bind("atualizar-lista", (data: any) => {
      if (!isMuted && data.remetenteId !== meuId) audioRef.current?.play().catch(() => {});
      
      const isChatAberto = agenteAtivo?.id === data.remetenteId;

      if (isChatAberto) {
        marcarChatComoLido(data.remetenteId);
      }
      
      setContatos((prev) => {
        const list = [...prev];
        const index = list.findIndex((c) => c.id === data.remetenteId);
        
        if (index !== -1) {
          const contact = { ...list[index] };
          contact.ultimaMsg = data.texto;
          
          if (!isChatAberto) {
            contact.naoLidas = (contact.naoLidas || 0) + 1;
          } else {
            contact.naoLidas = 0;
          }
  
          list.splice(index, 1);
          return [contact, ...list];
        }
        return list;
      });
    });
  
    return () => {
      try {
        pusherClient.unsubscribe(`user-notifications-${meuId}`);
      } catch {
        // ignore cleanup errors on closed connection
      }
    };
  }, [meuId, agenteAtivo, isMuted]);

  useEffect(() => {
    if (!agenteAtivo || !meuId) return;

    const carregarChat = async () => {
      const historico = await getHistoricoMensagens(Number(agenteAtivo.id));
      setMensagens(historico);
      await marcarChatComoLido(Number(agenteAtivo.id));
      setContatos((prev) => prev.map((c) => (c.id === agenteAtivo.id ? { ...c, naoLidas: 0 } : c)));

      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    };

    carregarChat();

    const canalId = `chat-${[meuId, Number(agenteAtivo.id)].sort((a, b) => a - b).join("-")}`;
    const channel = pusherClient.subscribe(canalId);

    channel.bind("nova-mensagem", (data: any) => {
      setMensagens((prev) => (prev.find((m) => m.id === data.id) ? prev : [...prev, data]));
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    });

    return () => {
      try {
        pusherClient.unsubscribe(canalId);
      } catch {
        // ignore cleanup errors on closed connection
      }
    };

  }, [agenteAtivo, meuId]);

  const handleEnviarMensagem = async () => {
    if (!mensagem.trim() || !agenteAtivo) return;
    const texto = mensagem;
    setMensagem("");
    await enviarMensagemChatAction(Number(agenteAtivo.id), texto);

    setContatos((prev) => {
      const list = [...prev];
      const index = list.findIndex((c) => c.id === agenteAtivo.id);
      if (index !== -1) {
        const contact = { ...list[index], ultimaMsg: texto };
        list.splice(index, 1);
        return [contact, ...list];
      }
      return list;
    });
  };

  const contatosFiltrados = useMemo(() =>
    contatos.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase())),
    [contatos, busca]);

  return (
    <main className="h-screen bg-[#02040a] flex flex-col text-white overflow-hidden selection:bg-blue-500/30">
      <header className="h-24 border-b border-white/5 bg-black/60 backdrop-blur-3xl flex items-center justify-between px-10 shrink-0 z-50">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3 group">
            Alpha <span className={style.text}>Comm</span>
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => setIsMuted(!isMuted)} className="p-3 hover:bg-white/5 rounded-full transition-all text-slate-500 hover:text-white">
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="flex items-center gap-4 px-6 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em]">Enlace Seguro</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <aside className="w-85 border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-md z-40">
          <div className="p-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-white" size={16} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="BUSCAR TERMINAL..." className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl pl-12 text-[10px] font-black uppercase tracking-widest focus:border-white/20 outline-none transition-all" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
            {contatosFiltrados.map((contato) => {
              const isActive = agenteAtivo?.id === contato.id;
              const isOnline = idsOnlineNumericos.includes(Number(contato.id));
              return (
                <button key={contato.id} onClick={() => setAgenteAtivo(contato)} className={`w-full flex items-center gap-4 p-4 rounded-[2.2rem] transition-all duration-500 group border ${isActive ? 'bg-white/5 border-white/10 shadow-2xl' : 'border-transparent hover:bg-white/[0.03]'}`}>
                  <div className="relative">
                    <div className={`h-14 w-14 rounded-2xl ${isOnline ? style.bg : 'bg-slate-900'} flex items-center justify-center border border-white/5 group-hover:scale-105 transition-all relative overflow-hidden`}>
                      {contato.imagemUrl ? <img src={contato.imagemUrl} className={`h-full w-full object-cover rounded-2xl ${!isOnline && 'grayscale opacity-40'}`} /> : <User size={22} className={isOnline ? "text-white" : "text-slate-600"} />}
                    </div>
                    {isOnline && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-[#02040a] animate-pulse shadow-[0_0_10px_#10b981]" />}
                  </div>
                  <div className="text-left flex-1 truncate">
                    <p className={`text-[12px] font-black uppercase italic tracking-tighter ${isActive ? 'text-white' : 'text-slate-400'}`}>{contato.nome}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-500' : 'text-slate-700'}`}>
                        {isOnline ? '● Online' : '○ Offline'}
                      </span>
                    </div>
                  </div>
                  {Number(contato.naoLidas) > 0 && <div className={`h-6 w-6 rounded-full ${style.bg} flex items-center justify-center text-[10px] font-black shadow-[0_0_15px_rgba(255,255,255,0.1)] animate-bounce`}>{contato.naoLidas}</div>}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex-1 flex flex-col relative bg-[radial-gradient(circle_at_center,_#1d4ed810_0%,_transparent_70%)]">
          {agenteAtivo ? (
            <>
              <header className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-5">
                  <div className={`h-12 w-12 rounded-2xl ${style.bg} flex items-center justify-center shadow-lg border border-white/10`}><Hash size={20} /></div>
                  <div>
                    <h2 className="text-base font-black uppercase italic tracking-tighter">{agenteAtivo.nome}</h2>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${idsOnlineNumericos.includes(Number(agenteAtivo.id)) ? 'text-emerald-500' : 'text-slate-600'}`}>
                      {idsOnlineNumericos.includes(Number(agenteAtivo.id)) ? 'Sincronização Ativa' : 'Terminal Desconectado'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setAgenteAtivo(null)} className="p-3 hover:bg-red-500/10 rounded-xl transition-all text-slate-500 hover:text-red-500"><X size={20} /></button>
              </header>

              <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar scroll-smooth" ref={scrollRef}>
                {mensagens.map((msg) => {
                  const souEu = Number(msg.remetenteId) === meuId;
                  return (
                    <div key={msg.id} className={`flex flex-col ${souEu ? 'items-end ml-auto' : 'items-start'} group max-w-[75%] animate-in fade-in slide-in-from-bottom-2`}>
                      <div className={`p-5 rounded-[2.2rem] ${souEu ? `${style.bg} rounded-tr-none shadow-2xl` : 'bg-white/5 border border-white/10 rounded-tl-none backdrop-blur-sm'}`}>
                        <p className={`text-[13px] leading-relaxed ${souEu ? 'font-black italic uppercase text-white' : 'font-medium text-slate-200'}`}>{msg.texto}</p>
                      </div>
                      <span className="text-[8px] font-black text-slate-600 uppercase mt-2 tracking-widest">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  );
                })}
              </div>

              <div className="p-8 bg-gradient-to-t from-[#02040a] to-transparent">
                <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-2 flex items-center gap-4 backdrop-blur-3xl focus-within:border-white/20 transition-all shadow-2xl">
                  <input value={mensagem} onChange={(e) => setMensagem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEnviarMensagem()} placeholder="DIGITE SUA MENSAGEM..." className="flex-1 bg-transparent border-none outline-none px-6 text-[11px] font-black tracking-[0.2em] placeholder:text-slate-800" />
                  <button onClick={handleEnviarMensagem} disabled={!mensagem.trim()} className={`h-14 w-14 rounded-[1.8rem] ${style.bg} flex items-center justify-center hover:brightness-125 transition-all shadow-xl disabled:opacity-20`}>
                    <Send size={20} className="text-white ml-1" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20">
              <ShieldCheck size={100} className="mb-6" />
              <p className="text-[12px] font-black uppercase tracking-[1em]">Terminal em Standby</p>
            </div>
          )}
        </section>
      </div>
      <style jsx global>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </main>
  );
}