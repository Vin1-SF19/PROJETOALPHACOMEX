"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { Edit3, Trash2, Film, Image as ImageIcon, Activity, Settings, FolderKanban, PlayCircle, X, BookOpen, ChevronLeft, Shield } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { getModulos, getVideos } from '@/actions/GetVideos';
import { getAllCursos } from '@/actions/Cursos';
import SecaoUpload from './Upload';
import ModalGerenciamento from './EdicaoOrdenacao';
import ModalEditar from './ModalEditar';
import ModalExcluir from './ModalExcluir';
import ModalCurso from './CriarCurso';
import ModalModulosDoCurso from './ModalModulosDoCurso';
import ModalAcessoGerenciamento from './ModalAcessoGerenciamento';

export default function GerenciadorAlphaSkills() {
    const { data: session } = useSession();
    const isAdmin = ['Admin', 'CEO'].includes((session?.user as { role?: string })?.role ?? '');

    const [filtroSetor, setFiltroSetor] = useState("Todos");
    const [loading, setLoading] = useState(true);
    const [videosList, setVideosList] = useState<any[]>([]);
    const [modulosList, setModulosList] = useState<any[]>([]);
    const [cursosList, setCursosList] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [videoSelecionado, setVideoSelecionado] = useState<any>(null);
    const [modalEditOpen, setModalEditOpen] = useState(false);
    const [modalDeleteOpen, setModalDeleteOpen] = useState(false);
    const [moduloAtivo, setModuloAtivo] = useState<any>(null);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
    const [videosOrdenados, setVideosOrdenados] = useState<any[]>([]);
    const [modalCursoOpen, setModalCursoOpen] = useState(false);
    const [cursoSelecionadoId, setCursoSelecionadoId] = useState<string | null>(null);
    const [modalAcessoOpen, setModalAcessoOpen] = useState(false);


    const carregarDados = async () => {
        setLoading(true);
        const [vids, mods, cursos] = await Promise.all([getVideos(), getModulos(), getAllCursos()]);
        setVideosList(vids);
        setModulosList(mods);
        setCursosList(cursos as any[]);
        setLoading(false);
    };

    useEffect(() => { carregarDados(); }, []);


    const filteredModulos = useMemo(() => {
        return modulosList.filter(m => filtroSetor === "Todos" || m.setor.includes(filtroSetor));
    }, [modulosList, filtroSetor]);

    const filteredCursos = useMemo(() => {
        return cursosList.filter(c => filtroSetor === "Todos" || c.setores.includes(filtroSetor));
    }, [cursosList, filtroSetor]);

    const cursoSelecionado = useMemo(
        () => cursosList.find(c => c.id === cursoSelecionadoId) ?? null,
        [cursosList, cursoSelecionadoId]
    );

    useEffect(() => {
        const carregarVideosDoModulo = async () => {
            if (!moduloAtivo) {
                setVideosOrdenados([]);
                return;
            }
            const { getVideosDoModulo } = await import('@/actions/GetVideos');
            const vids = await getVideosDoModulo(moduloAtivo.id);
            setVideosOrdenados(vids);
        };

        carregarVideosDoModulo();
    }, [moduloAtivo, videosList]);




    return (
        <>
            <div className="min-h-screen bg-[#111111] text-slate-300 p-8 font-sans">
                <header className="max-w-7xl mx-auto flex justify-between items-center mb-10">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/50 mb-1 leading-none">
                                    Alpha Skills Cloud
                                </h2>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter transition-all duration-500">
                                        {filtroSetor === "Todos" ? "Nuvem Geral" : filtroSetor}
                                    </h1>
                                </div>
                                <p className="text-[9px] font-bold text-slate-600 uppercase mt-1 tracking-widest">
                                    {filteredCursos.length} Curso{filteredCursos.length !== 1 ? 's' : ''} sincronizados
                                </p>

                            </div>

                        </div>

                        {/* Navegação de Setores + Criar Curso */}
                        <div className="w-full lg:w-auto flex flex-col gap-3">
                            {isAdmin && (
                                <div className="flex items-center gap-2 self-end">
                                    <button
                                        onClick={() => setModalAcessoOpen(true)}
                                        className="cursor-pointer flex items-center gap-2 px-5 py-2.5 bg-white/[0.04] hover:bg-orange-500/10 border border-white/[0.06] hover:border-orange-500/30 text-slate-400 hover:text-orange-400 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
                                    >
                                        <Shield size={14} /> Acesso
                                    </button>
                                </div>
                            )}
                            <div className="flex bg-[#1C1C1C] p-1.5 rounded-[1.5rem] border border-white/5 overflow-x-auto no-scrollbar gap-1.5 shadow-inner">
                                {["Todos", "T.I", "Comercial", "Operacional", "Financeiro", "Recursos-Humanos", "Serviços Gerais"].map((setor) => (
                                    <button
                                        key={setor}
                                        onClick={() => setFiltroSetor(setor)}
                                        className={`
                                                cursor-pointer px-6 py-3 rounded-xl text-[9px] font-black uppercase transition-all duration-300 whitespace-nowrap flex-shrink-0
                                                ${filtroSetor === setor
                                                ? 'bg-orange-600 text-white shadow-xl shadow-orange-900/20 scale-105 z-10'
                                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] active:scale-95'
                                            }
                                        `}
                                    >
                                        {setor}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-8">
                        <div>
                            <AnimatePresence mode="wait">
                                {loading ? (
                                    <div className="py-24 flex flex-col items-center justify-center bg-[#161616] rounded-[2.5rem] border border-white/5">
                                        <div className="relative">
                                            <Activity className="animate-spin text-orange-500 mb-4" size={40} />
                                            <div className="absolute inset-0 blur-xl bg-orange-500/20 animate-pulse" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Sincronizando Alpha Cloud</span>
                                    </div>
                                ) : !moduloAtivo ? (
                                    <motion.div
                                        key="grid-cursos"
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                        transition={{ duration: 0.4, ease: "circOut" }}
                                        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                                    >
                                        {filteredCursos.length === 0 && !loading && (
                                            <div className="col-span-2 py-20 flex flex-col items-center justify-center bg-[#161616] rounded-[2.5rem] border border-white/5 border-dashed">
                                                <BookOpen className="text-slate-800 mb-3" size={32} />
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Nenhum curso encontrado</span>
                                            </div>
                                        )}
                                        {filteredCursos.map((curso) => (
                                            <motion.div
                                                key={curso.id}
                                                initial={{ opacity: 0, y: 16 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                onClick={() => setCursoSelecionadoId(curso.id)}
                                                className="group relative rounded-[1.8rem] overflow-hidden cursor-pointer border border-white/[0.06] hover:border-orange-500/30 transition-all duration-500 shadow-2xl hover:-translate-y-1 hover:shadow-orange-950/30"
                                            >
                                                {/* Cover hero */}
                                                <div className="relative aspect-video">
                                                    {curso.capa ? (
                                                        <img src={curso.capa} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-[#1C1C1C] to-[#0D0D0D] flex items-center justify-center">
                                                            <BookOpen size={40} className="text-orange-500/15" />
                                                        </div>
                                                    )}
                                                    {/* Gradient overlay */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#111]/95 via-[#111]/30 to-transparent" />
                                                    {/* Sector badges */}
                                                    <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                                                        {curso.setores.slice(0, 2).map((s: string) => (
                                                            <span key={s} className="text-[7px] font-black text-orange-400 uppercase bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-orange-500/20">
                                                                {s}
                                                            </span>
                                                        ))}
                                                        {curso.setores.length > 2 && (
                                                            <span className="text-[7px] font-black text-slate-400 uppercase bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10">+{curso.setores.length - 2}</span>
                                                        )}
                                                    </div>
                                                    {/* Settings icon */}
                                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                                        <div className="p-2 bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-orange-600 transition-colors">
                                                            <Settings size={13} className="text-white" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Info footer */}
                                                <div className="bg-[#111] px-5 py-4 flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h3 className="text-[13px] font-black text-white uppercase tracking-tight truncate group-hover:text-orange-400 transition-colors duration-300">
                                                            {curso.nome}
                                                        </h3>
                                                        {curso.descricao && (
                                                            <p className="text-[9px] text-slate-600 mt-0.5 truncate uppercase tracking-wide">{curso.descricao}</p>
                                                        )}
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-xl">
                                                        <FolderKanban size={10} className="text-orange-500/70" />
                                                        <span className="text-[9px] font-black text-slate-400 uppercase whitespace-nowrap">
                                                            {curso.modulos.length} {curso.modulos.length === 1 ? 'módulo' : 'módulos'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="lista-aulas"
                                        initial={{ opacity: 0, x: 30 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -30 }}
                                        transition={{ duration: 0.4, ease: "backOut" }}
                                        className="bg-[#161616] p-4 md:p-8 rounded-[3rem] border border-white/5 shadow-inner"
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 px-2">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => setModuloAtivo(null)}
                                                    className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-white transition-all cursor-pointer group"
                                                >
                                                    <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                                                </button>
                                                <div>
                                                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Módulo Selecionado</span>
                                                    <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">{moduloAtivo.nome}</h2>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 bg-black/30 px-4 py-2.5 rounded-2xl border border-white/5">
                                                {filteredModulos && (
                                                    <button
                                                        onClick={() => setIsModalOpen(true)}
                                                        title="Organizar Trilha"
                                                        className="group p-2.5 bg-orange-600/10 border border-orange-500/20 text-orange-500 rounded-xl hover:bg-orange-600 hover:text-white transition-all duration-300 cursor-pointer shadow-lg shadow-orange-950/20"
                                                    >
                                                        <Settings
                                                            size={18}
                                                            className="group-hover:rotate-90 transition-transform duration-500"
                                                        />
                                                    </button>
                                                )}
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black text-slate-500 uppercase">Total de Conteúdo</span>
                                                    <span className="text-[10px] font-black text-white uppercase">{videosOrdenados.length} Aulas Ativas</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                            {videosOrdenados.map((vid, index) => (
                                                <div
                                                    key={vid.id}
                                                    className="group flex items-center gap-4 p-4 bg-[#1C1C1C] hover:bg-[#222] border border-white/5 rounded-[2.2rem] transition-all duration-300 shadow-lg"
                                                >

                                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/40 text-[10px] font-black text-orange-500 border border-white/5 shrink-0 group-hover:border-orange-500/50 transition-all">
                                                        {String(index + 1).padStart(2, '0')}
                                                    </div>

                                                    <div
                                                        onClick={() => setVideoPreviewUrl(vid.url)}
                                                        className="w-24 h-14 bg-black rounded-2xl overflow-hidden border border-white/10 shrink-0 relative cursor-pointer group/thumb"
                                                    >
                                                        {(vid.thumbUrl || moduloAtivo?.imagemUrl) ? (
                                                            <img
                                                                src={vid.thumbUrl || moduloAtivo?.imagemUrl}
                                                                className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-500"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-800">
                                                                <ImageIcon size={16} />
                                                            </div>
                                                        )}

                                                        <div className="absolute inset-0 bg-black/40 group-hover/thumb:bg-orange-600/20 opacity-100 transition-all flex items-center justify-center">
                                                            <PlayCircle size={20} className="text-white drop-shadow-lg" />
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-[12px] font-black text-white uppercase truncate tracking-tight">{vid.titulo}</h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-[8px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                                <Activity size={8} /> {vid.tamanho || "Video Cloud"}
                                                            </span>
                                                        </div>
                                                    </div>



                                                    <div className="flex gap-2 pr-2">
                                                        <button
                                                            onClick={() => { setVideoSelecionado(vid); setModalEditOpen(true); }}
                                                            className="p-3 bg-white/5 hover:bg-blue-600 rounded-[1.2rem] text-slate-400 hover:text-white transition-all cursor-pointer shadow-xl border border-white/5"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => { setVideoSelecionado(vid); setModalDeleteOpen(true); }}
                                                            className="p-3 bg-white/5 hover:bg-red-600 rounded-[1.2rem] text-slate-400 hover:text-white transition-all cursor-pointer shadow-xl border border-white/5"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {videosOrdenados.length === 0 && (
                                                <div className="py-20 flex flex-col items-center justify-center bg-black/20 rounded-[2rem] border border-dashed border-white/5">
                                                    <Film className="text-slate-800 mb-3" size={32} />
                                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Nenhum material neste módulo</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                    </div>

                    <SecaoUpload onSuccess={carregarDados} />
                </main>
            </div>
            <ModalGerenciamento
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                modulo={moduloAtivo}
                videos={videosList}
                onSuccess={carregarDados}
            />

            <ModalEditar
                isOpen={modalEditOpen}
                onClose={() => setModalEditOpen(false)}
                video={videoSelecionado}
                onSuccess={carregarDados}
            />

            <ModalExcluir
                isOpen={modalDeleteOpen}
                onClose={() => setModalDeleteOpen(false)}
                video={videoSelecionado}
                onSuccess={carregarDados}
            />

            <ModalCurso
                isOpen={modalCursoOpen}
                onClose={() => setModalCursoOpen(false)}
            />

            <ModalModulosDoCurso
                isOpen={!!cursoSelecionadoId}
                onClose={() => setCursoSelecionadoId(null)}
                curso={cursoSelecionado}
                onVerAulas={(mod) => setModuloAtivo(mod)}
                onSuccess={carregarDados}
            />

            <AnimatePresence>
                {videoPreviewUrl && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setVideoPreviewUrl(null)}
                            className="absolute inset-0 bg-black/95 backdrop-blur-xl"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-4xl aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl"
                        >
                            <button
                                onClick={() => setVideoPreviewUrl(null)}
                                className="absolute top-6 right-6 z-10 p-3 bg-black/50 hover:bg-orange-600 text-white rounded-full transition-all cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                            <video
                                src={videoPreviewUrl}
                                controls
                                autoPlay
                                className="w-full h-full object-contain"
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ModalAcessoGerenciamento
                isOpen={modalAcessoOpen}
                onClose={() => setModalAcessoOpen(false)}
            />
        </>
    );
}