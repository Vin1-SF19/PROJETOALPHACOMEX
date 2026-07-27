"use client";

import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BlueprintFiltersProps {
  busca: string;
  onBuscaChange: (v: string) => void;
  prioridade: string;
  onPrioridadeChange: (v: string) => void;
}

export function BlueprintFilters({ busca, onBuscaChange, prioridade, onPrioridadeChange }: BlueprintFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Buscar projetos..."
          className="w-full rounded-xl bg-slate-900/60 border border-white/10 pl-8 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
        />
      </div>

      <Select value={prioridade || "TODAS"} onValueChange={(v) => onPrioridadeChange(v === "TODAS" ? "" : v)}>
        <SelectTrigger className="w-36 bg-slate-900/60 border-white/10 text-white text-sm rounded-xl">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TODAS">Todas prioridades</SelectItem>
          <SelectItem value="BAIXA">Baixa</SelectItem>
          <SelectItem value="NORMAL">Normal</SelectItem>
          <SelectItem value="ALTA">Alta</SelectItem>
          <SelectItem value="URGENTE">Urgente</SelectItem>
          <SelectItem value="CRITICA">Crítica</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
