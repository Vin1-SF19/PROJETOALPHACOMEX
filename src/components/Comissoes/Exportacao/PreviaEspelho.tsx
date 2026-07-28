"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "../lib/status-badge";
import { formatarCentavosBRL, formatarDataComissao } from "../lib/formatters";
import { ConfirmarExportacao } from "@/actions/CommissionExports";
import type { PreviewResult } from "@/lib/commissions/export/preview-builder";
import type { TipoEspelho } from "@/lib/commissions/export/preview-builder";

interface PreviaEspelhoProps {
  preview: PreviewResult;
  filtros: {
    tipo: TipoEspelho;
    colaboradorId?: number;
    periodoInicio: Date;
    periodoFim: Date;
    status?: string;
  };
}

/**
 * TODO(expansão futura — seção 22 do prompt original): esta prévia ainda não permite
 * remover linha, corrigir data/valor, adicionar observação, inserir lançamento manual,
 * reorganizar linhas ou escolher colunas. Implementar quando o fluxo de ajuste manual
 * com justificativa/aprovação (seção 22) for priorizado.
 */
export function PreviaEspelho({ preview, filtros }: PreviaEspelhoProps) {
  const [formato, setFormato] = useState<"PDF" | "XLSX" | "AMBOS">("AMBOS");
  const [isPending, startTransition] = useTransition();

  function baixarArquivo(nomeArquivo: string, base64: string, mimeType: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function confirmarExportacao() {
    startTransition(async () => {
      const resultado = await ConfirmarExportacao({ ...filtros, formato });

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao gerar exportação");
        return;
      }

      for (const arquivo of resultado.data.arquivos) {
        const mimeType =
          arquivo.formato === "PDF"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        baixarArquivo(arquivo.nomeArquivo, arquivo.base64, mimeType);
      }

      toast.success(`Espelho gerado (código ${resultado.data.codigoVerificacao}).`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[40vh] overflow-auto rounded-2xl border border-white/5">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900">
            <tr className="text-slate-500">
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Razão Social</th>
              <th className="px-3 py-2 font-medium">Serviço</th>
              <th className="px-3 py-2 font-medium">Evento</th>
              <th className="px-3 py-2 text-right font-medium">Comissão</th>
              <th className="px-3 py-2 text-right font-medium">DSR</th>
              <th className="px-3 py-2 text-right font-medium">Prêmio</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.linhas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  Nenhum lançamento encontrado para os filtros informados.
                </td>
              </tr>
            ) : (
              preview.linhas.map((linha) => (
                <tr key={linha.entryId + linha.componenteId} className="border-t border-white/5 text-slate-300">
                  <td className="px-3 py-2 whitespace-nowrap">{formatarDataComissao(linha.data)}</td>
                  <td className="px-3 py-2">{linha.razaoSocial}</td>
                  <td className="px-3 py-2">{linha.servico}</td>
                  <td className="px-3 py-2">{linha.evento}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{formatarCentavosBRL(linha.comissaoCents)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{formatarCentavosBRL(linha.dsrCents)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{formatarCentavosBRL(linha.premioCents)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-white">
                    {formatarCentavosBRL(linha.totalCents)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={linha.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Comissão</p>
          <p className="font-mono tabular-nums text-slate-200">{formatarCentavosBRL(preview.totais.comissaoCents)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">DSR</p>
          <p className="font-mono tabular-nums text-slate-200">{formatarCentavosBRL(preview.totais.dsrCents)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Prêmio</p>
          <p className="font-mono tabular-nums text-slate-200">{formatarCentavosBRL(preview.totais.premioCents)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total Geral</p>
          <p className="font-mono text-base font-semibold tabular-nums text-white">
            {formatarCentavosBRL(preview.totais.totalGeralCents)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["PDF", "XLSX", "AMBOS"] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setFormato(opcao)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                formato === opcao
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/10 text-slate-400 hover:text-slate-200"
              }`}
            >
              {opcao === "AMBOS" ? "PDF + Excel" : opcao}
            </button>
          ))}
        </div>

        <Button
          onClick={confirmarExportacao}
          disabled={isPending || preview.linhas.length === 0}
          className="gap-2"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
          Confirmar Exportação
        </Button>
      </div>
    </div>
  );
}
