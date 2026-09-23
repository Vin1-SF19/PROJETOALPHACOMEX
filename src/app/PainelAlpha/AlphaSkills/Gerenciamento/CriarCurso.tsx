"use client";

import { useState, useEffect } from 'react';
import { X, Plus, BookOpen, Edit3, Save, RotateCcw, Link as LinkIcon, Upload, Image as ImageIcon, AlignLeft, Loader2, Trash2, Layers, CheckCircle2 } from 'lucide-react';
import { criarCurso, editarCurso, deletarCurso, getAllCursos } from '@/actions/Cursos';
import { getModulos } from '@/actions/GetVideos';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const SETORES_VALIDOS = ["T.I", "Comercial", "Operacional", "Financeiro", "Recursos-Humanos", "Serviços Gerais"];

interface ModuloItem {
    id: string;
    nome: string;
    setor: string;
}

interface CursoItem {
    id: string;
    nome: string;
    descricao?: string;
    capa?: string;
    setores: string[];
    modulos: { id: string; nome: string }[];
}

interface LoteCursoItem {
    localId: string;
    nome: string;
    setores: string[];
}

let _loteCursoCounter = 0;
function newLoteCursoItem(): LoteCursoItem {
    return { localId: `lcurso-${++_loteCursoCounter}`, nome: '', setores: [] };
}

export default function ModalCurso({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const router = useRouter();

    const [modo, setModo] = useState<'single' | 'lote'>('single');

    // ── Lote mode ──
    const [loteItems, setLoteItems] = useState<LoteCursoItem[]>([newLoteCursoItem()]);
    const [loteProgress, setLoteProgress] = useState<{ current: number; total: number } | null>(null);

    const updateLoteItem = (localId: string, patch: Partial<LoteCursoItem>) => {
        setLoteItems(prev => prev.map(i => i.localId === localId ? { ...i, ...patch } : i));
    };

    const removeLoteItem = (localId: string) => {
        setLoteItems(prev => prev.filter(i => i.localId !== localId));
    };

    const toggleLoteSetor = (localId: string, setor: string) => {
        setLoteItems(prev => prev.map(i => i.localId !== localId ? i : {
            ...i,
            setores: i.setores.includes(setor) ? i.setores.filter(s => s !== setor) : [...i.setores, setor]
        }));
    };

    const handleLoteCreate = async () => {
        const valid = loteItems.filter(i => i.nome.trim() && i.setores.length > 0);
        if (valid.length === 0) return toast.error("Preencha nome e ao menos 1 setor por curso.");
        setLoteProgress({ current: 0, total: valid.length });
        let criados = 0;
        for (let i = 0; i < valid.length; i++) {
            const item = valid[i];
            try {
                const res = await criarCurso({ nome: item.nome.trim(), setores: item.setores, modulosIds: [] });
                if (res.success) criados++;
                else toast.error(`"${item.nome}": ${(res as { error?: unknown }).error || 'Erro'}`);
            } catch {
                toast.error(`"${item.nome}": Erro ao criar`);
            }
            setLoteProgress({ current: i + 1, total: valid.length });
        }
        setLoteProgress(null);
        if (criados > 0) {
            toast.success(`${criados} curso(s) criado(s)!`);
            setLoteItems([newLoteCursoItem()]);
            fetchDados();
            router.refresh();
            onClose();
        }
    };

    // ── Single mode ──
    const [nome, setNome] = useState("");
    const [descricao, setDescricao] = useState("");
    const [setoresSelecionados, setSetoresSelecionados] = useState<string[]>([]);
    const [modulosSelecionados, setModulosSelecionados] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [editandoId, setEditandoId] = useState<string | null>(null);

    const [modoUpload, setModoUpload] = useState(true);
    const [capaLink, setCapaLink] = useState("");
    const [capaFile, setCapaFile] = useState<File | null>(null);

    const [cursos, setCursos] = useState<CursoItem[]>([]);
    const [modulos, setModulos] = useState<ModuloItem[]>([]);
    const [showModulosSelector, setShowModulosSelector] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchDados();
        }
    }, [isOpen]);

    async function fetchDados() {
        const [cursosData, modulosData] = await Promise.all([
            getAllCursos(),
            getModulos(),
        ]);
        setCursos(cursosData as CursoItem[]);
        setModulos(modulosData as ModuloItem[]);
    }

    const resetForm = () => {
        setEditandoId(null);
        setNome("");
        setDescricao("");
        setSetoresSelecionados([]);
        setModulosSelecionados([]);
        setCapaFile(null);
        setCapaLink("");
        setModoUpload(true);
        setShowModulosSelector(false);
    };

    const carregarParaEdicao = (c: CursoItem) => {
        setEditandoId(c.id);
        setNome(c.nome);
        setDescricao(c.descricao || "");
        setSetoresSelecionados(c.setores);
        setModulosSelecionados(c.modulos.map(m => m.id));
        setCapaLink(c.capa || "");
        setModoUpload(!c.capa);
    };

    const toggleSetor = (s: string) => {
        setSetoresSelecionados(prev =>
            prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
        );
    };

    const toggleModulo = (id: string) => {
        setModulosSelecionados(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleAction = async () => {
        if (!nome.trim()) return toast.error("Preencha o nome do curso!");
        if (setoresSelecionados.length === 0) return toast.error("Selecione ao menos um setor!");

        setLoading(true);
        try {
            let finalCapa = capaLink;
            if (modoUpload && capaFile) {
                const blob = await upload(capaFile.name, capaFile, {
                    access: 'public',
                    handleUploadUrl: '/api/UploadSkills',
                });
                finalCapa = blob.url;
            }

            const payload = {
                ...(editandoId ? { id: editandoId } : {}),
                nome: nome.trim(),
                descricao: descricao.trim() || undefined,
                capa: finalCapa || undefined,
                setores: setoresSelecionados,
                modulosIds: modulosSelecionados,
            };

            const res = editandoId
                ? await editarCurso(payload)
                : await criarCurso(payload);

            if (res.success) {
                toast.success(editandoId ? "Curso atualizado!" : "Curso criado!");
                resetForm();
                fetchDados();
                router.refresh();
                onClose();
            } else {
                toast.error(String((res as { error?: unknown }).error) || "Erro ao salvar.");
            }
        } catch {
            toast.error("Erro no processamento.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, nome: string) => {
        if (!confirm(`Excluir curso "${nome}"? Os módulos vinculados não serão excluídos.`)) return;
        const res = await deletarCurso(id);
        if (res.success) {
            toast.success("Curso excluído.");
            fetchDados();
            router.refresh();
        } else {
            toast.error("Erro ao excluir.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
            <div className="relative bg-[#0A0A0A] border border-white/10 rounded-[3rem] max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">

                <div className="p-8 border-b border-white/5 bg-[#0F0F0F] flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <BookOpen className={editandoId ? "text-blue-500" : "text-orange-500"} size={24} />
                        <h3 className="text-white font-black uppercase text-sm tracking-widest italic">
                            {editandoId ? "Editando Curso" : "Gestão de Cursos"}
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
                        <div className="space-y-4">
                            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
                                {loteItems.map((item, idx) => (
                                    <div key={item.localId} className="p-4 bg-[#111] border border-white/5 rounded-2xl space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[9px] font-black text-orange-500 w-6 text-center shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                                            <input
                                                value={item.nome}
                                                onChange={(e) => updateLoteItem(item.localId, { nome: e.target.value })}
                                                placeholder="Nome do curso *"
                                                className="flex-1 bg-[#161616] border border-white/5 px-4 py-2.5 rounded-xl text-xs text-white outline-none focus:border-orange-500 transition-all font-bold"
                                            />
                                            {loteItems.length > 1 && (
                                                <button type="button" onClick={() => removeLoteItem(item.localId)} className="cursor-pointer text-slate-700 hover:text-red-400 transition-colors shrink-0">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pl-9">
                                            {SETORES_VALIDOS.map(s => (
                                                <button key={s} type="button" onClick={() => toggleLoteSetor(item.localId, s)}
                                                    className={`px-3 py-1 rounded-full text-[7px] font-black uppercase border transition-all cursor-pointer ${item.setores.includes(s) ? 'bg-orange-600 border-orange-500 text-white' : 'bg-[#1C1C1C] border-white/5 text-slate-600 hover:border-white/20'}`}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button type="button" onClick={() => setLoteItems(prev => [...prev, newLoteCursoItem()])} disabled={loteItems.length >= 20}
                                className="cursor-pointer w-full py-3 rounded-2xl border-2 border-dashed border-orange-500/20 text-orange-400/60 hover:border-orange-500/40 hover:text-orange-400 transition-all text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-30">
                                <Plus size={12} /> Adicionar curso
                            </button>

                            {loteProgress && (
                                <div className="px-4 py-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                                    <p className="text-[9px] font-black text-orange-400 uppercase text-center">Criando {loteProgress.current} de {loteProgress.total}...</p>
                                    <div className="mt-2 bg-orange-500/20 rounded-full h-1">
                                        <div className="bg-orange-500 h-1 rounded-full transition-all duration-300" style={{ width: `${(loteProgress.current / loteProgress.total) * 100}%` }} />
                                    </div>
                                </div>
                            )}

                            <button onClick={handleLoteCreate} disabled={!!loteProgress || loteItems.filter(i => i.nome.trim() && i.setores.length > 0).length === 0}
                                className="cursor-pointer w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                                {loteProgress ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                {loteProgress ? `Criando ${loteProgress.current}/${loteProgress.total}...` : `Criar ${loteItems.filter(i => i.nome.trim() && i.setores.length > 0).length || loteItems.length} curso(s)`}
                            </button>
                        </div>
                    )}

                    {/* ── SINGLE MODE (Form) ── */}
                    {modo === 'single' && (
                    <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 ${editandoId ? 'bg-blue-500/5 border-blue-500/20' : 'bg-[#111] border-white/5'}`}>
                        <div className="space-y-5">

                            <input
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                placeholder="Nome do Curso *"
                                className="w-full bg-[#161616] border border-white/5 p-4 rounded-2xl text-xs text-white outline-none focus:border-orange-500 transition-all font-bold"
                            />

                            <div className="relative">
                                <AlignLeft size={14} className="absolute left-4 top-4 text-slate-600" />
                                <textarea
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    placeholder="Descrição do curso..."
                                    className="w-full bg-[#161616] border border-white/5 pl-12 pr-4 py-4 rounded-2xl text-xs text-slate-300 outline-none focus:border-orange-500 min-h-[90px] resize-none leading-relaxed"
                                />
                            </div>

                            {/* Capa */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <ImageIcon size={12} /> Capa do Curso
                                    </label>
                                    <div className="flex bg-black p-1 rounded-xl border border-white/5">
                                        <button onClick={() => setModoUpload(true)} className={`px-4 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all cursor-pointer ${modoUpload ? 'bg-orange-600 text-white' : 'text-slate-600'}`}>Upload</button>
                                        <button onClick={() => setModoUpload(false)} className={`px-4 py-1.5 text-[8px] font-black uppercase rounded-lg transition-all cursor-pointer ${!modoUpload ? 'bg-orange-600 text-white' : 'text-slate-600'}`}>URL</button>
                                    </div>
                                </div>
                                {modoUpload ? (
                                    <div className="relative border-2 border-dashed border-white/10 bg-[#161616] rounded-2xl p-6 text-center hover:border-orange-500/40 transition-all">
                                        <input type="file" accept="image/*" onChange={(e) => setCapaFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                        <div className="flex flex-col items-center gap-2">
                                            <Upload size={20} className={capaFile ? "text-orange-500" : "text-slate-600"} />
                                            <p className="text-[10px] font-bold text-white uppercase">{capaFile ? capaFile.name : "Clique para subir a imagem"}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <LinkIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                                        <input value={capaLink} onChange={(e) => setCapaLink(e.target.value)} placeholder="https://..." className="w-full bg-[#161616] border border-white/5 pl-12 pr-4 py-4 rounded-2xl text-xs text-white outline-none focus:border-orange-500" />
                                    </div>
                                )}
                            </div>

                            {/* Setores */}
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2 block">
                                    Setores * {setoresSelecionados.length > 0 && <span className="text-orange-500">({setoresSelecionados.length} selecionado{setoresSelecionados.length > 1 ? 's' : ''})</span>}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {SETORES_VALIDOS.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => toggleSetor(s)}
                                            className={`py-3 rounded-xl text-[8px] font-black uppercase border transition-all cursor-pointer ${setoresSelecionados.includes(s)
                                                ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/10'
                                                : 'bg-[#161616] border-white/5 text-slate-600 hover:border-white/20'
                                            }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Módulos (opcional) */}
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModulosSelector(!showModulosSelector)}
                                    className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
                                >
                                    <Plus size={12} className={`transition-transform ${showModulosSelector ? 'rotate-45' : ''}`} />
                                    Vincular Módulos (opcional)
                                    {modulosSelecionados.length > 0 && <span className="text-orange-500">— {modulosSelecionados.length} selecionado{modulosSelecionados.length > 1 ? 's' : ''}</span>}
                                </button>

                                {showModulosSelector && (
                                    <div className="grid grid-cols-1 gap-2 p-3 bg-[#111] rounded-2xl border border-white/5 max-h-48 overflow-y-auto">
                                        {modulos.length > 0 ? modulos.map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => toggleModulo(m.id)}
                                                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all border cursor-pointer ${modulosSelecionados.includes(m.id)
                                                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                                    : 'bg-[#1C1C1C] border-transparent text-slate-600 hover:bg-white/5'
                                                }`}
                                            >
                                                <span className="text-[9px] font-black uppercase">{m.nome}</span>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${modulosSelecionados.includes(m.id) ? 'border-blue-500 bg-blue-500' : 'border-slate-800'}`}>
                                                    {modulosSelecionados.includes(m.id) && <span className="text-white text-[8px]">✓</span>}
                                                </div>
                                            </button>
                                        )) : (
                                            <p className="text-center text-[9px] text-slate-700 py-4 uppercase italic">Nenhum módulo disponível</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                {editandoId && (
                                    <button onClick={resetForm} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all cursor-pointer">
                                        <RotateCcw size={14} /> Cancelar
                                    </button>
                                )}
                                <button
                                    onClick={handleAction}
                                    disabled={loading}
                                    className={`flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all text-white shadow-2xl disabled:opacity-50 cursor-pointer ${editandoId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-orange-600 hover:bg-orange-500'}`}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={14} /> : (editandoId ? <Save size={14} /> : <Plus size={14} />)}
                                    {editandoId ? "Salvar Alterações" : "Criar Novo Curso"}
                                </button>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Course list */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Cursos na Plataforma</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {cursos.length === 0 && (
                                <p className="text-center text-[10px] text-slate-700 italic py-8 uppercase">Nenhum curso criado ainda.</p>
                            )}
                            {cursos.map((c) => (
                                <div key={c.id} className="p-4 bg-[#111] rounded-[2rem] border border-white/5 flex justify-between items-center group hover:border-orange-500/30 transition-all shadow-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0 relative">
                                            {c.capa
                                                ? <Image src={c.capa} alt={c.nome} fill className="object-cover" unoptimized />
                                                : <BookOpen size={20} className="text-slate-800" />
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-black text-white uppercase italic truncate pr-4">{c.nome}</h4>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                {c.setores.map(s => (
                                                    <span key={s} className="text-[7px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full font-black uppercase">{s}</span>
                                                ))}
                                                <span className="text-[7px] bg-white/5 text-slate-500 px-2 py-0.5 rounded-full font-black uppercase">{c.modulos.length} módulos</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button onClick={() => carregarParaEdicao(c)} className="p-3 bg-white/5 text-slate-500 hover:bg-orange-600 hover:text-white rounded-2xl transition-all cursor-pointer">
                                            <Edit3 size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(c.id, c.nome)} className="p-3 bg-white/5 text-slate-500 hover:bg-red-600 hover:text-white rounded-2xl transition-all cursor-pointer">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
