import { CheckCircle2, XCircle } from "lucide-react";

type StatusBadgeVariant = "ok" | "warn" | "error" | "info" | "muted";

interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  icon?: "check" | "alert" | "x" | null;
}

const STYLES: Record<StatusBadgeVariant, string> = {
  ok: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  warn: "border-amber-400/25 bg-amber-500/10 text-amber-200",
  error: "border-rose-400/25 bg-rose-500/10 text-rose-200",
  info: "border-indigo-400/25 bg-indigo-500/10 text-indigo-200",
  muted: "border-slate-400/20 bg-slate-500/10 text-slate-300",
};

export function StatusBadge({ label, variant = "info", icon = null }: StatusBadgeProps) {
  const Icon = icon === "check" ? CheckCircle2 : icon === "x" ? XCircle : null;

  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STYLES[variant]}`}>
      {Icon ? <Icon className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}
