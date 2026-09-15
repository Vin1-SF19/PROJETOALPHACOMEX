"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, History, Loader2, ScanSearch, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { ACCEPT_MESCLAGEM } from "./api-mesclagem";
import { CnpjDiagnostic } from "./components/CnpjDiagnostic";
import { ExportPanel } from "./components/ExportPanel";
import { FileCard } from "./components/FileCard";
import { MappingPanel } from "./components/MappingPanel";
import { MergePreview } from "./components/MergePreview";
import { MergeStepper } from "./components/MergeStepper";
import { ProcessingProgress } from "./components/ProcessingProgress";
import { StatusBadge } from "./components/StatusBadge";
import { type EtapaMesclagem, useMesclagemController } from "./useMesclagemController";

export function MesclagemWorkspace() {
  const fluxo = useMesclagemController();
  const {
    etapa, setEtapa, principal, complementar, ultimosArquivos, errosArquivos, carregandoArquivo,
    abaPrincipal, abaComplementar, colunaCnpjPrincipal, colunaCnpjComplementar, mapeamento,
    carregandoMapeamento, erroMapeamento, avisoMapeamento, mapeamentoUsouIa, previa, processando,
    baixandoTemplate, gerado, historicoId, erroEtapa, ocupado, colunasComplementares,
  } = fluxo;
  const arquivoRetryPrincipal = ultimosArquivos.principal;
  const arquivoRetryComplementar = ultimosArquivos.complementar;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950 text-slate-50" aria-labelledby="mesclagem-titulo">
      <div className="relative z-10 mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-indigo-400/15 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/10 text-indigo-100 shadow-xl ring-1 ring-sky-400/20 sm:size-14">
                <FileSpreadsheet className="size-6 sm:size-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-200">
                    <ShieldCheck className="size-3" aria-hidden="true" /> Ferramenta administrativa
                  </span>
                  <StatusBadge label="Fluxo seguro" variant="ok" icon="check" />
                  <StatusBadge label="1:N preservado" variant="info" />
                </div>
                <h1 id="mesclagem-titulo" className="mt-3 text-2xl font-black tracking-tight text-white sm:text-4xl">Mesclagem de Planilhas</h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
                  Combine as fontes por CNPJ, revise cada correspondência e exporte no template oficial.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/PainelAlpha/Mesclagem" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-5 py-3 text-sm font-bold text-slate-200 transition hover:border-indigo-400/30"><History className="size-4" /> Histórico</Link>
              <button type="button" onClick={() => void fluxo.baixarTemplate()} disabled={baixandoTemplate || ocupado} className="inline-flex items-center justify-center gap-2 self-stretch rounded-xl border border-white/10 bg-slate-950/70 px-5 py-3 text-sm font-bold text-slate-200 transition hover:border-indigo-400/30 disabled:opacity-50 sm:self-start">
                {baixandoTemplate ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {baixandoTemplate ? "Baixando…" : "Baixar template"}
              </button>
            </div>
          </div>
          <div className="mt-6"><MergeStepper etapa={etapa} erroEtapa={erroEtapa} /></div>
        </header>

        <section className="mt-5 min-w-0 pb-28" aria-label={`Etapa ${etapa} da mesclagem`}>
          <div className="sr-only" aria-live="polite">Etapa {etapa} de 4.</div>
          <ProcessingProgress key={`${etapa}-${processando}-${carregandoMapeamento}`} active={processando || carregandoMapeamento} steps={carregandoMapeamento ? ["Comparando cabeçalhos…", "Validando sugestões…"] : ["Processando arquivos…", "Preparando resultado…"]} />

          {etapa === 1 && (
            <div className="grid gap-4 xl:grid-cols-2">
              <FileCard title="Planilha principal" description="Base que define as empresas e os dados originais." tone="blue" arquivo={principal?.arquivo} inspecao={principal?.inspecao} carregando={carregandoArquivo === "principal"} erro={errosArquivos.principal} accept={ACCEPT_MESCLAGEM} disabled={ocupado} onFile={(arquivo) => void fluxo.selecionarArquivo("principal", arquivo)} onRemove={() => fluxo.removerArquivo("principal")} onRetry={arquivoRetryPrincipal ? () => void fluxo.selecionarArquivo("principal", arquivoRetryPrincipal) : undefined} />
              <FileCard title="Planilha complementar" description="Fonte das colunas que serão relacionadas por CNPJ." tone="violet" arquivo={complementar?.arquivo} inspecao={complementar?.inspecao} carregando={carregandoArquivo === "complementar"} erro={errosArquivos.complementar} accept={ACCEPT_MESCLAGEM} disabled={ocupado} onFile={(arquivo) => void fluxo.selecionarArquivo("complementar", arquivo)} onRemove={() => fluxo.removerArquivo("complementar")} onRetry={arquivoRetryComplementar ? () => void fluxo.selecionarArquivo("complementar", arquivoRetryComplementar) : undefined} />
              {!principal && !complementar && !carregandoArquivo && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-200 shadow-xl backdrop-blur-xl xl:col-span-2">
                  <ScanSearch className="size-5 shrink-0" aria-hidden="true" /> Selecione a planilha principal e a complementar. Formatos: XLSX, XLSM, CSV e TSV.
                </div>
              )}
            </div>
          )}

          {etapa === 2 && principal && complementar && (
            <div className="grid gap-4 xl:grid-cols-2">
              {([
                { tipo: "principal" as const, titulo: "Planilha principal", arquivo: principal, aba: abaPrincipal, coluna: colunaCnpjPrincipal },
                { tipo: "complementar" as const, titulo: "Planilha complementar", arquivo: complementar, aba: abaComplementar, coluna: colunaCnpjComplementar },
              ]).map((configuracao) => (
                <article key={configuracao.tipo} className="rounded-2xl border border-indigo-400/15 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl">
                  <h2 className="text-base font-bold text-white">CNPJ · {configuracao.titulo}</h2>
                  <p className="mt-1 text-sm text-slate-400">Confirme a aba e a coluna usada para relacionar os registros.</p>
                  <div className="mt-4 space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Aba
                      <select value={configuracao.aba} disabled={ocupado} onChange={(evento) => fluxo.trocarAba(configuracao.tipo, evento.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 transition hover:border-indigo-400/50 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60">
                        {configuracao.arquivo.inspecao.abas.map((aba) => <option key={aba.nome} value={aba.nome}>{aba.nome}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Coluna de CNPJ
                      <select value={configuracao.coluna} disabled={ocupado} onChange={(evento) => fluxo.atualizarColunaCnpj(configuracao.tipo, Number(evento.target.value))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 transition hover:border-indigo-400/50 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60">
                        {configuracao.arquivo.inspecao.abas.find((aba) => aba.nome === configuracao.aba)?.colunas.map((coluna) => <option key={coluna.numero} value={coluna.numero}>{coluna.nome}</option>)}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          )}

          {etapa === 3 && (
            <div className="space-y-3">
              {avisoMapeamento && <div role="status" className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100">{avisoMapeamento}</div>}
              <MappingPanel mapeamento={mapeamento} colunas={colunasComplementares} onAtualizar={fluxo.atualizarCampo} carregando={carregandoMapeamento} erro={erroMapeamento} usouIa={mapeamentoUsouIa} onRetry={() => void fluxo.calcularSugestoes()} />
            </div>
          )}

          {etapa === 4 && previa && (
            <div className="space-y-4">
              <CnpjDiagnostic previa={previa} />
              <MergePreview previa={previa} />
              <ExportPanel previa={previa} processando={processando} gerado={gerado} historicoId={historicoId} onExport={() => void fluxo.baixar()} onRestart={fluxo.limpar} />
            </div>
          )}
        </section>

        <footer className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-3 border-t border-indigo-400/20 bg-slate-950/90 px-4 py-4 shadow-2xl backdrop-blur-xl sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-8 lg:px-8">
          <p className="text-xs text-slate-400">Etapa {etapa} de 4 · {etapa === 1 ? "Selecione os dois arquivos" : etapa === 2 ? "Confirme as colunas de CNPJ" : etapa === 3 ? "Revise o mapeamento sugerido" : "Confira e exporte o resultado"}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {etapa > 1 && <button type="button" onClick={() => setEtapa((etapa - 1) as EtapaMesclagem)} disabled={ocupado} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm font-bold text-slate-200 hover:border-indigo-400/30 disabled:opacity-50"><ArrowLeft className="size-4" /> Voltar</button>}
            {etapa === 1 && <button type="button" onClick={() => setEtapa(2)} disabled={!principal || !complementar || ocupado} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-violet-600 to-rose-500 px-5 py-2.5 text-sm font-black text-white shadow-xl transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none">Continuar <ArrowRight className="size-4" /></button>}
            {etapa === 2 && <button type="button" onClick={() => void fluxo.avancarParaMapeamento()} disabled={ocupado} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-violet-600 to-rose-500 px-5 py-2.5 text-sm font-black text-white shadow-xl transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none">{carregandoMapeamento ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Sparkles className="size-4" />} Calcular mapeamento</button>}
            {etapa === 3 && <button type="button" onClick={() => void fluxo.avancarParaRevisao()} disabled={ocupado} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-violet-600 to-rose-500 px-5 py-2.5 text-sm font-black text-white shadow-xl transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none">{processando ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Upload className="size-4" />} Gerar prévia</button>}
            {etapa === 4 && <button type="button" onClick={() => void fluxo.baixar()} disabled={ocupado || !previa} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-violet-600 to-rose-500 px-5 py-2.5 text-sm font-black text-white shadow-xl transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none">{processando ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Download className="size-4" />} {gerado ? "Baixar novamente" : "Gerar planilha final"}</button>}
          </div>
        </footer>
      </div>
    </main>
  );
}
