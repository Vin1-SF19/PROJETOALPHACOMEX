"use client";

import type { JustificativaMetaItem } from "@/actions/JustificativaMeta";

const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarData(iso: string): string {
    return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

interface ListaHistoricoJustificativasProps {
    historico: JustificativaMetaItem[];
    onSelecionar: (item: JustificativaMetaItem) => void;
}

export function ListaHistoricoJustificativas({ historico, onSelecionar }: ListaHistoricoJustificativasProps) {
    return (
        <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
            {historico.map((item) => (
                <li key={item.id}>
                    <button
                        onClick={() => onSelecionar(item)}
                        className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left text-sm transition-all hover:border-amber-500/30 hover:bg-amber-500/5"
                    >
                        <span className="font-semibold text-slate-200">
                            {MESES[item.mes - 1]}/{item.ano}
                        </span>
                        <span className="text-xs text-slate-500">
                            {item.enviadoPorNome} · {formatarData(item.createdAt)}
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
}
