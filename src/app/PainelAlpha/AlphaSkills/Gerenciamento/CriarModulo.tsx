"use client";

import { useState, useEffect } from 'react';
import { X, Plus, FolderPlus, Edit3, Save, RotateCcw, Link as LinkIcon, Upload, Image as ImageIcon, AlignLeft, Loader2, ShieldCheck, Lock, Layers, Trash2, CheckCircle2 } from 'lucide-react';
import { createModulo, getModulos, updateModulo } from '@/actions/GetVideos';
import { listarCursosParaSelect } from '@/actions/Cursos';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface CursoOption {
    id: string;
    nome: string;
}

interface ModuloItem {
    id: string;
    nome: string;
    setor: string;
    imagemUrl: string;
    descricao?: string;
    aprendizado?: string;
    bloqueado: boolean;
    requerModuloId?: string | null;
    percentualMinimo?: number;
    cursos?: { cursoId: string }[];
}

interface LoteModuloItem {
    localId: string;
    nome: string;
    aprendizado: string;
}

let _loteModCounter = 0;
function newLoteModuloItem(): LoteModuloItem {
    return { localId: `lmod-${++_loteModCounter}`, nome: '', aprendizado: '' };
}

export default function ModalModulos({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const router = useRouter();
    const [modo, setModo] = useState<'single' | 'lote'>('single');

    // ── Single mode ──
    const [nome, setNome] = useState("");
    const [descricao, setDescricao] = useState("");
    const [aprendizado, setAprendizado] = useState("");
    const [bloqueado, setBloqueado] = useState(false);
    const [requerModuloId, setRequerModuloId] = useState("");
    const [percentualMinimo, setPercentualMinimo] = useState(100);
    const [cursosSelected, setCursosSelected] = useState<string[]>([]);
    const [modulos, setModulos] = useState<ModuloItem[]>([]);
    const [cursosDisponiveis, setCursosDisponiveis] = useState<CursoOption[]>([]);
    const [loading, setLoading] = useState(false);

    const [modoUpload, setModoUpload] = useState(true);
    const [logoLink, setLogoLink] = useState("");
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [editandoId, setEditandoId] = useState<string | null>(null);

    // ── Lote mode ──
    const [loteItems, setLoteItems] = useState<LoteModuloItem[]>([newLoteModuloItem()]);
    const [loteCursosSelected, setLoteCursosSelected] = useState<string[]>([]);
    const [loteProgress, setLoteProgress] = useState<{ current: number; total: number } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchModulos();
            fetchCursos();
        }
    }, [isOpen]);

    async function fetchModulos() {
        const data = await getModulos();
        setModulos(data as ModuloItem[]);
        router.refresh();
    }

    async function fetchCursos() {
        const data = await listarCursosParaSelect();
        setCursosDisponiveis(data as CursoOption[]);
    }

    const cancelarEdicao = () => {
        setEditandoId(null);
        setNome("");
        setDescricao("");
        setAprendizado("");
        setBloqueado(false);
        setRequerModuloId("");
        setPercentualMinimo(100);
        setCursosSelected([]);
        setLogoFile(null);
        setLogoLink("");
        fetchModulos();
    };

    const carregarParaEdicao = (m: ModuloItem) => {
        setEditandoId(m.id);
        setNome(m.nome);
        setAprendizado(m.aprendizado || "");
        setDescricao(m.descricao || "");
        setBloqueado(m.bloqueado || false);
        setRequerModuloId(m.requerModuloId || "");
        setPercentualMinimo(m.percentualMinimo || 100);
        setCursosSelected(m.cursos?.map(c => c.cursoId) || []);
        setLogoLink(m.imagemUrl || "");
        setModoUpload(false);
    };

    const toggleCurso = (id: string) => {
        setCursosSelected(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    // ── Lote helpers ──
    const updateLoteItem = (localId: string, patch: Partial<LoteModuloItem>) => {
        setLoteItems(prev => prev.map(i => i.localId === localId ? { ...i, ...patch } : i));
    };

    const removeLoteItem = (localId: string) => {
        setLoteItems(prev => prev.filter(i => i.localId !== localId));
    };

    const toggleLoteCurso = (id: string) => {
        setLoteCursosSelected(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleLoteCreate = async () => {
        const valid = loteItems.filter(i => i.nome.trim());
        if (valid.length === 0) return toast.error("Preencha ao menos um nome de módulo.");
        setLoteProgress({ current: 0, total: valid.length });
        let criados = 0;
        for (let i = 0; i < valid.length; i++) {
            const item = valid[i];
            try {
                const res = await createModulo(item.nome.trim(), '', '', item.aprendizado.trim(), false, null, 100, loteCursosSelected);
                if (res.success) criados++;
                else toast.error(`"${item.nome}": ${(res as { error?: string }).error || 'Erro'}`);
            } catch {
                toast.error(`"${item.nome}": Erro ao criar`);
            }
            setLoteProgress({ current: i + 1, total: valid.length });
        }
        setLoteProgress(null);
        if (criados > 0) {
            toast.success(`${criados} módulo(s) criado(s)!`);
            setLoteItems([newLoteModuloItem()]);
            setLoteCursosSelected([]);
            fetchModulos();
            router.refresh();
            onClose();
        }
    };

    const handleAction = async () => {
        if (!nome) return toast.error("Preencha o nome do módulo!");

        setLoading(true);
        try {
            let finalImageUrl = logoLink;

            if (modoUpload && logoFile) {
                const blob = await upload(logoFile.name, logoFile, {
                    access: 'public',
                    handleUploadUrl: '/api/UploadSkills',
                });
                finalImageUrl = blob.url;
            }

            let res;
            if (editandoId) {
                res = await updateModulo(
                    editandoId,
                    nome,
                    finalImageUrl,
                    descricao,
                    aprendizado,
                    bloqueado,
                    requerModuloId || null,
                    Number(percentualMinimo),
                    cursosSelected
                );
            } else {
                res = await createModulo(
                    nome,
                    finalImageUrl,
                    descricao,
                    aprendizado,
                    bloqueado,
                    requerModuloId || null,
                    Number(percentualMinimo),
                    cursosSelected
                );
            }

            if (res.success) {
                toast.success(editandoId ? "Módulo atualizado!" : "Módulo criado!");
                fetchModulos();
                cancelarEdicao();
                onClose();
            }
        } catch {
            toast.error("Erro no processamento.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
            <div className="relative bg-[#0A0A0A] border border-white/10 rounded-[3rem] max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">

                <div className="p-8 border-b border-white/5 bg-[#0F0F0F] flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <FolderPlus className={editandoId ? "text-blue-500" : "text-orange-500"} size={24} />
                        <h3 className="text-white font-black uppercase text-sm tracking-widest italic">
                            {editandoId ? "Editando Módulo" : "Gestão de Módulos"}
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-[#1C1C1C] p-1 rounded-xl border border-white/5">
                            <button onClick={() => setModo('single')} className={`px-4 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all cursor-pointer ${modo === 'single' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:text-white'}`}>Single</button>
                            <button onClick={() => setModo('lote')} className={`px-4 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${modo === 'lote' ? 'bg-orange-600 text-white' : 'text-slate-600 hover:text-white'}`}><Layers size={10} /> Lote</button>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer"><X /></button>
                    </div>
                </div>

                <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar bg-[#0A0A0A]">
                    {/* ── LOTE MODE ── */}
                    {modo === 'lote' && (
                        <div className="space-y-5">
                            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                                {loteItems.map((item, idx) => (
                                    <div key={item.localId} className="flex items-center gap-3 p-3 bg-[#111] border border-white/5 rounded-2xl">
                                        <span className="text-[9px] font-black text-orange-500 w-6 text-center shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                                        <input
                                            value={item.nome}
                                            onChange={(e) => updateLoteItem(item.localId, { nome: e.target.value })}
                                            placeholder="Nome do módulo *"
                                            className="flex-1 bg-[#161616] border border-white/5 px-4 py-2.5 rounded-xl text-xs text-white outline-none focus:border-orange-500 transition-all font-bold"
                                        />
                                        <input
                                            value={item.aprendizado}
                                            onChange={(e) => updateLoteItem(item.localId, { aprendizado: e.target.value })}
                                            placeholder="Subtítulo (opcional)"
                                            className="flex-1 bg-[#161616] border border-white/5 px-4 py-2.5 rounded-xl text-xs text-slate-400 outline-none focus:border-orange-500 transition-all"
                                        />
                                        {loteItems.length > 1 && (
                                            <button type="button" onClick={() => removeLoteItem(item.localId)} className="cursor-pointer text-slate-700 hover:text-red-400 transition-colors shrink-0">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => setLoteItems(prev => [...prev, newLoteModuloItem()])}
                                disabled={loteItems.length >= 20}
                                className="cursor-pointer w-full py-3 rounded-2xl border-2 border-dashed border-orange-500/20 text-orange-400/60 hover:border-orange-500/40 hover:text-orange-400 transition-all text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-30"
                            >
                                <Plus size={12} /> Adicionar módulo
                            </button>

                            <div className="border-t border-white/5 pt-4 space-y-3">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1 block">
                                    Vincular todos a cursos {loteCursosSelected.length > 0 && <span className="text-orange-500">({loteCursosSelected.length})</span>}
                                </label>
                                {cursosDisponiveis.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {cursosDisponiveis.map(c => (
                                            <button key={c.id} type="button" onClick={() => toggleLoteCurso(c.id)}
                                                className={`py-2.5 px-4 rounded-xl text-[8px] font-black uppercase border transition-all cursor-pointer text-left ${loteCursosSelected.includes(c.id) ? 'bg-orange-600 border-orange-500 text-white' : 'bg-[#161616] border-white/5 text-slate-600 hover:border-white/20'}`}>
                                                {c.nome}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {loteProgress && (
                                    <div className="px-4 py-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                                        <p className="text-[9px] font-black text-orange-400 uppercase text-center">Criando {loteProgress.current} de {loteProgress.total}...</p>
                                        <div className="mt-2 bg-orange-500/20 rounded-full h-1">
                                            <div className="bg-orange-500 h-1 rounded-full transition-all duration-300" style={{ width: `${(loteProgress.current / loteProgress.total) * 100}%` }} />
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleLoteCreate}
                                    disabled={!!loteProgress || loteItems.filter(i => i.nome.trim()).length === 0}
                                    className="cursor-pointer w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {loteProgress ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                    {loteProgress ? `Criando ${loteProgress.current}/${loteProgress.total}...` : `Criar ${loteItems.filter(i => i.nome.trim()).length || loteItems.length} módulo(s)`}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── SINGLE MODE ── */}
                    {modo === 'single' && (
                    <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 ${editandoId ? 'bg-blue-500/5 border-blue-500/20' : 'bg-[#111] border-white/5'}`}>
                        <div className="space-y-5">
                            <input
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                placeholder="Título do Módulo"
                                className="w-full bg-[#161616] border border-white/5 p-4 rounded-2xl text-xs text-white outline-none focus:border-orange-500 transition-all font-bold"
                            />

                            <input
                                value={aprendizado}
                                onChange={(e) => setAprendizado(e.target.value)}
                                placeholder="Subtítulo ou resumo rápido"
                                className="w-full bg-[#161616] border border-white/5 p-4 rounded-2xl text-[10px] text-slate-400 outline-none focus:border-orange-500 transition-all uppercase tracking-widest font-black"
                            />

                            <div className="relative">
                                <AlignLeft size={14} className="absolute left-4 top-4 text-slate-600" />
                                <textarea
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    placeholder="Descrição detalhada do conteúdo..."
                                    className="w-full bg-[#161616] border border-white/5 pl-12 pr-4 py-4 rounded-2xl text-xs text-slate-300 outline-none focus:border-orange-500 min-h-[100px] resize-none leading-relaxed"
                                />
                            </div>

                            {/* Capa */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={12} /> Capa do Módulo</label>
                                    <div className="flex bg-black p-1 rounded-xl border border-white/5">
                                        <button onClick={() => setModoUpload(true)} className={`px-4 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all cursor-pointer ${modoUpload ? 'bg-orange-600 text-white' : 'text-slate-600'}`}>Upload</button>
                                        <button onClick={() => setModoUpload(false)} className={`px-4 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all cursor-pointer ${!modoUpload ? 'bg-orange-600 text-white' : 'text-slate-600'}`}>URL</button>
                                    </div>
                                </div>

                                {modoUpload ? (
                                    <div className="relative border-2 border-dashed border-white/10 bg-[#161616] rounded-2xl p-6 text-center hover:border-orange-500/40 transition-all">
                                        <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        <div className="flex flex-col items-center gap-2">
                                            <Upload size={20} className={logoFile ? "text-orange-500" : "text-slate-600"} />
                                            <p className="text-[10px] font-bold text-white uppercase">{logoFile ? logoFile.name : "Clique para subir a imagem"}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <LinkIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                                        <input value={logoLink} onChange={(e) => setLogoLink(e.target.value)} placeholder="https://..." className="w-full bg-[#161616] border border-white/5 pl-12 pr-4 py-4 rounded-2xl text-xs text-white outline-none focus:border-orange-500" />
                                    </div>
                                )}
                            </div>

                            {/* Cursos selector */}
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2 block">
                                    Vincular a Cursos {cursosSelected.length > 0 && <span className="text-orange-500">({cursosSelected.length} selecionado{cursosSelected.length > 1 ? 's' : ''})</span>}
                                </label>
                                {cursosDisponiveis.length === 0 ? (
                                    <p className="text-[10px] text-slate-600 italic px-2">Nenhum curso cadastrado. Crie um curso primeiro.</p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {cursosDisponiveis.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => toggleCurso(c.id)}
                                                className={`py-3 px-4 rounded-xl text-[8px] font-black uppercase border transition-all cursor-pointer text-left ${cursosSelected.includes(c.id)
                                                    ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/10'
                                                    : 'bg-[#161616] border-white/5 text-slate-600 hover:border-white/20'
                                                }`}
                                            >
                                                {c.nome}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Regras de Acesso */}
                            <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5 space-y-6">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="text-orange-500" size={16} />
                                    <h3 className="text-white font-black uppercase text-[10px] tracking-[0.2em] italic">Regras de Acesso</h3>
                                </div>

                                <div className="flex items-center justify-between bg-[#161616] p-4 rounded-2xl border border-white/5">
                                    <label className="text-[11px] font-bold text-slate-300 uppercase">Ativar Trava?</label>
                                    <input
                                        type="checkbox"
                                        checked={bloqueado}
                                        onChange={(e) => setBloqueado(e.target.checked)}
                                        className="w-5 h-5 accent-orange-500 cursor-pointer"
                                    />
                                </div>

                                <div className={`space-y-4 transition-all duration-500 ${bloqueado ? 'opacity-100 translate-y-0' : 'opacity-20 pointer-events-none -translate-y-2'}`}>
                                    <div className="space-y-2">
                                        <label className="text-[9px] text-slate-500 uppercase font-black ml-1">Módulo Precedente:</label>
                                        <select
                                            value={requerModuloId}
                                            onChange={(e) => setRequerModuloId(e.target.value)}
                                            className="w-full bg-[#161616] border border-white/5 p-4 rounded-2xl text-xs text-white outline-none focus:border-orange-500 appearance-none cursor-pointer"
                                        >
                                            <option value="">Nenhum (Bloqueio manual)</option>
                                            {modulos.filter(m => m.id !== editandoId).map(m => (
                                                <option key={m.id} value={m.id}>{m.nome}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] text-slate-500 uppercase font-black ml-1">% Mínima para liberar:</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={percentualMinimo}
                                                onChange={(e) => setPercentualMinimo(Number(e.target.value))}
                                                placeholder="100"
                                                className="w-full bg-[#161616] border border-white/5 p-4 rounded-2xl text-xs text-white outline-none focus:border-orange-500"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-orange-500">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                {editandoId && (
                                    <button onClick={cancelarEdicao} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all cursor-pointer">
                                        <RotateCcw size={14} /> Cancelar
                                    </button>
                                )}
                                <button
                                    onClick={handleAction}
                                    disabled={loading}
                                    className={`flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all text-white shadow-2xl disabled:opacity-50 cursor-pointer ${editandoId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500'}`}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={14} /> : (editandoId ? <Save size={14} /> : <Plus size={14} />)}
                                    {editandoId ? "Salvar Alterações" : "Criar Novo Módulo"}
                                </button>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Module list */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Módulos Ativos na Plataforma</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {modulos.map((m) => (
                                <div key={m.id} className="p-4 bg-[#111] rounded-[2rem] border border-white/5 flex justify-between items-center group hover:border-orange-500/30 transition-all shadow-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0 shadow-inner relative">
                                            {m.imagemUrl
                                                ? <Image src={m.imagemUrl} alt={m.nome} fill className="object-cover" unoptimized />
                                                : <ImageIcon size={20} className="text-slate-800" />
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-black text-white uppercase italic truncate pr-4">{m.nome}</h4>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[7px] bg-white/5 px-2 py-0.5 rounded-full text-slate-500 font-black uppercase tracking-widest">{m.setor || 'Sem setor'}</span>
                                                {m.bloqueado && <Lock size={10} className="text-orange-500" />}
                                                {(m.cursos?.length ?? 0) > 0 && (
                                                    <span className="text-[7px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full font-black uppercase">
                                                        {m.cursos!.length} curso{m.cursos!.length > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => carregarParaEdicao(m)} className="p-3 bg-white/5 text-slate-500 hover:bg-orange-600 hover:text-white rounded-2xl transition-all cursor-pointer">
                                        <Edit3 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
