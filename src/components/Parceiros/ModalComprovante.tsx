"use client";

import { useState, useRef } from "react";
import { X, Upload, Loader2, FileCheck2, Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { enviarComprovante, removerComprovante } from "@/actions/parceiros";

type Comprovante = {
  url: string | null;
  nome: string | null;
  enviadoEm: Date | string | null;
  enviadoPor: string | null;
};

export default function ModalComprovante({
  open, onClose, indicacaoId, empresaNome, comprovante, onChange,
}: {
  open: boolean;
  onClose: () => void;
  indicacaoId: number;
  empresaNome: string;
  comprovante: Comprovante;
  onChange: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const jaTem = !!comprovante.url;

  const enviar = async () => {
    if (!file) { toast.error("Selecione um arquivo"); return; }
    setEnviando(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await enviarComprovante(indicacaoId, fd);
    setEnviando(false);
    if (!res.success) { toast.error(res.error ?? "Erro ao enviar"); return; }
    toast.success("Comprovante enviado!");
    setFile(null);
    onChange();
    onClose();
  };

  const remover = async () => {
    if (!confirm("Remover o comprovante enviado?")) return;
    setRemovendo(true);
    const res = await removerComprovante(indicacaoId);
    setRemovendo(false);
    if (!res.success) { toast.error(res.error ?? "Erro ao remover"); return; }
    toast.success("Comprovante removido.");
    onChange();
    onClose();
  };

  const fmtData = (d: Date | string | null) => {
    if (!d) return "";
    try { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return String(d); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(2,6,23,0.8)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: "#0a1020", border: "1px solid rgba(99,102,241,0.3)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-[15px] font-black text-white leading-none">Comprovante de comissão</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 truncate">{empresaNome}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5 shrink-0"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Comprovante já enviado */}
          {jaTem && (
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <FileCheck2 size={20} className="text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-bold text-emerald-300 truncate">{comprovante.nome}</p>
                <p className="text-[10px] text-slate-500">Enviado {fmtData(comprovante.enviadoEm)}{comprovante.enviadoPor ? ` por ${comprovante.enviadoPor}` : ""}</p>
              </div>
              <a href={comprovante.url!} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 shrink-0" title="Abrir">
                <ExternalLink size={15} />
              </a>
            </div>
          )}

          {/* Área de upload (enviar ou substituir) */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              {jaTem ? "Substituir comprovante" : "Enviar comprovante"}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full rounded-2xl border border-dashed border-white/15 hover:border-indigo-500/50 hover:bg-white/[0.02] transition-all px-4 py-6 flex flex-col items-center gap-2"
            >
              <Upload size={22} className="text-slate-500" />
              {file ? (
                <span className="text-[12.5px] font-bold text-indigo-300 break-all">{file.name}</span>
              ) : (
                <>
                  <span className="text-[12px] font-bold text-slate-300">Clique para selecionar</span>
                  <span className="text-[10px] text-slate-600">PDF, Word, Excel, imagem… (máx. 25MB)</span>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {file && file.size > 25 * 1024 * 1024 && (
            <div className="flex items-center gap-2 text-red-400 text-[11px] font-bold">
              <AlertCircle size={13} /> Arquivo acima de 25MB
            </div>
          )}
        </div>

        <div className="px-5 py-4 flex items-center justify-between gap-2 border-t border-white/10">
          {jaTem ? (
            <button onClick={remover} disabled={removendo} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-red-400 disabled:opacity-40">
              {removendo ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Remover
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[12px] font-bold text-slate-400 hover:text-white">Cancelar</button>
            <button
              onClick={enviar}
              disabled={enviando || !file}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest text-white disabled:opacity-40"
              style={{ background: "rgba(99,102,241,1)" }}
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {jaTem ? "Substituir" : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
