"use client";

import { Loader2 } from "lucide-react";
import { PreviewJustificativa } from "@/components/Metas/PreviewJustificativa";
import type { JustificativaMetaItem } from "@/actions/JustificativaMeta";

interface VisualizacaoSimplesJustificativaProps {
    carregando: boolean;
    vigente: JustificativaMetaItem | null;
    mesLabel: string;
    ano: number;
}

export function VisualizacaoSimplesJustificativa({
    carregando,
    vigente,
    mesLabel,
    ano,
}: VisualizacaoSimplesJustificativaProps) {
    if (carregando) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
            </div>
        );
    }

    if (!vigente) {
        return (
            <p className="py-8 text-center text-sm text-slate-500">
                Nenhuma justificativa enviada para {mesLabel}/{ano} ainda.
            </p>
        );
    }

    return (
        <PreviewJustificativa
            item={vigente}
            altura="h-[65vh]"
            tituloIframe="Justificativa de Meta"
            ocultarBarraSuperior
        />
    );
}
