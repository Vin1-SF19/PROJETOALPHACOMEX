'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play,
    ChevronLeft,
    CheckCircle2,
    Lock,
    ArrowRight,
    Maximize2,
    Clock,
    Video,
    Loader2
} from 'lucide-react';
import { marcarVideoConcluidoAction } from '@/actions/questoes';
import type { getPresetCompletoAction } from '@/actions/questoes';
import type { TemaAlpha } from '@/lib/temas';
import { toast } from 'sonner';

type PresetCompleto = NonNullable<Awaited<ReturnType<typeof getPresetCompletoAction>>>;
type VideoAula = PresetCompleto['videos'][number];

export default function SalaDeAulaAlpha({ preset, temaConfig, onVoltar, userId,
    progressosIniciais = [] }: {
        preset: PresetCompleto;
        temaConfig: TemaAlpha;
        onVoltar: () => void;
        userId: string;
        progressosIniciais?: string[];
    }) {
    const [videoAtivo, setVideoAtivo] = useState<VideoAula | null>(null);
    const [videosAssitidos, setVideosAssistidos] = useState<string[]>(progressosIniciais);

    const videos = preset?.videos || [];
    const [salvando, setSalvando] = useState(false);


    const marcarComoAssistido = async (id: string) => {
        if (!videosAssitidos.includes(id)) {
            setSalvando(true);
            try {
                const res = await marcarVideoConcluidoAction(userId, id);

                if (res.success) {
                    setVideosAssistidos(prev => [...prev, id]);
                    toast.success("Módulo Validado no Servidor");
                } else {
                    toast.error("Erro ao sincronizar progresso");
                }
            } catch (err) {
                toast.error("Falha na conexão com o Terminal");
            } finally {
                setSalvando(false);
            }
        }
    };

    const todosAssistidos = videosAssitidos.length === videos.length && videos.length > 0;

    return (
        <div className="min-h-screen bg-[#020202] text-white p-8">
            <div className="flex items-center justify-between mb-12">
                <button
                    onClick={videoAtivo ? () => setVideoAtivo(null) : onVoltar}
                    className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-all group"
                >
                    <div className="p-2 bg-white/5 rounded-xl border border-white/5 group-hover:bg-white/10">
                        <ChevronLeft size={16} />
                    </div>
                    {videoAtivo ? "Voltar para Galeria" : "Sair do Treinamento"}
                </button>

                <div className="text-right">
                    <p className={`text-[9px] font-black uppercase tracking-[0.3em] ${temaConfig.text}`}>
                        {preset.nome}
                    </p>
                    <h2 className="text-xl font-black uppercase italic tracking-tighter">Sala de Performance</h2>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {!videoAtivo ? (
                    <motion.div
                        key="galeria"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {videos.map((video, index: number) => (
                            <motion.div
                                key={video.id}
                                whileHover={{ y: -10 }}
                                onClick={() => setVideoAtivo(video)}
                                className="group relative aspect-video bg-slate-900 rounded-[2rem] border border-white/5 overflow-hidden cursor-pointer hover:border-orange-500/30 transition-all"
                            >
                                {video.thumbUrl ? (
                                    <img
                                        src={video.thumbUrl}
                                        className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                                        alt={video.titulo}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                                        <Video size={32} className="text-slate-700 opacity-20" />
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                                <div className="absolute inset-0 p-8 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <span className="px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-[9px] font-black uppercase italic">
                                            Módulo {String(index + 1).padStart(2, '0')}
                                        </span>
                                        {videosAssitidos.includes(video.id) && (
                                            <CheckCircle2 size={20} className="text-green-500" />
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-black uppercase italic leading-tight mb-2 group-hover:text-orange-500 transition-colors">
                                            {video.titulo}
                                        </h3>
                                        <div className="flex items-center gap-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                            <span className="flex items-center gap-1"><Play size={10} /> Iniciar</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="player"
                        initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                    >
                        <div className="lg:col-span-8 space-y-6">
                            <div className="aspect-video bg-black rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl relative group">
                                <video
                                    key={videoAtivo.id}
                                    controls
                                    autoPlay
                                    className="w-full h-full object-contain"
                                    onLoadedMetadata={(e) => {
                                        const segundos = e.currentTarget.duration;
                                        console.log("Duração Real do Blob:", segundos);
                                    }}
                                >
                                    <source src={videoAtivo.url} type="video/mp4" />
                                    Seu navegador não suporta a reprodução de vídeos.
                                </video>
                            </div>

                            <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem]">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className={`w-8 h-[2px] ${temaConfig.bg}`} />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Agora Assistindo</span>
                                </div>
                                <h1 className="text-3xl font-black uppercase italic mb-4">{videoAtivo.titulo}</h1>
                                <p className="text-slate-400 text-sm leading-relaxed uppercase font-medium">
                                    {videoAtivo.descricao || "Este módulo faz parte do protocolo de certificação Alpha. Assista até o final para validar sua presença."}
                                </p>

                                <button
                                    disabled={salvando || videosAssitidos.includes(videoAtivo.id)}
                                    onClick={() => marcarComoAssistido(videoAtivo.id)}
                                    className={`mt-8 px-8 py-4 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${videosAssitidos.includes(videoAtivo.id)
                                            ? 'bg-green-500/10 border-green-500/20 text-green-500 cursor-default'
                                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                                        }`}
                                >
                                    {salvando ? (
                                        <Loader2 className="animate-spin" size={14} />
                                    ) : videosAssitidos.includes(videoAtivo.id) ? (
                                        <>Concluído <CheckCircle2 size={14} /></>
                                    ) : (
                                        "Marcar como Concluído"
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Playlist Lateral */}
                        <div className="lg:col-span-4 space-y-4">
                            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] px-4">Próximas Aulas</h3>
                            <div className="space-y-3">
                                {videos.map((v, idx: number) => (
                                    <div
                                        key={v.id}
                                        onClick={() => setVideoAtivo(v)}
                                        className={`flex items-center gap-4 p-4 rounded-[1.5rem] border transition-all cursor-pointer ${videoAtivo.id === v.id ? 'bg-orange-500/10 border-orange-500/40' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'}`}
                                    >
                                        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-black italic text-xs ${videoAtivo.id === v.id ? 'bg-orange-500 text-white' : 'bg-black/40 text-slate-600'}`}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[10px] font-black uppercase truncate ${videoAtivo.id === v.id ? 'text-white' : 'text-slate-400'}`}>
                                                {v.titulo}
                                            </p>
                                        </div>
                                        {videosAssitidos.includes(v.id) && <CheckCircle2 size={14} className="text-green-500" />}
                                    </div>
                                ))}
                            </div>

                            {/* Card de Prova (Bloqueado/Liberado) */}
                            <div className={`mt-8 p-8 rounded-[2.5rem] border transition-all duration-700 ${todosAssistidos ? 'bg-orange-600 border-orange-400 shadow-orange-500/20 shadow-2xl' : 'bg-white/5 border-white/10 opacity-50'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    {todosAssistidos ? <ShieldCheck size={32} /> : <Lock size={32} />}
                                    <div className="text-right text-[8px] font-black uppercase opacity-60">Status do Exame</div>
                                </div>
                                <h4 className="text-sm font-black uppercase italic mb-2">Exame de Proficiência</h4>
                                <p className="text-[9px] font-bold uppercase opacity-80 mb-6 leading-tight">
                                    {todosAssistidos
                                        ? "Todos os módulos concluídos. Você está autorizado a iniciar a prova."
                                        : "Assista todos os vídeos da trilha para liberar o acesso ao exame final."}
                                </p>

                                <button
                                    disabled={!todosAssistidos}
                                    onClick={() => {
                                        const idReal = preset?.id;

                                        if (idReal) {
                                            window.location.href = `/PainelAlpha/prova/${idReal}`;
                                        } else {
                                            console.error("ERRO CRÍTICO: O objeto preset não possui um ID válido.", preset);
                                        }
                                    }}
                                    className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${todosAssistidos
                                        ? 'bg-white text-orange-600 hover:scale-105 shadow-xl'
                                        : 'bg-black/20 text-slate-500 cursor-not-allowed'
                                        }`}
                                >
                                    Iniciar Prova <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ShieldCheck({ size }: { size: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>;
}
