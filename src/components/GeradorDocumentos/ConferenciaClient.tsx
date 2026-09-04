"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, FileCheck, Download, Loader2, FileWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  EditarClasulaGerada,
  ReescreverClasulaComIA,
  FinalizarDocumento,
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
  htmlUrl?: string | null; // RM-2026-94CBF6 — HTML renderizado com variáveis preenchidas
  template: { titulo: string };
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
  const [status, setStatus] = useState(documento.status);
  const [pdfDisponivel, setPdfDisponivel] = useState(documento.pdfDisponivel);
  const [pdfStatus, setPdfStatus] = useState<"loading" | "success" | "error">("loading");
  const [pdfRevision, setPdfRevision] = useState(0);
  const [htmlUrl, setHtmlUrl] = useState(documento.htmlUrl ?? null);
  const [htmlRevision, setHtmlRevision] = useState(0);
  const [clasulaEmEdicao, setClasulaEmEdicao] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const somenteLeitura = status === "FINALIZADO" || status === "ARQUIVADO";

  function handleSalvarTexto(clasulaId: string, conteudo: string) {
    startTransition(async () => {
      const resultado = await EditarClasulaGerada({ documentoId: documento.id, clasulaId, conteudo });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
    });
  }

  function handleAtualizarLocal(clasulaId: string, conteudo: string) {
    setClausulas((prev) => prev.map((c) => (c.id === clasulaId ? { ...c, conteudo } : c)));
  }

  function handleReescrever(clasulaId: string, instrucao: string) {
    startTransition(async () => {
      const resultado = await ReescreverClasulaComIA({ documentoId: documento.id, clasulaId, instrucao });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      setClausulas((prev) =>
        prev.map((c) => (c.id === clasulaId ? { ...c, conteudo: resultado.conteudo, reescritoPorIA: true } : c)),
      );
      setHtmlUrl(resultado.htmlUrl);
      setHtmlRevision((revision) => revision + 1);
      setPdfDisponivel(resultado.pdfDisponivel);
      setPdfStatus("loading");
      setPdfRevision((revision) => revision + 1);
      toast.success("Cláusula reescrita pela IA");
      setClasulaEmEdicao(null);
    });
  }

  function handleFinalizar() {
    startTransition(async () => {
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
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{documento.titulo}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{documento.template.titulo}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === "FINALIZADO" ? "default" : "secondary"}>{STATUS_LABEL[status] ?? status}</Badge>
          {pdfDisponivel && (
            <a href={`/PainelAlpha/GeradorDocumentos/${documento.id}/download`} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">
                <Download className="mr-1.5 h-4 w-4" />
                Baixar PDF
              </Button>
            </a>
          )}
          {!pdfDisponivel && (
            <Button variant="secondary" disabled title="PDF ainda não gerado">
              <Download className="mr-1.5 h-4 w-4" />
              Baixar PDF
            </Button>
          )}
          {!somenteLeitura && (
            <Button onClick={handleFinalizar} disabled={isPending}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Finalizar
            </Button>
          )}
        </div>
      </div>

      {somenteLeitura && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          <FileCheck className="h-4 w-4 shrink-0" />
          Este documento já foi finalizado e não pode mais ser editado.
        </div>
      )}

      {pdfDisponivel ? (
        <Card className="mb-6 flex flex-col gap-3 p-5">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">PDF gerado</h2>
          <div className="relative min-h-[32rem] overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950">
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
              src={`/PainelAlpha/GeradorDocumentos/${documento.id}/download?disposition=inline`}
              title={`Visualização do PDF: ${documento.titulo}`}
              className="h-[70vh] min-h-[32rem] w-full bg-white"
              onLoad={() => setPdfStatus("success")}
              onError={() => setPdfStatus("error")}
            />
          </div>
        </Card>
      ) : (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300" role="alert">
          <FileWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
          O PDF não foi gerado. A visualização HTML continua disponível para conferência.
        </div>
      )}

      {/* HTML fiel renderizado (RM-2026-94CBF6) — exibição acima das cláusulas editáveis */}
      {htmlUrl && (
        <Card className="mb-6 flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">Visualização fiel do documento</h3>
            <a href={htmlUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                <Download className="mr-1.5 h-4 w-4" />
                Baixar HTML
              </Button>
            </a>
          </div>
          <iframe
            key={htmlRevision}
            srcDoc={undefined}
            src={htmlUrl ?? undefined}
            title="Documento HTML"
            className="h-[600px] w-full rounded-md border border-neutral-200 bg-white dark:border-neutral-800"
            sandbox="allow-same-origin"
          />
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {clausulas
          .slice()
          .sort((a, b) => a.ordem - b.ordem)
          .map((clasula) => (
            <Card key={clasula.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{clasula.titulo}</h3>
                {clasula.reescritoPorIA && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Reescrito por IA
                  </Badge>
                )}
              </div>

              <textarea
                className="min-h-28 w-full rounded-md border border-neutral-200 bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-800"
                value={clasula.conteudo}
                disabled={somenteLeitura || isPending}
                onChange={(e) => handleAtualizarLocal(clasula.id, e.target.value)}
                onBlur={(e) => !somenteLeitura && handleSalvarTexto(clasula.id, e.target.value)}
              />

              {!somenteLeitura && (
                <ReescreverIA
                  aberto={clasulaEmEdicao === clasula.id}
                  onAbrir={() => setClasulaEmEdicao(clasula.id)}
                  onFechar={() => setClasulaEmEdicao(null)}
                  onReescrever={(instrucao) => handleReescrever(clasula.id, instrucao)}
                  carregando={isPending && clasulaEmEdicao === clasula.id}
                />
              )}
            </Card>
          ))}
      </div>
    </div>
  );
}
