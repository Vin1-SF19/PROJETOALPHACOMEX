"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Image as ImageIcon, CheckCircle2, Loader2, Plus, Film, X, FolderPlus, FolderKanban, AlignLeft, Trash2, Layers, BookOpen, Search } from 'lucide-react';
import { createVideo, getModulos } from '@/actions/GetVideos';
import { uploadVideosLote } from '@/actions/UploadVideosLote';
import { toast } from 'sonner';
import { upload } from '@vercel/blob/client';
import ModalModulos from './CriarModulo';
import ModalCurso from './CriarCurso';

interface ModuloItem {
    id: string;
    nome: string;
    setor: string;
    cursoNome?: string;
}

interface VideoLoteItem {
    localId: string;
    titulo: string;
    descricao: string;
    videoFile: File | null;
    thumbFile: File | null;
    thumbUrl: string;
    status: 'idle' | 'uploading' | 'done' | 'error';
}

let _loteCounter = 0;
function newLoteItem(): VideoLoteItem {
    return {
        localId: `lote-${++_loteCounter}`,
        titulo: '',
        descricao: '',
        videoFile: null,
        thumbFile: null,
        thumbUrl: '',
        status: 'idle',
    };
}

export default function SecaoUpload({ onSuccess }: { onSuccess: () => void }) {
    const [modo, setModo] = useState<'single' | 'lote'>('single');

    // ── Single mode state ──
    const videoInputRef = useRef<HTMLInputElement>(null);
    const thumbInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [thumbFile, setThumbFile] = useState<File | null>(null);
    const [titulo, setTitulo] = useState("");
    const [descricao, setDescricao] = useState("");
    const [modulosSelecionados, setModulosSelecionados] = useState<ModuloItem[]>([]);
    const [showModulos, setShowModulos] = useState(false);

    // ── Lote mode state ──
    const [videos, setVideos] = useState<VideoLoteItem[]>([newLoteItem()]);
    const [moduloLoteId, setModuloLoteId] = useState("");
    const [loteProgress, setLoteProgress] = useState<{ current: number; total: number } | null>(null);
    const [showModuloLote, setShowModuloLote] = useState(false);

    // ── Shared ──
    const [modulosDisponiveis, setModulosDisponiveis] = useState<ModuloItem[]>([]);
    const [modalModuloOpen, setModalModuloOpen] = useState(false);
    const [modalCursoOpen, setModalCursoOpen] = useState(false);
    const [buscaSingle, setBuscaSingle] = useState("");
    const [buscaLote, setBuscaLote] = useState("");

    const fetchModulos = async () => {
        const data = await getModulos();
        const mapped = (data as any[]).map((m) => ({
            id: m.id,
            nome: m.nome,
            setor: m.setor,
            cursoNome: m.cursos?.[0]?.curso?.nome ?? null,
        }));
        setModulosDisponiveis(mapped);
    };

    useEffect(() => {
        fetchModulos();
    }, [modalModuloOpen]);

    const modulosFiltradosSingle = useMemo(() =>
        modulosDisponiveis.filter(m =>
            m.nome.toLowerCase().includes(buscaSingle.toLowerCase()) ||
            (m.cursoNome ?? "").toLowerCase().includes(buscaSingle.toLowerCase())
        ), [modulosDisponiveis, buscaSingle]);

    const modulosFiltradosLote = useMemo(() =>
        modulosDisponiveis.filter(m =>
            m.nome.toLowerCase().includes(buscaLote.toLowerCase()) ||
            (m.cursoNome ?? "").toLowerCase().includes(buscaLote.toLowerCase())
        ), [modulosDisponiveis, buscaLote]);

    // ── Single helpers ──
    const toggleModulo = (modulo: ModuloItem) => {
        setModulosSelecionados(prev =>
            prev.find(m => m.id === modulo.id)
                ? prev.filter(m => m.id !== modulo.id)
                : [...prev, modulo]
        );
    };

    const handleSingleUpload = async () => {
        if (!videoFile || !titulo || modulosSelecionados.length === 0) {
            toast.error("Preencha o título, vídeo e selecione ao menos um módulo.");
            return;
        }
        setIsUploading(true);
        try {
            const videoBlob = await upload(videoFile.name, videoFile, {
                access: 'public',
                handleUploadUrl: '/api/UploadSkills',
            });
            let thumbUrl = "";
            if (thumbFile) {
                const thumbBlob = await upload(thumbFile.name, thumbFile, {
                    access: 'public',
                    handleUploadUrl: '/api/UploadSkills',
                });
                thumbUrl = thumbBlob.url;
            }
            const size = (videoFile.size / (1024 * 1024)).toFixed(1) + "MB";
            const setoresUnicos = Array.from(new Set(
                modulosSelecionados.flatMap(m => (m.setor || 'Geral').split(", "))
            )).join(", ");
            const result = await createVideo({
                titulo,
                setor: setoresUnicos,
                url: videoBlob.url,
                descricao,
                thumbUrl,
                tamanho: size,
                modulosIds: modulosSelecionados.map(m => m.id)
            });
            if (result?.success) {
                setVideoFile(null);
                setThumbFile(null);
                setTitulo("");
                setDescricao("");
                setModulosSelecionados([]);
                setShowModulos(false);
                if (videoInputRef.current) videoInputRef.current.value = "";
                if (thumbInputRef.current) thumbInputRef.current.value = "";
                toast.success("Mídia publicada e vinculada aos módulos!");
                onSuccess?.();
            } else {
                toast.error((result as { error?: string })?.error || "Erro ao processar upload.");
            }
        } catch {
            toast.error("Erro ao processar upload.");
        } finally {
            setIsUploading(false);
        }
    };

    // ── Lote helpers ──
    const updateLoteItem = (localId: string, patch: Partial<VideoLoteItem>) => {
        setVideos(prev => prev.map(v => v.localId === localId ? { ...v, ...patch } : v));
    };

    const removeLoteItem = (localId: string) => {
        setVideos(prev => prev.filter(v => v.localId !== localId));
    };

    const handleLoteUpload = async () => {
        const valid = videos.filter(v => v.titulo.trim() && v.videoFile);
        if (valid.length === 0) {
            toast.error("Adicione ao menos 1 vídeo com título e arquivo.");
            return;
        }
        if (!moduloLoteId) {
            toast.error("Selecione um módulo para vincular os vídeos.");
            return;
        }

        setLoteProgress({ current: 0, total: valid.length });

        const uploadedVideos: { titulo: string; descricao?: string; url: string; thumbUrl?: string }[] = [];

        for (let i = 0; i < valid.length; i++) {
            const item = valid[i];
            updateLoteItem(item.localId, { status: 'uploading' });
            try {
                const videoBlob = await upload(item.videoFile!.name, item.videoFile!, {
                    access: 'public',
                    handleUploadUrl: '/api/UploadSkills',
                });
                let thumbUrl = item.thumbUrl || "";
                if (item.thumbFile) {
                    const thumbBlob = await upload(item.thumbFile.name, item.thumbFile, {
                        access: 'public',
                        handleUploadUrl: '/api/UploadSkills',
                    });
                    thumbUrl = thumbBlob.url;
                }
                uploadedVideos.push({
                    titulo: item.titulo.trim(),
                    descricao: item.descricao.trim() || undefined,
                    url: videoBlob.url,
                    thumbUrl: thumbUrl || undefined,
                });
                updateLoteItem(item.localId, { status: 'done' });
                setLoteProgress({ current: i + 1, total: valid.length });
            } catch {
                updateLoteItem(item.localId, { status: 'error' });
                toast.error(`Erro no upload: "${item.titulo}"`);
            }
        }

        if (uploadedVideos.length === 0) {
            setLoteProgress(null);
            return;
        }

        const result = await uploadVideosLote({ videos: uploadedVideos, moduloId: moduloLoteId });
        setLoteProgress(null);

        if (result.success) {
            toast.success(`${result.count} vídeo(s) publicado(s)!`);
            if (result.erros?.length) {
                result.erros.forEach(e => toast.warning(e));
            }
            setVideos([newLoteItem()]);
            setModuloLoteId("");
            onSuccess?.();
        } else {
            toast.error((result as { error?: string }).error || "Erro ao salvar vídeos.");
        }
    };

    const videosProntos = videos.filter(v => v.titulo.trim() && v.videoFile).length;

    return (
        <>
            <div className="lg:col-span-5">
                <div className="bg-[#161616] p-8 rounded-[2.5rem] border border-white/5 sticky top-10 shadow-2xl">

                    {/* Header */}
                    <header className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-widest text-white">Upload de Mídia</h2>
                            <p className="text-[9px] text-slate-500 uppercase mt-1">Vincular aula a módulos</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setModalModuloOpen(true)}
                                className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500 hover:bg-blue-500 hover:text-white transition-all cursor-pointer flex items-center gap-2"
                                title="Criar Módulo"
                            >
                                <FolderPlus size={18} />
                                <span className="text-[8px] font-black uppercase pr-1 hidden sm:block">Módulos</span>
                            </button>
                            <button
                                onClick={() => setModalCursoOpen(true)}
                                className="p-2.5 bg-orange-500/10 rounded-xl text-orange-500 hover:bg-orange-500 hover:text-white transition-all cursor-pointer flex items-center gap-2 border border-orange-500/20"
                                title="Criar Curso"
                            >
                                <BookOpen size={18} />
                                <span className="text-[8px] font-black uppercase pr-1 hidden sm:block">Cursos</span>
                            </button>
                            <div className="p-2.5 bg-orange-500/10 rounded-xl text-orange-500 border border-orange-500/10">
                                <Film size={18} />
                            </div>
                        </div>
                    </header>

                    {/* Toggle Single / Lote */}
                    <div className="flex bg-[#1C1C1C] p-1 rounded-2xl border border-white/5 mb-6">
                        <button
                            onClick={() => setModo('single')}
                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${modo === 'single' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-white'}`}
                        >
                            Single
                        </button>
                        <button
                            onClick={() => setModo('lote')}
                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${modo === 'lote' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Layers size={12} /> Lote
                        </button>
                    </div>

                    {/* ── SINGLE MODE ── */}
                    {modo === 'single' && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Título da Aula</label>
                                <input
                                    type="text"
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    placeholder="Ex: Introdução ao CRM"
                                    className="w-full px-5 py-4 bg-[#1C1C1C] border border-white/5 rounded-2xl text-xs text-white outline-none focus:border-orange-500 focus:bg-[#222] transition-all"
                                />
                            </div>

                            <div className="relative">
                                <AlignLeft size={14} className="absolute left-4 top-4 text-slate-600" />
                                <textarea
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    placeholder="Descrição opcional..."
                                    className="w-full bg-[#1C1C1C] border border-white/5 pl-10 pr-4 py-4 rounded-xl text-xs text-white outline-none focus:border-orange-500 min-h-[80px] resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className={`group relative border-2 border-dashed ${videoFile ? 'border-orange-500/40 bg-orange-500/5' : 'border-white/5 bg-[#1C1C1C]'} rounded-3xl p-6 transition-all text-center`}>
                                    <input
                                        type="file"
                                        ref={videoInputRef}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept="video/*"
                                        onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                                    />
                                    <div className={`w-10 h-10 ${videoFile ? 'bg-orange-500 text-white' : 'bg-orange-500/10 text-orange-500'} rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors`}>
                                        {videoFile ? <CheckCircle2 size={20} /> : <Upload size={20} />}
                                    </div>
                                    <p className="text-[10px] font-bold text-white uppercase">{videoFile ? videoFile.name : "Arquivo de Vídeo"}</p>
                                </div>

                                <div className={`group relative border-2 border-dashed ${thumbFile ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5 bg-[#1C1C1C]'} rounded-3xl p-5 transition-all flex items-center gap-4`}>
                                    <input
                                        type="file"
                                        ref={thumbInputRef}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept="image/*"
                                        onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                                    />
                                    <div className={`w-10 h-10 ${thumbFile ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'} rounded-xl flex items-center justify-center transition-colors`}>
                                        {thumbFile ? <CheckCircle2 size={18} /> : <ImageIcon size={18} />}
                                    </div>
                                    <p className="text-[10px] font-bold text-white uppercase truncate">{thumbFile ? thumbFile.name : "Miniatura (Capa)"}</p>
                                </div>
                            </div>

                            {/* Módulos selector */}
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModulos(!showModulos)}
                                    className={`cursor-pointer w-full flex items-center justify-between px-5 py-4 rounded-2xl text-xs transition-all border ${modulosSelecionados.length > 0 ? 'bg-blue-500/5 border-blue-500/30 text-white' : 'bg-[#1C1C1C] border-white/5 text-slate-400'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <FolderKanban size={16} className={modulosSelecionados.length > 0 ? "text-blue-500" : "text-slate-600"} />
                                        <span className="font-bold uppercase tracking-tighter text-[10px]">
                                            {modulosSelecionados.length > 0
                                                ? modulosSelecionados.map(m => m.nome).join(", ")
                                                : "Vincular a Módulos"}
                                        </span>
                                    </div>
                                    <Plus size={14} className={`transition-transform duration-300 ${showModulos ? 'rotate-45 text-blue-500' : ''}`} />
                                </button>

                                {showModulos && (
                                    <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
                                        {/* Barra de pesquisa */}
                                        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                                            <Search size={12} className="text-slate-600 flex-shrink-0" />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={buscaSingle}
                                                onChange={(e) => setBuscaSingle(e.target.value)}
                                                placeholder="Pesquisar módulo ou curso..."
                                                className="flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-slate-700"
                                            />
                                            {buscaSingle && (
                                                <button type="button" onClick={() => setBuscaSingle("")} className="text-slate-600 hover:text-slate-400 transition-colors">
                                                    <X size={10} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 gap-1.5 p-2 max-h-48 overflow-y-auto">
                                            {modulosFiltradosSingle.length > 0 ? (
                                                modulosFiltradosSingle.map((modulo) => {
                                                    const isSelected = modulosSelecionados.find(m => m.id === modulo.id);
                                                    return (
                                                        <button
                                                            key={modulo.id}
                                                            type="button"
                                                            onClick={() => toggleModulo(modulo)}
                                                            className={`cursor-pointer flex items-center justify-between px-4 py-3 rounded-xl transition-all border ${isSelected ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'bg-[#1C1C1C] border-transparent text-slate-600 hover:bg-white/5'}`}
                                                        >
                                                            <div className="flex flex-col items-start">
                                                                <span className="text-[9px] font-black uppercase">{modulo.nome}</span>
                                                                <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                                                                    {modulo.cursoNome ?? modulo.setor ?? "—"}
                                                                </span>
                                                            </div>
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-800 bg-black'}`}>
                                                                {isSelected && <CheckCircle2 size={10} />}
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="py-4 text-center text-[8px] font-black text-slate-700 uppercase italic">
                                                    {buscaSingle ? "Nenhum resultado." : "Nenhum módulo. Crie um acima."}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                disabled={isUploading}
                                onClick={handleSingleUpload}
                                className={`cursor-pointer w-full py-5 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-3 shadow-2xl ${isUploading ? 'bg-orange-900/50 cursor-wait' : 'bg-orange-600 hover:bg-orange-500'}`}
                            >
                                {isUploading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                                {isUploading ? "Enviando..." : "Finalizar Publicação"}
                            </button>
                        </div>
                    )}

                    {/* ── LOTE MODE ── */}
                    {modo === 'lote' && (
                        <div className="space-y-4">
                            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                {videos.map((item, idx) => (
                                    <LoteVideoCard
                                        key={item.localId}
                                        index={idx}
                                        item={item}
                                        onUpdate={(patch) => updateLoteItem(item.localId, patch)}
                                        onRemove={() => removeLoteItem(item.localId)}
                                        canRemove={videos.length > 1}
                                    />
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => setVideos(prev => [...prev, newLoteItem()])}
                                disabled={videos.length >= 20}
                                className="cursor-pointer w-full py-3 rounded-2xl border-2 border-dashed border-indigo-500/30 text-indigo-400 hover:border-indigo-500/60 hover:text-indigo-300 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Plus size={14} /> Adicionar mais um vídeo
                            </button>

                            {/* Footer: modulo selector + send */}
                            <div className="border-t border-white/5 pt-4 space-y-3">
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModuloLote(!showModuloLote)}
                                        className={`cursor-pointer w-full flex items-center justify-between px-5 py-4 rounded-2xl text-xs transition-all border ${moduloLoteId ? 'bg-blue-500/5 border-blue-500/30 text-white' : 'bg-[#1C1C1C] border-white/5 text-slate-400'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <FolderKanban size={16} className={moduloLoteId ? "text-blue-500" : "text-slate-600"} />
                                            <span className="font-bold uppercase tracking-tighter text-[10px]">
                                                {moduloLoteId
                                                    ? (() => { const m = modulosDisponiveis.find(x => x.id === moduloLoteId); return m ? m.nome : "Módulo selecionado"; })()
                                                    : "Vincular todos ao Módulo"}
                                            </span>
                                        </div>
                                        <Plus size={14} className={`transition-transform duration-300 ${showModuloLote ? 'rotate-45 text-blue-500' : ''}`} />
                                    </button>

                                    {showModuloLote && (
                                        <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
                                            {/* Barra de pesquisa */}
                                            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                                                <Search size={12} className="text-slate-600 flex-shrink-0" />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={buscaLote}
                                                    onChange={(e) => setBuscaLote(e.target.value)}
                                                    placeholder="Pesquisar módulo ou curso..."
                                                    className="flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-slate-700"
                                                />
                                                {buscaLote && (
                                                    <button type="button" onClick={() => setBuscaLote("")} className="text-slate-600 hover:text-slate-400 transition-colors">
                                                        <X size={10} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 gap-1.5 p-2 max-h-48 overflow-y-auto">
                                                {modulosFiltradosLote.length > 0 ? (
                                                    modulosFiltradosLote.map((modulo) => {
                                                        const isSelected = moduloLoteId === modulo.id;
                                                        return (
                                                            <button
                                                                key={modulo.id}
                                                                type="button"
                                                                onClick={() => { setModuloLoteId(modulo.id); setShowModuloLote(false); setBuscaLote(""); }}
                                                                className={`cursor-pointer flex items-center justify-between px-4 py-3 rounded-xl transition-all border ${isSelected ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'bg-[#1C1C1C] border-transparent text-slate-600 hover:bg-white/5'}`}
                                                            >
                                                                <div className="flex flex-col items-start">
                                                                    <span className="text-[9px] font-black uppercase">{modulo.nome}</span>
                                                                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                                                                        {modulo.cursoNome ?? modulo.setor ?? "—"}
                                                                    </span>
                                                                </div>
                                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-800 bg-black'}`}>
                                                                    {isSelected && <CheckCircle2 size={10} />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="py-4 text-center text-[8px] font-black text-slate-700 uppercase italic">
                                                        {buscaLote ? "Nenhum resultado." : "Nenhum módulo. Crie um acima."}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {loteProgress && (
                                    <div className="px-4 py-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                                        <p className="text-[9px] font-black text-orange-400 uppercase text-center">
                                            Enviando {loteProgress.current} de {loteProgress.total}...
                                        </p>
                                        <div className="mt-2 bg-orange-500/20 rounded-full h-1">
                                            <div
                                                className="bg-orange-500 h-1 rounded-full transition-all duration-300"
                                                style={{ width: `${(loteProgress.current / loteProgress.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    disabled={!!loteProgress || videosProntos === 0}
                                    onClick={handleLoteUpload}
                                    className={`cursor-pointer w-full py-5 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-3 ${loteProgress || videosProntos === 0 ? 'bg-orange-900/50 cursor-wait opacity-60' : 'bg-orange-600 hover:bg-orange-500'}`}
                                >
                                    {loteProgress ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                                    {loteProgress ? `Enviando ${loteProgress.current}/${loteProgress.total}...` : `Enviar ${videosProntos || videos.length} vídeo(s)`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ModalModulos isOpen={modalModuloOpen} onClose={() => setModalModuloOpen(false)} />
            <ModalCurso isOpen={modalCursoOpen} onClose={() => setModalCursoOpen(false)} />
        </>
    );
}

// ── Sub-component: individual video card in lote mode ──
function LoteVideoCard({
    index,
    item,
    onUpdate,
    onRemove,
    canRemove,
}: {
    index: number;
    item: VideoLoteItem;
    onUpdate: (patch: Partial<VideoLoteItem>) => void;
    onRemove: () => void;
    canRemove: boolean;
}) {
    const videoRef = useRef<HTMLInputElement>(null);
    const thumbRef = useRef<HTMLInputElement>(null);

    const statusColor = item.status === 'done' ? 'border-green-500/30 bg-green-500/5'
        : item.status === 'error' ? 'border-red-500/30 bg-red-500/5'
        : item.status === 'uploading' ? 'border-orange-500/30 bg-orange-500/5'
        : 'border-white/5 bg-[#1C1C1C]';

    return (
        <div className={`rounded-2xl border p-4 space-y-3 transition-all ${statusColor}`}>
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-500 uppercase">
                    {item.status === 'done' ? '✓' : item.status === 'error' ? '✗' : item.status === 'uploading' ? '⟳' : `📹`} Vídeo {index + 1}
                </span>
                {canRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="cursor-pointer text-slate-600 hover:text-red-400 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>

            <input
                type="text"
                value={item.titulo}
                onChange={(e) => onUpdate({ titulo: e.target.value })}
                placeholder="Título do vídeo"
                className="w-full px-4 py-3 bg-[#111] border border-white/5 rounded-xl text-xs text-white outline-none focus:border-orange-500 transition-all"
            />

            <input
                type="text"
                value={item.descricao}
                onChange={(e) => onUpdate({ descricao: e.target.value })}
                placeholder="Descrição (opcional)"
                className="w-full px-4 py-3 bg-[#111] border border-white/5 rounded-xl text-xs text-white outline-none focus:border-orange-500 transition-all"
            />

            <div className="grid grid-cols-2 gap-2">
                <div className={`relative border-2 border-dashed ${item.videoFile ? 'border-orange-500/40 bg-orange-500/5' : 'border-white/5 bg-[#111]'} rounded-xl p-3 text-center cursor-pointer transition-all`}>
                    <input
                        type="file"
                        ref={videoRef}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept="video/*"
                        onChange={(e) => onUpdate({ videoFile: e.target.files?.[0] || null })}
                    />
                    <Upload size={14} className={`mx-auto mb-1 ${item.videoFile ? 'text-orange-500' : 'text-slate-600'}`} />
                    <p className="text-[8px] font-bold text-white uppercase truncate">
                        {item.videoFile ? item.videoFile.name : "Vídeo"}
                    </p>
                </div>

                <div className={`relative border-2 border-dashed ${item.thumbFile ? 'border-blue-500/40 bg-blue-500/5' : 'border-white/5 bg-[#111]'} rounded-xl p-3 text-center cursor-pointer transition-all`}>
                    <input
                        type="file"
                        ref={thumbRef}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept="image/*"
                        onChange={(e) => onUpdate({ thumbFile: e.target.files?.[0] || null })}
                    />
                    <ImageIcon size={14} className={`mx-auto mb-1 ${item.thumbFile ? 'text-blue-400' : 'text-slate-600'}`} />
                    <p className="text-[8px] font-bold text-white uppercase truncate">
                        {item.thumbFile ? item.thumbFile.name : "Capa (opcional)"}
                    </p>
                </div>
            </div>

            <div className="relative">
                <input
                    type="url"
                    value={item.thumbUrl}
                    onChange={(e) => onUpdate({ thumbUrl: e.target.value })}
                    placeholder="Ou cole URL da capa..."
                    className="w-full px-4 py-2.5 bg-[#111] border border-white/5 rounded-xl text-[10px] text-white outline-none focus:border-blue-500 transition-all"
                />
            </div>
        </div>
    );
}
