"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ProgramarPagamento } from "@/actions/CommissionPayments";

interface ModalProgramarPagamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  colaboradorNome: string;
  dataAtual?: Date | null;
  onConfirmado?: () => void;
}

export function ModalProgramarPagamento({
  open,
  onOpenChange,
  entryId,
  colaboradorNome,
  dataAtual,
  onConfirmado,
}: ModalProgramarPagamentoProps) {
  const [data, setData] = useState(() =>
    (dataAtual ? new Date(dataAtual) : new Date()).toISOString().slice(0, 10),
  );
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    if (!data) return toast.error("Informe a data prevista.");
    startTransition(async () => {
      const resultado = await ProgramarPagamento({
        entryId,
        scheduledPaymentDate: new Date(`${data}T12:00:00`),
      });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao programar pagamento");
        return;
      }
      toast.success(`Pagamento de ${colaboradorNome} programado.`);
      onOpenChange(false);
      onConfirmado?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-slate-950 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Programar pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-slate-400">{colaboradorNome}</p>
          <label className="block text-xs text-slate-500">Data prevista de pagamento</label>
          <Input type="date" value={data} onChange={(event) => setData(event.target.value)} className="border-white/10 bg-slate-900/50" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={isPending || !data}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
