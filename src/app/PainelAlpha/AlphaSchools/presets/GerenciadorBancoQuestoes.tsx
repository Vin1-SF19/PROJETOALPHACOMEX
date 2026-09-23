'use client';
import React, { useState, useEffect } from 'react';
import { Tag, Plus, Loader2, ChevronLeft, ListChecks, AlignLeft } from 'lucide-react';
import { createTagAction, getTagsAction } from '@/actions/questoes';
import { toast } from 'sonner';
import FormularioPerguntas from './Questoes';
import type { TemaAlpha } from '@/lib/temas';

type TagQuestao = Awaited<ReturnType<typeof getTagsAction>>[number];

export default function GerenciadorQuestoes({ temaConfig }: { temaConfig: TemaAlpha }) {
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [tags, setTags] = useState<TagQuestao[]>([]);
    const [novaTagName, setNovaTagName] = useState("");
    
    const [tagAtiva, setTagAtiva] = useState<TagQuestao | null>(null);

    useEffect(() => {
        carregarTags();
    }, []);

    async function carregarTags() {
        const data = await getTagsAction();
        setTags(data);
        setLoading(false);
    }

    const handleCriarTag = async () => {
        if (!novaTagName) return;
        setIsSaving(true);
        const res = await createTagAction(novaTagName);

        if (res.success) {
            toast.success("Categoria criada!");
            setNovaTagName("");
            carregarTags();
        } else {
            toast.error(res.error);
        }
        setIsSaving(false);
    };

    
    if (tagAtiva) {
        return (
            <FormularioPerguntas 
                temaConfig={temaConfig} 
                tagAtiva={tagAtiva} 
                onVoltar={() => {
                    setTagAtiva(null);
                    carregarTags();
                }} 
                refresh={carregarTags}
            />
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* INPUT DE CRIAÇÃO DE TAG */}
            <div className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                <label className="text-[9px] font-black uppercase text-slate-500 mb-3 block tracking-widest">
                    Nova Categoria de Estudo
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={novaTagName}
                        onChange={(e) => setNovaTagName(e.target.value)}
                        placeholder="Ex: RADAR, COMEX, LOGÍSTICA..."
                        className="flex-1 h-12 bg-black/40 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-orange-500/50 transition-all"
                    />
                    <button
                        onClick={handleCriarTag}
                        disabled={isSaving || !novaTagName}
                        className={`px-6 h-12 ${temaConfig.bg} rounded-xl text-[10px] font-black uppercase flex items-center gap-2 disabled:opacity-50`}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                        Criar Tag
                    </button>
                </div>
            </div>

            {/* LISTAGEM DE TAGS EXISTENTES */}
            <div className="space-y-3">
                <h4 className="text-[9px] font-black uppercase text-slate-500 ml-2">Categorias Ativas</h4>
                {loading ? (
                    <div className="py-10 flex justify-center opacity-20"><Loader2 className="animate-spin" /></div>
                ) : tags.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-20">
                        <p className="text-[9px] font-black uppercase">Nenhuma categoria encontrada</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {tags.map((tag) => (
                            <div key={tag.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl group hover:border-white/10 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-black/40 border border-white/5 ${temaConfig.text}`}>
                                        <Tag size={14} />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase text-white tracking-wider">{tag.nome}</p>
                                        <p className="text-[8px] font-bold text-slate-500 uppercase">{tag._count?.perguntas || 0} Questões no Banco</p>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => setTagAtiva(tag)}
                                    className="text-[8px] font-black uppercase p-2 hover:bg-white/5 rounded-lg transition-all text-slate-500 hover:text-white border border-transparent hover:border-white/5"
                                >
                                    Gerenciar Perguntas
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
