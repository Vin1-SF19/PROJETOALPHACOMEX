"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { RefreshCw, FileDown, Plus, Settings, AlertTriangle, Loader2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SincronizarComissoes } from "@/actions/CommissionSync";
import { ModalExportarEspelho } from "../Exportacao/ModalExportarEspelho";
import type { TemaAlpha } from "@/lib/temas";

interface CabecalhoComissoesProps {
  tema: TemaAlpha;
  onSincronizado?: () => void;
  /** Contagem de divergências pendentes — mostrada como badge no botão, se > 0. Sem chamada assíncrona própria (reaproveita CalcularIndicadoresComissao já carregado pelo dashboard). */
  totalDivergencias?: number;
}

/** Botão desabilitado com aria-label explicando o motivo — funcionalidades das fases 11-14. */
function BotaoEmBreve({ icone: Icone, label }: { icone: typeof FileDown; label: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled
      aria-label={`${label} — em breve`}
      title={`${label} — em breve`}
      className="gap-2 border-white/10 text-slate-500"
    >
      <Icone className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

export function CabecalhoComissoes({ tema, onSincronizado, totalDivergencias = 0 }: CabecalhoComissoesProps) {
  const [isPending, startTransition] = useTransition();
  const [sincronizando, setSincronizando] = useState(false);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);

  function sincronizar() {
    setSincronizando(true);
    startTransition(async () => {
      const resultado = await SincronizarComissoes({ triggeredBy: "manual" });
      setSincronizando(false);

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao sincronizar");
        return;
      }

      toast.success(
        `Sincronização concluída: ${resultado.data.totalProcessed} evento(s) processado(s)${
          resultado.data.totalErrors > 0 ? `, ${resultado.data.totalErrors} erro(s)` : ""
        }.`,
      );
      onSincronizado?.();
    });
  }

  return (
    <header className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
      <div>
        <h1 className="text-2xl font-black uppercase italic tracking-tight text-white sm:text-3xl">
          Gestão de Comissões e Prêmios
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Controle de fatos geradores, cálculos, pagamentos e espelhos
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={sincronizar}
          disabled={isPending || sincronizando}
          className="gap-2"
          style={{ backgroundColor: `rgb(${tema.accent})` }}
        >
          {sincronizando ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          Sincronizar
        </Button>

        <Button size="sm" variant="outline" className="gap-2 border-white/10" asChild>
          <Link href="/PainelAlpha/Comissoes/Simulador">
            <Calculator className="size-4" aria-hidden="true" />
            Simulador
          </Link>
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-white/10"
          onClick={() => setModalExportarAberto(true)}
        >
          <FileDown className="size-4" aria-hidden="true" />
          Exportar Espelho
        </Button>

        <BotaoEmBreve icone={Plus} label="Novo Lançamento" />

        <Button size="sm" variant="outline" className="gap-2 border-white/10" asChild>
          <Link href="/PainelAlpha/Comissoes/Configuracoes">
            <Settings className="size-4" aria-hidden="true" />
            Configurações
          </Link>
        </Button>

        <Button size="sm" variant="outline" className="gap-2 border-white/10" asChild>
          <Link href="/PainelAlpha/Comissoes/Divergencias">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Divergências
            {totalDivergencias > 0 && (
              <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-rose-400">
                {totalDivergencias}
              </span>
            )}
          </Link>
        </Button>
      </div>

      <ModalExportarEspelho open={modalExportarAberto} onOpenChange={setModalExportarAberto} />
    </header>
  );
}
