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
import { CriarFeriado, ExcluirFeriado, ListarFeriados, type FeriadoExibicao } from "@/actions/CommissionHolidays";

const ESCOPO_LABEL: Record<string, string> = { NACIONAL: "Nacional", ESTADUAL: "Estadual", MUNICIPAL: "Municipal" };

export function AbaCalendarios() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [feriados, setFeriados] = useState<FeriadoExibicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState("");
  const [nome, setNome] = useState("");
  const [escopo, setEscopo] = useState<"ESTADUAL" | "MUNICIPAL">("ESTADUAL");
  const [uf, setUf] = useState("");
  const [municipio, setMunicipio] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarFeriados({ ano });
    if (resultado.success) {
      setFeriados(resultado.data);
    }
    setCarregando(false);
  }, [ano]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function criar() {
    if (!data || !nome.trim() || !uf.trim()) {
      toast.error("Preencha data, nome e UF.");
      return;
    }
    if (escopo === "MUNICIPAL" && !municipio.trim()) {
      toast.error("Município é obrigatório para feriado municipal.");
      return;
    }

    startTransition(async () => {
      const resultado = await CriarFeriado({
        data: new Date(data),
        nome: nome.trim(),
        escopo,
        uf: uf.trim().toUpperCase(),
        municipio: escopo === "MUNICIPAL" ? municipio.trim() : undefined,
      });

      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao criar feriado");
        return;
      }

      toast.success("Feriado cadastrado.");
      setData("");
      setNome("");
      setUf("");
      setMunicipio("");
      void carregar();
    });
  }

  function excluir(id: string) {
    startTransition(async () => {
      const resultado = await ExcluirFeriado({ id });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao excluir feriado");
        return;
      }
      toast.success("Feriado removido.");
      void carregar();
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        Feriados nacionais são calculados automaticamente (Páscoa, Carnaval, etc — não aparecem
        aqui para edição). Cadastre abaixo feriados estaduais/municipais que afetam o cálculo de
        dias úteis das comissões.
      </p>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label className="text-slate-400">Data</Label>
          <Input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
          />
        </div>

        <div>
          <Label className="text-slate-400">Nome</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Aniversário da cidade"
            className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
          />
        </div>

        <div>
          <Label className="text-slate-400">Escopo</Label>
          <Select value={escopo} onValueChange={(v) => setEscopo(v as typeof escopo)}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ESTADUAL">Estadual</SelectItem>
              <SelectItem value="MUNICIPAL">Municipal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-slate-400">UF</Label>
          <Input
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            placeholder="SP"
            maxLength={2}
            className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
          />
        </div>

        {escopo === "MUNICIPAL" && (
          <div>
            <Label className="text-slate-400">Município</Label>
            <Input
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              placeholder="São Paulo"
              className="mt-1 border-white/10 bg-slate-950/60 text-slate-200"
            />
          </div>
        )}

        <div className="sm:col-span-2 lg:col-span-5">
          <Button onClick={criar} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            Cadastrar Feriado
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-slate-400">Ano</Label>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="w-32 border-white/10 bg-slate-950/60 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
        </div>
      ) : feriados.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhum feriado para {ano}.</p>
      ) : (
        <div className="space-y-2">
          {feriados.map((feriado, index) => (
            <div
              key={feriado.id ?? `nacional-${index}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-3"
            >
              <div>
                <p className="text-sm font-medium text-white">{feriado.nome}</p>
                <p className="text-xs text-slate-500">
                  {feriado.data} · {ESCOPO_LABEL[feriado.escopo] ?? feriado.escopo}
                  {feriado.uf && ` · ${feriado.uf}`}
                  {feriado.municipio && ` · ${feriado.municipio}`}
                </p>
              </div>

              {feriado.id && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="border-white/10 text-rose-400" disabled={isPending}>
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-slate-950">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-slate-200">Excluir &quot;{feriado.nome}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        Este feriado deixa de contar no cálculo de dias úteis das comissões.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => excluir(feriado.id!)}>Confirmar</AlertDialogAction>
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
