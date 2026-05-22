"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Palette, Layout, Save, CheckCircle2, Monitor, Bot } from "lucide-react";
import { toast } from "sonner";
import { atualizarInterfaceAction, toggleBibbleAction } from "@/actions/preferencias";

import { getTema } from "@/lib/temas";

const TEMAS = [
  { id: "blue", label: "Alpha Blue", color: "bg-blue-600" },
  { id: "emerald", label: "Protocolo Green", color: "bg-emerald-600" },
  { id: "rose", label: "Cyber Rose", color: "bg-rose-600" },
  { id: "amber", label: "Warning Gold", color: "bg-amber-600" },
  { id: "violet", label: "Nebula Violet", color: "bg-violet-600" },
  { id: "cyan", label: "Electric Cyan", color: "bg-cyan-500" },
  { id: "fuchsia", label: "Deep Fuchsia", color: "bg-fuchsia-600" },
  { id: "toxic", label: "Toxic Lime", color: "bg-lime-500" },
  { id: "crimson", label: "Crimson Red", color: "bg-red-600" },
  { id: "midnight", label: "Midnight Blue", color: "bg-indigo-700" },
  { id: "lavender", label: "Soft Lavender", color: "bg-purple-400" },
  { id: "pink", label: "Alpha Pink", color: "bg-pink-500" },
];

export default function PreferenciasPage() {
  const { data: session, update } = useSession();
  
  const [tema, setTema] = useState("blue");
  const [densidade, setDensidade] = useState("default");

  useEffect(() => {
    const cachedTema = localStorage.getItem("alpha-theme-temp");
    const cachedDensidade = localStorage.getItem("alpha-density-temp");
    if (cachedTema) setTema(cachedTema);
    if (cachedDensidade) setDensidade(cachedDensidade);
  }, []);
  
  const [loading, setLoading] = useState(false);
  const [bibbleAtivo, setBibbleAtivo] = useState(true);
  const [loadingBibble, setLoadingBibble] = useState(false);

  useEffect(() => {
    if (session?.user) {
      const ativo = (session.user as any).bibble_ativo;
      if (ativo !== undefined) setBibbleAtivo(ativo);
    }
  }, [session]);

  useEffect(() => {
    if (session?.user) {
      const user = session.user as any;
      const cachedTheme = localStorage.getItem("alpha-theme-temp");
      const cachedDensity = localStorage.getItem("alpha-density-temp");

      if (user.tema_interface && !cachedTheme) setTema(user.tema_interface);
      if (user.densidade_painel && !cachedDensity) setDensidade(user.densidade_painel);
    }
  }, [session]);

  useEffect(() => {
    const estilo = getTema(tema);
    document.documentElement.style.setProperty("--alpha-primary", estilo.accent);
    localStorage.setItem("alpha-theme-temp", tema);
    localStorage.setItem("alpha-density-temp", densidade);
  }, [tema, densidade]);

  const preview = getTema(tema);

  const handleSalvar = async () => {
    setLoading(true);
    
    try {
      const res = await atualizarInterfaceAction(tema, densidade);
  
      if (res?.success) {
        localStorage.setItem("alpha-theme-temp", tema);
        localStorage.setItem("alpha-density-temp", densidade);

        await update({
          ...session,
          user: { ...session?.user, tema_interface: tema, densidade_painel: densidade }
        });
  
        toast.success("Protocolo Alpha Sincronizado!");
  
        setTimeout(() => {
          window.location.replace(`/PainelAlpha?refresh=${Date.now()}`);
        }, 500);
      }
    } catch (error) {
      setLoading(false);
      toast.error("Erro na sincronização");
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] p-8 lg:p-16 text-white relative transition-colors duration-500 overflow-x-hidden">
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] ${preview.glow} blur-[150px] rounded-full transition-all duration-700 opacity-50`} />

      <div className="max-w-4xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter flex items-center gap-4">
              <Palette className={preview.text} size={40} /> Interface
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 italic">Ajuste de Estética Operacional</p>
          </div>
          <button
            onClick={handleSalvar}
            disabled={loading}
            className={`cursor-pointer h-14 px-10 ${preview.bg} hover:brightness-110 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 transition-all shadow-xl ${preview.shadow} disabled:opacity-50 active:scale-95`}
          >
            {loading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
            Salvar Protocolo
          </button>
        </header>

        <div className="grid gap-8">

          <section className={`bg-slate-900/20 backdrop-blur-md border ${preview.border} p-8 rounded-[2.5rem] transition-all duration-500 shadow-2xl`}>
            <h2 className="text-xs font-black uppercase tracking-widest mb-8 flex items-center gap-2 text-slate-400">
              <Monitor size={16} className={preview.text} /> Esquema de Cores
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {TEMAS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTema(t.id)}
                  className={`cursor-pointer p-6 rounded-3xl border transition-all duration-300 flex flex-col items-center gap-4 group ${tema === t.id
                    ? `${preview.border.replace('20', '50')} bg-white/5 shadow-lg`
                    : 'border-white/5 bg-black/40 hover:border-white/20'
                    }`}
                >
                  <div className={`h-10 w-10 rounded-full ${t.color} shadow-inner transition-transform group-hover:scale-110 ${tema === t.id ? 'ring-4 ring-white/10 scale-110' : ''}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${tema === t.id ? preview.text : 'text-slate-600'}`}>{t.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Bibble Toggle */}
          <section className={`bg-slate-900/20 backdrop-blur-md border ${preview.border} p-8 rounded-[2.5rem] transition-all duration-500 shadow-2xl`}>
            <h2 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2 text-slate-400">
              <Bot size={16} className={preview.text} /> Assistente Bibble
            </h2>
            <div className="flex items-center justify-between p-5 rounded-2xl bg-black/30 border border-white/5">
              <div>
                <p className="text-sm font-black text-white">Bibble ativo no painel</p>
                <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">
                  {bibbleAtivo ? "Assistente visível em todas as páginas" : "Assistente desativado"}
                </p>
              </div>
              <button
                onClick={async () => {
                  setLoadingBibble(true);
                  const novoValor = !bibbleAtivo;
                  setBibbleAtivo(novoValor);
                  const res = await toggleBibbleAction(novoValor);
                  if (res.success) {
                    await update({ ...session, user: { ...session?.user, bibble_ativo: novoValor } });
                    toast.success(novoValor ? "Bibble ativado!" : "Bibble desativado!");
                  } else {
                    setBibbleAtivo(!novoValor);
                    toast.error("Erro ao salvar preferência");
                  }
                  setLoadingBibble(false);
                }}
                disabled={loadingBibble}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 cursor-pointer disabled:opacity-50 ${bibbleAtivo ? preview.bg : 'bg-slate-700'}`}
              >
                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${bibbleAtivo ? 'left-8' : 'left-1'}`} />
              </button>
            </div>
          </section>

          <section className={`bg-slate-900/20 backdrop-blur-md border ${preview.border} p-8 rounded-[2.5rem] transition-all duration-500 shadow-2xl`}>
            <h2 className="text-xs font-black uppercase tracking-widest mb-8 flex items-center gap-2 text-slate-400">
              <Layout size={16} className={preview.text} /> Densidade do Painel
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['default', 'compact'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDensidade(d)}
                  className={`cursor-pointer p-6 rounded-3xl border transition-all duration-300 flex items-center justify-between group ${densidade === d
                    ? `${preview.border.replace('20', '50')} bg-white/5`
                    : 'border-white/5 bg-black/40 text-slate-600 hover:border-white/20'
                    }`}
                >
                  <span className={`text-[10px] font-black uppercase tracking-widest ${densidade === d ? 'text-white' : ''}`}>
                    {d === 'default' ? 'Espaçamento Padrão' : 'Modo Compacto'}
                  </span>
                  {densidade === d ? <CheckCircle2 size={18} className={preview.text} /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-white/5 group-hover:border-white/20" />}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
