"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, FileCheck, Download, Loader2, FileWarning, FileText } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  EditarClasulaGerada,
  ReescreverClasulaComIA,
  FinalizarDocumento,
  AtualizarVariaveisContratoPadrao,
} from "@/actions/gerador-documentos";
import { ReescreverIA } from "./ReescreverIA";

interface ClasulaGerada {
  id: string;
  ordem: number;
  titulo: string;
  conteudo: string;
  reescritoPorIA: boolean;
}

interface DocumentoConferencia {
  id: string;
  titulo: string;
  status: string;
  finalizadoEm: Date | string | null;
  pdfDisponivel: boolean;
  template: { titulo: string };
  variaveisJson: unknown;
  variaveisDefinicoes?: Array<{ nome: string; label: string; tipo: string; obrigatorio: boolean }>;
  clausulas: ClasulaGerada[];
}

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  CONFERENCIA: "Em conferência",
  FINALIZADO: "Finalizado",
  ARQUIVADO: "Arquivado",
};

export function ConferenciaClient({ documento }: { documento: DocumentoConferencia }) {
  const [clausulas, setClausulas] = useState(documento.clausulas);
  const definicoes = documento.variaveisDefinicoes ?? [];
  const valoresIniciais = (typeof documento.variaveisJson === "string" ? JSON.parse(documento.variaveisJson) : documento.variaveisJson ?? {}) as Record<string, unknown>;
  const [variaveis, setVariaveis] = useState<Record<string, string>>(Object.fromEntries(definicoes.map((item) => [item.nome, String(valoresIniciais[item.nome] ?? "")])));
  const [variaveisSalvas, setVariaveisSalvas] = useState<Record<string, string>>(variaveis);
  const [status, setStatus] = useState(documento.status);
  const [pdfDisponivel, setPdfDisponivel] = useState(documento.pdfDisponivel);
  const [pdfStatus, setPdfStatus] = useState<"loading" | "success" | "error">("loading");
  const [pdfRevision, setPdfRevision] = useState(0);
  const [conteudosSalvos, setConteudosSalvos] = useState<Record<string, string>>(
    Object.fromEntries(documento.clausulas.map((clausula) => [clausula.id, clausula.conteudo])),
  );
  const [clasulaEmEdicao, setClasulaEmEdicao] = useState<string | null>(null);
  const [acaoPendente, setAcaoPendente] = useState<"clausula" | "ia" | "finalizar" | "variaveis" | null>(null);
  const [isPending, startTransition] = useTransition();

  const somenteLeitura = status === "FINALIZADO" || status === "ARQUIVADO";
  const temClausulasPendentes = clausulas.some((clausula) => clausula.conteudo !== conteudosSalvos[clausula.id]);
  const temVariaveisPendentes = definicoes.some((item) => variaveis[item.nome] !== variaveisSalvas[item.nome]);
  const temAlteracoesPendentes = temClausulasPendentes || temVariaveisPendentes;

  function handleSalvarTexto(clasulaId: string, conteudo: string) {
    if (conteudo === conteudosSalvos[clasulaId] || isPending) return;
    setAcaoPendente("clausula");
    startTransition(async () => {
      try {
        const resultado = await EditarClasulaGerada({ documentoId: documento.id, clasulaId, conteudo });
        if (!resultado.success) {
          toast.error(resultado.error);
          return;
        }
        setConteudosSalvos((prev) => ({ ...prev, [clasulaId]: conteudo }));
        setPdfDisponivel(resultado.pdfDisponivel);
        if (resultado.atualizado) {
          setPdfStatus("loading");
          setPdfRevision((revision) => revision + 1);
        }
        toast.success("Documento e PDF atualizados");
      } finally {
        setAcaoPendente(null);
      }
    });
  }

  function handleAtualizarLocal(clasulaId: string, conteudo: string) {
    setClausulas((prev) => prev.map((c) => (c.id === clasulaId ? { ...c, conteudo } : c)));
  }

  function handleReescrever(clasulaId: string, instrucao: string) {
    if (temAlteracoesPendentes || isPending) {
      toast.error("Salve as alterações antes de reescrever com IA");
      return;
    }
    setAcaoPendente("ia");
    startTransition(async () => {
      try {
        const resultado = await ReescreverClasulaComIA({ documentoId: documento.id, clasulaId, instrucao });
        if (!resultado.success) {
          toast.error(resultado.error);
          return;
        }
        setClausulas((prev) =>
          prev.map((c) => (c.id === clasulaId ? { ...c, conteudo: resultado.conteudo, reescritoPorIA: true } : c)),
        );
        setConteudosSalvos((prev) => ({ ...prev, [clasulaId]: resultado.conteudo }));
        setPdfDisponivel(resultado.pdfDisponivel);
        setPdfStatus("loading");
        setPdfRevision((revision) => revision + 1);
        toast.success("Cláusula reescrita pela IA");
        setClasulaEmEdicao(null);
      } finally {
        setAcaoPendente(null);
      }
    });
  }

  function handleFinalizar() {
    if (temAlteracoesPendentes || isPending) return;
    setAcaoPendente("finalizar");
    startTransition(async () => {
      try {
        const resultado = await FinalizarDocumento(documento.id);
        if (!resultado.success) {
          toast.error(resultado.error);
          return;
        }
        setStatus("FINALIZADO");
        setPdfDisponivel(true);
        setPdfStatus("loading");
        setPdfRevision((revision) => revision + 1);
        toast.success("Documento finalizado");
      } finally {
        setAcaoPendente(null);
      }
    });
  }

  function handleSalvarVariaveis() {
    if (temClausulasPendentes || isPending) {
      toast.error("Salve as cláusulas antes de atualizar os dados do contrato");
      return;
    }
    setAcaoPendente("variaveis");
    startTransition(async () => {
      try {
        const resultado = await AtualizarVariaveisContratoPadrao({ documentoId: documento.id, valores: variaveis });
        if (!resultado.success) {
          toast.error(resultado.error);
          return;
        }
        setClausulas(resultado.data.clausulas);
        setConteudosSalvos(Object.fromEntries(resultado.data.clausulas.map((clausula) => [clausula.id, clausula.conteudo])));
        setVariaveisSalvas({ ...variaveis });
        setPdfDisponivel(resultado.data.pdfDisponivel);
        setPdfStatus("loading");
        setPdfRevision((revision) => revision + 1);
        toast.success("Dados do contrato e PDF atualizados");
      } finally {
        setAcaoPendente(null);
      }
    });
  }

  return (
    <main className="gd-main gd-inner mx-auto max-w-6xl px-4 py-8 md:px-8">
      <nav aria-label="Caminho" className="gd-breadcrumb mb-6"><Link href="/PainelAlpha/GeradorDocumentos">Gerador de Documentos</Link><span>/</span><span>Documentos gerados</span><span>/</span><span aria-current="page">{documento.titulo}</span></nav>
      <div className="gd-page-heading mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="gd-kicker">Conferência do documento</p><h1 className="gd-title">{documento.titulo}</h1>
          <p className="gd-muted mt-2 text-sm">{documento.template.titulo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="gd-status" data-status={status}>{STATUS_LABEL[status] ?? status}</Badge>
          {pdfDisponivel && !temAlteracoesPendentes && !isPending && (
            <a href={`/PainelAlpha/GeradorDocumentos/${documento.id}/download`} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">
                <Download className="mr-1.5 h-4 w-4" />
                Baixar PDF
              </Button>
            </a>
          )}
          {(!pdfDisponivel || temAlteracoesPendentes || isPending) && (
            <Button variant="secondary" disabled title={temAlteracoesPendentes ? "Aguarde o salvamento das alterações" : "PDF ainda não disponível"}>
              <Download className="mr-1.5 h-4 w-4" />
              Baixar PDF
            </Button>
          )}
          {!somenteLeitura && (
            <Button onClick={handleFinalizar} disabled={isPending || temAlteracoesPendentes}>
              {acaoPendente === "finalizar" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              {acaoPendente === "finalizar" ? "Finalizando..." : "Finalizar"}
            </Button>
          )}
        </div>
      </div>

      {somenteLeitura && (
        <div className="gd-notice gd-notice-success mb-6 flex items-center gap-2 px-4 py-3 text-sm">
          <FileCheck className="h-4 w-4 shrink-0" />
          Este documento já foi finalizado e não pode mais ser editado.
        </div>
      )}

      {!somenteLeitura && definicoes.length > 0 && (
        <Card className="gd-panel mb-6 space-y-4 p-5 md:p-6">
          <div>
            <p className="gd-kicker">Informações importadas</p><h2 className="gd-section-title">Dados do contrato para conferência</h2>
            <p className="gd-muted text-sm">Confira os dados importados do Financeiro e preencha os pendentes antes de finalizar.</p>
          </div>
          <div className="gd-subpanel rounded-md p-4 text-sm">
            <p><strong>Serviço:</strong> {String(valoresIniciais.__bpmServico ?? "Não informado")}</p>
            <p><strong>Forma de pagamento:</strong> {String(valoresIniciais.__bpmFormaPagamento ?? "Não informada")}</p>
            <p><strong>Condição negociada:</strong> {String(valoresIniciais.__bpmCondicaoNegociada ?? "Não informada")}</p>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Confira se as cláusulas financeiras do modelo correspondem a essas condições antes de finalizar.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {definicoes.map((item) => <label key={item.nome} className="text-xs text-neutral-600 dark:text-neutral-300">
              {item.label}{item.obrigatorio ? " *" : ""}
              <Input className="mt-1" type={item.tipo === "data" ? "date" : item.tipo === "moeda" ? "number" : "text"}
                step={item.tipo === "moeda" ? "0.01" : undefined}
                value={variaveis[item.nome] ?? ""}
                onChange={(event) => setVariaveis((atual) => ({ ...atual, [item.nome]: event.target.value }))}
                disabled={isPending} />
            </label>)}
          </div>
          <Button type="button" onClick={handleSalvarVariaveis} disabled={isPending || !temVariaveisPendentes || temClausulasPendentes}>{acaoPendente === "variaveis" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{acaoPendente === "variaveis" ? "Atualizando..." : "Atualizar dados do contrato"}</Button>
        </Card>
      )}

      {pdfDisponivel ? (
        <Card className="gd-panel mb-6 flex flex-col gap-3 p-5 md:p-6">
          <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#73bfd2]" /><h2 className="gd-section-title">Documento em PDF</h2></div>
          <div className="gd-pdf-frame relative min-h-[32rem] overflow-hidden rounded-md">
            {(temAlteracoesPendentes || isPending) && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1424]/95 px-6 text-center text-sm text-slate-200" role="status">
                {isPending ? "Atualizando documento e PDF…" : "Alterações pendentes. Salve os campos ou saia da cláusula para atualizar o PDF."}
              </div>
            )}
            {pdfStatus === "loading" && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-neutral-600 dark:text-neutral-300" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Carregando visualização do PDF…
              </div>
            )}
            {pdfStatus === "error" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-red-600 dark:text-red-400" role="alert">
                <FileWarning className="h-5 w-5" aria-hidden="true" />
                Não foi possível exibir o PDF. Use o botão “Baixar PDF” para tentar novamente.
              </div>
            )}
            <iframe
              key={pdfRevision}
              src={`/PainelAlpha/GeradorDocumentos/${documento.id}/download?disposition=inline&revision=${pdfRevision}`}
              title={`Visualização do PDF: ${documento.titulo}`}
              className="h-[70vh] min-h-[32rem] w-full bg-white"
              onLoad={() => setPdfStatus("success")}
              onError={() => setPdfStatus("error")}
            />
          </div>
        </Card>
      ) : (
        <div className="gd-notice gd-notice-warning mb-6 flex items-center gap-2 px-4 py-3 text-sm" role="alert">
          <FileWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
          {definicoes.length > 0
            ? "Confira e salve os dados do contrato para atualizar o PDF."
            : "O PDF ainda não está disponível. Salve uma cláusula ou finalize o documento para tentar gerar novamente."}
        </div>
      )}

      <div className="mb-4"><p className="gd-kicker">Conteúdo</p><h2 className="gd-section-title">Cláusulas do documento</h2></div>
      <div className="flex flex-col gap-4">
        {clausulas
          .slice()
          .sort((a, b) => a.ordem - b.ordem)
          .map((clasula) => (
            <Card key={clasula.id} className="gd-clause-card flex flex-col gap-3 p-5 md:p-6">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{clasula.titulo}</h3>
                {clasula.reescritoPorIA && (
                  <Badge variant="secondary" className="gd-ai gap-1">
                    <Sparkles className="h-3 w-3" />
                    Reescrito por IA
                  </Badge>
                )}
              </div>

              <textarea
                className="gd-textarea min-h-28 w-full rounded-md p-3 text-sm outline-none"
                value={clasula.conteudo}
                disabled={somenteLeitura || isPending}
                onChange={(e) => handleAtualizarLocal(clasula.id, e.target.value)}
                onBlur={(e) => !somenteLeitura && handleSalvarTexto(clasula.id, e.target.value)}
              />
              {clasula.conteudo !== conteudosSalvos[clasula.id] && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
                    {isPending ? "Salvando alterações e atualizando PDF…" : "Alteração pendente. Saia do campo para salvar."}
                  </p>
                  {!isPending && (
                    <Button variant="secondary" size="sm" onClick={() => handleSalvarTexto(clasula.id, clasula.conteudo)}>
                      Salvar alteração
                    </Button>
                  )}
                </div>
              )}

              {!somenteLeitura && (
                <ReescreverIA
                  aberto={clasulaEmEdicao === clasula.id}
                  onAbrir={() => setClasulaEmEdicao(clasula.id)}
                  onFechar={() => setClasulaEmEdicao(null)}
                  onReescrever={(instrucao) => handleReescrever(clasula.id, instrucao)}
                  carregando={acaoPendente === "ia" && clasulaEmEdicao === clasula.id}
                />
              )}
            </Card>
          ))}
      </div>
    </main>
  );
}
