"use client";
import Image from "next/image";
import { UsersRound, UserRound } from "lucide-react";
import type { Analista } from "@/lib/checklist/client/types";
import { iniciais } from "@/lib/checklist/client/types";
import { cn } from "@/lib/utils";
interface Props {
  analistas: Analista[];
  selecionado: number | null;
  onSelect: (id: number | null) => void;
}
export function AnalistasSidebar({ analistas, selecionado, onSelect }: Props) {
  return (
    <nav aria-label="Analistas" className="space-y-2">
      <div className="mb-5 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <UsersRound size={15} />
        Analistas
      </div>
      <button
        onClick={() => onSelect(null)}
        aria-current={selecionado === null ? "page" : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-[var(--checklist-accent)]",
          selecionado === null ? "bg-[var(--checklist-accent)]/20 text-white" : "text-slate-300 hover:bg-white/5",
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/10">
          <UsersRound size={17} />
        </span>
        <span className="flex-1">Todos os analistas</span>
      </button>
      <div className="my-3 border-t border-white/10" />
      {analistas.map((a) => (
        <button
          key={a.id}
          onClick={() => onSelect(a.id)}
          aria-current={selecionado === a.id ? "page" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-[var(--checklist-accent)]",
            selecionado === a.id ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5",
          )}
        >
          <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-800 text-xs font-semibold">
            {a.imagemUrl ? <Image src={a.imagemUrl} alt="" fill className="object-cover" /> : iniciais(a.nome) || <UserRound size={15} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{a.nome}</span>
            {(!a.ativo || a.legado) && <span className="text-[10px] text-slate-500">Histórico · {a.ativo ? "setor anterior" : "inativo"}</span>}
          </span>
          <span className="rounded-lg bg-white/5 px-2 py-1 text-xs tabular-nums text-slate-400">{a.totalEmpresas}</span>
        </button>
      ))}
    </nav>
  );
}
