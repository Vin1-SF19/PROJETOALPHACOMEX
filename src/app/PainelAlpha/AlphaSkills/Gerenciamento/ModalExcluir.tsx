"use client";

import { X, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { deleteVideo } from '@/actions/GetVideos';
import { toast } from 'sonner';

type VideoExcluivel = { id: string; url: string; thumbUrl: string | null; titulo: string };

export default function ModalExcluir({ isOpen, onClose, video, onSuccess }: { isOpen: boolean, onClose: () => void, video: VideoExcluivel | null, onSuccess: () => void}) {
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleDelete = async () => {
        setLoading(true);
        if (!video) {
            setLoading(false);
            return;
        }
        try {
            const res = await deleteVideo(video.id, video.url, video.thumbUrl ?? undefined);
            
            if (res?.success) {
                toast.success("Vídeo removido da nuvem!");
                onSuccess(); 
                onClose();   
            } else {
                toast.error(res?.error || "Erro ao excluir do banco de dados.");
            }
        } catch (error) {
            toast.error("Erro de conexão ao excluir.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#161616] border border-white/5 p-8 rounded-[2.5rem] max-w-sm w-full text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-white font-black uppercase text-sm mb-2">Confirmar Exclusão?</h3>
                <p className="text-slate-500 text-[10px] uppercase font-bold mb-8">
                    Esta ação é permanente e removerá o vídeo &quot;{video?.titulo}&quot; de todos os setores.
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="cursor-pointer flex-1 py-4 text-[10px] font-black text-slate-500 uppercase">Cancelar</button>
                    <button 
                        onClick={handleDelete}
                        disabled={loading}
                        className="cursor-pointer flex-1 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                        Excluir
                    </button>
                </div>
            </div>
        </div>
    );
}
