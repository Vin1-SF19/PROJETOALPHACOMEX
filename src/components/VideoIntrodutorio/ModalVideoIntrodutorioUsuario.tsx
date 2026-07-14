"use client";

import { X, PlayCircle } from "lucide-react";
import { PlayerVideo } from "./PlayerVideo";

interface ModalVideoIntrodutorioUsuarioProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  videoTitulo: string;
}

/**
 * Modal simples exibido para usuários não-Admin: só o player, sem painel de
 * configuração. Visibilidade do botão que abre este modal já é decidida em
 * BotaoVideoIntrodutorio (config existente + não expirada) — ver decisions.md.
 */
export function ModalVideoIntrodutorioUsuario({ open, onClose, videoUrl, videoTitulo }: ModalVideoIntrodutorioUsuarioProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b1220] border border-white/10 w-full max-w-3xl max-h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
              <PlayCircle size={18} className="text-indigo-300" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter truncate">{videoTitulo}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <PlayerVideo url={videoUrl} className="max-h-[65vh]" />
        </div>
      </div>
    </div>
  );
}
