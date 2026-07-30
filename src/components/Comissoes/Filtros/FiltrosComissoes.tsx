"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
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

const MESES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function mesReferenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function deslocarMes(mesReferencia: string, delta: number): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1 + delta, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

function labelMesReferencia(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  return `${MESES_LABEL[mes - 1]} de ${ano}`;
}

interface FiltrosComissoesProps {
  onBuscaChange: (busca: string) => void;
  onMesReferenciaChange: (mesReferencia: string) => void;
}

/**
 * Busca com debounce (~400ms, mesmo padrão de TabelaTransacoesPaginada.tsx) por CNPJ,
 * razão social, nome fantasia, serviço, colaborador e cargo. Seletor de mês (seção 1 do
 * desenho do usuário) sempre visível na barra — navega mês a mês, sem precisar abrir o
 * painel de filtros extras (Sheet).
 */
export function FiltrosComissoes({ onBuscaChange, onMesReferenciaChange }: FiltrosComissoesProps) {
  const [buscaInput, setBuscaInput] = useState("");
  const [mesReferencia, setMesReferencia] = useState(mesReferenciaAtual);
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

  function mudarMes(delta: number) {
    const novo = deslocarMes(mesReferencia, delta);
    setMesReferencia(novo);
    onMesReferenciaChange(novo);
  }

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-2">
        <button
          type="button"
          onClick={() => mudarMes(-1)}
          aria-label="Mês anterior"
          className="text-slate-500 hover:text-slate-200"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-40 text-center text-sm font-medium text-slate-200">
          {labelMesReferencia(mesReferencia)}
        </span>
        <button
          type="button"
          onClick={() => mudarMes(1)}
          aria-label="Próximo mês"
          className="text-slate-500 hover:text-slate-200"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                Filtros por contratação/êxito, comissão/prêmio/DSR, CLT/PJ, setor, cargo,
                colaborador, forma de pagamento e status serão adicionados conforme
                necessário. O filtro de período (mês) já está disponível no seletor acima.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
