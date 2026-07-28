"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatarCentavosBRL } from "../lib/formatters";
import {
  PrepararPagamentoLoteBigCard,
  RegistrarPagamentoLote,
  type ItemElegivelPagamentoLote,
  type ItemExcluidoPagamentoLote,
} from "@/actions/CommissionPayments";

interface ModalPagarTodosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryIds: string[];
  onConfirmado?: () => void;
}

/**
 * Botão "MARCAR TODOS COMO PAGOS" (seção 20 do prompt) — sempre mostra o preview
 * (elegíveis + excluídos com motivo) ANTES de confirmar. Nunca grava direto.
 */
export function ModalPagarTodos({ open, onOpenChange, entryIds, onConfirmado }: ModalPagarTodosProps) {
  const [carregando, setCarregando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [elegiveis, setElegiveis] = useState<ItemElegivelPagamentoLote[]>([]);
  const [excluidos, setExcluidos] = useState<ItemExcluidoPagamentoLote[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelado = false;

    void (async () => {
      setCarregando(true);
      setErro(null);

      const resultado = await PrepararPagamentoLoteBigCard({ entryIds });
      if (cancelado) return;

      if (resultado.success) {
        setElegiveis(resultado.data.elegiveis);
        setExcluidos(resultado.data.excluidos);
        setTotalCents(resultado.data.totalCents);
      } else {
        setErro(resultado.error);
      }
      setCarregando(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [open, entryIds]);

  function confirmar() {
    startTransition(async () => {
      const resultado = await RegistrarPagamentoLote({
        entryIds: elegiveis.map((e) => e.entryId),
        data: new Date(),
        meio: "PIX",
      });

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao registrar pagamentos");
        return;
      }

      toast.success(`${resultado.data.processados.length} pagamento(s) registrado(s).`);
      onOpenChange(false);
      onConfirmado?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-slate-950 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Marcar todos como pagos</DialogTitle>
        </DialogHeader>

        {carregando ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
          </div>
        ) : erro ? (
          <p className="py-4 text-sm text-rose-400">
            Não foi possível preparar o pagamento em lote. <code className="text-xs">{erro}</code>
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-emerald-400">
                {elegiveis.length} lançamento(s) serão pagos — total {formatarCentavosBRL(totalCents)}
              </p>
            </div>

            {excluidos.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-amber-400">
                  {excluidos.length} lançamento(s) NÃO serão incluídos:
                </p>
                <ul className="space-y-1 text-xs text-slate-400">
                  {excluidos.map((item) => (
                    <li key={item.entryId} className="rounded-lg border border-white/5 bg-slate-900/40 px-2 py-1">
                      {item.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="border-white/10" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={carregando || isPending || elegiveis.length === 0}>
            {isPending ? "Confirmando..." : `Confirmar (${elegiveis.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
