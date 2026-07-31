"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatarCentavosBRL } from "../lib/formatters";
import { EnviarComprovantePagamento, RegistrarPagamento } from "@/actions/CommissionPayments";

interface ModalRegistrarPagamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  colaboradorNome: string;
  saldoPendenteCents: number;
  onConfirmado?: () => void;
}

const MEIOS_PAGAMENTO = ["PIX", "TED", "Depósito", "Dinheiro", "Outro"];

export function ModalRegistrarPagamento({
  open,
  onOpenChange,
  entryId,
  colaboradorNome,
  saldoPendenteCents,
  onConfirmado,
}: ModalRegistrarPagamentoProps) {
  const [isPending, startTransition] = useTransition();
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  const [tipoPagamento, setTipoPagamento] = useState<"integral" | "parcial">("integral");
  const [valorReais, setValorReais] = useState(() => (saldoPendenteCents / 100).toFixed(2).replace(".", ","));
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [meio, setMeio] = useState("PIX");
  const [referencia, setReferencia] = useState("");
  const [observacao, setObservacao] = useState("");
  const [comprovantePathname, setComprovantePathname] = useState<string | null>(null);
  const [comprovanteNome, setComprovanteNome] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function mudarTipo(tipo: "integral" | "parcial") {
    setTipoPagamento(tipo);
    if (tipo === "integral") setValorReais((saldoPendenteCents / 100).toFixed(2).replace(".", ","));
    else setValorReais("");
  }

  function selecionarArquivo(file?: File) {
    if (!file) return;
    setEnviandoComprovante(true);
    void (async () => {
      const formData = new FormData();
      formData.append("file", file);
      const resultado = await EnviarComprovantePagamento(formData);
      setEnviandoComprovante(false);
      if (!resultado.success) return toast.error(resultado.error ?? "Erro ao enviar comprovante");
      setComprovantePathname(resultado.pathname);
      setComprovanteNome(file.name);
      toast.success("Comprovante protegido e anexado.");
    })();
  }

  function confirmar() {
    const numero = Number(valorReais.replace(/\./g, "").replace(",", "."));
    const valorCents = Math.round(numero * 100);
    if (!Number.isFinite(numero) || valorCents <= 0) return toast.error("Informe um valor válido.");
    if (valorCents > saldoPendenteCents) return toast.error("O valor supera o saldo pendente.");
    if (!data) return toast.error("Informe a data do pagamento.");

    startTransition(async () => {
      const resultado = await RegistrarPagamento({
        entryId,
        data: new Date(`${data}T12:00:00`),
        valorCents,
        meio,
        referencia: referencia.trim() || undefined,
        observacao: observacao.trim() || undefined,
        comprovantePathname: comprovantePathname ?? undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-white/10 bg-slate-950 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Registrar pagamento — {colaboradorNome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-500">
            Saldo pendente: <span className="font-mono text-slate-200">{formatarCentavosBRL(saldoPendenteCents)}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={tipoPagamento === "integral" ? "secondary" : "outline"} onClick={() => mudarTipo("integral")}>Integral</Button>
            <Button type="button" variant={tipoPagamento === "parcial" ? "secondary" : "outline"} onClick={() => mudarTipo("parcial")}>Parcial</Button>
          </div>
          <Campo label="Valor pago (R$)">
            <Input inputMode="decimal" value={valorReais} readOnly={tipoPagamento === "integral"} onChange={(event) => setValorReais(event.target.value)} className="border-white/10 bg-slate-900/50" />
          </Campo>
          <Campo label="Data do pagamento">
            <Input type="date" value={data} onChange={(event) => setData(event.target.value)} className="border-white/10 bg-slate-900/50" />
          </Campo>
          <Campo label="Meio de pagamento">
            <Select value={meio} onValueChange={setMeio}>
              <SelectTrigger className="w-full border-white/10 bg-slate-900/50"><SelectValue /></SelectTrigger>
              <SelectContent>{MEIOS_PAGAMENTO.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label="Referência (opcional)">
            <Input value={referencia} maxLength={120} onChange={(event) => setReferencia(event.target.value)} placeholder="Lote, banco, ID da transação..." className="border-white/10 bg-slate-900/50" />
          </Campo>
          <Campo label="Observação (opcional)">
            <textarea value={observacao} maxLength={1000} onChange={(event) => setObservacao(event.target.value)} rows={3} className="w-full rounded-md border border-white/10 bg-slate-900/50 p-2 text-slate-200" />
          </Campo>
          <Campo label="Comprovante (PDF ou imagem, até 10 MB)">
            <button type="button" disabled={enviandoComprovante} onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/15 p-3 text-xs text-slate-400">
              {enviandoComprovante ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {comprovanteNome ?? "Selecionar arquivo"}
            </button>
            <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => selecionarArquivo(event.target.files?.[0])} />
          </Campo>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={isPending || enviandoComprovante || saldoPendenteCents <= 0}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="block text-xs text-slate-500">{label}</label>{children}</div>;
}
