"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import {
  AtualizarCargo,
  CriarCargo,
  InativarCargo,
  ListarCargos,
  ReativarCargo,
} from "@/actions/CommissionPositions";
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

interface AbaCargosProps {
  setores: Array<{ id: number; nome: string }>;
}

interface CargoRow {
  id: number;
  nome: string;
  ativo: boolean;
  setorId: number | null;
  setorNome: string | null;
  setoresPorRole: string[];
  setorOrigem: "USUARIOS_ROLE" | "CARGO" | null;
  vinculoPadrao: string | null;
  naturezaRecebimento: string | null;
  permiteMultiplosOcupantes: boolean;
}

const NATUREZA_LABEL: Record<string, string> = { COMISSAO: "Comissão", PREMIO: "Prêmio", AMBOS: "Ambos" };

export function AbaCargos({ setores }: AbaCargosProps) {
  const [cargos, setCargos] = useState<CargoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const [nome, setNome] = useState("");
  const [setorId, setSetorId] = useState("__NONE__");
  const [vinculoPadrao, setVinculoPadrao] = useState("__NONE__");
  const [naturezaRecebimento, setNaturezaRecebimento] = useState("__NONE__");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarCargos();
    if (resultado.success) setCargos(resultado.data as CargoRow[]);
    else toast.error(resultado.error);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function limparFormulario() {
    setEditandoId(null);
    setNome("");
    setSetorId("__NONE__");
    setVinculoPadrao("__NONE__");
    setNaturezaRecebimento("__NONE__");
  }

  function editar(cargo: CargoRow) {
    setEditandoId(cargo.id);
    setNome(cargo.nome);
    setSetorId(cargo.setorId ? String(cargo.setorId) : "__NONE__");
    setVinculoPadrao(cargo.vinculoPadrao ?? "__NONE__");
    setNaturezaRecebimento(cargo.naturezaRecebimento ?? "__NONE__");
  }

  function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome do cargo");
      return;
    }

    startTransition(async () => {
      const dados = {
        nome: nome.trim(),
        setorId: setorId === "__NONE__" ? null : Number(setorId),
        vinculoPadrao: vinculoPadrao === "__NONE__" ? null : (vinculoPadrao as "CLT" | "PJ"),
        naturezaRecebimento:
          naturezaRecebimento === "__NONE__"
            ? null
            : (naturezaRecebimento as "COMISSAO" | "PREMIO" | "AMBOS"),
        permiteMultiplosOcupantes: true,
      };

      const resultado = editandoId
        ? await AtualizarCargo({ id: editandoId, ...dados })
        : await CriarCargo({
            ...dados,
            setorId: dados.setorId ?? undefined,
            vinculoPadrao: dados.vinculoPadrao ?? undefined,
            naturezaRecebimento: dados.naturezaRecebimento ?? undefined,
          });

      if (!resultado.success) {
        toast.error(resultado.error ?? `Erro ao ${editandoId ? "atualizar" : "criar"} cargo`);
        return;
      }

      toast.success(editandoId ? "Cargo atualizado." : "Cargo criado.");
      limparFormulario();
      void carregar();
    });
  }

  function alterarStatus(cargo: CargoRow) {
    startTransition(async () => {
      const resultado = cargo.ativo ? await InativarCargo({ id: cargo.id }) : await ReativarCargo({ id: cargo.id });
      if (!resultado.success) {
        toast.error(resultado.error ?? `Erro ao ${cargo.ativo ? "inativar" : "reativar"} cargo`);
        return;
      }
      toast.success(cargo.ativo ? "Cargo inativado." : "Cargo reativado.");
      void carregar();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-3 text-xs text-blue-200/80">
        O setor exibido prioriza a <strong>role dos colaboradores ativos</strong> que ocupam o cargo.
        O setor cadastrado abaixo é usado como fallback quando o cargo ainda não possui ocupantes.
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="nomeCargo" className="text-slate-400">Nome do Cargo</Label>
          <Input id="nomeCargo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Closer" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" />
          {editandoId && <p className="mt-1 text-[11px] text-slate-600">O nome só pode ser alterado quando não houver colaboradores vinculados.</p>}
        </div>
        <div>
          <Label className="text-slate-400">Setor de fallback</Label>
          <Select value={setorId} onValueChange={setSetorId}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__NONE__">Nenhum</SelectItem>
              {setores.map((setor) => <SelectItem key={setor.id} value={String(setor.id)}>{setor.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-slate-400">Vínculo Padrão</Label>
          <Select value={vinculoPadrao} onValueChange={setVinculoPadrao}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__NONE__">Não definido</SelectItem>
              <SelectItem value="CLT">CLT</SelectItem>
              <SelectItem value="PJ">PJ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-slate-400">Natureza do Recebimento</Label>
          <Select value={naturezaRecebimento} onValueChange={setNaturezaRecebimento}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__NONE__">Não definida</SelectItem>
              <SelectItem value="COMISSAO">Comissão</SelectItem>
              <SelectItem value="PREMIO">Prêmio</SelectItem>
              <SelectItem value="AMBOS">Ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Button onClick={salvar} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {editandoId ? "Salvar alterações" : "Criar Cargo"}
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
      ) : cargos.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhum cargo cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {cargos.map((cargo) => (
            <div key={cargo.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-900/40 p-3 ${editandoId === cargo.id ? "border-blue-500/40" : "border-white/5"} ${!cargo.ativo ? "opacity-60" : ""}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white">{cargo.nome}</p>
                  {!cargo.ativo && <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400">Inativo</span>}
                </div>
                <p className="text-xs text-slate-500">
                  {cargo.setorNome ?? "Sem setor"} · {cargo.vinculoPadrao ?? "Vínculo não definido"} ·{" "}
                  {cargo.naturezaRecebimento ? NATUREZA_LABEL[cargo.naturezaRecebimento] : "Natureza não definida"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 border-white/10" onClick={() => editar(cargo)} disabled={isPending}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className={`gap-1.5 border-white/10 ${cargo.ativo ? "text-rose-400" : "text-emerald-400"}`} disabled={isPending}>
                      {cargo.ativo ? null : <RotateCcw className="size-3.5" aria-hidden="true" />}
                      {cargo.ativo ? "Inativar" : "Reativar"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-slate-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-200">{cargo.ativo ? "Inativar" : "Reativar"} cargo &quot;{cargo.nome}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        {cargo.ativo
                          ? "O cargo deixa de aparecer como opção nova, mas nenhum histórico é apagado."
                          : "O cargo volta a aparecer nas opções e poderá ser usado novamente."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => alterarStatus(cargo)}>Confirmar</AlertDialogAction>
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
