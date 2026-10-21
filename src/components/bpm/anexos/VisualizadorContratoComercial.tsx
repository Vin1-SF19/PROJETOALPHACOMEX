"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Download, FileWarning, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DocumentoProjetado {
  id: string;
  nome: string;
  tipo: string | null;
  urlAcesso?: string;
  origem?: "CONTRATACAO";
  somenteLeitura?: boolean;
}
interface Props { anexo: DocumentoProjetado; cardId?: string; revisao?: string; onClose: () => void }

/** Only the current commercial card and the two fixed document slots are accepted. */
export function urlContratoComercialSegura(anexo: DocumentoProjetado, cardId?: string): string | null {
  if (!cardId || anexo.origem !== "CONTRATACAO" || anexo.somenteLeitura !== true) return null;
  const base = `/api/bpm/cards/${encodeURIComponent(cardId)}/contrato?tipo=`;
  return anexo.urlAcesso === `${base}para_envio` || anexo.urlAcesso === `${base}assinado` ? anexo.urlAcesso : null;
}

export function VisualizadorContratoComercial(props: Props) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
  return <QueryClientProvider client={client}><ConteudoContratoComercial {...props} /></QueryClientProvider>;
}

function ConteudoContratoComercial({ anexo, cardId, revisao, onClose }: Props) {
  const url = urlContratoComercialSegura(anexo, cardId);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const consulta = useQuery({
    queryKey: ["contrato-comercial-arquivo", cardId, anexo.id, url, revisao],
    enabled: Boolean(url),
    queryFn: async ({ signal }) => {
      if (!url) throw new Error("Documento indisponível.");
      const resposta = await fetch(url, { signal, cache: "no-store", credentials: "same-origin" });
      if (!resposta.ok) throw new Error("O documento não está disponível. Atualize a consulta ou tente novamente mais tarde.");
      const mime = resposta.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (!mime || mime !== anexo.tipo?.toLowerCase()) throw new Error("Não foi possível confirmar o formato deste documento.");
      const blob = await resposta.blob();
      if (!blob.size) throw new Error("O documento está vazio ou indisponível.");
      return blob;
    },
  });
  useEffect(() => {
    const blob = consulta.data;
    if (!blob) return;
    let objetoUrl: string | null = null;
    const timer = window.setTimeout(() => {
      objetoUrl = URL.createObjectURL(blob);
      setPreview({ blob, url: objetoUrl });
    }, 0);
    return () => { window.clearTimeout(timer); if (objetoUrl) URL.revokeObjectURL(objetoUrl); };
  }, [consulta.data]);
  const urlPreview = preview?.blob === consulta.data ? preview?.url : null;
  const imagem = ["image/png", "image/jpeg", "image/webp"].includes(anexo.tipo ?? "");
  const inline = anexo.tipo === "application/pdf" || anexo.tipo === "text/plain";
  const falha = !url || consulta.isError;
  return <Dialog open onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
    <DialogContent className="flex h-[min(90vh,900px)] w-[min(96vw,1100px)] max-w-none flex-col gap-3 overflow-hidden border-white/10 bg-slate-950 text-slate-100">
      <DialogHeader className="shrink-0 pr-8"><DialogTitle className="truncate text-left">{anexo.nome}</DialogTitle><DialogDescription className="text-left text-slate-400">Documento disponibilizado pelo Financeiro · somente leitura</DialogDescription></DialogHeader>
      {falha ? <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-amber-200">
        <FileWarning size={22} aria-hidden="true" /><p>{consulta.error?.message ?? "Documento indisponível. Atualize o card antes de tentar novamente."}</p>
        {url && <button type="button" onClick={() => void consulta.refetch()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3"><RefreshCw size={14} aria-hidden="true" /> Atualizar consulta</button>}
      </div> : !urlPreview ? <p role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-300"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Carregando documento…</p> : <>
        <a href={url ?? undefined} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-lg border border-white/15 px-3 text-xs text-slate-200 hover:bg-white/10"><Download size={14} aria-hidden="true" /> Abrir ou baixar arquivo</a>
        {imagem ? <Image src={urlPreview} alt={anexo.nome} unoptimized width={1200} height={900} className="min-h-0 flex-1 self-center rounded-md object-contain" /> : inline ? <iframe src={urlPreview} title={anexo.nome} className="min-h-0 flex-1 rounded-md bg-white" /> : <p className="flex flex-1 items-center justify-center text-sm text-slate-400">Este tipo de arquivo está disponível para download.</p>}
      </>}
    </DialogContent>
  </Dialog>;
}
