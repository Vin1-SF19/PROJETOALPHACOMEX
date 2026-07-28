"use client";

import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const DEBOUNCE_MS = 400;

interface FiltrosComissoesProps {
  onBuscaChange: (busca: string) => void;
}

/**
 * Busca com debounce (~400ms, mesmo padrão de TabelaTransacoesPaginada.tsx) por CNPJ,
 * razão social, nome fantasia, serviço, colaborador e cargo. Painel de filtros extras
 * (período, setor, CLT/PJ, status etc.) fica em um Sheet (drawer) — mobile-first.
 */
export function FiltrosComissoes({ onBuscaChange }: FiltrosComissoesProps) {
  const [buscaInput, setBuscaInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onBuscaChange(buscaInput);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [buscaInput, onBuscaChange]);

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <Input
          value={buscaInput}
          onChange={(e) => setBuscaInput(e.target.value)}
          placeholder="Buscar por CNPJ, razão social, serviço, colaborador ou cargo..."
          className="border-white/10 bg-slate-900/40 pl-9 text-slate-200 placeholder:text-slate-500"
          aria-label="Buscar eventos de comissão"
        />
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 border-white/10">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtros
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="border-white/10 bg-slate-950">
          <SheetHeader>
            <SheetTitle className="text-slate-200">Filtros</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-4 text-sm text-slate-400">
            <p>
              Filtros por período, contratação/êxito, comissão/prêmio/DSR, CLT/PJ, setor,
              cargo, colaborador, serviço, forma de pagamento e status serão adicionados
              conforme as fases de Configurações e Divergências forem implementadas.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
