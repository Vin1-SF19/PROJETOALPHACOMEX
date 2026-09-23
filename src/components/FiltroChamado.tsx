"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, AlertCircle, Clock, CheckCircle2 } from "lucide-react";

export function FiltroChamadosCards({ 
  total, 
  abertos, 
  emCurso, 
  finalizados 
}: { 
  total: number; 
  abertos: number; 
  emCurso: number; 
  finalizados: number; 
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusAtual = searchParams.get("status") || "TODOS";

  const cards = [
    { label: "Volume Total", value: "TODOS", count: total, color: "blue", icon: LayoutDashboard },
    { label: "Pendentes", value: "ABERTO", count: abertos, color: "amber", icon: AlertCircle },
    { label: "Em Resposta", value: "EM_ATENDIMENTO", count: emCurso, color: "purple", icon: Clock },
    { label: "Concluídos", value: "CONCLUIDO", count: finalizados, color: "emerald", icon: CheckCircle2 },
  ];

  const handleFiltro = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString());
    valor === "TODOS" ? params.delete("status") : params.set("status", valor);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const styles: Record<string, { border: string; active: string; text: string }> = {
    blue: { border: "border-blue-500/20", active: "bg-blue-600/20 border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.3)] ring-1 ring-blue-500", text: "text-blue-400" },
    amber: { border: "border-amber-500/20", active: "bg-amber-600/20 border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)] ring-1 ring-amber-500", text: "text-amber-400" },
    purple: { border: "border-purple-500/20", active: "bg-purple-600/20 border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.3)] ring-1 ring-purple-500", text: "text-purple-400" },
    emerald: { border: "border-emerald-500/20", active: "bg-emerald-600/20 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500", text: "text-emerald-400" }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-10">
      {cards.map((card) => {
        const ativo = statusAtual === card.value;
        const Icon = card.icon;
        const style = styles[card.color];

        return (
          <button
            key={card.value}
            onClick={() => handleFiltro(card.value)}
            className={`relative p-8 rounded-[2.5rem] border backdrop-blur-xl flex items-center justify-between transition-all duration-300 group active:scale-95 cursor-pointer overflow-hidden ${ativo ? style.active : `bg-slate-900/20 ${style.border} hover:border-white/20`}`}
          >
            <div className="relative z-10">
              <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 transition-colors ${ativo ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}>
                {card.label}
              </p>
              <div className="flex items-baseline gap-2">
                <h4 className="text-4xl font-black text-white tracking-tighter italic">
                  {card.count}
                </h4>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border transition-all duration-500 relative z-10 ${ativo ? "bg-white/10 border-white/20 scale-110 rotate-6 text-white" : `bg-white/5 border-white/5 group-hover:scale-110 ${style.text}`}`}>
              <Icon size={20} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
