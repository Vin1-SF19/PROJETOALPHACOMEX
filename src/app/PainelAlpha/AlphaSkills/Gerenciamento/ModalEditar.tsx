"use client";

import { useState, useEffect } from 'react';
import { X, Save, Upload, Loader2, Film, Image as ImageIcon, CheckCircle2, Check, AlignLeft, FolderKanban } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { getVideos, updateVideoData } from '@/actions/GetVideos';
import { getModulos } from '@/actions/GetVideos'; // Importante importar a action
import { toast } from 'sonner';

type Modulo = Awaited<ReturnType<typeof getModulos>>[number];
type ModuloSelecionado = Pick<Modulo, "id" | "nome" | "setor">;
type Video = Pick<Awaited<ReturnType<typeof getVideos>>[number], "id" | "titulo" | "descricao" | "url" | "thumbUrl"> & {
    modulo?: ModuloSelecionado[];
};

export default function ModalEditar({ isOpen, onClose, video, onSuccess }: { isOpen: boolean, onClose: () => void, video: Video | null, onSuccess: () => void }) {
    if (!isOpen || !video) return null;
    return <ModalEditarConteudo key={video.id} video={video} onClose={onClose} onSuccess={onSuccess} />;
}

function ModalEditarConteudo({ onClose, video, onSuccess }: { onClose: () => void, video: Video, onSuccess: () => void }) {
    const [titulo, setTitulo] = useState(video.titulo);
    const [descricao, setDescricao] = useState(video.descricao || "");
    const [modulosDisponiveis, setModulosDisponiveis] = useState<Modulo[]>([]);
    const [modulosSelecionados, setModulosSelecionados] = useState<ModuloSelecionado[]>(
        Array.isArray(video.modulo) ? video.modulo : video.modulo ? [video.modulo] : []
    );

    const [loading, setLoading] = useState(false);
    const [newVideo, setNewVideo] = useState<File | null>(null);
    const [newThumb, setNewThumb] = useState<File | null>(null);

    useEffect(() => {
        const fetchModulos = async () => {
            const dados = await getModulos();
            setModulosDisponiveis(dados);
        };
        fetchModulos();
    }, []);

    const toggleModulo = (modulo: Modulo) => {
        setModulosSelecionados(prev =>
            prev.find(m => m.id === modulo.id)
                ? prev.filter(m => m.id !== modulo.id)
                : [...prev, modulo]
        );
    }; 

    const handleUpdate = async () => {
        if (!titulo || modulosSelecionados.length === 0) {
            toast.error("O título e ao menos um módulo são obrigatórios.");
            return;
        }

        setLoading(true);
        try {
            let finalUrl = video.url;
            let finalThumb = video.thumbUrl;

            if (newVideo) {
                const blob = await upload(newVideo.name, newVideo, { access: 'public', handleUploadUrl: '/api/UploadSkills' });
                finalUrl = blob.url;
            }

            if (newThumb) {
                const blob = await upload(newThumb.name, newThumb, { access: 'public', handleUploadUrl: '/api/UploadSkills' });
                finalThumb = blob.url;
            }


            const setoresUnicos = Array.from(new Set(
                modulosSelecionados.flatMap(m => m.setor.split(", "))
            )).join(", ");

            await updateVideoData(video.id, {
                titulo,
                descricao,
                url: finalUrl,
                thumbUrl: finalThumb,
                setor: setoresUnicos,
                modulosIds: modulosSelecionados.map(m => m.id)
            });

            toast.success("Conteúdo atualizado!");
            onSuccess();
            onClose();
        } catch (e) {
            toast.error("Falha na atualização.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

            <div className="relative bg-[#161616] border border-white/10 rounded-[3rem] max-w-lg w-full p-8 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                            <FolderKanban size={18} />
                        </div>
                        <h3 className="text-white font-black uppercase text-xs tracking-widest">Editar Aula</h3>
                    </div>
                    <button onClick={onClose} className="cursor-pointer text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>

                <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">

                    {/* Título */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Título da Aula</label>
                        <input
                            type="text"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            className="w-full px-5 py-4 bg-[#1C1C1C] border border-white/5 rounded-2xl text-xs text-white outline-none focus:border-orange-500 transition-all"
                        />
                    </div>

                    {/* Descrição */}
                    <div className="relative">
                        <AlignLeft size={14} className="absolute left-4 top-4 text-slate-600" />
                        <textarea
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Descrição da aula..."
                            className="w-full bg-[#1C1C1C] border border-white/5 pl-10 pr-4 py-4 rounded-xl text-xs text-white outline-none focus:border-orange-500 min-h-[80px] resize-none"
                        />
                    </div>

                    {/* Seleção de Módulos */}
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-500 uppercase ml-2 flex items-center gap-2">
                            <FolderKanban size={12} className="text-blue-500" /> Vínculo com Módulos
                        </label>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {modulosDisponiveis.map((modulo) => {
                                const isSelected = modulosSelecionados.find(m => m.id === modulo.id);
                                return (
                                    <button
                                        key={modulo.id}
                                        type="button"
                                        onClick={() => toggleModulo(modulo)}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all cursor-pointer ${isSelected
                                            ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                                            : 'bg-[#1C1C1C] border-white/5 text-slate-600 hover:border-white/10'
                                            }`}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="text-[9px] font-black uppercase">{modulo.nome}</span>
                                            <span className="text-[7px] font-bold opacity-50 uppercase tracking-widest">{modulo.setor}</span>
                                        </div>
                                        {isSelected && <CheckCircle2 size={14} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Uploads de Mídia */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="relative p-5 bg-[#1C1C1C] rounded-2xl border border-white/5 text-center group cursor-pointer hover:bg-[#222] transition-all">
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="video/*" onChange={(e) => setNewVideo(e.target.files?.[0] || null)} />
                            <div className={`w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center ${newVideo ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-600'}`}>
                                <Film size={16} />
                            </div>
                            <p className="text-[8px] font-black text-white uppercase">{newVideo ? "Novo Vídeo!" : "Trocar Vídeo"}</p>
                        </div>

                        <div className="relative p-5 bg-[#1C1C1C] rounded-2xl border border-white/5 text-center group cursor-pointer hover:bg-[#222] transition-all">
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => setNewThumb(e.target.files?.[0] || null)} />
                            <div className={`w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center ${newThumb ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-600'}`}>
                                <ImageIcon size={16} />
                            </div>
                            <p className="text-[8px] font-black text-white uppercase">{newThumb ? "Nova Capa!" : "Trocar Capa"}</p>
                        </div>
                    </div>
                </div>

                <div className="pt-8 mt-auto">
                    <button
                        onClick={handleUpdate}
                        disabled={loading}
                        className={`w-full py-5 bg-orange-600 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-orange-900/20
                            ${loading
                                ? 'opacity-50 cursor-wait pointer-events-none'
                                : 'hover:bg-orange-500 active:scale-95 cursor-pointer'
                            }`}
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {loading ? "Atualizando..." : "Salvar Alterações"}
                    </button>
                </div>
            </div>
        </div>
    );
}
