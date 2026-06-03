"use client";

import React, { useEffect, useState } from 'react';
import { X, GripVertical, Save, Loader2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { getVideosDoModulo, updateVideoOrder } from '@/actions/GetVideos';
import { useRouter } from 'next/navigation';

interface Video {
    id: string;
    titulo: string;
    setor: string;
    url: string;
    createdAt: Date;
    updatedAt: Date;
    ordem: number;
    descricao: string | null;
    thumbUrl: string | null;
    tamanho: string | null;
    duracao: number | null;
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    modulo: { id: string; nome: string; imagemUrl?: string | null } | null;
    videos: Video[];
    onSuccess: () => void;
}

export default function ModalGerenciamento({ isOpen, onClose, modulo, videos, onSuccess }: ModalProps) {
    const router = useRouter();
    const [itens, setItens] = useState<Video[]>([]);
    const [isSaving, setIsSaving] = useState(false);


    useEffect(() => {
        if (isOpen && modulo) {
            const fetchOrdem = async () => {
                const res = await getVideosDoModulo(modulo.id);
                setItens(res);
            };
            fetchOrdem();
        }
    }, [isOpen, modulo]);

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const novaLista = Array.from(itens);
        const [reorderedItem] = novaLista.splice(result.source.index, 1);
        novaLista.splice(result.destination.index, 0, reorderedItem);

        setItens(novaLista);
    };

    const handleSave = async () => {
        if (!modulo) return;

        setIsSaving(true);
        try {
            const ids = itens.map(i => i.id);
            const res = await updateVideoOrder(modulo.id, ids);

            if (res.success) {
                toast.success("Ordem salva!");
                await onSuccess();
                onClose();
            }
        } catch (e) {
            toast.error("Erro ao salvar");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !modulo) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[3rem] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl">
                <div className="p-8 border-b border-white/5 bg-[#161616] flex justify-between items-center">
                    <div>
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Organizar Conteúdo</span>
                        <h3 className="text-white font-black uppercase italic leading-none">{modulo.nome}</h3>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl text-slate-500 transition-all cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-[#0F0F0F] custom-scrollbar">
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="videos-modulo">
                            {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                    {itens.map((vid, index) => (
                                        <Draggable key={vid.id} draggableId={vid.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={`flex items-center gap-4 p-4 rounded-[1.8rem] border transition-all duration-200 ${snapshot.isDragging
                                                        ? 'bg-[#222] border-orange-500/50 shadow-2xl scale-[1.02] z-[200]'
                                                        : 'bg-[#161616] border-white/5'
                                                        }`}
                                                >
                                                    <div {...provided.dragHandleProps} className="p-2 text-slate-700 hover:text-orange-500 cursor-grab active:cursor-grabbing">
                                                        <GripVertical size={18} />
                                                    </div>

                                                    <div className="w-7 h-7 shrink-0 bg-black rounded-full flex items-center justify-center text-[9px] font-black text-slate-500 border border-white/5">
                                                        {index + 1}
                                                    </div>

                                                    <div className="w-12 h-8 bg-black rounded-lg overflow-hidden shrink-0 border border-white/5">
                                                        {(vid.thumbUrl || modulo?.imagemUrl) && (
                                                            <img src={vid.thumbUrl || modulo?.imagemUrl!} className="w-full h-full object-cover opacity-80" />
                                                        )}
                                                    </div>

                                                    <h4 className="flex-1 text-[11px] font-black text-white uppercase truncate tracking-tight">
                                                        {vid.titulo}
                                                    </h4>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>

                    {itens.length === 0 && (
                        <div className="py-20 text-center opacity-20 uppercase font-black text-xs tracking-widest">
                            Nenhum vídeo vinculado
                        </div>
                    )}
                </div>

                <div className="p-8 bg-[#161616] border-t border-white/5 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-4 rounded-2xl text-[10px] font-black text-slate-500 uppercase hover:bg-white/5 transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || itens.length === 0}
                        className="px-8 py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-30 rounded-2xl text-[10px] font-black uppercase text-white flex items-center gap-3 transition-all cursor-pointer shadow-lg shadow-orange-900/20"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        {isSaving ? "Sincronizando..." : "Confirmar Ordem"}
                    </button>
                </div>
            </div>
        </div>
    );
}