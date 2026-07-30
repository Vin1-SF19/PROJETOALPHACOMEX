"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
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
import { formatarCentavosBRL } from "../lib/formatters";
import { AtualizarEligibilityOverride, CriarEligibilityOverride, ListarEligibilityOverrides } from "@/actions/EligibilityOverrides";
import { BuscarTodosUsuarios } from "@/actions/RecursosHumanos";
import { ListarCargos } from "@/actions/CommissionPositions";

interface OverrideRow {
  id: string;
  collaboratorId: number | null;
  cargoId: number | null;
  servico: string | null;
  eventType: string | null;
  tipo: string;
  percentualEspecifico: number | null;
  valorEspecificoCents: number | null;
  justificativa: string;
  approvalRequired: boolean;
  aprovadoEm: Date | null;
}

const TIPO_LABEL: Record<string, string> = {
  BLOQUEIO: "Bloqueio (não recebe comissão)",
  SUBSTITUICAO: "Substituição de regra",
  PERCENTUAL_ESPECIFICO: "Percentual específico",
  VALOR_ESPECIFICO: "Valor fixo específico",
  EXCLUSAO: "Exclusão",
};

export function AbaExcecoes() {
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [colaboradores, setColaboradores] = useState<Array<{ id: number; nome: string }>>([]);
  const [cargos, setCargos] = useState<Array<{ id: number; nome: string }>>([]);
  const [carregando, setCarregando] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [escopoTipo, setEscopoTipo] = useState<"colaborador" | "cargo" | "servico">("colaborador");
  const [escopoValor, setEscopoValor] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [percentual, setPercentual] = useState("");
  const [valorReais, setValorReais] = useState("");
  const [justificativa, setJustificativa] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [resOverrides, resUsuarios, resCargos] = await Promise.all([
      ListarEligibilityOverrides(),
      BuscarTodosUsuarios(),
      ListarCargos(),
    ]);

    if (resOverrides.success) setOverrides(resOverrides.data as unknown as OverrideRow[]);
    if (resUsuarios.success) {
      setColaboradores(resUsuarios.data.filter((u) => u.status === "ATIVO").map((u) => ({ id: u.id, nome: u.nome })));
    }
    if (resCargos.success) {
      setCargos((resCargos.data as unknown as Array<{ id: number; nome: string }>).map((c) => ({ id: c.id, nome: c.nome })));
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function nomeColaborador(id: number | null) {
    if (id === null) return null;
    return colaboradores.find((c) => c.id === id)?.nome ?? `Colaborador #${id}`;
  }

  function nomeCargo(id: number | null) {
    if (id === null) return null;
    return cargos.find((c) => c.id === id)?.nome ?? `Cargo #${id}`;
  }

  function criar() {
    if (!escopoValor) {
      toast.error("Selecione o escopo da exceção.");
      return;
    }
    if (!tipo) {
      toast.error("Selecione o tipo de exceção.");
      return;
    }
    if (!justificativa.trim()) {
      toast.error("Justificativa é obrigatória.");
      return;
    }

    startTransition(async () => {
      const resultado = await CriarEligibilityOverride({
        collaboratorId: escopoTipo === "colaborador" ? Number(escopoValor) : undefined,
        cargoId: escopoTipo === "cargo" ? Number(escopoValor) : undefined,
        servico: escopoTipo === "servico" ? escopoValor : undefined,
        tipo: tipo as "BLOQUEIO" | "SUBSTITUICAO" | "PERCENTUAL_ESPECIFICO" | "VALOR_ESPECIFICO" | "EXCLUSAO",
        percentualEspecifico: tipo === "PERCENTUAL_ESPECIFICO" && percentual ? Number(percentual) / 100 : undefined,
        valorEspecificoCents:
          tipo === "VALOR_ESPECIFICO" && valorReais
            ? Math.round(Number(valorReais.replace(",", ".")) * 100)
            : undefined,
        justificativa: justificativa.trim(),
        prioridade: 0,
        approvalRequired: false,
      });

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao criar exceção");
        return;
      }

      toast.success("Exceção criada.");
      setEscopoValor("");
      setTipo("");
      setPercentual("");
      setValorReais("");
      setJustificativa("");
      void carregar();
    });
  }

  function aprovar(id: string) {
    startTransition(async () => {
      const resultado = await AtualizarEligibilityOverride({ id, aprovadoEm: new Date() });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao aprovar exceção");
        return;
      }
      toast.success("Exceção aprovada.");
      void carregar();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-slate-400">Escopo</Label>
          <Select value={escopoTipo} onValueChange={(v) => { setEscopoTipo(v as typeof escopoTipo); setEscopoValor(""); }}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="colaborador">Colaborador</SelectItem>
              <SelectItem value="cargo">Cargo</SelectItem>
              <SelectItem value="servico">Serviço</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-400">
            {escopoTipo === "colaborador" ? "Colaborador" : escopoTipo === "cargo" ? "Cargo" : "Nome do serviço"}
          </Label>
          {escopoTipo === "servico" ? (
            <Input
              value={escopoValor}
              onChange={(e) => setEscopoValor(e.target.value)}
              placeholder="Ex: Revisão de RADAR Ilimitado"
              className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
            />
          ) : (
            <Select value={escopoValor} onValueChange={setEscopoValor}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {(escopoTipo === "colaborador" ? colaboradores : cargos).map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div>
          <Label className="text-slate-400">Tipo de exceção</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                <SelectItem key={valor} value={valor}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tipo === "PERCENTUAL_ESPECIFICO" && (
          <div>
            <Label className="text-slate-400">Percentual (%)</Label>
            <Input
              inputMode="decimal"
              value={percentual}
              onChange={(e) => setPercentual(e.target.value)}
              placeholder="Ex: 5"
              className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
            />
          </div>
        )}

        {tipo === "VALOR_ESPECIFICO" && (
          <div>
            <Label className="text-slate-400">Valor (R$)</Label>
            <Input
              inputMode="decimal"
              value={valorReais}
              onChange={(e) => setValorReais(e.target.value)}
              placeholder="Ex: 1500,00"
              className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
            />
          </div>
        )}

        <div className="sm:col-span-2 lg:col-span-4">
          <Label className="text-slate-400">Justificativa</Label>
          <Input
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Motivo desta exceção"
            className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <Button onClick={criar} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            Criar Exceção
          </Button>
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
        </div>
      ) : overrides.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhuma exceção cadastrada ainda.</p>
      ) : (
        <div className="space-y-2">
          {overrides.map((override) => (
            <div
              key={override.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-3"
            >
              <div>
                <p className="text-sm font-medium text-white">{TIPO_LABEL[override.tipo] ?? override.tipo}</p>
                <p className="text-xs text-slate-500">
                  {nomeColaborador(override.collaboratorId) ?? nomeCargo(override.cargoId) ?? override.servico ?? "Escopo geral"}
                  {override.percentualEspecifico !== null && ` · ${(override.percentualEspecifico * 100).toFixed(2)}%`}
                  {override.valorEspecificoCents !== null && ` · ${formatarCentavosBRL(override.valorEspecificoCents)}`}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">{override.justificativa}</p>
              </div>

              {override.approvalRequired && !override.aprovadoEm ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="border-white/10" disabled={isPending}>
                      Aprovar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-slate-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-200">Aprovar esta exceção?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        A exceção passa a valer para os próximos cálculos de comissão deste escopo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => aprovar(override.id)}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : override.aprovadoEm ? (
                <span className="text-xs text-emerald-400">Aprovada</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
