"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { buscarHtmlApresentacao } from "@/lib/apresentacoes/exportacao";

interface ModalVisualizadorHtmlProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apresentacaoId: string;
  titulo: string;
  /**
   * Chamado uma vez, ao abrir, ANTES de buscar o HTML — usado pelo editor pra esperar o
   * salvamento do slide ativo terminar (se houver alteração pendente), garantindo que a prévia
   * reflita o que está no banco, não uma versão desatualizada. `undefined`/promise resolvida
   * imediatamente = nada a esperar.
   */
  aguardarAntesDeGerar?: () => Promise<void> | null | undefined;
}

type Status = "carregando" | "pronto" | "erro";

/**
 * Prévia da apresentação como um EXIBIDOR HTML de verdade: busca o mesmo arquivo `.html`
 * autocontido gerado por "Exportar HTML" e renderiza num iframe — não é mais o player React
 * ao vivo (`ModoApresentacaoClient`, que segue existindo só pra rota standalone
 * `/PainelAlpha/Apresentacoes/[id]/apresentar`). Garante fidelidade 100% com o que o usuário
 * baixa: WYSIWYG real, um único caminho de renderização pra acertar em vez de dois divergentes.
 */
export function ModalVisualizadorHtml({
  open,
  onOpenChange,
  apresentacaoId,
  titulo,
  aguardarAntesDeGerar,
}: ModalVisualizadorHtmlProps) {
  const [status, setStatus] = useState<Status>("carregando");
  const [html, setHtml] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const aguardarRef = useRef(aguardarAntesDeGerar);

  useEffect(() => {
    aguardarRef.current = aguardarAntesDeGerar;
  }, [aguardarAntesDeGerar]);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;

    (async () => {
      setStatus("carregando");
      setErro(null);
      try {
        await aguardarRef.current?.();
        const conteudo = await buscarHtmlApresentacao(apresentacaoId);
        if (cancelado) return;
        setHtml(conteudo);
        setStatus("pronto");
      } catch (erroCapturado) {
        if (cancelado) return;
        setErro(erroCapturado instanceof Error ? erroCapturado.message : "Falha ao gerar a prévia.");
        setStatus("erro");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [open, apresentacaoId, tentativa]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="aspect-video h-auto w-[min(96vw,1440px,163.555dvh)] max-w-none gap-0 overflow-hidden rounded-2xl border-white/10 bg-black p-0 shadow-2xl sm:max-w-none"
      >
        <DialogTitle className="sr-only">Prévia — {titulo}</DialogTitle>
        <DialogDescription className="sr-only">
          Prévia do arquivo HTML autocontido que será exportado, exibida dentro de um iframe.
        </DialogDescription>

        {status === "carregando" && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
            <p className="text-sm">Gerando a prévia do HTML exportado…</p>
          </div>
        )}

        {status === "erro" && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-8 text-center text-slate-300">
            <TriangleAlert size={28} className="text-amber-400" aria-hidden="true" />
            <p className="max-w-md text-sm">{erro}</p>
            <button
              type="button"
              onClick={() => setTentativa((atual) => atual + 1)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:border-white/20 hover:text-white"
            >
              <RefreshCw size={13} aria-hidden="true" /> Tentar de novo
            </button>
          </div>
        )}

        {status === "pronto" && html !== null && (
          <iframe
            key={tentativa}
            title={`Prévia — ${titulo}`}
            srcDoc={html}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
