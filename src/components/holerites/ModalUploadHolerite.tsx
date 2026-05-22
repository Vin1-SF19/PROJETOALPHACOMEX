"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, Check, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { uploadHolerite, substituirHolerite } from "@/actions/Holerites";

function getMesPadrao() {
  const m = new Date().getMonth(); // 0-indexed — já é o mês anterior (0 = jan → prev = dez)
  if (m === 0) return { mes: 12, ano: new Date().getFullYear() - 1 };
  return { mes: m, ano: new Date().getFullYear() };
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface ModalUploadHoleriteProps {
  open: boolean;
  onClose: () => void;
  colaboradorId: number;
  onSucesso?: () => void;
  substituirId?: number;
  mesFixo?: number;
  anoFixo?: number;
}

export default function ModalUploadHolerite({
  open, onClose, colaboradorId, onSucesso,
  substituirId, mesFixo, anoFixo,
}: ModalUploadHoleriteProps) {
  const anoAtual = new Date().getFullYear();
  const padrao = getMesPadrao();
  const [step, setStep] = useState<1 | 2 | 3>(substituirId ? 2 : 1);
  const [mes, setMes] = useState(mesFixo ?? padrao.mes);
  const [ano, setAno] = useState(anoFixo ?? padrao.ano);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(substituirId ? 2 : 1);
    const p = getMesPadrao();
    setMes(mesFixo ?? p.mes);
    setAno(anoFixo ?? p.ano);
    setArquivo(null);
    setUploadUrl(null);
    setAssinado(false);
    setObservacao("");
    setUploading(false);
    setSalvando(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite: 10 MB");
      return;
    }
    setArquivo(file);
    setUploadUrl(null);
    setUploading(true);
    try {
      const res = await fetch(`/api/holerites/upload?filename=${encodeURIComponent(file.name)}`, {
        method: "POST",
        body: file,
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) {
        toast.error(json.error || "Erro ao enviar arquivo");
        setArquivo(null);
        return;
      }
      setUploadUrl(json.url ?? null);
    } catch {
      toast.error("Falha no upload. Tente novamente.");
      setArquivo(null);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConfirmar = async () => {
    if (!uploadUrl || !arquivo) { toast.error("Nenhum arquivo enviado"); return; }
    if (!assinado) { toast.error("Confirme a declaração de assinatura digital"); return; }
    setSalvando(true);
    try {
      const payload = {
        arquivoUrl: uploadUrl,
        arquivoNome: arquivo.name,
        arquivoTamanho: arquivo.size,
        assinado: true,
        observacao: observacao.trim() || undefined,
      };
      const res = substituirId
        ? await substituirHolerite(substituirId, payload)
        : await uploadHolerite({ colaboradorId, mes, ano, ...payload });
      if (res.success) {
        toast.success(substituirId ? "Holerite substituído — voltou para Pendente" : "Holerite enviado com sucesso");
        onSucesso?.();
        handleClose();
      } else {
        toast.error(res.error || "Erro ao salvar");
      }
    } finally {
      setSalvando(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Alpha Holerites</p>
              <p className="text-sm font-black text-white">
                {substituirId ? `Substituir Holerite — ${MESES[(mesFixo ?? 1) - 1]}/${anoFixo ?? anoAtual}` : "Enviar Holerite"}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center px-5 pt-4">
            {([1, 2, 3] as const).map((s) => (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-black transition-all shrink-0
                  ${step > s ? "bg-teal-500 border-teal-500 text-white" : step === s ? "border-teal-500 text-teal-400" : "border-white/10 text-slate-600"}`}>
                  {step > s ? <Check size={10} /> : s}
                </div>
                {s < 3 && (
                  <div className={`h-px flex-1 mx-1 transition-all ${step > s ? "bg-teal-500/50" : "bg-white/5"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="p-5">
            {/* STEP 1 — Competência */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Selecione a competência
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase text-slate-500">Mês</label>
                    <select
                      value={mes}
                      onChange={(e) => setMes(Number(e.target.value))}
                      className="h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-xs font-black text-white focus:outline-none focus:border-teal-500/50 transition-all"
                    >
                      {MESES.map((m, i) => (
                        <option key={i + 1} value={i + 1} className="bg-slate-900">{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase text-slate-500">Ano</label>
                    <select
                      value={ano}
                      onChange={(e) => setAno(Number(e.target.value))}
                      className="h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-xs font-black text-white focus:outline-none focus:border-teal-500/50 transition-all"
                    >
                      {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => (
                        <option key={a} value={a} className="bg-slate-900">{a}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  Próximo <ChevronRight size={14} />
                </button>
              </motion.div>
            )}

            {/* STEP 2 — Upload */}
            {step === 2 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Enviar PDF — {MESES[mes - 1]}/{ano}
                </p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => !uploading && fileRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 h-36 rounded-2xl border-2 border-dashed transition-all cursor-pointer select-none
                    ${dragOver ? "border-teal-500/60 bg-teal-500/5" : arquivo && uploadUrl ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10 hover:border-white/20"}`}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={24} className="animate-spin text-teal-400" />
                      <span className="text-[10px] font-black uppercase text-slate-400">Enviando...</span>
                    </>
                  ) : arquivo && uploadUrl ? (
                    <>
                      <FileText size={24} className="text-emerald-400" />
                      <span className="text-[10px] font-black uppercase text-emerald-400 text-center px-4 truncate max-w-full">
                        {arquivo.name}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {Math.round(arquivo.size / 1024)} KB · clique para trocar
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-slate-500" />
                      <span className="text-[10px] font-black uppercase text-slate-500">Clique ou arraste o PDF</span>
                      <span className="text-[9px] text-slate-600">Máximo 10 MB</span>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase hover:text-white transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!uploadUrl || uploading}
                    className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                  >
                    Próximo <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 — Declaração + Observação */}
            {step === 3 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confirmação</p>
                <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/2 cursor-pointer hover:border-white/20 transition-all">
                  <input
                    type="checkbox"
                    checked={assinado}
                    onChange={(e) => setAssinado(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-teal-500 cursor-pointer shrink-0"
                  />
                  <span className="text-[10px] leading-relaxed text-slate-300">
                    Declaro que este holerite foi{" "}
                    <strong className="text-white">assinado digitalmente via Gov.br (ICP-Brasil)</strong>{" "}
                    e que o documento é autêntico e íntegro.
                  </span>
                </label>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-slate-500">Observação (opcional)</label>
                  <textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Alguma observação sobre este holerite..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-teal-500/50 transition-all"
                  />
                </div>
                {!assinado && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle size={14} className="text-amber-400 shrink-0" />
                    <span className="text-[9px] text-amber-300">
                      Confirme a declaração de assinatura para continuar
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(2)}
                    className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase hover:text-white transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleConfirmar}
                    disabled={!assinado || salvando}
                    className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 hover:bg-teal-500/30 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                  >
                    {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {salvando ? "Salvando..." : "Confirmar Envio"}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
