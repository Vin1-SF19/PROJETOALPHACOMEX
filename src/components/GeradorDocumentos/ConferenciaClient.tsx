"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, FileCheck, Download } from "lucide-react";

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
  pdfUrl: string | null;
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
  const [pdfUrl, setPdfUrl] = useState(documento.pdfUrl);
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
      setPdfUrl(resultado.pdfUrl);
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
          {pdfUrl && (
            <a href={`/PainelAlpha/GeradorDocumentos/${documento.id}/download`} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">
                <Download className="mr-1.5 h-4 w-4" />
                Baixar PDF
              </Button>
            </a>
          )}
          {!pdfUrl && (
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

      {/* HTML fiel renderizado (RM-2026-94CBF6) — exibição acima das cláusulas editáveis */}
      {documento.htmlUrl && (
        <Card className="mb-6 flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-neutral-900 dark:text-neutral-100">Visualização fiel do documento</h3>
            <a href={documento.htmlUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                <Download className="mr-1.5 h-4 w-4" />
                Baixar HTML
              </Button>
            </a>
          </div>
          <iframe
            srcDoc={undefined}
            src={documento.htmlUrl}
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
