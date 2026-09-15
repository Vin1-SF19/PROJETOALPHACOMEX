"use client";

import { useRef, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { EXTENSOES_MESCLAGEM } from "../api-mesclagem";

const LIMITE_ARQUIVO_MB = 80;

interface UploadDropzoneProps {
  accept: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
}

const FORMATOS = EXTENSOES_MESCLAGEM.map((formato) => formato.slice(1).toLocaleUpperCase("pt-BR"));

export function UploadDropzone({ accept, onFile, disabled, loading = false, label }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  function tratarArquivo(evento: React.DragEvent<HTMLButtonElement> | React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    const arquivo = "dataTransfer" in evento ? evento.dataTransfer.files?.[0] : evento.target.files?.[0];
    if (!arquivo) return;
    onFile(arquivo);
    if ("target" in evento) (evento.target as HTMLInputElement).value = "";
  }

  return (
    <div>
      <button
        type="button"
        aria-label={label}
        aria-busy={loading}
        disabled={disabled}
        className={`group flex min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-slate-900/70 p-6 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none ${arrastando ? "border-sky-400 bg-slate-800 shadow-xl ring-2 ring-sky-400/15" : "border-slate-600 hover:border-indigo-400/60"}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(evento) => { evento.preventDefault(); if (!disabled) setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(evento) => { evento.preventDefault(); setArrastando(false); tratarArquivo(evento); }}
      >
        <div className={`flex size-12 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-200 transition motion-reduce:transition-none ${disabled ? "opacity-60" : "group-hover:scale-105 motion-reduce:group-hover:scale-100"}`}>
          {loading ? <Loader2 className="size-6 animate-spin motion-reduce:animate-none" /> : <UploadCloud className="size-6" />}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100">{loading ? "Inspecionando arquivo…" : "Arraste e solte ou selecione"}</p>
          <p className="mt-1 text-xs text-slate-400">{loading ? "Aguarde a validação deste arquivo." : `Clique ou pressione Enter · máximo ${LIMITE_ARQUIVO_MB} MB`}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {FORMATOS.map((formato) => <span key={formato} className="rounded-md border border-white/10 bg-slate-950/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{formato}</span>)}
        </div>
      </button>
      <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={(evento) => tratarArquivo(evento)} disabled={disabled} />
    </div>
  );
}
