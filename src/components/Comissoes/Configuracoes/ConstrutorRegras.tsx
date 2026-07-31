"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Power, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  CriarVersaoRegra,
  InativarRegra,
  ListarRegrasConfiguracao,
  PublicarRegra,
  ReativarRegra,
  SalvarRascunhoRegra,
} from "@/actions/CommissionRuleBuilder";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CalculationType, ConditionOperator, RuleCalculation, RuleCondition } from "@/lib/commissions/types";

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
  { value: "TOTAL_FIXO_COM_DSR", label: "Total fixo (comissão + DSR decompostos)" },
  { value: "CAP", label: "Teto" },
  { value: "FLOOR", label: "Piso" },
  { value: "PROPORTIONAL", label: "Proporcional" },
  { value: "SUM_OF_COMPONENTS", label: "Soma de componentes" },
];

const EVENTO_LABEL: Record<string, string> = {
  CONTRACTING: "Contratação",
  PROCESS_SUCCESS: "Êxito",
  FIRST_ATTEMPT_SUCCESS: "Êxito na 1ª tentativa",
  AUXILIARY_PARTICIPATION: "Participação auxiliar",
};
const BENEFICIO_LABEL: Record<string, string> = { COMMISSION: "Comissão", BONUS: "Prêmio", DSR: "DSR" };

interface CondicaoForm {
  field: string;
  operator: ConditionOperator;
  value: string;
}

interface RegraConfigRow {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  eventType: string;
  benefitType: "COMMISSION" | "BONUS" | "DSR";
  ultimaVersao: {
    id: string;
    version: number;
    status: string;
    conditionsJson: string;
    calculationJson: string;
    paymentScheduleJson: string;
  } | null;
}

function lerJson<T>(valor: string | undefined, fallback: T): T {
  if (!valor) return fallback;
  try {
    return JSON.parse(valor) as T;
  } catch {
    return fallback;
  }
}

export function ConstrutorRegras() {
  const [regras, setRegras] = useState<RegraConfigRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editandoRegraId, setEditandoRegraId] = useState<string | null>(null);
  const [ultimaVersaoId, setUltimaVersaoId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [eventType, setEventType] = useState("CONTRACTING");
  const [benefitType, setBenefitType] = useState<"COMMISSION" | "BONUS" | "DSR">("COMMISSION");
  const [condicoes, setCondicoes] = useState<CondicaoForm[]>([]);
  const [tipoCalculo, setTipoCalculo] = useState<CalculationType>("FIXED");
  const [rate, setRate] = useState("");
  const [fixedAmountReais, setFixedAmountReais] = useState("");
  const [scheduleRuleName, setScheduleRuleName] = useState("QUINTO_DIA_UTIL_CLT");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarRegrasConfiguracao();
    if (resultado.success) setRegras(resultado.data as RegraConfigRow[]);
    else toast.error(resultado.error);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function novaRegra() {
    setEditandoRegraId(null);
    setUltimaVersaoId(null);
    setNome("");
    setEventType("CONTRACTING");
    setBenefitType("COMMISSION");
    setCondicoes([]);
    setTipoCalculo("FIXED");
    setRate("");
    setFixedAmountReais("");
    setScheduleRuleName("QUINTO_DIA_UTIL_CLT");
  }

  function editarRegra(regra: RegraConfigRow) {
    const versao = regra.ultimaVersao;
    const conditions = lerJson<RuleCondition[]>(versao?.conditionsJson, []);
    const calculation = lerJson<RuleCalculation | null>(versao?.calculationJson, null);
    const schedule = lerJson<{ scheduleRuleName?: string }>(versao?.paymentScheduleJson, {});

    setEditandoRegraId(regra.id);
    setUltimaVersaoId(versao?.status === "DRAFT" ? versao.id : null);
    setNome(regra.name);
    setEventType(regra.eventType);
    setBenefitType(regra.benefitType);
    setCondicoes(conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: condition.value === undefined ? "" : Array.isArray(condition.value) ? condition.value.join(", ") : String(condition.value),
    })));
    setTipoCalculo(calculation?.type ?? "FIXED");
    setRate(calculation?.rate === undefined ? "" : String(calculation.rate * 100));
    const cents = calculation?.fixedAmountCents ?? calculation?.totalFixoComDsrCents;
    setFixedAmountReais(cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ","));
    setScheduleRuleName(schedule.scheduleRuleName ?? "QUINTO_DIA_UTIL_CLT");
  }

  function adicionarCondicao() {
    setCondicoes((atual) => [...atual, { field: "", operator: "EQUALS", value: "" }]);
  }

  function removerCondicao(index: number) {
    setCondicoes((atual) => atual.filter((_, itemIndex) => itemIndex !== index));
  }

  function atualizarCondicao(index: number, patch: Partial<CondicaoForm>) {
    setCondicoes((atual) => atual.map((condicao, itemIndex) => itemIndex === index ? { ...condicao, ...patch } : condicao));
  }

  function montarConditions(): RuleCondition[] {
    return condicoes.filter((condicao) => condicao.field.trim()).map((condicao) => ({
      field: condicao.field.trim(),
      operator: condicao.operator,
      value: condicao.operator === "EXISTS" || condicao.operator === "NOT_EXISTS" ? undefined : condicao.value,
    }));
  }

  function montarCalculo(): RuleCalculation | null {
    const percentual = rate ? Number(rate.replace(",", ".")) / 100 : undefined;
    const valorCents = fixedAmountReais ? Math.round(Number(fixedAmountReais.replace(",", ".")) * 100) : undefined;
    if ((tipoCalculo === "PERCENTAGE" || tipoCalculo === "PROPORTIONAL") && (!Number.isFinite(percentual) || percentual === undefined || percentual < 0 || percentual > 1)) {
      toast.error("Informe um percentual válido.");
      return null;
    }
    if ((tipoCalculo === "FIXED" || tipoCalculo === "ADDITIONAL" || tipoCalculo === "TOTAL_FIXO_COM_DSR") && (!Number.isFinite(valorCents) || valorCents === undefined)) {
      toast.error("Informe um valor válido.");
      return null;
    }
    return {
      type: tipoCalculo,
      benefitType,
      rate: tipoCalculo === "PERCENTAGE" || tipoCalculo === "PROPORTIONAL" ? percentual : undefined,
      fixedAmountCents: tipoCalculo === "FIXED" || tipoCalculo === "ADDITIONAL" ? valorCents : undefined,
      totalFixoComDsrCents: tipoCalculo === "TOTAL_FIXO_COM_DSR" ? valorCents : undefined,
    };
  }

  function salvarRascunho() {
    if (!nome.trim()) {
      toast.error("Informe o nome da regra");
      return;
    }
    const calculation = montarCalculo();
    if (!calculation) return;

    startTransition(async () => {
      const base = {
        priority: 0,
        conditions: montarConditions(),
        calculation,
        paymentSchedule: { scheduleRuleName },
        validFrom: new Date(),
      };
      if (editandoRegraId) {
        const resultado = await CriarVersaoRegra({
            ruleId: editandoRegraId,
            name: nome.trim(),
            eventType: eventType as Parameters<typeof CriarVersaoRegra>[0]["eventType"],
            benefitType,
            ...base,
          });

        if (!resultado.success) {
          toast.error(resultado.error ?? "Erro ao salvar nova versão");
          return;
        }

        setUltimaVersaoId(resultado.data.id);
        toast.success("Nova versão em rascunho criada.");
        void carregar();
        return;
      }

      const resultado = await SalvarRascunhoRegra({
        name: nome.trim(),
        eventType: eventType as Parameters<typeof SalvarRascunhoRegra>[0]["eventType"],
        benefitType,
        approvalRequired: false,
        ...base,
      });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao salvar rascunho");
        return;
      }

      setEditandoRegraId(resultado.data.rule.id);
      setUltimaVersaoId(resultado.data.versao.id);
      toast.success("Rascunho salvo.");
      void carregar();
    });
  }

  function publicar(versionId = ultimaVersaoId) {
    if (!versionId) {
      toast.error("Salve um rascunho antes de publicar");
      return;
    }
    startTransition(async () => {
      const resultado = await PublicarRegra({ versionId });
      if (!resultado.success) toast.error(resultado.error ?? "Erro ao publicar regra");
      else {
        toast.success("Regra publicada.");
        setUltimaVersaoId(null);
        void carregar();
      }
    });
  }

  function alterarStatus(regra: RegraConfigRow) {
    startTransition(async () => {
      const resultado = regra.active ? await InativarRegra({ ruleId: regra.id }) : await ReativarRegra({ ruleId: regra.id });
      if (!resultado.success) toast.error(resultado.error ?? "Erro ao alterar status da regra");
      else {
        toast.success(regra.active ? "Regra inativada." : "Regra reativada.");
        void carregar();
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Regras publicadas são editadas por uma nova versão; o histórico anterior permanece intacto.
        </p>
        {editandoRegraId && <Button size="sm" variant="outline" className="gap-1.5 border-white/10" onClick={novaRegra}><X className="size-3.5" aria-hidden="true" />Nova regra</Button>}
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Quando</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><Label htmlFor="nomeRegra" className="text-slate-400">Nome da Regra</Label><Input id="nomeRegra" value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" /></div>
          <div>
            <Label className="text-slate-400">Evento</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
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
            <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
              <Input value={condicao.field} onChange={(e) => atualizarCondicao(index, { field: e.target.value })} placeholder="Campo (ex: servico)" className="border-white/10 bg-slate-950/60 text-slate-200" />
              <Select value={condicao.operator} onValueChange={(value) => atualizarCondicao(index, { operator: value as ConditionOperator })}>
                <SelectTrigger className="w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>{OPERADORES.map((operador) => <SelectItem key={operador.value} value={operador.value}>{operador.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={condicao.value} onChange={(e) => atualizarCondicao(index, { value: e.target.value })} placeholder="Valor" disabled={condicao.operator === "EXISTS" || condicao.operator === "NOT_EXISTS"} className="border-white/10 bg-slate-950/60 text-slate-200" />
              <Button size="sm" variant="ghost" onClick={() => removerCondicao(index)} aria-label="Remover condição"><Trash2 className="size-4 text-rose-400" aria-hidden="true" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="gap-2 border-white/10" onClick={adicionarCondicao}><Plus className="size-4" aria-hidden="true" />Adicionar condição</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Então</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-slate-400">Natureza do Benefício</Label>
            <Select value={benefitType} onValueChange={(value) => setBenefitType(value as typeof benefitType)}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="COMMISSION">Comissão</SelectItem><SelectItem value="BONUS">Prêmio</SelectItem><SelectItem value="DSR">DSR</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-400">Tipo de Cálculo</Label>
            <Select value={tipoCalculo} onValueChange={(value) => setTipoCalculo(value as CalculationType)}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS_CALCULO.map((tipo) => <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {(tipoCalculo === "PERCENTAGE" || tipoCalculo === "PROPORTIONAL") && <div><Label htmlFor="rate" className="text-slate-400">Percentual (%)</Label><Input id="rate" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="4" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" /></div>}
          {(tipoCalculo === "FIXED" || tipoCalculo === "ADDITIONAL" || tipoCalculo === "TOTAL_FIXO_COM_DSR") && <div><Label htmlFor="fixedAmount" className="text-slate-400">{tipoCalculo === "TOTAL_FIXO_COM_DSR" ? "Total comissão + DSR (R$)" : "Valor Fixo (R$)"}</Label><Input id="fixedAmount" value={fixedAmountReais} onChange={(e) => setFixedAmountReais(e.target.value)} placeholder="350,00" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" /></div>}
          <div>
            <Label className="text-slate-400">Regra de Calendário</Label>
            <Select value={scheduleRuleName} onValueChange={setScheduleRuleName}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="QUINTO_DIA_UTIL_CLT">5º dia útil (CLT)</SelectItem><SelectItem value="ULTIMO_DIA_MES_SEGUINTE_PREMIO_CLT">Último dia do mês seguinte (prêmio CLT)</SelectItem><SelectItem value="ULTIMO_DIA_MES_SEGUINTE_PJ">Último dia do mês seguinte (PJ)</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={salvarRascunho} disabled={isPending} variant="outline" className="gap-2 border-white/10">{isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{editandoRegraId ? "Salvar nova versão" : "Salvar rascunho"}</Button>
        <Button onClick={() => publicar()} disabled={isPending || !ultimaVersaoId}>Publicar</Button>
        <Link href="/PainelAlpha/Comissoes/Simulador" className="text-sm text-slate-400 underline hover:text-slate-200">Testar no Simulador</Link>
      </div>

      <section className="space-y-3 border-t border-white/5 pt-6">
        <div><h3 className="text-sm font-semibold text-slate-200">Regras cadastradas</h3><p className="text-xs text-slate-500">Editar cria uma nova versão. Inativar preserva todas as versões anteriores.</p></div>
        {carregando ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" /></div>
        ) : regras.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nenhuma regra cadastrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {regras.map((regra) => (
              <div key={regra.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-900/40 p-3 ${editandoRegraId === regra.id ? "border-blue-500/40" : "border-white/5"} ${!regra.active ? "opacity-60" : ""}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-white">{regra.name}</p>{!regra.active && <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] uppercase text-slate-400">Inativa</span>}</div>
                  <p className="text-xs text-slate-500">{EVENTO_LABEL[regra.eventType] ?? regra.eventType} · {BENEFICIO_LABEL[regra.benefitType] ?? regra.benefitType} · versão {regra.ultimaVersao?.version ?? "—"} ({regra.ultimaVersao?.status ?? "sem versão"})</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {regra.ultimaVersao?.status === "DRAFT" && <Button size="sm" onClick={() => publicar(regra.ultimaVersao!.id)} disabled={isPending}>Publicar rascunho</Button>}
                  <Button size="sm" variant="outline" className="gap-1.5 border-white/10" onClick={() => editarRegra(regra)} disabled={isPending}><Pencil className="size-3.5" aria-hidden="true" />Editar</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="sm" variant="outline" className={`gap-1.5 border-white/10 ${regra.active ? "text-rose-400" : "text-emerald-400"}`} disabled={isPending}>{regra.active ? <Power className="size-3.5" aria-hidden="true" /> : <RotateCcw className="size-3.5" aria-hidden="true" />}{regra.active ? "Inativar" : "Reativar"}</Button></AlertDialogTrigger>
                    <AlertDialogContent className="border-white/10 bg-slate-950">
                      <AlertDialogHeader><AlertDialogTitle className="text-slate-200">{regra.active ? "Inativar" : "Reativar"} regra &quot;{regra.name}&quot;?</AlertDialogTitle><AlertDialogDescription className="text-slate-400">{regra.active ? "Ela deixa de participar de novos cálculos, mas o histórico e as versões são preservados." : "Ela volta a participar dos cálculos conforme sua versão publicada e vigência."}</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => alterarStatus(regra)}>Confirmar</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
