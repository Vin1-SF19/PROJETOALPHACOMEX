"use client";

import { useState, useRef } from "react";
import { Pencil, LoaderCircle, X, Trash2, Upload, Camera } from "lucide-react";
import { toast } from "sonner";
import { atualizarFotoPerfilAction, deletarImagemAction } from "@/actions/perfil";
import { useSession } from "next-auth/react";
import { getTema } from "@/lib/temas";
import { prepareAvatarImage } from "@/lib/avatar-upload";

export function AvatarUpload({ inicial, fotoAtual }: { inicial: string, fotoAtual?: string | null }) {
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preview, setPreview] = useState(fotoAtual);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const temaNome = (session?.user as any)?.tema_interface || "blue";
  const style = getTema(temaNome);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const toastId = toast.loading("Sincronizando Dossiê...");

    try {
      const prepared = await prepareAvatarImage(file);
      const response = await fetch(`/api/usuarios/avatar?filename=${encodeURIComponent(prepared.filename)}`, {
        method: 'POST',
        headers: { 'Content-Type': prepared.blob.type },
        body: prepared.blob,
      });

      const newBlob = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !newBlob.url) throw new Error(newBlob.error || "O servidor não retornou a URL da foto.");
      const res = await atualizarFotoPerfilAction(newBlob.url);

      if (res.success) {
        setPreview(newBlob.url);
        await update({ ...session, user: { ...session?.user, imagemUrl: newBlob.url } });
        toast.success("Identidade atualizada!", { id: toastId });
        setIsModalOpen(false);
      }
    } catch (error: any) {
      toast.error(`Falha: ${error.message}`, { id: toastId });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExcluir = async () => {
    setLoading(true);
    const res = await deletarImagemAction();
    if (res.success) {
      setPreview(null);
      await update({ ...session, user: { ...session?.user, imagemUrl: null } });
      toast.success("Avatar removido do protocolo.");
      setIsModalOpen(false);
    }
    setLoading(false);
  };

  return (
    <>
      {/* GATILHO VISUAL */}
      <div className="relative group cursor-pointer" onClick={() => setIsModalOpen(true)}>
        <div className={`h-32 w-32 rounded-[2.5rem] bg-black border-2 ${style.border} flex items-center justify-center overflow-hidden shadow-2xl transition-all group-hover:scale-105`}>
          {preview ? (
            <img src={preview} alt="Perfil" className="h-full w-full object-cover" />
          ) : (
            <span className={`text-4xl font-black ${style.text} italic uppercase`}>{inicial}</span>
          )}
        </div>
        <div className={`absolute -bottom-2 -right-2 p-2.5 ${style.bg} rounded-2xl border-4 border-[#020617] shadow-lg`}>
          <Pencil size={16} className="text-white" />
        </div>
      </div>

      {/* MODAL DE GESTÃO DE IDENTIDADE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-slate-900 border border-white/10 p-8 rounded-[3rem] max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setIsModalOpen(false)} className="cursor-pointer absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>

            <h2 className="text-xl font-black uppercase italic tracking-tighter text-white mb-8 flex items-center gap-3">
              <Camera className={style.text} /> Protocolo de Imagem
            </h2>

            <div className="flex flex-col items-center gap-8">
              <div className={`h-48 w-48 rounded-[3rem] bg-black border-2 ${style.border} overflow-hidden shadow-2xl relative`}>
                {loading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                    <LoaderCircle className={`animate-spin ${style.text}`} size={40} />
                  </div>
                )}
                {preview ? (
                  <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-6xl font-black text-slate-800 italic uppercase">
                    {inicial}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 w-full gap-3">
                <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/jpeg,image/png,image/webp" />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className={`cursor-pointer h-14 ${style.bg} hover:brightness-110 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50`}
                >
                  <Upload size={18} /> Alterar Identidade
                </button>

                {preview && (
                  <button
                    onClick={handleExcluir}
                    disabled={loading}
                    className="cursor-pointer h-14 bg-red-600/10 border border-red-600/20 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 size={18} /> Deletar Registro
                  </button>
                )}
              </div>
            </div>

            <p className="text-[8px] font-black text-center text-slate-600 uppercase tracking-widest mt-8">Sincronização Criptografada v4.0</p>
          </div>
        </div>
      )}
    </>
  );
}
