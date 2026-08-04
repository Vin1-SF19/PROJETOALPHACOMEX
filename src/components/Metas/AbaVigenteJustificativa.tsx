"use client";

import { Loader2, Trash2 } from "lucide-react";
import { PreviewJustificativa } from "@/components/Metas/PreviewJustificativa";
import { FormularioUploadJustificativa } from "@/components/Metas/FormularioUploadJustificativa";
import { SeletorPeriodoJustificativa } from "@/components/Metas/SeletorPeriodoJustificativa";
import type { JustificativaMetaItem } from "@/actions/JustificativaMeta";

interface AbaVigenteJustificativaProps {
    mes: number;
    ano: number;
    anos: number[];
    onMesChange: (mes: number) => void;
    onAnoChange: (ano: number) => void;
    arquivoSelecionado: File | null;
    enviando: boolean;
    onSelecionarArquivo: (file: File | null) => void;
    onEnviar: () => void;
    carregandoVigente: boolean;
    itemExibido: JustificativaMetaItem | null;
    vigente: JustificativaMetaItem | null;
    mesLabel: string;
    onSolicitarExclusao: () => void;
}

export function AbaVigenteJustificativa({
    mes,
    ano,
    anos,
    onMesChange,
    onAnoChange,
    arquivoSelecionado,
    enviando,
    onSelecionarArquivo,
    onEnviar,
    carregandoVigente,
    itemExibido,
    vigente,
    mesLabel,
    onSolicitarExclusao,
}: AbaVigenteJustificativaProps) {
    return (
        <div className="space-y-4">
            <SeletorPeriodoJustificativa
                mes={mes}
                ano={ano}
                anos={anos}
                onMesChange={onMesChange}
                onAnoChange={onAnoChange}
            />

            <FormularioUploadJustificativa
                arquivoSelecionado={arquivoSelecionado}
                enviando={enviando}
                onSelecionarArquivo={onSelecionarArquivo}
                onEnviar={onEnviar}
            />

            {carregandoVigente ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
                </div>
            ) : itemExibido ? (
                <div className="space-y-2">
                    <PreviewJustificativa
                        item={itemExibido}
                        altura="h-[55vh]"
                        tituloIframe="Justificativa de Meta"
                        ocultarBarraSuperior
                    />
                    {vigente && (
                        <button
                            onClick={onSolicitarExclusao}
                            className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-600/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-rose-400 transition-all hover:bg-rose-600/20"
                        >
                            <Trash2 size={14} />
                            Excluir permanentemente
                        </button>
                    )}
                </div>
            ) : (
                <p className="py-8 text-center text-sm text-slate-500">
                    Nenhuma justificativa enviada para {mesLabel}/{ano}.
                </p>
            )}
        </div>
    );
}
