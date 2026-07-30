"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatarCentavosBRL, formatarDataComissao } from "../lib/formatters";
import { ConfirmarExportacao } from "@/actions/CommissionExports";
import type { PreviewResult, TipoEspelho } from "@/lib/commissions/export/preview-builder";

interface PreviaEspelhoProps {
  preview: PreviewResult;
  filtros: {
    tipo: TipoEspelho;
    colaboradorId: number;
    periodoInicio: Date;
    periodoFim: Date;
  };
}

interface LinhaEditavel {
  entryId: string;
  data: string;
  empresaNome: string;
  valorA: number; // comissão ou êxito, conforme o tipo
  valorB: number; // DSR ou primeira, conforme o tipo
}

/**
 * Prévia editável antes de exportar (seção do prompt: "poder fazer ajustes manuais
 * antes de exportar o espelho") — os ajustes aqui NUNCA persistem no CommissionEntry
 * real, só afetam o arquivo final gerado. Se o usuário quiser um ajuste permanente,
 * deve usar "Ajuste Manual" no modal de detalhes do lançamento (auditado).
 */
export function PreviaEspelho({ preview, filtros }: PreviaEspelhoProps) {
  const [formato, setFormato] = useState<"PDF" | "XLSX" | "AMBOS">("AMBOS");
  const [isPending, startTransition] = useTransition();
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const linhasOriginais = preview.tipo === "comissoes" ? preview.linhasComissao : preview.linhasPremio;
  const [linhas, setLinhas] = useState<LinhaEditavel[]>(() =>
    linhasOriginais.map((l) => ({
      entryId: l.entryId,
      data: formatarDataComissao(l.data),
      empresaNome: l.empresaNome,
      valorA: preview.tipo === "comissoes" ? (l as (typeof preview.linhasComissao)[number]).comissaoCents : (l as (typeof preview.linhasPremio)[number]).exitoCents,
      valorB: preview.tipo === "comissoes" ? (l as (typeof preview.linhasComissao)[number]).dsrCents : (l as (typeof preview.linhasPremio)[number]).primeiraCents,
    })),
  );

  const colunaA = preview.tipo === "comissoes" ? "Comissão" : "Êxito";
  const colunaB = preview.tipo === "comissoes" ? "DSR" : "De Primeira";

  function atualizarValor(entryId: string, campo: "valorA" | "valorB", valorReais: string) {
    const numero = Number(valorReais.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(numero)) return;
    setLinhas((atual) => atual.map((l) => (l.entryId === entryId ? { ...l, [campo]: Math.round(numero * 100) } : l)));
  }

  const totalA = linhas.reduce((s, l) => s + l.valorA, 0);
  const totalB = linhas.reduce((s, l) => s + l.valorB, 0);
  const totalGeral = totalA + totalB;

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
      const ajustes = linhas.map((l) => ({ entryId: l.entryId, valorA: l.valorA, valorB: l.valorB }));
      const resultado = await ConfirmarExportacao({ ...filtros, formato, ajustes });

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
      <p className="text-xs text-slate-500">
        {preview.cargoNome ?? "Cargo não informado"} · {preview.colaboradorNome}
      </p>

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-300">
        Os ajustes feitos aqui só afetam o arquivo exportado — para corrigir um lançamento de
        forma permanente e auditada, use &quot;Ajuste Manual&quot; no detalhe do lançamento.
      </p>

      <div className="max-h-[40vh] overflow-auto rounded-2xl border border-white/5">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900">
            <tr className="text-slate-500">
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Empresa</th>
              <th className="px-3 py-2 text-right font-medium">{colunaA}</th>
              <th className="px-3 py-2 text-right font-medium">{colunaB}</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Nenhum lançamento encontrado para os filtros informados.
                </td>
              </tr>
            ) : (
              linhas.map((linha) => (
                <tr key={linha.entryId} className="border-t border-white/5 text-slate-300">
                  <td className="px-3 py-2 whitespace-nowrap">{linha.data}</td>
                  <td className="px-3 py-2">{linha.empresaNome}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {editandoId === linha.entryId ? (
                      <Input
                        defaultValue={(linha.valorA / 100).toFixed(2).replace(".", ",")}
                        onChange={(e) => atualizarValor(linha.entryId, "valorA", e.target.value)}
                        className="h-7 w-24 border-white/10 bg-slate-950/60 text-right text-xs"
                      />
                    ) : (
                      formatarCentavosBRL(linha.valorA)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {editandoId === linha.entryId ? (
                      <Input
                        defaultValue={(linha.valorB / 100).toFixed(2).replace(".", ",")}
                        onChange={(e) => atualizarValor(linha.entryId, "valorB", e.target.value)}
                        className="h-7 w-24 border-white/10 bg-slate-950/60 text-right text-xs"
                      />
                    ) : (
                      formatarCentavosBRL(linha.valorB)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-white">
                    {formatarCentavosBRL(linha.valorA + linha.valorB)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setEditandoId(editandoId === linha.entryId ? null : linha.entryId)}
                      className="text-slate-500 hover:text-slate-300"
                      aria-label="Ajustar valores para o arquivo exportado"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">{colunaA}</p>
          <p className="font-mono tabular-nums text-slate-200">{formatarCentavosBRL(totalA)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{colunaB}</p>
          <p className="font-mono tabular-nums text-slate-200">{formatarCentavosBRL(totalB)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total Geral</p>
          <p className="font-mono text-base font-semibold tabular-nums text-white">
            {formatarCentavosBRL(totalGeral)}
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
          disabled={isPending || linhas.length === 0}
          className="gap-2"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
          Confirmar Exportação
        </Button>
      </div>
    </div>
  );
}
