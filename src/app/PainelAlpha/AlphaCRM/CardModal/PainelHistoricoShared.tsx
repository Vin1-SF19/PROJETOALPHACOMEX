import type { ReactNode } from "react";
import {
  ArrowRightLeft,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  History,
  ListTodo,
  Paperclip,
  Pencil,
  Repeat,
  Zap,
} from "lucide-react";

interface SectionCardProps {
  icon: typeof History;
  title: string;
  count?: number;
  accent: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SectionCard({ icon: Icon, title, count, accent, defaultOpen, children }: SectionCardProps) {
  return (
    <details
      open={defaultOpen}
      className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm transition-colors hover:border-white/10"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `rgba(${accent},0.15)` }}
          >
            <Icon size={13} style={{ color: `rgb(${accent})` }} />
          </div>
          <span className="text-xs font-bold uppercase tracking-wide text-white">{title}</span>
          {typeof count === "number" && count > 0 && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">{count}</span>
          )}
        </div>
        <ChevronDown size={14} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/[0.04] px-4 pb-4 pt-1">{children}</div>
    </details>
  );
}

export function formatarBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function iconePorAcao(acao: string): typeof History {
  if (acao.startsWith("CARD_MOVIDO")) return ArrowRightLeft;
  if (acao === "CARD_ATUALIZADO" || acao === "MEMBROS_ATUALIZADOS") return Pencil;
  if (acao.startsWith("TAREFA_") || acao === "PRESET_APLICADO") return ListTodo;
  if (acao.startsWith("REUNIAO_")) return CalendarClock;
  if (acao.startsWith("CHECKLIST_")) return CheckCircle2;
  if (acao.startsWith("ANEXO_")) return Paperclip;
  if (acao.startsWith("CADENCIA_")) return Repeat;
  if (acao.startsWith("AUTOMACAO") || acao === "DISTRIBUICAO_AUTOMATICA" || acao === "ENVIAR_EMAIL") return Zap;
  if (acao.startsWith("STANDBY_")) return Bot;
  return History;
}

export function formatarValorHistorico(valor: string | null | undefined): string | null {
  if (!valor) return null;
  try {
    const parsed: unknown = JSON.parse(valor);
    if (typeof parsed === "string") return parsed;
    return JSON.stringify(parsed);
  } catch {
    return valor;
  }
}
