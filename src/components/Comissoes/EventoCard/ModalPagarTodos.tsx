"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatarCentavosBRL } from "../lib/formatters";
import {
  EnviarComprovantePagamento,
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

export function ModalPagarTodos({ open, onOpenChange, entryIds, onConfirmado }: ModalPagarTodosProps) {
  const [carregando, setCarregando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [elegiveis, setElegiveis] = useState<ItemElegivelPagamentoLote[]>([]);
  const [excluidos, setExcluidos] = useState<ItemExcluidoPagamentoLote[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [meio, setMeio] = useState("PIX");
  const [referencia, setReferencia] = useState("");
  const [observacao, setObservacao] = useState("");
  const [comprovantePathname, setComprovantePathname] = useState<string | null>(null);
  const [comprovanteNome, setComprovanteNome] = useState<string | null>(null);
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    void PrepararPagamentoLoteBigCard({ entryIds }).then((resultado) => {
      if (cancelado) return;
      if (resultado.success) {
        setElegiveis(resultado.data.elegiveis);
        setExcluidos(resultado.data.excluidos);
        setTotalCents(resultado.data.totalCents);
      } else setErro(resultado.error);
      setCarregando(false);
    });
    return () => { cancelado = true; };
  }, [open, entryIds]);

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
    })();
  }

  function confirmar() {
    if (!data) return toast.error("Informe a data do pagamento.");
    startTransition(async () => {
      const resultado = await RegistrarPagamentoLote({
        entryIds: elegiveis.map((entry) => entry.entryId),
        data: new Date(`${data}T12:00:00`),
        meio,
        referencia: referencia.trim() || undefined,
        observacao: observacao.trim() || undefined,
        comprovantePathname: comprovantePathname ?? undefined,
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto border-white/10 bg-slate-950 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Confirmar pagamento do evento</DialogTitle>
        </DialogHeader>

        {carregando ? (
          <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-slate-500" /></div>
        ) : erro ? (
          <p className="text-sm text-rose-400">{erro}</p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-sm font-medium text-emerald-300">{elegiveis.length} pagamento(s) elegível(is)</p>
              <p className="mt-1 font-mono text-xl text-white">{formatarCentavosBRL(totalCents)}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {elegiveis.map((entry) => (
                <article key={entry.entryId} className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
                  <div className="flex justify-between gap-3">
                    <div><p className="text-sm font-medium text-white">{entry.colaboradorNome}</p><p className="text-xs text-slate-500">{entry.cargoNome ?? "Cargo não informado"}</p></div>
                    <p className="font-mono text-sm text-amber-300">{formatarCentavosBRL(entry.valorPendenteCents)}</p>
                  </div>
                  <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
                    {entry.componentes.map((componente, index) => (
                      <div key={`${entry.entryId}-${index}`} className="flex justify-between gap-2 text-xs text-slate-400">
                        <span>{componente.descricao}</span><span className="font-mono">{formatarCentavosBRL(componente.valorCents)}</span>
                      </div>
                    ))}
                    {entry.saldoPagoCents > 0 && <p className="text-xs text-emerald-400">Já pago: {formatarCentavosBRL(entry.saldoPagoCents)}</p>}
                  </div>
                </article>
              ))}
            </div>

            {excluidos.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-300"><AlertTriangle className="size-4" />Não incluídos no lote</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {excluidos.map((entry) => <li key={entry.entryId}><strong>{entry.colaboradorNome}</strong>{entry.cargoNome ? ` — ${entry.cargoNome}` : ""}: {entry.motivo}</li>)}
                </ul>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Campo label="Data do pagamento"><Input type="date" value={data} onChange={(event) => setData(event.target.value)} className="border-white/10 bg-slate-900/50" /></Campo>
              <Campo label="Meio de pagamento">
                <Select value={meio} onValueChange={setMeio}><SelectTrigger className="w-full border-white/10 bg-slate-900/50"><SelectValue /></SelectTrigger><SelectContent>{["PIX", "TED", "Depósito", "Dinheiro", "Outro"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
              </Campo>
              <Campo label="Referência"><Input value={referencia} maxLength={120} onChange={(event) => setReferencia(event.target.value)} className="border-white/10 bg-slate-900/50" /></Campo>
              <Campo label="Comprovante">
                <button type="button" disabled={enviandoComprovante} onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/15 p-2 text-xs text-slate-400">{enviandoComprovante ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{comprovanteNome ?? "Selecionar arquivo"}</button>
                <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => selecionarArquivo(event.target.files?.[0])} />
              </Campo>
              <div className="md:col-span-2"><Campo label="Observação"><textarea rows={3} maxLength={1000} value={observacao} onChange={(event) => setObservacao(event.target.value)} className="w-full rounded-md border border-white/10 bg-slate-900/50 p-2 text-sm text-slate-200" /></Campo></div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={carregando || isPending || enviandoComprovante || elegiveis.length === 0}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Confirmar {elegiveis.length} pagamento(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="block text-xs text-slate-500">{label}</label>{children}</div>;
}
