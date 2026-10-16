"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AvisoMovimentoRd, ConfirmacaoPendenciasRd } from "@/lib/bpm/movimento-importado-rd";

export interface MovimentoRdPendente {
  cardId: string;
  etapaDestinoId: string;
  etapaDestinoNome: string;
  idempotencyKey: string;
  confirmacao: ConfirmacaoPendenciasRd;
  avisos: AvisoMovimentoRd[];
}

interface ConfirmarMovimentoRdModalProps {
  open: boolean;
  etapaDestinoNome: string;
  avisos: AvisoMovimentoRd[];
  processando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

export function ConfirmarMovimentoRdModal({ open, etapaDestinoNome, avisos, processando, onCancelar, onConfirmar }: ConfirmarMovimentoRdModalProps) {
  return (
    <Dialog open={open} onOpenChange={(aberto) => { if (!aberto && !processando) onCancelar(); }}>
      <DialogContent showCloseButton={!processando} className="max-h-[85vh] overflow-y-auto border-white/10 bg-slate-950 text-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-4">
            <AlertTriangle className="size-5 shrink-0 text-amber-300" aria-hidden="true" />
            Mover para {etapaDestinoNome}?
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Estas informações obrigatórias estão pendentes. Você pode mover o card e preenchê-las depois.
          </DialogDescription>
        </DialogHeader>
        <ul aria-label="Informações obrigatórias pendentes" className="list-disc space-y-2 rounded-xl border border-amber-300/20 bg-amber-300/10 py-4 pl-8 pr-4 text-sm text-amber-100">
          {avisos.map((aviso) => <li key={aviso.key}>{aviso.nome}</li>)}
        </ul>
        <DialogFooter>
          <button type="button" onClick={onCancelar} disabled={processando} className="min-h-11 rounded-lg border border-white/15 px-4 text-xs font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50">
            Cancelar para preencher
          </button>
          <button type="button" onClick={onConfirmar} disabled={processando} aria-busy={processando} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 text-xs font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50">
            {processando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Mover mesmo assim
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
