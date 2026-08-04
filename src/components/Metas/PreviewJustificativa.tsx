"use client";

import { ExternalLink } from "lucide-react";
import type { JustificativaMetaItem } from "@/actions/JustificativaMeta";

function formatarTamanho(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarData(iso: string): string {
    return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

interface PreviewJustificativaProps {
    item: JustificativaMetaItem;
    altura: string;
    tituloIframe: string;
    mostrarMetadados?: boolean;
    /** Quando true, remove completamente a barra de nome do arquivo + link "Nova aba" — usado na visualização minimalista do usuário comum. */
    ocultarBarraSuperior?: boolean;
}

export function PreviewJustificativa({
    item,
    altura,
    tituloIframe,
    mostrarMetadados = true,
    ocultarBarraSuperior = false,
}: PreviewJustificativaProps) {
    return (
        <div className="space-y-2">
            {!ocultarBarraSuperior && (
                <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                        {mostrarMetadados
                            ? `${item.nomeArquivo} · ${formatarTamanho(item.tamanhoBytes)} · enviado por ${item.enviadoPorNome} em ${formatarData(item.createdAt)}`
                            : item.nomeArquivo}
                    </span>
                    <a
                        href={`/api/metas/justificativas/${item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
                    >
                        <ExternalLink size={12} /> Nova aba
                    </a>
                </div>
            )}
            {/* #toolbar=0 oculta a barra nativa (baixar/imprimir) do visualizador de PDF embutido no Chrome/Edge — não é bloqueio de segurança, apenas reduz atrito visual; outros navegadores/SOs podem ignorar o parâmetro. */}
            <iframe
                src={`/api/metas/justificativas/${item.id}#toolbar=0`}
                className={`${altura} w-full rounded-2xl border border-white/5 bg-white`}
                title={tituloIframe}
            />
        </div>
    );
}
