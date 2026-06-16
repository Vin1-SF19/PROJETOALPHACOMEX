"use client";

import { BarChart2, Users, Package, FileText, AlertCircle, TrendingUp } from "lucide-react";
import { type LucideIcon } from "lucide-react";

interface Suggestion {
  icon: LucideIcon;
  label: string;
  desc: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: BarChart2,
    label: "Resumo financeiro",
    desc: "Extrato desta semana",
    prompt: "Me dê um resumo do extrato financeiro desta semana.",
  },
  {
    icon: Users,
    label: "Consultar cliente",
    desc: "Dados e situação",
    prompt: "Preciso consultar informações sobre o cliente ",
  },
  {
    icon: Package,
    label: "Verificar estoque",
    desc: "Status de produto",
    prompt: "Qual é o status atual do estoque de ",
  },
  {
    icon: FileText,
    label: "Gerar relatório",
    desc: "Exportar dados",
    prompt: "Gere um relatório de ",
  },
  {
    icon: AlertCircle,
    label: "Chamados abertos",
    desc: "Pendentes agora",
    prompt: "Quais chamados estão em aberto agora?",
  },
  {
    icon: TrendingUp,
    label: "Análise de dados",
    desc: "Tendências e insights",
    prompt: "Analise os dados de ",
  },
];

export default function BibblePromptSuggestions({
  onSelect,
}: {
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full px-5">
      {SUGGESTIONS.map(s => {
        const Icon = s.icon;
        return (
          <button
            key={s.label}
            onClick={() => onSelect(s.prompt)}
            className="
              group flex flex-col gap-2.5 px-3.5 py-3.5 rounded-xl text-left
              bg-white/[0.03] border border-white/[0.06]
              hover:bg-white/[0.06] hover:border-white/[0.10]
              active:scale-[0.98]
              transition-all duration-150
            "
          >
            <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center group-hover:border-blue-500/20 group-hover:bg-blue-600/10 transition-all">
              <Icon size={13} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-slate-300 truncate group-hover:text-white transition-colors">
                {s.label}
              </p>
              <p className="text-[10px] text-slate-600 truncate mt-0.5">
                {s.desc}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
