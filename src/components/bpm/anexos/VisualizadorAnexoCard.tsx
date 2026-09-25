"use client";

import { useEffect, useState } from "react";
import { FileWarning, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type AnexoParaVisualizar = { id: string; nome: string; tipo: string | null };

type Clausula = { id: string; ordem: number; titulo: string; conteudo: string };
type ContratoPreview = { titulo: string; status: string; pdfDisponivel: boolean; clausulas: Clausula[] };

export function VisualizadorAnexoCard({ anexo, onClose }: {
  anexo: AnexoParaVisualizar | null;
  onClose: () => void;
}) {
  const [resultado, setResultado] = useState<{ id: string; contrato: ContratoPreview | null; erro: string | null } | null>(null);
  const [visualizacao, setVisualizacao] = useState<{ id: string; pdf: boolean } | null>(null);
  const anexoId = anexo?.id;
  const gerado = anexo?.tipo === "application/x-painel-alpha-documento";
  const arquivoUrl = anexo ? `/api/bpm/anexos/${encodeURIComponent(anexo.id)}` : "";
  const previewUrl = anexo ? `${arquivoUrl}/preview` : "";
  const contrato = resultado && resultado.id === anexoId ? resultado.contrato : null;
  const erro = resultado && resultado.id === anexoId ? resultado.erro : null;
  const carregando = Boolean(gerado && anexoId && resultado?.id !== anexoId);
  const verPdf = Boolean(visualizacao && visualizacao.id === anexoId && visualizacao.pdf);

  useEffect(() => {
    if (!anexoId || !gerado) return;
    const controller = new AbortController();
    fetch(`${previewUrl}`, { signal: controller.signal })
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error("Não foi possível visualizar este contrato.");
        return resposta.json() as Promise<ContratoPreview>;
      })
      .then((data) => { if (!controller.signal.aborted) setResultado({ id: anexoId, contrato: data, erro: null }); })
      .catch((falha: unknown) => {
        if (!controller.signal.aborted) setResultado({ id: anexoId, contrato: null, erro: falha instanceof Error ? falha.message : "Falha ao carregar contrato." });
      });
    return () => controller.abort();
  }, [anexoId, gerado, previewUrl]);

  const tipo = anexo?.tipo ?? "";
  const imagem = tipo.startsWith("image/");
  const documentoInline = tipo === "application/pdf" || tipo === "text/plain";

  return (
    <Dialog open={Boolean(anexo)} onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
      <DialogContent className="flex h-[min(90vh,900px)] w-[min(96vw,1100px)] max-w-none flex-col gap-3 overflow-hidden border-white/10 bg-slate-950 text-slate-100">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="truncate text-left">{contrato?.titulo ?? anexo?.nome ?? "Anexo"}</DialogTitle>
          <DialogDescription className="text-left text-slate-400">
            {gerado ? "Contrato gerado para este card" : "Visualização do anexo do card"}
          </DialogDescription>
        </DialogHeader>

        {gerado ? (
          carregando ? (
            <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-300">
              <Loader2 className="size-4 animate-spin" /> Carregando contrato…
            </div>
          ) : erro ? (
            <div role="alert" className="flex flex-1 items-center justify-center gap-2 text-sm text-rose-300">
              <FileWarning className="size-4" /> {erro}
            </div>
          ) : contrato ? (
            <>
              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{contrato.status === "FINALIZADO" ? "Finalizado" : "Em conferência"}</span>
                {contrato.pdfDisponivel && (
                  <button type="button" onClick={() => setVisualizacao({ id: anexoId!, pdf: !verPdf })} className="rounded-md border border-white/15 px-2.5 py-1 text-sky-200 hover:bg-white/10">
                    {verPdf ? "Ver texto" : "Ver PDF"}
                  </button>
                )}
              </div>
              {verPdf && contrato.pdfDisponivel ? (
                <iframe src={`${previewUrl}?formato=pdf`} title={`PDF: ${contrato.titulo}`} className="min-h-0 flex-1 rounded-md bg-white" />
              ) : (
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto rounded-md border border-white/10 bg-white p-5 text-slate-900 sm:p-8">
                  <h2 className="text-center text-lg font-bold">{contrato.titulo}</h2>
                  {contrato.clausulas.map((clausula) => (
                    <section key={clausula.id}>
                      <h3 className="mb-2 font-semibold">{clausula.titulo}</h3>
                      <div className="whitespace-pre-wrap text-sm leading-7">{clausula.conteudo}</div>
                    </section>
                  ))}
                </div>
              )}
            </>
          ) : null
        ) : imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={arquivoUrl} alt={anexo?.nome ?? "Anexo"} className="min-h-0 flex-1 self-center rounded-md object-contain" />
        ) : documentoInline ? (
          <iframe src={arquivoUrl} title={anexo?.nome ?? "Anexo"} className="min-h-0 flex-1 rounded-md bg-white" />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-slate-300">
            <FileWarning className="size-6" />
            <p>Este tipo de arquivo não possui prévia no navegador.</p>
            <a href={arquivoUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-white/15 px-3 py-2 text-sky-200 hover:bg-white/10">
              Abrir ou baixar arquivo
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
