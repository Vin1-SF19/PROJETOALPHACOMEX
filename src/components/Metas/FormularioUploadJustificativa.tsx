"use client";

import { Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreviewArquivoLocal } from "@/components/Metas/PreviewArquivoLocal";

interface FormularioUploadJustificativaProps {
    arquivoSelecionado: File | null;
    enviando: boolean;
    onSelecionarArquivo: (file: File | null) => void;
    onEnviar: () => void;
}

export function FormularioUploadJustificativa({
    arquivoSelecionado,
    enviando,
    onSelecionarArquivo,
    onEnviar,
}: FormularioUploadJustificativaProps) {
    return (
        <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                    <UploadCloud size={16} className="text-amber-400" />
                    <span>{arquivoSelecionado ? arquivoSelecionado.name : "Selecionar PDF"}</span>
                    <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => onSelecionarArquivo(e.target.files?.[0] ?? null)}
                    />
                </label>
                <Button
                    onClick={onEnviar}
                    disabled={!arquivoSelecionado || enviando}
                    className="bg-amber-600/20 text-amber-300 hover:bg-amber-600/30"
                >
                    {enviando ? <Loader2 size={14} className="animate-spin" /> : "Enviar"}
                </Button>
            </div>
            {arquivoSelecionado && <PreviewArquivoLocal arquivo={arquivoSelecionado} />}
        </div>
    );
}
