"use client";

import { useState } from "react";
import { X, PlayCircle, Loader2, CalendarClock, PowerOff } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fmtDateTime } from "@/lib/format-date";
import { ativarVideoIntrodutorio, desativarVideoIntrodutorio } from "@/actions/video-introdutorio";
import { PlayerVideo } from "./PlayerVideo";
import { PainelSelecaoVideoSkills } from "./PainelSelecaoVideoSkills";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

interface ConfigAtual {
  videoId: string;
  videoTitulo: string;
  videoUrl: string;
  videoThumbUrl: string | null;
  ativadoEm: Date;
  expirado: boolean;
}

interface ModalVideoIntrodutorioAdminProps {
  open: boolean;
  onClose: () => void;
  modulo: string;
  configAtual: ConfigAtual | null;
  aoAtivar?: () => void;
}

/**
 * Modal Admin: player (preview) à esquerda + painel de busca/seleção à
 * direita. Ativar sobrescreve a config atual do módulo (upsert, sem
 * histórico — ver decisions.md 2026-07-14). Desativar é soft (mantém
 * videoId, zera ativadoEm).
 */
export function ModalVideoIntrodutorioAdmin({ open, onClose, modulo, configAtual, aoAtivar }: ModalVideoIntrodutorioAdminProps) {
  const [videoSelecionadoId, setVideoSelecionadoId] = useState<string | null>(configAtual?.videoId ?? null);
  const [videoSelecionadoUrl, setVideoSelecionadoUrl] = useState<string | null>(configAtual?.videoUrl ?? null);
  const [videoSelecionadoTitulo, setVideoSelecionadoTitulo] = useState<string | null>(configAtual?.videoTitulo ?? null);
  const [ativando, setAtivando] = useState(false);
  const [desativando, setDesativando] = useState(false);
  const [confirmDesativarOpen, setConfirmDesativarOpen] = useState(false);

  if (!open) return null;

  const handleSelecionar = (video: { id: string; titulo: string; url: string; thumbUrl: string | null }) => {
    setVideoSelecionadoId(video.id);
    setVideoSelecionadoUrl(video.url);
    setVideoSelecionadoTitulo(video.titulo);
  };

  const handleAtivar = async () => {
    if (!videoSelecionadoId || ativando) return;
    setAtivando(true);
    const res = await ativarVideoIntrodutorio(modulo, videoSelecionadoId);
    setAtivando(false);
    if (res.success) {
      toast.success("Vídeo introdutório ativado");
      aoAtivar?.();
      onClose();
    } else {
      toast.error(res.error ?? "Erro ao ativar vídeo introdutório");
    }
  };

  const handleDesativar = async () => {
    setDesativando(true);
    const res = await desativarVideoIntrodutorio(modulo);
    setDesativando(false);
    setConfirmDesativarOpen(false);
    if (res.success) {
      toast.success("Vídeo introdutório desativado");
      aoAtivar?.();
    } else {
      toast.error(res.error ?? "Erro ao desativar vídeo introdutório");
    }
  };

  const ativoAteData = configAtual && !configAtual.expirado
    ? new Date(configAtual.ativadoEm.getTime() + SETE_DIAS_MS)
    : null;

  return (
    <>
      <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-[#0b1220] border border-white/10 w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
                <PlayCircle size={18} className="text-indigo-300" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter truncate">Vídeo Introdutório</h3>
                {ativoAteData ? (
                  <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                    <CalendarClock size={11} aria-hidden="true" /> Ativo até {fmtDateTime(ativoAteData)}
                  </p>
                ) : (
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-0.5">Nenhum vídeo ativo no momento</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Preview à esquerda */}
            <div className="flex flex-col gap-2 min-h-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Preview</span>
              {videoSelecionadoUrl ? (
                <>
                  <PlayerVideo url={videoSelecionadoUrl} className="aspect-video" />
                  <p className="text-[11px] font-bold text-slate-300 truncate">{videoSelecionadoTitulo}</p>
                </>
              ) : (
                <div className="aspect-video rounded-2xl bg-slate-900/60 border border-white/5 grid place-items-center text-slate-700">
                  <p className="text-[10px] font-black uppercase tracking-widest">Selecione um vídeo ao lado</p>
                </div>
              )}
            </div>

            {/* Painel de seleção à direita */}
            <div className="flex flex-col min-h-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Buscar no Alpha Skills</span>
              <div className="flex-1 min-h-0 max-h-[45vh] md:max-h-none">
                <PainelSelecaoVideoSkills videoSelecionadoId={videoSelecionadoId} onSelecionar={handleSelecionar} />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-white/5 shrink-0 flex items-center justify-between gap-3">
            {configAtual && !configAtual.expirado ? (
              <button
                onClick={() => setConfirmDesativarOpen(true)}
                disabled={desativando}
                className="h-10 px-4 flex items-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-rose-300/90 hover:text-rose-300 transition-all disabled:opacity-50"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                {desativando ? <Loader2 size={14} className="animate-spin" /> : <PowerOff size={14} />}
                Desativar
              </button>
            ) : (
              <span />
            )}

            <button
              onClick={handleAtivar}
              disabled={!videoSelecionadoId || ativando}
              className="h-11 px-6 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
              style={{ background: "rgba(99,102,241,1)", boxShadow: "0 8px 24px rgba(99,102,241,0.35)" }}
            >
              {ativando ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
              Ativar Vídeo Introdutório
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDesativarOpen} onOpenChange={setConfirmDesativarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar vídeo introdutório?</AlertDialogTitle>
            <AlertDialogDescription>
              O botão deixará de aparecer para os demais usuários antes do prazo de 7 dias. O vídeo selecionado é mantido (você pode reativá-lo depois).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDesativar} className="bg-rose-600 hover:bg-rose-500 text-white">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
