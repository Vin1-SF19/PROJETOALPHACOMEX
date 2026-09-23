"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

type StatusConsulta = "idle" | "loading" | "success" | "error";

interface Props {
    label: string;
    status: StatusConsulta;
    icon: React.ReactNode;
    onRetry: () => void;
}

export default function ProgressCard({ label, status, icon, onRetry }: Props) {
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isError = status === "error";
    const isLoading = status === "loading";
    const isSuccess = status === "success";

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        if (status === "loading") {
            intervalRef.current = setInterval(() => {
                setProgress(prev => {
                    const next = prev + Math.random() * 14 + 4;
                    if (next >= 87) { clearInterval(intervalRef.current!); return 87; }
                    return next;
                });
            }, 220);
        }

        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [status]);

    const pct = status === "idle" ? 0 : status === "loading" ? Math.round(Math.min(progress, 87)) : 100;

    return (
        <div className={`relative overflow-hidden rounded-3xl border transition-all duration-500 ${
            isSuccess ? "bg-emerald-500/5 border-emerald-500/25" :
            isError   ? "bg-rose-500/5 border-rose-500/25" :
                        "bg-white/[0.03] border-white/10"
        }`}>
            {/* Barra de progresso no topo — dentro do overflow-hidden */}
            <div className="absolute top-0 left-0 h-[3px] w-full bg-white/5">
                <div
                    className={`h-full transition-all duration-500 ease-out ${
                        isSuccess ? "bg-emerald-500" :
                        isError   ? "bg-rose-500" :
                                    "bg-indigo-500"
                    }`}
                    style={{ width: `${pct}%` }}
                />
            </div>

            <div className="pt-10 pb-8 px-8 flex flex-col items-center text-center gap-5">
                {/* Ícone */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                    isSuccess ? "bg-emerald-500/20 text-emerald-400" :
                    isError   ? "bg-rose-500/20 text-rose-400" :
                    isLoading ? "bg-indigo-500/15 text-indigo-400" :
                                "bg-slate-800/80 text-slate-500"
                }`}>
                    {isLoading ? <RefreshCw size={26} className="animate-spin" /> : icon}
                </div>

                {/* Contador */}
                <div className="flex items-end gap-0.5">
                    <span className={`text-6xl font-black tabular-nums leading-none transition-colors duration-300 ${
                        isSuccess ? "text-emerald-400" :
                        isError   ? "text-rose-400" :
                        isLoading ? "text-white" :
                                    "text-slate-700"
                    }`}>{pct}</span>
                    <span className="text-2xl font-black text-slate-600 mb-1">%</span>
                </div>

                {/* Label e status */}
                <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">{label}</p>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${
                        isSuccess ? "text-emerald-400" :
                        isError   ? "text-rose-400" :
                        isLoading ? "text-indigo-300" :
                                    "text-slate-600"
                    }`}>
                        {status === "idle" && "Aguardando..."}
                        {isLoading && "Consultando..."}
                        {isSuccess && "✓ Concluído"}
                        {isError && "✗ Erro na consulta"}
                    </p>
                </div>

                {isError && (
                    <button
                        onClick={onRetry}
                        className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 transition-all active:scale-95"
                    >
                        <RefreshCw size={12} /> Tentar Novamente
                    </button>
                )}
            </div>
        </div>
    );
}
