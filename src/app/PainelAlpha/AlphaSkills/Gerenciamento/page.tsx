"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { MoveVertical, Edit3, Trash2, Upload, Film, Image as ImageIcon, CheckCircle2, Activity, Search, ChevronLeft, ChevronRight, Settings, FolderKanban, PlayCircle, X, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { getUsers } from '@/actions/get-user';
import { getModulos, getVideos } from '@/actions/GetVideos';
import { getAllCursos } from '@/actions/Cursos';
import SecaoUpload from './Upload';
import ModalGerenciamento from './EdicaoOrdenacao';
import ModalEditar from './ModalEditar';
import ModalExcluir from './ModalExcluir';
import ModalCurso from './CriarCurso';
import ModalModulosDoCurso from './ModalModulosDoCurso';

export default function GerenciadorAlphaSkills() {
    const router = useRouter();
    const [usersList, setUsersList] = useState<any[]>([]);
    const [filtroSetor, setFiltroSetor] = useState("Todos");
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [videosList, setVideosList] = useState<any[]>([]);
    const [modulosList, setModulosList] = useState<any[]>([]);
    const [cursosList, setCursosList] = useState<any[]>([]);
    const [loadingVideos, setLoadingVideos] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [videoSelecionado, setVideoSelecionado] = useState<any>(null);
    const [modalEditOpen, setModalEditOpen] = useState(false);
    const [modalDeleteOpen, setModalDeleteOpen] = useState(false);
    const [moduloAtivo, setModuloAtivo] = useState<any>(null);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
    const [videosOrdenados, setVideosOrdenados] = useState<any[]>([]);
    const [modalCursoOpen, setModalCursoOpen] = useState(false);
    const [cursoSelecionadoId, setCursoSelecionadoId] = useState<string | null>(null);


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
        return modulosList.filter(m => {
            const matchesSetor = filtroSetor === "Todos" || m.setor.includes(filtroSetor);
            const matchesBusca = m.nome.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSetor && matchesBusca;
        });
    }, [modulosList, filtroSetor, searchTerm]);

    const filteredCursos = useMemo(() => {
        return cursosList.filter(c => {
            const matchesSetor = filtroSetor === "Todos" || c.setores.includes(filtroSetor);
            const matchesBusca = c.nome.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSetor && matchesBusca;
        });
    }, [cursosList, filtroSetor, searchTerm]);

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


    useEffect(() => {
        const carregarDados = async () => {
            try {
                const dados = await getUsers();
                setUsersList(dados || []);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        carregarDados();
    }, []);

    const filteredUsers = useMemo(() => {
        return usersList.filter(u =>
            (u.nome || u.usuario || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [usersList, searchTerm]);

    const rolesUnicos = useMemo(() => {
        return Array.from(new Set(filteredUsers.map(u => u.role))).filter(Boolean);
    }, [filteredUsers]);

    const scrollCarrossel = (idSetor: string, direcao: 'esquerda' | 'direita') => {
        const container = document.getElementById(`carrossel-${idSetor}`);
        if (container) {
            const scrollAmount = 300;
            container.scrollBy({
                left: direcao === 'direita' ? scrollAmount : -scrollAmount,
                behavior: 'smooth'
            });
        }
    };


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
                            <button
                                onClick={() => setModalCursoOpen(true)}
                                className="cursor-pointer self-end flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-900/20"
                            >
                                <BookOpen size={14} /> Criar Curso
                            </button>
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
                    <div className="lg:col-span-7 space-y-12">
                        <div className="lg:col-span-7">
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
                                        className="grid grid-cols-1 md:grid-cols-2 gap-5"
                                    >
                                        {filteredCursos.length === 0 && !loading && (
                                            <div className="col-span-2 py-20 flex flex-col items-center justify-center bg-[#161616] rounded-[2.5rem] border border-white/5 border-dashed">
                                                <BookOpen className="text-slate-800 mb-3" size={32} />
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Nenhum curso encontrado</span>
                                            </div>
                                        )}
                                        {filteredCursos.map((curso) => (
                                            <div
                                                key={curso.id}
                                                onClick={() => setCursoSelecionadoId(curso.id)}
                                                className="group relative bg-gradient-to-br from-[#161616] to-[#121212] border border-white/5 rounded-[2.8rem] p-7 cursor-pointer hover:border-orange-500/50 transition-all duration-500 shadow-2xl overflow-hidden"
                                            >
                                                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-orange-600/5 blur-[50px] group-hover:bg-orange-600/15 transition-all duration-700" />

                                                {curso.capa && (
                                                    <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-all duration-700 overflow-hidden rounded-[2.8rem]">
                                                        <img src={curso.capa} alt="" className="w-full h-full object-cover scale-110 blur-sm" />
                                                    </div>
                                                )}

                                                <div className="flex flex-col gap-5 relative z-10">
                                                    <div className="flex justify-between items-start">
                                                        <div className="relative w-16 h-16 rounded-[1.4rem] bg-black border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl group-hover:scale-105 group-hover:border-orange-500/30 transition-all duration-500">
                                                            {curso.capa ? (
                                                                <img src={curso.capa} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                                                            ) : (
                                                                <BookOpen size={24} className="text-orange-500/50" />
                                                            )}
                                                        </div>
                                                        <div className="bg-white/[0.03] p-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                                                            <Settings size={20} className="text-orange-500" />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <h3 className="text-base font-black text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors duration-300">
                                                            {curso.nome}
                                                        </h3>
                                                        <p className="text-[10px] text-slate-500 font-medium mt-1 line-clamp-1 uppercase tracking-wider">
                                                            {curso.descricao || "Curso Alpha Skills"}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-2">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {curso.setores.slice(0, 2).map((s: string) => (
                                                                <span key={s} className="text-[8px] font-black text-orange-500 uppercase bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                                                                    {s}
                                                                </span>
                                                            ))}
                                                            {curso.setores.length > 2 && (
                                                                <span className="text-[8px] font-black text-slate-500 uppercase bg-white/5 px-2 py-1 rounded-full">+{curso.setores.length - 2}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <FolderKanban size={10} className="text-slate-600" />
                                                            <span className="text-[9px] font-black text-slate-400 uppercase">
                                                                {curso.modulos.length} {curso.modulos.length === 1 ? 'Módulo' : 'Módulos'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
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
                                                        {vid.thumbUrl ? (
                                                            <img
                                                                src={vid.thumbUrl}
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

                        <div className="bg-[#161616]/30 rounded-[2.5rem] border border-white/5 p-6 shadow-inner">
                            <div className="flex justify-between items-end px-4 mb-6">
                                <div>
                                    <h2 className="text-sm font-black uppercase tracking-widest text-white">Alpha Tracking</h2>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter italic">Desempenho da Equipe</p>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-slate-600" size={14} />
                                    <input type="text" placeholder="BUSCAR OPERADOR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-500/50 transition-all w-48 text-white" />
                                </div>
                            </div>

                            <div className="max-h-[500px] overflow-y-auto pr-2 custom-tracking-scroll space-y-10">
                                {loading ? (
                                    <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-20">
                                        <Activity className="animate-spin text-blue-500" size={32} />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Sincronizando...</span>
                                    </div>
                                ) : (
                                    rolesUnicos.map((setorNome) => (
                                        <div key={setorNome as string} className="space-y-4">
                                            <div className="flex items-center justify-between px-4 sticky top-0 bg-[#161616]/10 backdrop-blur-md py-2 z-10">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1 h-3 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{setorNome as string}</h3>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => scrollCarrossel(setorNome as string, 'esquerda')} className="p-1.5 rounded-lg bg-black/40 border border-white/5 text-slate-500 hover:text-blue-400 transition-all active:scale-90"><ChevronLeft size={14} /></button>
                                                    <button onClick={() => scrollCarrossel(setorNome as string, 'direita')} className="p-1.5 rounded-lg bg-black/40 border border-white/5 text-slate-500 hover:text-blue-400 transition-all active:scale-90"><ChevronRight size={14} /></button>
                                                </div>
                                            </div>

                                            <div id={`carrossel-${setorNome}`} className="flex gap-4 overflow-x-auto pb-4 px-2 no-scrollbar snap-x scroll-smooth">
                                                {filteredUsers.filter(u => u.role === setorNome).map((user) => (
                                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={user.id} className="min-w-[260px] group relative flex flex-col gap-4 p-5 rounded-[2rem] border border-white/5 bg-black/40 hover:bg-slate-900/40 hover:border-blue-500/30 transition-all duration-500 snap-start shadow-xl">
                                                        <div className="flex items-center gap-4">
                                                            <div className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-slate-800 to-black border border-white/10 flex items-center justify-center text-blue-400 font-black text-[10px] group-hover:scale-110 transition-transform duration-500 overflow-hidden shadow-lg">
                                                                {user.imagemUrl ? <img src={user.imagemUrl} alt={user.nome} className="h-full w-full object-cover" /> : <span>{user.nome?.substring(0, 2).toUpperCase() || "UA"}</span>}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="text-[11px] font-black text-white uppercase truncate tracking-widest italic">{user.nome || user.usuario}</h4>
                                                            </div>
                                                        </div>
                                                        <div className="mt-1 pt-4 border-t border-white/5 space-y-2">
                                                            <div className="flex justify-between items-end px-1">
                                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Treinamento Alpha</span>
                                                                <span className="text-[9px] font-black text-blue-500 italic">65%</span>
                                                            </div>
                                                            <div className="relative h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                                <div className="h-full bg-gradient-to-r from-blue-700 via-blue-400 to-blue-300 shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all duration-1000" style={{ width: '65%' }} />
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
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

        </>
    );
}