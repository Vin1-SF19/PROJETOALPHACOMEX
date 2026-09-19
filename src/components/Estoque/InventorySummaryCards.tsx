import { AlertTriangle, Boxes, PackageCheck, UserRoundCheck } from "lucide-react";
import type { InventorySummary } from "@/lib/estoque/types";

interface InventorySummaryCardsProps {
  summary: InventorySummary;
}

const cards = [
  { key: "itensCadastrados", label: "Itens cadastrados", icon: Boxes, color: "text-blue-300 bg-blue-400/10" },
  { key: "disponiveis", label: "Disponíveis", icon: PackageCheck, color: "text-emerald-300 bg-emerald-400/10" },
  { key: "emUso", label: "Em uso", icon: UserRoundCheck, color: "text-violet-300 bg-violet-400/10" },
  { key: "estoqueBaixo", label: "Estoque baixo", icon: AlertTriangle, color: "text-amber-300 bg-amber-400/10" },
] as const;

export function InventorySummaryCards({ summary }: InventorySummaryCardsProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo do estoque">
      {cards.map(({ key, label, icon: Icon, color }) => (
        <article key={key} className="estoque-card rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-white">{summary[key]}</p>
            </div>
            <span className={`estoque-card-icon grid size-10 place-items-center rounded-xl ${color}`}><Icon size={19} aria-hidden="true" /></span>
          </div>
        </article>
      ))}
    </section>
  );
}
