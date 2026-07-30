"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
import { formatarCentavosBRL, formatarDataComissao } from "../lib/formatters";
import { SimularRegra, type SimularRegraInput, type SimularRegraResult } from "@/actions/CommissionRules";

const CARGOS_CONHECIDOS = [
  "Closer",
  "Coordenadora Comercial",
  "Diretora Comercial",
  "Analista II",
  "Analista Sênior",
  "Analista Auxiliar",
  "Auditor Contábil",
  "Diretor Operacional",
];

const EVENT_TYPES: Array<{ value: string; label: string }> = [
  { value: "CONTRACTING", label: "Contratação" },
  { value: "PROCESS_STARTED", label: "Processo Iniciado" },
  { value: "PROCESS_SUCCESS", label: "Êxito" },
  { value: "FIRST_ATTEMPT_SUCCESS", label: "Êxito na 1ª Tentativa" },
  { value: "AUXILIARY_PARTICIPATION", label: "Participação Auxiliar" },
  { value: "MANUAL_EVENT", label: "Lançamento Manual" },
  { value: "CANCELLATION", label: "Cancelamento" },
  { value: "REVERSAL", label: "Estorno" },
];

const FORMAS_PAGAMENTO: Array<{ value: string; label: string }> = [
  { value: "PARCELADO_CONTRATACAO_EXITO", label: "50% Contratação + 50% Êxito" },
  { value: "CARTAO_PARCELADO", label: "Cartão Parcelado (com juros)" },
  { value: "A_VISTA_DESCONTO", label: "À Vista (com desconto)" },
];

const BENEFIT_TYPE_LABEL: Record<string, string> = {
  COMMISSION: "Comissão",
  BONUS: "Prêmio",
  DSR: "DSR",
};

interface FormState {
  servico: string;
  tarifarioReais: string;
  valorContratadoReais: string;
  formaPagamento: string;
  cargoNome: string;
  eventType: string;
  dataEvento: string;
  primeiraTentativa: boolean;
  vinculo: "CLT" | "PJ";
}

const FORM_INICIAL: FormState = {
  servico: "Revisão de RADAR Ilimitado",
  tarifarioReais: "22000,00",
  valorContratadoReais: "22000,00",
  formaPagamento: "A_VISTA_DESCONTO",
  cargoNome: "Closer",
  eventType: "CONTRACTING",
  dataEvento: new Date().toISOString().slice(0, 10),
  primeiraTentativa: false,
  vinculo: "CLT",
};

function reaisParaCentavos(valor: string): number {
  const normalizado = valor.replace(/\./g, "").replace(",", ".");
  const numero = parseFloat(normalizado);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

export function SimuladorRegras() {
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [resultado, setResultado] = useState<SimularRegraResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function atualizarCampo<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function simular() {
    setErro(null);
    startTransition(async () => {
      const input: SimularRegraInput = {
        servico: form.servico,
        tarifarioCents: reaisParaCentavos(form.tarifarioReais),
        valorContratadoCents: reaisParaCentavos(form.valorContratadoReais),
        formaPagamento: form.formaPagamento as SimularRegraInput["formaPagamento"],
        cargoNome: form.cargoNome,
        eventType: form.eventType as SimularRegraInput["eventType"],
        dataEvento: new Date(form.dataEvento),
        primeiraTentativa: form.primeiraTentativa,
        vinculo: form.vinculo,
      };

      const resposta = await SimularRegra(input);

      if (!resposta.success) {
        setErro(resposta.error);
        setResultado(null);
        return;
      }

      setResultado(resposta.data);
    });
  }

  return (
    <div className="text-slate-200">
      <p className="text-sm text-slate-400">
        Teste combinações de serviço, tarifário, valor, desconto, forma de pagamento e cargo
        contra o motor de regras real — sem gerar nenhum lançamento.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Formulário */}
        <div className="space-y-4 rounded-[2rem] border border-white/5 bg-slate-900/40 p-6">
          <div>
            <Label htmlFor="servico" className="text-slate-400">Serviço</Label>
            <Input
              id="servico"
              value={form.servico}
              onChange={(e) => atualizarCampo("servico", e.target.value)}
              className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tarifario" className="text-slate-400">Tarifário (R$)</Label>
              <Input
                id="tarifario"
                value={form.tarifarioReais}
                onChange={(e) => atualizarCampo("tarifarioReais", e.target.value)}
                className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
              />
            </div>
            <div>
              <Label htmlFor="valorContratado" className="text-slate-400">Valor Contratado (R$)</Label>
              <Input
                id="valorContratado"
                value={form.valorContratadoReais}
                onChange={(e) => atualizarCampo("valorContratadoReais", e.target.value)}
                className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-400">Forma de Pagamento</Label>
            <Select value={form.formaPagamento} onValueChange={(v) => atualizarCampo("formaPagamento", v)}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400">Cargo</Label>
              <Select value={form.cargoNome} onValueChange={(v) => atualizarCampo("cargoNome", v)}>
                <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS_CONHECIDOS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-400">Evento</Label>
              <Select value={form.eventType} onValueChange={(v) => atualizarCampo("eventType", v)}>
                <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dataEvento" className="text-slate-400">Data do Evento</Label>
              <Input
                id="dataEvento"
                type="date"
                value={form.dataEvento}
                onChange={(e) => atualizarCampo("dataEvento", e.target.value)}
                className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
              />
            </div>

            <div>
              <Label className="text-slate-400">Vínculo</Label>
              <Select value={form.vinculo} onValueChange={(v) => atualizarCampo("vinculo", v as "CLT" | "PJ")}>
                <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLT">CLT</SelectItem>
                  <SelectItem value="PJ">PJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={form.primeiraTentativa}
              onChange={(e) => atualizarCampo("primeiraTentativa", e.target.checked)}
              className="size-4 rounded border-white/10 bg-slate-950"
            />
            Deferido na primeira tentativa
          </label>

          <Button onClick={simular} disabled={isPending} className="w-full gap-2">
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Simular
          </Button>
        </div>

        {/* Resultado */}
        <div className="space-y-4">
          {erro && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
              Não foi possível simular. <code className="text-xs text-rose-400/80">{erro}</code>
            </div>
          )}

          {!resultado && !erro && (
            <div className="flex flex-col items-center gap-2 rounded-[2rem] border border-white/5 bg-slate-900/40 py-16 text-slate-500">
              <p>Preencha o formulário e clique em &quot;Simular&quot;.</p>
            </div>
          )}

          {resultado && (
            <>
              {resultado.alertas.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">Alertas</p>
                  <ul className="space-y-1 text-xs text-amber-300/90">
                    {resultado.alertas.map((alerta, i) => (
                      <li key={i}>{alerta}</li>
                    ))}
                  </ul>
                </div>
              )}

              {resultado.base && (
                <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Base Comissionável
                  </p>
                  <dl className="space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Valor bruto (tarifário)</dt>
                      <dd className="font-mono tabular-nums text-slate-300">
                        {formatarCentavosBRL(resultado.base.grossContractAmountCents)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Valor líquido contratado</dt>
                      <dd className="font-mono tabular-nums text-slate-300">
                        {formatarCentavosBRL(resultado.base.netContractAmountCents)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Base comissionável</dt>
                      <dd className="font-mono tabular-nums font-semibold text-white">
                        {formatarCentavosBRL(resultado.base.commissionableBaseCents)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-slate-500">{resultado.base.reason}</p>
                </div>
              )}

              {resultado.resultadosPorTipo.map((r) => (
                <div key={r.benefitType} className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {BENEFIT_TYPE_LABEL[r.benefitType] ?? r.benefitType}
                  </p>

                  {r.regraVencedora ? (
                    <>
                      <p className="text-emerald-400">Regra vencedora: {r.regraVencedora}</p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">
                        {r.calculatedAmountCents !== null ? formatarCentavosBRL(r.calculatedAmountCents) : "--"}
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-500">Nenhuma regra venceu para este tipo.</p>
                  )}

                  {r.regrasCandidatas.length > 0 && (
                    <p className="mt-2 text-xs text-slate-600">
                      Candidatas: {r.regrasCandidatas.join(", ")}
                    </p>
                  )}
                </div>
              ))}

              {(resultado.contractualDueDate || resultado.operationalSuggestedDate) && (
                <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Previsão</p>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vencimento contratual</span>
                    <span className="text-slate-300">{formatarDataComissao(resultado.contractualDueDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Data operacional sugerida</span>
                    <span className="text-slate-300">{formatarDataComissao(resultado.operationalSuggestedDate)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
