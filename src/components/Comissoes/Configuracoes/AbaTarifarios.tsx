"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { TariffVersion } from "@prisma/client";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AtualizarTarifario,
  CriarTarifario,
  ExcluirTarifario,
  ListarTarifarios,
} from "@/actions/CommissionTariffs";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarCentavosBRL, formatarDataComissao } from "../lib/formatters";

const FORMAS_PADRAO = JSON.stringify([
  "PARCELADO_CONTRATACAO_EXITO",
  "CARTAO_PARCELADO",
  "A_VISTA_DESCONTO",
]);

export function AbaTarifarios() {
  const [tarifarios, setTarifarios] = useState<TariffVersion[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [servico, setServico] = useState("");
  const [valorReais, setValorReais] = useState("");
  const [dataInicial, setDataInicial] = useState(new Date().toISOString().slice(0, 10));
  const [dataFinal, setDataFinal] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarTarifarios();
    if (resultado.success) setTarifarios(resultado.data);
    else toast.error(resultado.error);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function limparFormulario() {
    setEditandoId(null);
    setServico("");
    setValorReais("");
    setDataInicial(new Date().toISOString().slice(0, 10));
    setDataFinal("");
  }

  function editar(tarifario: TariffVersion) {
    setEditandoId(tarifario.id);
    setServico(tarifario.servico);
    setValorReais((tarifario.valorCents / 100).toFixed(2).replace(".", ","));
    setDataInicial(new Date(tarifario.dataInicial).toISOString().slice(0, 10));
    setDataFinal(tarifario.dataFinal ? new Date(tarifario.dataFinal).toISOString().slice(0, 10) : "");
  }

  function salvar() {
    if (!servico.trim() || !valorReais.trim() || !dataInicial) {
      toast.error("Informe serviço, valor e início da vigência");
      return;
    }

    const valorCents = Math.round(Number(valorReais.replace(",", ".")) * 100);
    if (!Number.isFinite(valorCents) || valorCents < 0) {
      toast.error("Valor inválido");
      return;
    }
    if (dataFinal && dataFinal < dataInicial) {
      toast.error("A data final não pode ser anterior ao início");
      return;
    }

    startTransition(async () => {
      const atual = editandoId ? tarifarios.find((item) => item.id === editandoId) : null;
      const resultado = editandoId
        ? await AtualizarTarifario({
            id: editandoId,
            servico: servico.trim(),
            valorCents,
            dataInicial: new Date(`${dataInicial}T12:00:00`),
            dataFinal: dataFinal ? new Date(`${dataFinal}T12:00:00`) : null,
            formasPagamentoJson: atual?.formasPagamentoJson ?? FORMAS_PADRAO,
          })
        : await CriarTarifario({
            servico: servico.trim(),
            valorCents,
            dataInicial: new Date(`${dataInicial}T12:00:00`),
            dataFinal: dataFinal ? new Date(`${dataFinal}T12:00:00`) : undefined,
            formasPagamentoJson: FORMAS_PADRAO,
          });

      if (!resultado.success) {
        toast.error(resultado.error ?? `Erro ao ${editandoId ? "atualizar" : "criar"} tarifário`);
        return;
      }

      toast.success(editandoId ? "Tarifário atualizado." : "Tarifário criado.");
      limparFormulario();
      void carregar();
    });
  }

  function excluir(id: string) {
    startTransition(async () => {
      const resultado = await ExcluirTarifario({ id });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao excluir tarifário");
        return;
      }
      if (editandoId === id) limparFormulario();
      toast.success("Tarifário excluído.");
      void carregar();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="servico" className="text-slate-400">Serviço</Label>
          <Input id="servico" value={servico} onChange={(e) => setServico(e.target.value)} placeholder="Ex: Revisão de RADAR Ilimitado" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" />
        </div>
        <div>
          <Label htmlFor="valorReais" className="text-slate-400">Valor (R$)</Label>
          <Input id="valorReais" inputMode="decimal" value={valorReais} onChange={(e) => setValorReais(e.target.value)} placeholder="22000,00" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" />
        </div>
        <div>
          <Label htmlFor="dataInicial" className="text-slate-400">Vigência — início</Label>
          <Input id="dataInicial" type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" />
        </div>
        <div>
          <Label htmlFor="dataFinal" className="text-slate-400">Vigência — fim (opcional)</Label>
          <Input id="dataFinal" type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Button onClick={salvar} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {editandoId ? "Salvar alterações" : "Criar Tarifário"}
          </Button>
          {editandoId && (
            <Button onClick={limparFormulario} disabled={isPending} variant="outline" className="gap-2 border-white/10">
              <X className="size-4" aria-hidden="true" />
              Cancelar edição
            </Button>
          )}
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" /></div>
      ) : tarifarios.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhum tarifário cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {tarifarios.map((tarifario) => (
            <div key={tarifario.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-900/40 p-3 ${editandoId === tarifario.id ? "border-blue-500/40" : "border-white/5"}`}>
              <div>
                <p className="text-sm font-medium text-white">{tarifario.servico}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatarCentavosBRL(tarifario.valorCents)} · vigência {formatarDataComissao(tarifario.dataInicial)} a{" "}
                  {tarifario.dataFinal ? formatarDataComissao(tarifario.dataFinal) : "indeterminado"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 border-white/10" onClick={() => editar(tarifario)} disabled={isPending}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 border-white/10 text-rose-400" disabled={isPending}>
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-slate-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-200">Excluir tarifário de &quot;{tarifario.servico}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        O valor deixa de ser considerado nos próximos cálculos. Lançamentos já calculados não são apagados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => excluir(tarifario.id)} className="bg-rose-600 hover:bg-rose-500">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
