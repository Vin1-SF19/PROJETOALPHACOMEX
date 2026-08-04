"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface SeletorPeriodoJustificativaProps {
    mes: number;
    ano: number;
    anos: number[];
    onMesChange: (mes: number) => void;
    onAnoChange: (ano: number) => void;
}

export function SeletorPeriodoJustificativa({
    mes,
    ano,
    anos,
    onMesChange,
    onAnoChange,
}: SeletorPeriodoJustificativaProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={String(mes)} onValueChange={(v) => onMesChange(Number(v))}>
                <SelectTrigger className="w-full border-white/10 bg-white/5 text-slate-200 sm:w-48">
                    <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                    {MESES.map((nome, i) => (
                        <SelectItem key={nome} value={String(i + 1)}>{nome}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={String(ano)} onValueChange={(v) => onAnoChange(Number(v))}>
                <SelectTrigger className="w-full border-white/10 bg-white/5 text-slate-200 sm:w-32">
                    <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                    {anos.map((a) => (
                        <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export { MESES };
