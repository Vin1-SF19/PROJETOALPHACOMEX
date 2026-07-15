"use client";

import { useRef } from "react";
import { Download, FileCheck2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TipoImportacao } from "@/lib/cs-nps/importacao-tipos";
import { ROTULOS_TIPO } from "./constantes";

interface EtapaArquivoImportacaoProps {
  tipos: TipoImportacao[];
  arquivo: File | null;
  isBaixando: boolean;
  isAnalisando: boolean;
  onBaixar: () => void;
  onArquivo: (arquivo: File | null) => void;
  onAnalisar: () => void;
}

export function EtapaArquivoImportacao({
  tipos,
  arquivo,
  isBaixando,
  isAnalisando,
  onBaixar,
  onArquivo,
  onAnalisar,
}: EtapaArquivoImportacaoProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function selecionarArquivo(fileList: FileList | null) {
    const selecionado = fileList?.[0] ?? null;
    onArquivo(selecionado?.name.toLowerCase().endsWith(".xlsx") ? selecionado : null);
    if (selecionado && !selecionado.name.toLowerCase().endsWith(".xlsx")) {
      inputRef.current?.setCustomValidity("Selecione um arquivo .xlsx.");
      inputRef.current?.reportValidity();
    } else {
      inputRef.current?.setCustomValidity("");
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="titulo-arquivo-importacao">
      <div>
        <h3 id="titulo-arquivo-importacao" className="text-lg font-black text-slate-100">
          Prepare e envie a planilha
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Baixe o modelo, preencha sem alterar os cabeçalhos e envie o arquivo para validação.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tipos.map((tipo) => <Badge key={tipo} className="bg-indigo-500/15 text-indigo-300">{ROTULOS_TIPO[tipo]}</Badge>)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400"><Download className="size-5" aria-hidden="true" /></span>
            <div>
              <h4 className="text-sm font-black text-slate-100">1. Baixar modelo</h4>
              <p className="text-xs text-slate-400">Inclui instruções, formatos e abas selecionadas.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onBaixar}
            disabled={isBaixando || isAnalisando}
            className="mt-5 w-full border-emerald-400/30 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/15 hover:text-emerald-200"
          >
            {isBaixando ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            {isBaixando ? "Preparando..." : "Baixar modelo .xlsx"}
          </Button>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-indigo-500/10 p-2 text-indigo-400"><UploadCloud className="size-5" aria-hidden="true" /></span>
            <div>
              <h4 className="text-sm font-black text-slate-100">2. Enviar planilha</h4>
              <p className="text-xs text-slate-400">Somente Excel .xlsx. A prévia ainda não grava dados.</p>
            </div>
          </div>
          <input
            ref={inputRef}
            id="arquivo-importacao-cs-nps"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => selecionarArquivo(event.target.files)}
            disabled={isAnalisando}
            className="sr-only"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isAnalisando}
            className="mt-5 w-full border-indigo-400/30 bg-indigo-500/5 text-indigo-300 hover:bg-indigo-500/15 hover:text-indigo-200"
          >
            {arquivo ? <FileCheck2 /> : <UploadCloud />}
            {arquivo ? "Trocar arquivo" : "Escolher arquivo .xlsx"}
          </Button>
        </article>
      </div>

      {arquivo && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-emerald-200">{arquivo.name}</p>
            <p className="text-xs text-slate-400">{(arquivo.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB selecionados</p>
          </div>
          <Button type="button" onClick={onAnalisar} disabled={isAnalisando} className="bg-indigo-600 text-white hover:bg-indigo-500">
            {isAnalisando ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            {isAnalisando ? "Validando..." : "Analisar planilha"}
          </Button>
        </div>
      )}
    </section>
  );
}

