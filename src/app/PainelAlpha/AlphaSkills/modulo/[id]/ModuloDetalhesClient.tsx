"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Play, Clock, LayoutGrid, CheckCircle2, Trophy, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { marcarAulaComoConcluida } from '@/actions/GetVideos';
import { UserDropdown } from '@/components/UserDropdown';
import { toast } from 'sonner';

export default function ModuloDetalhesClient({ session, modulo, aulasIniciais, progressoInicial }: any) {
    const router = useRouter();
    const [videoAtivo, setVideoAtivo] = useState<any>(aulasIniciais[0] || null);
    const [aulasConcluidas, setAulasConcluidas] = useState<string[]>(
        progressoInicial ? progressoInicial.map((p: any) => p.aulaId) : []
    );

    const userName = session?.user?.nome || "Operador";
    const userRole = session?.user?.role || "USER";
    const cursoCapa: string = modulo?.cursos?.[0]?.curso?.capa || "";

    const progressoPorcentagem = useMemo(() => {
        if (aulasIniciais.length === 0) return 0;
        return Math.round((aulasConcluidas.filter(id => aulasIniciais.some((a:any) => a.id === id)).length / aulasIniciais.length) * 100);
    }, [aulasIniciais, aulasConcluidas]);

    const handleConcluir = async () => {
        if (!session?.user?.id || !videoAtivo?.id) return toast.error("Sessão não identificada.");
        if (aulasConcluidas.includes(videoAtivo.id)) return;

        const result = await marcarAulaComoConcluida(session.user.id, videoAtivo.id);

        if (result.success) {
            toast.success("Progresso Alpha atualizado!");
            setAulasConcluidas(prev => [...prev, videoAtivo.id]);
            router.refresh();
        } else {
            toast.error("Erro ao salvar progresso.");
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-orange-500/30 overflow-x-hidden">
            {/* Background Estilizado */}
            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-[url('/FundoLogin.png')] bg-cover bg-center opacity-20 grayscale pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-[#050505]" />
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[120px]" />
            </div>

            {/* Navbar */}
            <nav className="fixed top-0 w-full z-40 bg-black/40 backdrop-blur-xl border-b border-white/5 px-6 md:px-12 py-4 flex items-center justify-end">
                <UserDropdown userName={userName} userRole={userRole} userImage={session?.user?.imagemUrl} />
            </nav>

            <main className="relative z-10 pt-28 pb-20 px-6 md:px-12 max-w-[1700px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Lado Esquerdo: Player */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="relative aspect-video rounded-[2.5rem] overflow-hidden bg-black shadow-[0_0_100px_rgba(249,115,22,0.1)] border border-white/10 group">
                        {videoAtivo ? (
                            <video key={videoAtivo.url} src={videoAtivo.url} poster={videoAtivo.thumbUrl || cursoCapa || modulo?.imagemUrl || undefined} controls className="w-full h-full object-contain shadow-2xl" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center opacity-20"><Play size={80} /></div>
                        )}
                    </div>

                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-8 md:p-10 rounded-[3rem] shadow-2xl"
                    >
                        <div className="flex items-center gap-4 mb-6">
                            <span className="flex items-center gap-2 bg-orange-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-orange-600/20">
                                <Sparkles size={12} /> Aula em destaque
                            </span>
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                <Clock size={14} /> {videoAtivo?.tamanho || "Alpha Skills"}
                            </span>
                        </div>
                        
                        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6 italic leading-none text-white">
                            {videoAtivo?.titulo}
                        </h1>
                        <p className="text-slate-400 text-sm md:text-lg leading-relaxed max-w-4xl border-l-2 border-orange-500/30 pl-6 whitespace-pre-wrap">
                            {videoAtivo?.descricao?.trim() || modulo.descricao?.trim() || "Domine esta especialização com a metodologia Alpha."}
                        </p>
                    </motion.div>
                </div>

                {/* Lado Direito: Playlist */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Card de Progresso */}
                    <div className="bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-md border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Status da Missão</h3>
                                <p className="text-4xl font-black italic text-white">{progressoPorcentagem}%</p>
                            </div>
                            <Trophy size={40} className="text-orange-500 opacity-20" />
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mb-4">
                            <motion.div 
                                initial={{ width: 0 }} animate={{ width: `${progressoPorcentagem}%` }}
                                className="h-full bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.5)]" 
                            />
                        </div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase text-center">{aulasConcluidas.filter(id => aulasIniciais.some((a:any) => a.id === id)).length} de {aulasIniciais.length} tarefas finalizadas</p>
                    </div>

                    {/* Lista de Aulas */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-4 space-y-3">
                        <div className="px-4 py-2 border-b border-white/5 mb-2">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">{modulo.nome}</h3>
                        </div>
                        
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {aulasIniciais.map((aula: any, idx: number) => {
                                const isConcluida = aulasConcluidas.includes(aula.id);
                                const isAtiva = videoAtivo?.id === aula.id;

                                return (
                                    <button
                                        key={aula.id}
                                        onClick={() => setVideoAtivo(aula)}
                                        className={`w-full group flex items-center gap-4 p-4 rounded-3xl transition-all border cursor-pointer ${
                                            isAtiva ? "bg-orange-600 border-orange-400 shadow-xl translate-x-1" : "bg-white/[0.02] border-white/5 hover:bg-white/5"
                                        }`}
                                    >
                                        <div className="relative shrink-0 w-20 aspect-video rounded-xl overflow-hidden bg-black/60">
                                            {isConcluida && <div className="absolute inset-0 z-10 bg-green-500/20 flex items-center justify-center"><CheckCircle2 className="text-green-400" size={16} /></div>}
                                            <Image src={aula.thumbUrl || cursoCapa || modulo?.imagemUrl || "/placeholder.png"} alt={aula.titulo || ""} fill className={`object-cover ${isConcluida ? 'opacity-30' : 'opacity-70'}`} unoptimized />
                                        </div>
                                        <div className="text-left min-w-0">
                                            <p className={`text-[8px] font-black uppercase mb-1 ${isAtiva ? 'text-orange-200' : 'text-slate-500'}`}>Aula {(idx + 1).toString().padStart(2, '0')}</p>
                                            <h4 className={`text-[11px] font-black uppercase italic line-clamp-1 ${isAtiva ? 'text-white' : 'text-slate-300'}`}>{aula.titulo}</h4>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {videoAtivo && (
                            <button
                                onClick={handleConcluir}
                                className={`w-full mt-4 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 cursor-pointer ${
                                    aulasConcluidas.includes(videoAtivo.id)
                                    ? "bg-green-500/10 border border-green-500/20 text-green-500"
                                    : "bg-white text-black hover:bg-orange-600 hover:text-white"
                                }`}
                            >
                                {aulasConcluidas.includes(videoAtivo.id) ? (
                                    <><CheckCircle2 size={16} /> Concluída</>
                                ) : (
                                    <><Play size={14} fill="currentColor" /> Finalizar Aula</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}