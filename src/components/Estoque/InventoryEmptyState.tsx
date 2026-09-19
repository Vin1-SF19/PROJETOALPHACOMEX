import type { LucideIcon } from "lucide-react";

interface InventoryEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function InventoryEmptyState({ icon: Icon, title, description }: InventoryEmptyStateProps) {
  return (
    <div className="estoque-empty grid min-h-64 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <div>
        <div className="estoque-card-icon mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-300">
          <Icon size={23} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
