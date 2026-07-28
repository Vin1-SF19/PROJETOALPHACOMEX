import { corDoStatus, STATUS_LABELS } from "./formatters";

const DOT_COR: Record<ReturnType<typeof corDoStatus>, string> = {
  verde: "bg-emerald-400",
  amarelo: "bg-amber-400",
  vermelho: "bg-rose-400",
  neutro: "bg-slate-400",
};

const TEXTO_COR: Record<ReturnType<typeof corDoStatus>, string> = {
  verde: "text-emerald-400",
  amarelo: "text-amber-400",
  vermelho: "text-rose-400",
  neutro: "text-slate-400",
};

/** Status SEMPRE como dot colorido + label textual — nunca só cor (regra de acessibilidade). */
export function StatusBadge({ status }: { status: string }) {
  const cor = corDoStatus(status);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`size-1.5 rounded-full ${DOT_COR[cor]}`} aria-hidden="true" />
      <span className={TEXTO_COR[cor]}>{STATUS_LABELS[status] ?? status}</span>
    </span>
  );
}
