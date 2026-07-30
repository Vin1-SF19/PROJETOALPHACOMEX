"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarCentavosBRL } from "../lib/formatters";
import { EnviarComprovantePagamento, RegistrarPagamento } from "@/actions/CommissionPayments";

interface ModalRegistrarPagamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  colaboradorNome: string;
  totalCents: number;
  onConfirmado?: () => void;
}

const MEIOS_PAGAMENTO = ["PIX", "TED", "Depósito", "Dinheiro", "Outro"];

/**
 * Pagamento individual sempre passa por este modal de confirmação — nunca registra direto
 * ao clicar "Pagar" (seção 6 do desenho do usuário: valor editável para pagamento parcial,
 * data, meio, observação, comprovante).
 */
export function ModalRegistrarPagamento({
  open,
  onOpenChange,
  entryId,
  colaboradorNome,
  totalCents,
  onConfirmado,
}: ModalRegistrarPagamentoProps) {
  const [isPending, startTransition] = useTransition();
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  const [valorReais, setValorReais] = useState((totalCents / 100).toFixed(2).replace(".", ","));
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [meio, setMeio] = useState("PIX");
  const [observacao, setObservacao] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);
  const [comprovanteNome, setComprovanteNome] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function selecionarArquivo(file: File | undefined) {
    if (!file) return;

    setEnviandoComprovante(true);
    void (async () => {
      const fd = new FormData();
      fd.append("file", file);
      const resultado = await EnviarComprovantePagamento(fd);
      setEnviandoComprovante(false);

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao enviar comprovante");
        return;
      }

      setComprovanteUrl(resultado.url);
      setComprovanteNome(file.name);
      toast.success("Comprovante anexado.");
    })();
  }

  function confirmar() {
    const numero = Number(valorReais.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(numero) || numero <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    const valorCents = Math.round(numero * 100);

    startTransition(async () => {
      const resultado = await RegistrarPagamento({
        entryId,
        data: new Date(data),
        valorCents,
        meio,
        observacao: observacao.trim() || undefined,
        comprovanteUrl: comprovanteUrl ?? undefined,
      });

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao registrar pagamento");
        return;
      }

      toast.success(`Pagamento registrado para ${colaboradorNome}.`);
      onOpenChange(false);
      onConfirmado?.();
    });
  }

  const ehParcial = (() => {
    const numero = Number(valorReais.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(numero) && Math.round(numero * 100) < totalCents;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-slate-950 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Registrar pagamento — {colaboradorNome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-500">
            Total devido: <span className="font-mono text-slate-300">{formatarCentavosBRL(totalCents)}</span>
          </p>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Valor pago (R$)</label>
            <Input
              inputMode="decimal"
              value={valorReais}
              onChange={(e) => setValorReais(e.target.value)}
              className="border-white/10 bg-slate-900/40"
            />
            {ehParcial && (
              <p className="mt-1 text-xs text-amber-400">
                Valor menor que o total — o lançamento ficará como &quot;Parcialmente Pago&quot;.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Data do pagamento</label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="border-white/10 bg-slate-900/40"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Meio de pagamento</label>
            <Select value={meio} onValueChange={setMeio}>
              <SelectTrigger className="w-full border-white/10 bg-slate-900/40 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEIOS_PAGAMENTO.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-white/10 bg-slate-900/40 p-2 text-sm text-slate-200 placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">Comprovante (opcional)</label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={enviandoComprovante}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/15 bg-slate-900/40 px-3 py-2 text-xs text-slate-400 hover:border-white/30"
            >
              {enviandoComprovante ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-3.5" aria-hidden="true" />
              )}
              {comprovanteNome ?? "Selecionar arquivo"}
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => selecionarArquivo(e.target.files?.[0])}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="border-white/10" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={isPending || enviandoComprovante}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
