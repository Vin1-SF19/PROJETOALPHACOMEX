"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "../lib/status-badge";
import { formatarCentavosBRL, formatarDataComissao } from "../lib/formatters";
import { BuscarDetalhesLancamento, CriarAjusteManual } from "@/actions/CommissionEntries";
import { EstornarPagamento } from "@/actions/CommissionPayments";
import { EditorResponsavel } from "./EditorResponsavel";
import { ModalRegistrarPagamento } from "../MiniCard/ModalRegistrarPagamento";
import { ModalProgramarPagamento } from "../MiniCard/ModalProgramarPagamento";

interface ModalDetalhesLancamentoProps {
  entryId: string | null;
  onOpenChange: (open: boolean) => void;
  onAtualizar?: () => void;
}

interface MemoriaCalculo {
  ruleName?: string;
  ruleVersion?: number;
  eventType?: string;
  commissionableBaseCents?: number;
  rate?: number;
  calculatedAmountCents?: number;
  reason?: string;
}

const TIPO_LABEL: Record<string, string> = { COMISSAO: "Comissão", PREMIO: "Prêmio", DSR: "DSR", AJUSTE: "Ajuste" };

export function ModalDetalhesLancamento({ entryId, onOpenChange, onAtualizar }: ModalDetalhesLancamentoProps) {
  const [carregando, setCarregando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<Awaited<ReturnType<typeof BuscarDetalhesLancamento>> | null>(null);
  const [valorAjuste, setValorAjuste] = useState("");
  const [justificativaAjuste, setJustificativaAjuste] = useState("");
  const [enviandoAjuste, setEnviandoAjuste] = useState(false);
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false);
  const [modalProgramacaoAberto, setModalProgramacaoAberto] = useState(false);

  useEffect(() => {
    if (!entryId) return;

    let cancelado = false;

    void (async () => {
      setCarregando(true);
      setErro(null);
      setDados(null);

      const resultado = await BuscarDetalhesLancamento({ entryId });
      if (cancelado) return;

      if (!resultado.success) setErro(resultado.error);
      setDados(resultado);
      setCarregando(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [entryId]);

  function recarregar() {
    if (!entryId) return;
    void (async () => {
      const resultado = await BuscarDetalhesLancamento({ entryId });
      setDados(resultado);
    })();
    onAtualizar?.();
  }

  function estornar(paymentId: string) {
    startTransition(async () => {
      const resultado = await EstornarPagamento({ paymentId, motivo: "Estorno solicitado via modal de detalhes" });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao estornar pagamento");
        return;
      }
      toast.success("Pagamento estornado.");
      recarregar();
    });
  }

  function criarAjuste() {
    if (!dados?.success) return;

    const numero = Number(valorAjuste.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(numero)) {
      toast.error("Valor ajustado inválido.");
      return;
    }

    setEnviandoAjuste(true);
    void (async () => {
      const resultado = await CriarAjusteManual({
        entryId: dados.data.entry.id,
        valorAjustadoCents: Math.round(numero * 100),
        justificativa: justificativaAjuste,
      });
      setEnviandoAjuste(false);

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao criar ajuste manual");
        return;
      }

      toast.success("Ajuste manual registrado.");
      setValorAjuste("");
      setJustificativaAjuste("");
      recarregar();
    })();
  }

  return (
    <Dialog open={entryId !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto border-white/10 bg-slate-950 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Detalhes do Lançamento</DialogTitle>
        </DialogHeader>

        {carregando ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
          </div>
        ) : erro ? (
          <p className="py-4 text-sm text-rose-400">
            Não foi possível carregar os detalhes. <code className="text-xs">{erro}</code>
          </p>
        ) : dados?.success ? (
          <>
            <Tabs defaultValue="resumo">
              <TabsList className="flex w-full justify-start overflow-x-auto">
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="memoria">Memória</TabsTrigger>
                <TabsTrigger value="regra">Regra</TabsTrigger>
                <TabsTrigger value="pagamentos">Pagtos.</TabsTrigger>
                <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
                <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
              </TabsList>

              <TabsContent value="resumo" className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <StatusBadge status={dados.data.entry.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vínculo</span>
                  <span className="text-slate-300">{dados.data.entry.vinculo}</span>
                </div>
                <EditorResponsavel
                  label="Closer"
                  eventId={dados.data.eventId}
                  nomeAtual={dados.data.closerNome}
                  campo="closer"
                  onAtualizado={recarregar}
                />
                <EditorResponsavel
                  label="Analista Responsável"
                  eventId={dados.data.eventId}
                  nomeAtual={dados.data.analistaResponsavelNome}
                  campo="analistaResponsavel"
                  onAtualizado={recarregar}
                />
                <div className="flex justify-between">
                  <span className="text-slate-500">Total</span>
                  <span className="font-mono tabular-nums text-white">
                    {formatarCentavosBRL(dados.data.entry.totalCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Saldo pago</span>
                  <span className="font-mono tabular-nums text-emerald-300">{formatarCentavosBRL(dados.data.saldoPagoCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Saldo pendente</span>
                  <span className="font-mono tabular-nums text-amber-300">{formatarCentavosBRL(dados.data.saldoPendenteCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vencimento contratual</span>
                  <span className="text-slate-300">{formatarDataComissao(dados.data.entry.contractualDueDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data operacional sugerida</span>
                  <span className="text-slate-300">{formatarDataComissao(dados.data.entry.operationalSuggestedDate)}</span>
                </div>
              </TabsContent>

              <TabsContent value="memoria" className="space-y-3 text-sm">
                {dados.data.entry.componentes.map((componente) => {
                  let memoria: MemoriaCalculo = {};
                  try {
                    memoria = JSON.parse(componente.memoriaCalculoJson);
                  } catch {
                    // memória mal-formada — exibe fallback abaixo, nunca quebra a tela
                  }
                  return (
                    <div key={componente.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
                      <p className="font-medium text-slate-200">{TIPO_LABEL[componente.tipo] ?? componente.tipo}</p>
                      {memoria.reason ? (
                        <p className="mt-1 text-xs text-slate-400">{memoria.reason}</p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">Sem memória de cálculo detalhada.</p>
                      )}
                      <p className="mt-1 font-mono text-xs tabular-nums text-slate-300">
                        Valor: {formatarCentavosBRL(componente.valorCents)}
                        {componente.percentual !== null && ` · ${(componente.percentual * 100).toFixed(2)}%`}
                      </p>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="regra" className="text-sm text-slate-400">
                {dados.data.entry.componentes.map((componente) => {
                  let memoria: MemoriaCalculo = {};
                  try {
                    memoria = JSON.parse(componente.memoriaCalculoJson);
                  } catch {
                    // memória mal-formada — ignorado, fallback já é mostrado na aba Memória
                  }
                  return (
                    <p key={componente.id}>
                      {memoria.ruleName ?? "Regra não identificada"}
                      {memoria.ruleVersion ? ` (v${memoria.ruleVersion})` : ""}
                    </p>
                  );
                })}
              </TabsContent>

              <TabsContent value="pagamentos" className="space-y-2 text-sm">
                {dados.data.entry.alocacoes.length === 0 ? (
                  <p className="text-slate-500">Nenhum pagamento registrado ainda.</p>
                ) : (
                  dados.data.entry.alocacoes.map((alocacao) => (
                    <div key={alocacao.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/40 p-3">
                      <div>
                        <p className="text-slate-200">
                          {alocacao.payment.tipo === "ESTORNO" ? "Estorno" : "Pagamento"} — {formatarDataComissao(alocacao.payment.data)}
                        </p>
                        <p className="text-xs text-slate-500">{alocacao.payment.meio}</p>
                        {alocacao.payment.comprovanteUrl && (
                          <a
                            href={`/api/comissoes/comprovantes/${alocacao.paymentId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs text-cyan-300 underline"
                          >
                            Baixar comprovante
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-slate-300">
                          {formatarCentavosBRL(alocacao.valorCents)}
                        </span>
                        {alocacao.payment.tipo === "PAGAMENTO" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-400">
                                Estornar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-white/10 bg-slate-950">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-slate-200">Estornar pagamento?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-400">
                                  Esta ação registra um estorno de {formatarCentavosBRL(alocacao.valorCents)} e não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => estornar(alocacao.paymentId)}>
                                  Confirmar estorno
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="ajustes" className="space-y-3 text-sm">
                {dados.data.entry.ajustes.length === 0 ? (
                  <p className="text-slate-500">Nenhum ajuste manual registrado.</p>
                ) : (
                  dados.data.entry.ajustes.map((ajuste) => (
                    <div key={ajuste.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
                      <p className="text-slate-300">{ajuste.justificativa}</p>
                      <p className="mt-1 font-mono tabular-nums text-slate-400">
                        {formatarCentavosBRL(ajuste.valorOriginalCents)} → {formatarCentavosBRL(ajuste.valorAjustadoCents)}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {ajuste.aprovadoEm ? "Aprovado" : "Pendente de aprovação"}
                      </p>
                    </div>
                  ))
                )}

                {dados.data.entry.status === "Pago" || dados.data.entry.status === "Estornado" ? (
                  <p className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs text-slate-500">
                    Lançamento {dados.data.entry.status === "Pago" ? "pago" : "estornado"} — não é possível criar novo ajuste.
                  </p>
                ) : (
                  <div className="space-y-2 rounded-xl border border-white/5 bg-slate-900/40 p-3">
                    <p className="text-xs font-medium text-slate-300">Novo ajuste manual</p>
                    <Input
                      inputMode="decimal"
                      placeholder="Valor ajustado (ex: 1500,00)"
                      value={valorAjuste}
                      onChange={(e) => setValorAjuste(e.target.value)}
                      className="border-white/10 bg-slate-950 text-sm"
                    />
                    <textarea
                      placeholder="Justificativa (mínimo 10 caracteres)"
                      value={justificativaAjuste}
                      onChange={(e) => setJustificativaAjuste(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-white/10 bg-slate-950 p-2 text-sm text-slate-200 placeholder:text-slate-600"
                    />
                    <Button
                      size="sm"
                      disabled={enviandoAjuste || !valorAjuste || justificativaAjuste.trim().length < 10}
                      onClick={criarAjuste}
                    >
                      {enviandoAjuste ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "Registrar ajuste"}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="historico" className="text-sm text-slate-500">
                <p>Histórico consolidado a partir da aba Auditoria.</p>
              </TabsContent>

              <TabsContent value="auditoria" className="space-y-2 text-sm">
                {dados.data.auditoria.length === 0 ? (
                  <p className="text-slate-500">Sem eventos de auditoria.</p>
                ) : (
                  dados.data.auditoria.map((log) => (
                    <div key={log.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs">
                      <p className="text-slate-300">{log.acao}</p>
                      <p className="text-slate-500">{formatarDataComissao(log.createdAt)}</p>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
              <Button size="sm" disabled={isPending || dados.data.saldoPendenteCents <= 0} onClick={() => setModalPagamentoAberto(true)}>
                Registrar pagamento
              </Button>
              <Button size="sm" variant="outline" className="border-white/10" disabled={isPending || dados.data.saldoPendenteCents <= 0} onClick={() => setModalProgramacaoAberto(true)}>
                Programar pagamento
              </Button>
            </div>
            {modalPagamentoAberto && (
              <ModalRegistrarPagamento
                open
                onOpenChange={setModalPagamentoAberto}
                entryId={dados.data.entry.id}
                colaboradorNome={dados.data.colaboradorNome}
                saldoPendenteCents={dados.data.saldoPendenteCents}
                onConfirmado={recarregar}
              />
            )}
            {modalProgramacaoAberto && (
              <ModalProgramarPagamento
                open
                onOpenChange={setModalProgramacaoAberto}
                entryId={dados.data.entry.id}
                colaboradorNome={dados.data.colaboradorNome}
                dataAtual={dados.data.entry.scheduledPaymentDate}
                onConfirmado={recarregar}
              />
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
