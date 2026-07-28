"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarCentavosBRL, formatarDataComissao } from "../lib/formatters";
import { CriarTarifario, ListarTarifarios } from "@/actions/CommissionTariffs";
import type { TariffVersion } from "@prisma/client";

export function AbaTarifarios() {
  const [tarifarios, setTarifarios] = useState<TariffVersion[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [servico, setServico] = useState("");
  const [valorReais, setValorReais] = useState("");
  const [dataInicial, setDataInicial] = useState(new Date().toISOString().slice(0, 10));
  const [dataFinal, setDataFinal] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarTarifarios();
    if (resultado.success) {
      setTarifarios(resultado.data);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function criar() {
    if (!servico.trim() || !valorReais.trim()) {
      toast.error("Informe serviço e valor");
      return;
    }

    const valorCents = Math.round(parseFloat(valorReais.replace(",", ".")) * 100);
    if (!Number.isFinite(valorCents) || valorCents < 0) {
      toast.error("Valor inválido");
      return;
    }

    startTransition(async () => {
      const resultado = await CriarTarifario({
        servico: servico.trim(),
        valorCents,
        dataInicial: new Date(dataInicial),
        dataFinal: dataFinal ? new Date(dataFinal) : undefined,
        // TODO(expansão futura): formasPagamentoJson hoje é um placeholder fixo — a Fase
        // 14 completa poderia trazer um seletor multi-select de formas de pagamento em
        // vez de um JSON hardcoded.
        formasPagamentoJson: JSON.stringify(["PARCELADO_CONTRATACAO_EXITO", "CARTAO_PARCELADO", "A_VISTA_DESCONTO"]),
      });

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao criar tarifário");
        return;
      }

      toast.success("Tarifário criado. Divergências de \"serviço sem tarifário\" param de disparar para este serviço.");
      setServico("");
      setValorReais("");
      void carregar();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="servico" className="text-slate-400">Serviço</Label>
          <Input
            id="servico"
            value={servico}
            onChange={(e) => setServico(e.target.value)}
            placeholder="Ex: Revisão de RADAR Ilimitado"
            className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
          />
        </div>

        <div>
          <Label htmlFor="valorReais" className="text-slate-400">Valor (R$)</Label>
          <Input
            id="valorReais"
            value={valorReais}
            onChange={(e) => setValorReais(e.target.value)}
            placeholder="22000,00"
            className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
          />
        </div>

        <div>
          <Label htmlFor="dataInicial" className="text-slate-400">Vigência — início</Label>
          <Input
            id="dataInicial"
            type="date"
            value={dataInicial}
            onChange={(e) => setDataInicial(e.target.value)}
            className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
          />
        </div>

        <div>
          <Label htmlFor="dataFinal" className="text-slate-400">Vigência — fim (opcional)</Label>
          <Input
            id="dataFinal"
            type="date"
            value={dataFinal}
            onChange={(e) => setDataFinal(e.target.value)}
            className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <Button onClick={criar} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            Criar Tarifário
          </Button>
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
        </div>
      ) : tarifarios.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhum tarifário cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {tarifarios.map((tarifario) => (
            <div key={tarifario.id} className="rounded-2xl border border-white/5 bg-slate-900/40 p-3">
              <p className="text-sm font-medium text-white">{tarifario.servico}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatarCentavosBRL(tarifario.valorCents)} · vigência {formatarDataComissao(tarifario.dataInicial)} a{" "}
                {tarifario.dataFinal ? formatarDataComissao(tarifario.dataFinal) : "indeterminado"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
