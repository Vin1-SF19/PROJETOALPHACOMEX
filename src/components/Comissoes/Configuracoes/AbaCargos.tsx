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
import { CriarCargo, InativarCargo, ListarCargos } from "@/actions/CommissionPositions";

interface AbaCargosProps {
  setores: Array<{ id: number; nome: string }>;
}

interface CargoRow {
  id: number;
  nome: string;
  ativo: boolean;
  setorId: number | null;
  setorNome: string | null;
  vinculoPadrao: string | null;
  naturezaRecebimento: string | null;
  permiteMultiplosOcupantes: boolean;
}

const NATUREZA_LABEL: Record<string, string> = { COMISSAO: "Comissão", PREMIO: "Prêmio", AMBOS: "Ambos" };

export function AbaCargos({ setores }: AbaCargosProps) {
  const [cargos, setCargos] = useState<CargoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [nome, setNome] = useState("");
  const [setorId, setSetorId] = useState<string>("");
  const [vinculoPadrao, setVinculoPadrao] = useState<string>("");
  const [naturezaRecebimento, setNaturezaRecebimento] = useState<string>("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarCargos();
    if (resultado.success) {
      setCargos(resultado.data as unknown as CargoRow[]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function criar() {
    if (!nome.trim()) {
      toast.error("Informe o nome do cargo");
      return;
    }

    startTransition(async () => {
      const resultado = await CriarCargo({
        nome: nome.trim(),
        setorId: setorId ? Number(setorId) : undefined,
        vinculoPadrao: vinculoPadrao ? (vinculoPadrao as "CLT" | "PJ") : undefined,
        naturezaRecebimento: naturezaRecebimento ? (naturezaRecebimento as "COMISSAO" | "PREMIO" | "AMBOS") : undefined,
        permiteMultiplosOcupantes: true,
      });

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao criar cargo");
        return;
      }

      toast.success("Cargo criado.");
      setNome("");
      setSetorId("");
      setVinculoPadrao("");
      setNaturezaRecebimento("");
      void carregar();
    });
  }

  function inativar(id: number) {
    startTransition(async () => {
      const resultado = await InativarCargo({ id });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao inativar cargo");
        return;
      }
      toast.success("Cargo inativado.");
      void carregar();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="nomeCargo" className="text-slate-400">Nome do Cargo</Label>
          <Input
            id="nomeCargo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Closer"
            className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
          />
        </div>

        <div>
          <Label className="text-slate-400">Setor</Label>
          <Select value={setorId} onValueChange={setSetorId}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              {setores.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-400">Vínculo Padrão</Label>
          <Select value={vinculoPadrao} onValueChange={setVinculoPadrao}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
              <SelectValue placeholder="Não definido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CLT">CLT</SelectItem>
              <SelectItem value="PJ">PJ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-400">Natureza do Recebimento</Label>
          <Select value={naturezaRecebimento} onValueChange={setNaturezaRecebimento}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
              <SelectValue placeholder="Não definida" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMISSAO">Comissão</SelectItem>
              <SelectItem value="PREMIO">Prêmio</SelectItem>
              <SelectItem value="AMBOS">Ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <Button onClick={criar} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            Criar Cargo
          </Button>
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
        </div>
      ) : cargos.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhum cargo cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {cargos.map((cargo) => (
            <div
              key={cargo.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-3 ${!cargo.ativo ? "opacity-50" : ""}`}
            >
              <div>
                <p className="text-sm font-medium text-white">{cargo.nome}</p>
                <p className="text-xs text-slate-500">
                  {cargo.setorNome ?? "Sem setor"} · {cargo.vinculoPadrao ?? "Vínculo não definido"} ·{" "}
                  {cargo.naturezaRecebimento ? NATUREZA_LABEL[cargo.naturezaRecebimento] : "Natureza não definida"}
                  {!cargo.ativo && " · Inativo"}
                </p>
              </div>

              {cargo.ativo && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="border-white/10 text-rose-400" disabled={isPending}>
                      Inativar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-slate-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-200">Inativar cargo &quot;{cargo.nome}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        O cargo deixa de aparecer como opção nova, mas nenhum histórico é apagado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => inativar(cargo.id)}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
