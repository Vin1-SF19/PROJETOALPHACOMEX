"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AtualizarEligibilityOverride,
  CriarEligibilityOverride,
  ExcluirEligibilityOverride,
  ListarEligibilityOverrides,
} from "@/actions/EligibilityOverrides";
import { ListarCargos } from "@/actions/CommissionPositions";
import { BuscarTodosUsuarios } from "@/actions/RecursosHumanos";
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
import { formatarCentavosBRL } from "../lib/formatters";

type TipoOverride = "BLOQUEIO" | "SUBSTITUICAO" | "PERCENTUAL_ESPECIFICO" | "VALOR_ESPECIFICO" | "EXCLUSAO";
type EscopoTipo = "colaborador" | "cargo" | "servico";

interface OverrideRow {
  id: string;
  collaboratorId: number | null;
  cargoId: number | null;
  servico: string | null;
  tipo: TipoOverride;
  percentualEspecifico: number | null;
  valorEspecificoCents: number | null;
  justificativa: string;
  prioridade: number;
  approvalRequired: boolean;
  aprovadoEm: Date | null;
}

const TIPO_LABEL: Record<TipoOverride, string> = {
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
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [escopoTipo, setEscopoTipo] = useState<EscopoTipo>("colaborador");
  const [escopoValor, setEscopoValor] = useState("");
  const [tipo, setTipo] = useState<TipoOverride | "">("");
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
    if (resOverrides.success) setOverrides(resOverrides.data as OverrideRow[]);
    else toast.error(resOverrides.error);
    if (resUsuarios.success) {
      setColaboradores(resUsuarios.data.filter((usuario) => usuario.status === "ATIVO").map((usuario) => ({ id: usuario.id, nome: usuario.nome })));
    }
    if (resCargos.success) setCargos(resCargos.data.map((cargo) => ({ id: cargo.id, nome: cargo.nome })));
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function limparFormulario() {
    setEditandoId(null);
    setEscopoTipo("colaborador");
    setEscopoValor("");
    setTipo("");
    setPercentual("");
    setValorReais("");
    setJustificativa("");
  }

  function editar(override: OverrideRow) {
    setEditandoId(override.id);
    if (override.collaboratorId) {
      setEscopoTipo("colaborador");
      setEscopoValor(String(override.collaboratorId));
    } else if (override.cargoId) {
      setEscopoTipo("cargo");
      setEscopoValor(String(override.cargoId));
    } else {
      setEscopoTipo("servico");
      setEscopoValor(override.servico ?? "");
    }
    setTipo(override.tipo);
    setPercentual(override.percentualEspecifico === null ? "" : String(override.percentualEspecifico * 100));
    setValorReais(override.valorEspecificoCents === null ? "" : (override.valorEspecificoCents / 100).toFixed(2).replace(".", ","));
    setJustificativa(override.justificativa);
  }

  function nomeEscopo(override: OverrideRow) {
    if (override.collaboratorId) return colaboradores.find((item) => item.id === override.collaboratorId)?.nome ?? `Colaborador #${override.collaboratorId}`;
    if (override.cargoId) return cargos.find((item) => item.id === override.cargoId)?.nome ?? `Cargo #${override.cargoId}`;
    return override.servico ?? "Escopo geral";
  }

  function salvar() {
    if (!escopoValor || !tipo || !justificativa.trim()) {
      toast.error("Preencha escopo, tipo e justificativa.");
      return;
    }

    const percentualEspecifico = tipo === "PERCENTUAL_ESPECIFICO" && percentual ? Number(percentual.replace(",", ".")) / 100 : null;
    const valorEspecificoCents = tipo === "VALOR_ESPECIFICO" && valorReais
      ? Math.round(Number(valorReais.replace(",", ".")) * 100)
      : null;
    if (percentualEspecifico !== null && (!Number.isFinite(percentualEspecifico) || percentualEspecifico < 0 || percentualEspecifico > 1)) {
      toast.error("Percentual inválido.");
      return;
    }
    if (valorEspecificoCents !== null && (!Number.isFinite(valorEspecificoCents) || valorEspecificoCents < 0)) {
      toast.error("Valor inválido.");
      return;
    }

    startTransition(async () => {
      const escopo = {
        collaboratorId: escopoTipo === "colaborador" ? Number(escopoValor) : null,
        cargoId: escopoTipo === "cargo" ? Number(escopoValor) : null,
        servico: escopoTipo === "servico" ? escopoValor.trim() : null,
      };
      const resultado = editandoId
        ? await AtualizarEligibilityOverride({
            id: editandoId,
            ...escopo,
            tipo,
            percentualEspecifico,
            valorEspecificoCents,
            justificativa: justificativa.trim(),
          })
        : await CriarEligibilityOverride({
            collaboratorId: escopo.collaboratorId ?? undefined,
            cargoId: escopo.cargoId ?? undefined,
            servico: escopo.servico ?? undefined,
            tipo,
            percentualEspecifico: percentualEspecifico ?? undefined,
            valorEspecificoCents: valorEspecificoCents ?? undefined,
            justificativa: justificativa.trim(),
            prioridade: 0,
            approvalRequired: false,
          });

      if (!resultado.success) {
        toast.error(resultado.error ?? `Erro ao ${editandoId ? "atualizar" : "criar"} exceção`);
        return;
      }
      toast.success(editandoId ? "Exceção atualizada." : "Exceção criada.");
      limparFormulario();
      void carregar();
    });
  }

  function aprovar(id: string) {
    startTransition(async () => {
      const resultado = await AtualizarEligibilityOverride({ id, aprovadoEm: new Date() });
      if (!resultado.success) toast.error(resultado.error ?? "Erro ao aprovar exceção");
      else {
        toast.success("Exceção aprovada.");
        void carregar();
      }
    });
  }

  function excluir(id: string) {
    startTransition(async () => {
      const resultado = await ExcluirEligibilityOverride({ id });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao excluir exceção");
        return;
      }
      if (editandoId === id) limparFormulario();
      toast.success("Exceção excluída.");
      void carregar();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-slate-400">Escopo</Label>
          <Select value={escopoTipo} onValueChange={(value) => { setEscopoTipo(value as EscopoTipo); setEscopoValor(""); }}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="colaborador">Colaborador</SelectItem>
              <SelectItem value="cargo">Cargo</SelectItem>
              <SelectItem value="servico">Serviço</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-slate-400">{escopoTipo === "colaborador" ? "Colaborador" : escopoTipo === "cargo" ? "Cargo" : "Nome do serviço"}</Label>
          {escopoTipo === "servico" ? (
            <Input value={escopoValor} onChange={(e) => setEscopoValor(e.target.value)} placeholder="Ex: Revisão de RADAR Ilimitado" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" />
          ) : (
            <Select value={escopoValor} onValueChange={setEscopoValor}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {(escopoTipo === "colaborador" ? colaboradores : cargos).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label className="text-slate-400">Tipo de exceção</Label>
          <Select value={tipo} onValueChange={(value) => setTipo(value as TipoOverride)}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {tipo === "PERCENTUAL_ESPECIFICO" && (
          <div><Label className="text-slate-400">Percentual (%)</Label><Input inputMode="decimal" value={percentual} onChange={(e) => setPercentual(e.target.value)} placeholder="Ex: 5" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" /></div>
        )}
        {tipo === "VALOR_ESPECIFICO" && (
          <div><Label className="text-slate-400">Valor (R$)</Label><Input inputMode="decimal" value={valorReais} onChange={(e) => setValorReais(e.target.value)} placeholder="Ex: 1500,00" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" /></div>
        )}
        <div className="sm:col-span-2 lg:col-span-4">
          <Label className="text-slate-400">Justificativa</Label>
          <Input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Motivo desta exceção" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Button onClick={salvar} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {editandoId ? "Salvar alterações" : "Criar Exceção"}
          </Button>
          {editandoId && (
            <Button onClick={limparFormulario} disabled={isPending} variant="outline" className="gap-2 border-white/10"><X className="size-4" aria-hidden="true" />Cancelar edição</Button>
          )}
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" /></div>
      ) : overrides.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhuma exceção cadastrada ainda.</p>
      ) : (
        <div className="space-y-2">
          {overrides.map((override) => (
            <div key={override.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-900/40 p-3 ${editandoId === override.id ? "border-blue-500/40" : "border-white/5"}`}>
              <div>
                <p className="text-sm font-medium text-white">{TIPO_LABEL[override.tipo]}</p>
                <p className="text-xs text-slate-500">
                  {nomeEscopo(override)}
                  {override.percentualEspecifico !== null && ` · ${(override.percentualEspecifico * 100).toFixed(2)}%`}
                  {override.valorEspecificoCents !== null && ` · ${formatarCentavosBRL(override.valorEspecificoCents)}`}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">{override.justificativa}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {override.approvalRequired && !override.aprovadoEm && (
                  <Button size="sm" variant="outline" className="border-white/10" disabled={isPending} onClick={() => aprovar(override.id)}>Aprovar</Button>
                )}
                {override.aprovadoEm && <span className="text-xs text-emerald-400">Aprovada</span>}
                <Button size="sm" variant="outline" className="gap-1.5 border-white/10" disabled={isPending} onClick={() => editar(override)}>
                  <Pencil className="size-3.5" aria-hidden="true" />Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 border-white/10 text-rose-400" disabled={isPending}><Trash2 className="size-3.5" aria-hidden="true" />Excluir</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-slate-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-200">Excluir esta exceção?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">Ela deixa de ser aplicada aos próximos cálculos. Lançamentos já gerados não são apagados.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => excluir(override.id)} className="bg-rose-600 hover:bg-rose-500">Excluir</AlertDialogAction>
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
