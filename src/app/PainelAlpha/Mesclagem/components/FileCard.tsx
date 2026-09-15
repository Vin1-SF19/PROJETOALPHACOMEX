"use client";

import { useRef } from "react";
import { CheckCircle2, FileSpreadsheet, RefreshCw, Trash2 } from "lucide-react";
import type { InspecaoPlanilha } from "@/lib/mesclagem";
import { StatusBadge } from "./StatusBadge";
import { UploadDropzone } from "./UploadDropzone";

type FileCardTone = "blue" | "violet" | "red";

interface FileCardProps {
  title: string;
  description: string;
  tone: FileCardTone;
  arquivo?: File;
  inspecao?: InspecaoPlanilha;
  carregando?: boolean;
  erro?: string | null;
  accept: string;
  disabled?: boolean;
  onFile: (arquivo: File) => void;
  onRemove: () => void;
  onRetry?: () => void;
}

const TONE: Record<FileCardTone, { icon: string; badge: string; glow: string }> = {
  blue: { icon: "text-sky-300", badge: "border-sky-400/25 bg-sky-500/10 text-sky-200", glow: "ring-1 ring-sky-400/25 shadow-xl" },
  violet: { icon: "text-violet-300", badge: "border-violet-400/25 bg-violet-500/10 text-violet-200", glow: "ring-1 ring-violet-400/25 shadow-xl" },
  red: { icon: "text-rose-300", badge: "border-rose-400/25 bg-rose-500/10 text-rose-200", glow: "ring-1 ring-rose-400/25 shadow-xl" },
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileCard({ title, description, tone, arquivo, inspecao, carregando, erro, accept, disabled, onFile, onRemove, onRetry }: FileCardProps) {
  const inputTrocaRef = useRef<HTMLInputElement>(null);
  const estilo = TONE[tone];
  const totalLinhas = inspecao?.abas.reduce((soma, aba) => soma + aba.totalLinhas, 0) ?? 0;

  return (
    <article className={`rounded-2xl border border-indigo-400/15 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl ${arquivo ? estilo.glow : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex size-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 ${estilo.icon}`}>
            <FileSpreadsheet className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-50">{title}</h3>
            <p className="text-xs leading-relaxed text-slate-400">{description}</p>
          </div>
        </div>
        {carregando ? <StatusBadge label="Carregando" variant="info" /> : erro ? <StatusBadge label="Falhou" variant="error" icon="x" /> : arquivo ? <StatusBadge label="Carregado" variant="ok" icon="check" /> : <StatusBadge label="Pendente" variant="muted" />}
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-slate-950/50 p-4">
        {arquivo && inspecao && !carregando ? (
          <div className="space-y-3">
            <p className="truncate text-sm font-semibold text-slate-100" title={arquivo.name}>{arquivo.name}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="block text-slate-500">Tamanho</span><span className="font-semibold text-slate-200">{formatarTamanho(arquivo.size)}</span></div>
              <div><span className="block text-slate-500">Formato</span><span className="font-semibold uppercase text-slate-200">{inspecao.extensao.replace(".", "")}</span></div>
              <div><span className="block text-slate-500">Linhas</span><span className="font-semibold text-slate-200">{totalLinhas.toLocaleString("pt-BR")}</span></div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="size-4" />
              Arquivo reconhecido e pronto para mesclagem.
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => inputTrocaRef.current?.click()} disabled={disabled} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:border-indigo-400/30 disabled:opacity-50">
                Trocar arquivo
              </button>
              <button type="button" onClick={onRemove} disabled={disabled} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/20 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50">
                <Trash2 className="size-3.5" /> Remover
              </button>
              <input ref={inputTrocaRef} type="file" accept={accept} className="sr-only" onChange={(evento) => { const selecionado = evento.target.files?.[0]; if (selecionado) onFile(selecionado); evento.target.value = ""; }} disabled={disabled} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <UploadDropzone accept={accept} onFile={onFile} disabled={disabled} loading={carregando} label={`Selecionar ${title.toLowerCase()}`} />
            {erro && (
              <div role="alert" className="flex flex-col gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100 sm:flex-row sm:items-center sm:justify-between">
                <span>{erro}</span>
                {onRetry && (
                  <button type="button" onClick={onRetry} disabled={disabled} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rose-300/25 px-3 py-2 font-bold hover:bg-rose-400/10 disabled:opacity-50">
                    <RefreshCw className="size-3.5" /> Tentar novamente
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
