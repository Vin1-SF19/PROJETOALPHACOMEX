import db from "@/lib/prisma";
import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { Activity, User, ArrowUpRight, ShieldCheck, Zap, Globe, Fingerprint, Search } from "lucide-react";
import { getTema } from "@/lib/temas";


export const dynamic = "force-dynamic";

export default async function UsuariosOnlinePage() {
  const session = await auth();
  if (session?.user?.role !== "Admin") redirect("/");

  const style = getTema((session?.user as any)?.tema_interface || "blue");
  
  const todosUsuarios = await db.usuarios.findMany({
    select: { id: true, nome: true, email: true, role: true, tema_interface: true, ultimo_aviso: true },
    orderBy: { nome: 'asc' }
  });

  const limiteOnline = new Date(Date.now() - 20000).toISOString();

  return (
    <main className="min-h-screen bg-[#02040a] p-10 lg:p-20 text-white relative overflow-hidden font-sans">
      <div className={`absolute -top-24 -left-24 w-[500px] h-[500px] ${style.glow} opacity-10 blur-[120px] animate-pulse`} />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 blur-[100px]" />
      
      <div className="max-w-full mx-auto relative z-10">
        <header className="mb-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="space-y-4">
            <div className="pt-4">
                <h1 className="text-6xl font-black uppercase italic tracking-[ -0.05em] leading-none flex items-center gap-6">
                <div className={`p-4 rounded-[2rem] ${style.bg} bg-opacity-20 border ${style.border} backdrop-blur-3xl`}>
                    <Activity className={style.text} size={48} />
                </div>
                <span>Agentes <span className={style.text}>Online</span></span>
                </h1>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mt-4 ml-2 flex items-center gap-3">
                <Globe size={14} className="text-emerald-500 animate-spin-slow" /> Monitoramento de Rede Global Alpha
                </p>
            </div>
          </div>
          
          <div className="bg-white/[0.02] border border-white/5 backdrop-blur-2xl p-8 rounded-[3rem] flex items-center gap-8 shadow-2xl">
            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Sessões Ativas</span>
              <p className="text-4xl font-black italic text-white">{todosUsuarios.filter(u => u.ultimo_aviso && u.ultimo_aviso >= limiteOnline).length}</p>
            </div>
            <div className="h-12 w-px bg-white/10" />
            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Registrados</span>
              <p className="text-4xl font-black italic text-slate-300">{todosUsuarios.length}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
          {todosUsuarios.map((u) => {
            const isOnline = u.ultimo_aviso && u.ultimo_aviso >= limiteOnline;
            const uStyle = getTema(u.tema_interface || "blue");

            return (
              <div key={u.id} className="group relative">
                {/* CARD BACKGROUND ASIMÉTRICO */}
                <div className={`absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-3xl rounded-[3.5rem] border ${isOnline ? 'border-emerald-500/30' : 'border-white/5'} transition-all duration-700 group-hover:scale-[1.02] group-hover:-rotate-1`} />
                
                <div className="relative p-10 flex flex-col items-center text-center">
                  {/* AVATAR CÁPSULA */}
                  <div className="relative mb-8">
                    <div className={`absolute inset-0 ${isOnline ? uStyle.glow : 'bg-slate-900'} blur-2xl opacity-20 group-hover:opacity-40 transition-opacity`} />
                    <div className={`h-24 w-20 rounded-[3rem] ${isOnline ? uStyle.bg : 'bg-slate-800'} border-4 border-[#02040a] flex items-center justify-center relative z-10 shadow-2xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                       <User size={32} className={isOnline ? "text-white" : "text-slate-500"} />
                    </div>
                    {isOnline && (
                        <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-emerald-500 border-4 border-[#02040a] rounded-full z-20 animate-bounce" />
                    )}
                  </div>

                  <div className="space-y-1 mb-8">
                    <h3 className="text-lg font-black uppercase italic tracking-tighter text-white group-hover:text-emerald-400 transition-colors">{u.nome}</h3>
                    <p className="text-[9px] font-bold text-slate-600 lowercase tracking-tight opacity-60">{u.email}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 w-full mb-10">
                    <div className="bg-black/40 rounded-2xl p-3 border border-white/5">
                        <span className="block text-[7px] font-black text-slate-500 uppercase mb-1">Hierarchy</span>
                        <span className={`text-[9px] font-black uppercase ${u.role === 'Admin' ? 'text-amber-500' : 'text-blue-400'}`}>{u.role}</span>
                    </div>
                    <div className="bg-black/40 rounded-2xl p-3 border border-white/5">
                        <span className="block text-[7px] font-black text-slate-500 uppercase mb-1">Interface</span>
                        <span className={`text-[9px] font-black uppercase ${uStyle.text}`}>{u.tema_interface || 'Blue'}</span>
                    </div>
                  </div>

                  <button className={`w-full group/btn relative overflow-hidden h-14 rounded-[1.8rem] flex items-center justify-center gap-3 transition-all duration-500 border ${isOnline ? `border-emerald-500/50 bg-emerald-500/5 text-emerald-400` : 'border-white/10 bg-white/5 text-slate-500'}`}>
                    <div className={`absolute inset-0 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500 ${isOnline ? 'bg-emerald-500' : 'bg-white/10'}`} />
                    <span className="relative z-10 text-[10px] font-black uppercase tracking-[0.2em] group-hover/btn:text-black transition-colors">Acessar Perfil</span>
                    <ArrowUpRight size={16} className="relative z-10 group-hover/btn:text-black group-hover/btn:rotate-45 transition-all" />
                  </button>
                </div>

                {/* DETALHE TÉCNICO DE RODAPÉ */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                    <Fingerprint size={12} className="text-slate-700" />
                    <span className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em]">ID: {u.id.toString().slice(-6)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
