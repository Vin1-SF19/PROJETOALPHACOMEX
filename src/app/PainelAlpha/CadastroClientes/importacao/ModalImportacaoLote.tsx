"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LinhaImportacaoPreview, PrevisualizacaoImportacao, ResumoImportacaoSalva, TipoImportacao } from "@/lib/cs-nps/importacao-tipos";
import { baixarModeloImportacao, previsualizarImportacao, salvarImportacao } from "./api-importacao";
import { calcularTotais, construirLinhasSalvar, type SelecoesDestino } from "./calculos";
import { EtapaArquivoImportacao } from "./EtapaArquivoImportacao";
import { ResumoImportacao } from "./ResumoImportacao";
import { ResultadoImportacao } from "./ResultadoImportacao";
import { SelecaoTiposImportacao } from "./SelecaoTiposImportacao";

interface ModalImportacaoLoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportado: () => void | Promise<void>;
}

type Etapa = 1 | 2 | 3 | 4;

const ETAPAS = ["Seleção", "Planilha", "Revisão", "Concluído"] as const;

export function ModalImportacaoLote({ open, onOpenChange, onImportado }: ModalImportacaoLoteProps) {
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [tipos, setTipos] = useState<TipoImportacao[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<PrevisualizacaoImportacao | null>(null);
  const [linhas, setLinhas] = useState<LinhaImportacaoPreview[]>([]);
  const [selecoes, setSelecoes] = useState<SelecoesDestino>({});
  const [resultado, setResultado] = useState<ResumoImportacaoSalva | null>(null);
  const [isBaixando, setIsBaixando] = useState(false);
  const [isAnalisando, setIsAnalisando] = useState(false);
  const [isSalvando, setIsSalvando] = useState(false);

  const ocupado = isBaixando || isAnalisando || isSalvando;
  const totais = calcularTotais(linhas, selecoes);
  const podeSalvar = totais.total > 0 && totais.invalidas === 0 && totais.ambiguas === 0;

  function limpar() {
    setEtapa(1);
    setTipos([]);
    setArquivo(null);
    setPreview(null);
    setLinhas([]);
    setSelecoes({});
    setResultado(null);
  }

  function alterarAbertura(novoOpen: boolean) {
    if (!novoOpen && ocupado) return;
    onOpenChange(novoOpen);
    if (!novoOpen) limpar();
  }

  async function baixarModelo() {
    setIsBaixando(true);
    try {
      await baixarModeloImportacao(tipos);
      toast.success("Modelo de importação baixado.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível baixar o modelo.");
    } finally {
      setIsBaixando(false);
    }
  }

  async function analisarArquivo() {
    if (!arquivo) return;
    setIsAnalisando(true);
    try {
      const dados = await previsualizarImportacao(arquivo, tipos);
      const sugeridas = Object.fromEntries(dados.linhas.flatMap((linha) => linha.clienteIdSugerido === null ? [] : [[linha.id, linha.clienteIdSugerido]]));
      setPreview(dados);
      setLinhas(dados.linhas);
      setSelecoes(sugeridas);
      setEtapa(3);
      toast.success(`${dados.totais.total} linhas analisadas. Revise os detalhes antes de salvar.`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível analisar a planilha.");
    } finally {
      setIsAnalisando(false);
    }
  }

  function removerLinha(linhaId: string) {
    setLinhas((atuais) => atuais.filter((linha) => linha.id !== linhaId));
    setSelecoes((atuais) => {
      const copia = { ...atuais };
      delete copia[linhaId];
      return copia;
    });
  }

  async function confirmarImportacao() {
    if (!podeSalvar) return;
    setIsSalvando(true);
    try {
      const resumo = await salvarImportacao(construirLinhasSalvar(linhas, selecoes));
      setResultado(resumo);
      setEtapa(4);
      await onImportado();
      toast.success(`${resumo.total} registros importados com sucesso.`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a importação.");
    } finally {
      setIsSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={alterarAbertura}>
      <DialogContent className="max-h-[94vh] overflow-hidden border-white/10 bg-slate-950 p-0 text-slate-100 shadow-2xl sm:max-w-5xl">
        <DialogHeader className="border-b border-white/10 bg-slate-900/60 px-6 pb-5 pt-6">
          <DialogTitle className="text-xl font-black">Importação em lote</DialogTitle>
          <DialogDescription className="text-slate-400">Importe Sócios, CS e Feedbacks com revisão completa antes de gravar.</DialogDescription>
          <ol className="mt-4 grid grid-cols-4 gap-2" aria-label="Etapas da importação">
            {ETAPAS.map((rotulo, indice) => {
              const numero = (indice + 1) as Etapa;
              const ativo = etapa === numero;
              const concluido = etapa > numero;
              return (
                <li key={rotulo} className={`rounded-lg border px-2 py-2 text-center text-[10px] font-black uppercase tracking-wider ${ativo ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200" : concluido ? "border-emerald-400/20 bg-emerald-500/5 text-emerald-300" : "border-white/5 text-slate-600"}`}>
                  {concluido ? <CheckCircle2 className="mx-auto mb-1 size-3" /> : <span className="mb-1 block">0{numero}</span>}{rotulo}
                </li>
              );
            })}
          </ol>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5 custom-scrollbar">
          {etapa === 1 && <SelecaoTiposImportacao tipos={tipos} onChange={setTipos} />}
          {etapa === 2 && <EtapaArquivoImportacao tipos={tipos} arquivo={arquivo} isBaixando={isBaixando} isAnalisando={isAnalisando} onBaixar={baixarModelo} onArquivo={setArquivo} onAnalisar={analisarArquivo} />}
          {etapa === 3 && preview && <ResumoImportacao nomeArquivo={preview.arquivo} linhas={linhas} selecoes={selecoes} onSelecionarDestino={(linhaId, clienteId) => setSelecoes((atuais) => ({ ...atuais, [linhaId]: clienteId }))} onRemover={removerLinha} />}
          {etapa === 4 && resultado && <ResultadoImportacao resumo={resultado} />}
        </div>

        <DialogFooter className="border-t border-white/10 bg-slate-900/60 px-6 py-4">
          {etapa === 1 && <Button type="button" onClick={() => setEtapa(2)} disabled={tipos.length === 0} className="bg-indigo-600 text-white hover:bg-indigo-500">Continuar <ArrowRight /></Button>}
          {etapa === 2 && <><Button type="button" variant="ghost" onClick={() => setEtapa(1)} disabled={ocupado} className="text-slate-300"><ArrowLeft /> Voltar</Button></>}
          {etapa === 3 && <>
            <Button type="button" variant="ghost" onClick={() => setEtapa(2)} disabled={isSalvando} className="text-slate-300"><ArrowLeft /> Trocar planilha</Button>
            <Button type="button" onClick={confirmarImportacao} disabled={!podeSalvar || isSalvando} className="bg-emerald-600 text-white hover:bg-emerald-500">
              {isSalvando ? <Loader2 className="animate-spin" /> : <Save />}{isSalvando ? "Salvando..." : `Salvar importação (${totais.total})`}
            </Button>
          </>}
          {etapa === 4 && <Button type="button" onClick={() => alterarAbertura(false)} className="bg-indigo-600 text-white hover:bg-indigo-500">Concluir</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

