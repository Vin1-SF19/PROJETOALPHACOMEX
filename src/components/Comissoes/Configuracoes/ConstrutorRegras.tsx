"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SalvarRascunhoRegra, PublicarRegra } from "@/actions/CommissionRuleBuilder";
import type { CalculationType, ConditionOperator, RuleCondition } from "@/lib/commissions/types";

const OPERADORES: Array<{ value: ConditionOperator; label: string }> = [
  { value: "EQUALS", label: "igual a" },
  { value: "NOT_EQUALS", label: "diferente de" },
  { value: "GREATER_THAN", label: "maior que" },
  { value: "GREATER_THAN_OR_EQUAL", label: "maior ou igual a" },
  { value: "LESS_THAN", label: "menor que" },
  { value: "LESS_THAN_OR_EQUAL", label: "menor ou igual a" },
  { value: "CONTAINS", label: "contém" },
  { value: "IN", label: "pertence a (lista separada por vírgula)" },
  { value: "BETWEEN", label: "entre (dois valores separados por vírgula)" },
  { value: "EXISTS", label: "existe" },
  { value: "NOT_EXISTS", label: "não existe" },
  { value: "BEFORE", label: "antes de" },
  { value: "AFTER", label: "depois de" },
];

const TIPOS_CALCULO: Array<{ value: CalculationType; label: string }> = [
  { value: "PERCENTAGE", label: "Percentual" },
  { value: "FIXED", label: "Valor fixo" },
  { value: "PER_UNIT", label: "Valor por unidade" },
  { value: "ADDITIONAL", label: "Adicional" },
  { value: "DSR", label: "DSR" },
  { value: "CAP", label: "Teto" },
  { value: "FLOOR", label: "Piso" },
  { value: "PROPORTIONAL", label: "Proporcional" },
  { value: "SUM_OF_COMPONENTS", label: "Soma de componentes" },
];

interface CondicaoForm {
  field: string;
  operator: ConditionOperator;
  value: string;
}

/**
 * Builder estruturado (não é drag-and-drop) — suficiente para montar RuleCondition[] +
 * RuleCalculation + PaymentSchedule válidos. Um construtor visual mais rico (arrastar
 * blocos QUANDO/ENTÃO) fica para expansão futura, se priorizado.
 */
export function ConstrutorRegras() {
  const [nome, setNome] = useState("");
  const [eventType, setEventType] = useState("CONTRACTING");
  const [benefitType, setBenefitType] = useState<"COMMISSION" | "BONUS" | "DSR">("COMMISSION");
  const [condicoes, setCondicoes] = useState<CondicaoForm[]>([]);
  const [tipoCalculo, setTipoCalculo] = useState<CalculationType>("FIXED");
  const [rate, setRate] = useState("");
  const [fixedAmountReais, setFixedAmountReais] = useState("");
  const [scheduleRuleName, setScheduleRuleName] = useState("QUINTO_DIA_UTIL_CLT");
  const [isPending, startTransition] = useTransition();
  const [ultimaVersaoId, setUltimaVersaoId] = useState<string | null>(null);

  function adicionarCondicao() {
    setCondicoes((atual) => [...atual, { field: "", operator: "EQUALS", value: "" }]);
  }

  function removerCondicao(index: number) {
    setCondicoes((atual) => atual.filter((_, i) => i !== index));
  }

  function atualizarCondicao(index: number, patch: Partial<CondicaoForm>) {
    setCondicoes((atual) => atual.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function montarConditions(): RuleCondition[] {
    return condicoes
      .filter((c) => c.field.trim())
      .map((c) => ({
        field: c.field.trim(),
        operator: c.operator,
        value: c.operator === "EXISTS" || c.operator === "NOT_EXISTS" ? undefined : c.value,
      }));
  }

  function salvarRascunho() {
    if (!nome.trim()) {
      toast.error("Informe o nome da regra");
      return;
    }

    startTransition(async () => {
      const resultado = await SalvarRascunhoRegra({
        name: nome.trim(),
        priority: 0,
        eventType: eventType as Parameters<typeof SalvarRascunhoRegra>[0]["eventType"],
        benefitType,
        approvalRequired: false,
        conditions: montarConditions(),
        calculation: {
          type: tipoCalculo,
          benefitType,
          rate: tipoCalculo === "PERCENTAGE" || tipoCalculo === "PROPORTIONAL" ? Number(rate) / 100 : undefined,
          fixedAmountCents:
            tipoCalculo === "FIXED" || tipoCalculo === "ADDITIONAL"
              ? Math.round(parseFloat(fixedAmountReais.replace(",", ".")) * 100)
              : undefined,
        },
        paymentSchedule: { scheduleRuleName },
        validFrom: new Date(),
      });

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao salvar rascunho");
        return;
      }

      toast.success("Rascunho salvo.");
      setUltimaVersaoId(resultado.data.versao.id);
    });
  }

  function publicar() {
    if (!ultimaVersaoId) {
      toast.error("Salve um rascunho antes de publicar");
      return;
    }

    startTransition(async () => {
      const resultado = await PublicarRegra({ versionId: ultimaVersaoId });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao publicar regra");
        return;
      }
      toast.success("Regra publicada.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">QUANDO</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nomeRegra" className="text-slate-400">Nome da Regra</Label>
            <Input
              id="nomeRegra"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
            />
          </div>

          <div>
            <Label className="text-slate-400">Evento</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTRACTING">Contratação</SelectItem>
                <SelectItem value="PROCESS_SUCCESS">Êxito</SelectItem>
                <SelectItem value="FIRST_ATTEMPT_SUCCESS">Êxito na 1ª Tentativa</SelectItem>
                <SelectItem value="AUXILIARY_PARTICIPATION">Participação Auxiliar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {condicoes.map((condicao, index) => (
            <div key={index} className="grid grid-cols-[1fr_1.4fr_1fr_auto] gap-2">
              <Input
                value={condicao.field}
                onChange={(e) => atualizarCondicao(index, { field: e.target.value })}
                placeholder="Campo (ex: servico)"
                className="border-white/10 bg-slate-950/60 text-slate-200"
              />
              <Select value={condicao.operator} onValueChange={(v) => atualizarCondicao(index, { operator: v as ConditionOperator })}>
                <SelectTrigger className="w-full border-white/10 bg-slate-950/60 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERADORES.map((op) => (
                    <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={condicao.value}
                onChange={(e) => atualizarCondicao(index, { value: e.target.value })}
                placeholder="Valor"
                disabled={condicao.operator === "EXISTS" || condicao.operator === "NOT_EXISTS"}
                className="border-white/10 bg-slate-950/60 text-slate-200"
              />
              <Button size="sm" variant="ghost" onClick={() => removerCondicao(index)} aria-label="Remover condição">
                <Trash2 className="size-4 text-rose-400" aria-hidden="true" />
              </Button>
            </div>
          ))}

          <Button size="sm" variant="outline" className="gap-2 border-white/10" onClick={adicionarCondicao}>
            <Plus className="size-4" aria-hidden="true" />
            Adicionar condição
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">ENTÃO</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-slate-400">Natureza do Benefício</Label>
            <Select value={benefitType} onValueChange={(v) => setBenefitType(v as "COMMISSION" | "BONUS" | "DSR")}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMMISSION">Comissão</SelectItem>
                <SelectItem value="BONUS">Prêmio</SelectItem>
                <SelectItem value="DSR">DSR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-400">Tipo de Cálculo</Label>
            <Select value={tipoCalculo} onValueChange={(v) => setTipoCalculo(v as CalculationType)}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CALCULO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(tipoCalculo === "PERCENTAGE" || tipoCalculo === "PROPORTIONAL") && (
            <div>
              <Label htmlFor="rate" className="text-slate-400">Percentual (%)</Label>
              <Input
                id="rate"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="4"
                className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
              />
            </div>
          )}

          {(tipoCalculo === "FIXED" || tipoCalculo === "ADDITIONAL") && (
            <div>
              <Label htmlFor="fixedAmount" className="text-slate-400">Valor Fixo (R$)</Label>
              <Input
                id="fixedAmount"
                value={fixedAmountReais}
                onChange={(e) => setFixedAmountReais(e.target.value)}
                placeholder="350,00"
                className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
              />
            </div>
          )}

          <div>
            <Label className="text-slate-400">Regra de Calendário</Label>
            <Select value={scheduleRuleName} onValueChange={setScheduleRuleName}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QUINTO_DIA_UTIL_CLT">5º dia útil (CLT)</SelectItem>
                <SelectItem value="ULTIMO_DIA_MES_SEGUINTE_PREMIO_CLT">Último dia do mês seguinte (prêmio CLT)</SelectItem>
                <SelectItem value="ULTIMO_DIA_MES_SEGUINTE_PJ">Último dia do mês seguinte (PJ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={salvarRascunho} disabled={isPending} variant="outline" className="gap-2 border-white/10">
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Salvar Rascunho
        </Button>
        <Button onClick={publicar} disabled={isPending || !ultimaVersaoId}>
          Publicar
        </Button>
        <Link href="/PainelAlpha/Comissoes/Simulador" className="text-sm text-slate-400 underline hover:text-slate-200">
          Testar no Simulador
        </Link>
      </div>
    </div>
  );
}
