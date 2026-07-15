"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

const NOME_ARQUIVO_PADRAO = "cs-nps-exportacao.xlsx";

function obterNomeArquivo(contentDisposition: string | null): string {
    if (!contentDisposition) return NOME_ARQUIVO_PADRAO;

    const nomeUtf8 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    if (nomeUtf8) {
        try {
            return decodeURIComponent(nomeUtf8).replace(/[\\/:*?"<>|]/g, "-");
        } catch {
            return NOME_ARQUIVO_PADRAO;
        }
    }

    const nomeSimples = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
    return nomeSimples?.replace(/[\\/:*?"<>|]/g, "-") || NOME_ARQUIVO_PADRAO;
}

async function obterMensagemErro(response: Response): Promise<string> {
    if (response.status === 401) return "Sua sessão expirou. Entre novamente para exportar os dados.";
    if (response.status === 403) return "Você não tem permissão para exportar os dados de CS & NPS.";

    try {
        const body: unknown = await response.json();
        if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
            return body.error;
        }
    } catch {
        // Respostas sem JSON usam a mensagem segura abaixo.
    }

    return "Não foi possível gerar a planilha. Tente novamente.";
}

export function BotaoExportarDados() {
    const [isExportando, setIsExportando] = useState(false);

    async function exportarDados() {
        if (isExportando) return;

        setIsExportando(true);
        try {
            const response = await fetch("/api/cs-nps/exportar", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
            });

            if (!response.ok) {
                toast.error(await obterMensagemErro(response));
                return;
            }

            const arquivo = await response.blob();
            if (arquivo.size === 0) {
                toast.error("Não há dados disponíveis para exportação.");
                return;
            }

            const url = URL.createObjectURL(arquivo);
            const link = document.createElement("a");
            link.href = url;
            link.download = obterNomeArquivo(response.headers.get("content-disposition"));
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            toast.success("Planilha exportada com sucesso.");
        } catch {
            toast.error("Falha na conexão ao exportar os dados. Tente novamente.");
        } finally {
            setIsExportando(false);
        }
    }

    return (
        <button
            type="button"
            onClick={exportarDados}
            disabled={isExportando}
            aria-label={isExportando ? "Exportando dados de CS e NPS" : "Exportar todos os dados de CS e NPS"}
            aria-busy={isExportando}
            className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        >
            {isExportando ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
                <Download size={16} aria-hidden="true" />
            )}
            {isExportando ? "Exportando..." : "Exportar dados"}
        </button>
    );
}
