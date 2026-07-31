"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AtualizarFeriado,
  CriarFeriado,
  ExcluirFeriado,
  ListarFeriados,
  type FeriadoExibicao,
} from "@/actions/CommissionHolidays";
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

const ESCOPO_LABEL: Record<string, string> = { NACIONAL: "Nacional", ESTADUAL: "Estadual", MUNICIPAL: "Municipal" };

export function AbaCalendarios() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [feriados, setFeriados] = useState<FeriadoExibicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [data, setData] = useState("");
  const [nome, setNome] = useState("");
  const [escopo, setEscopo] = useState<"ESTADUAL" | "MUNICIPAL">("ESTADUAL");
  const [uf, setUf] = useState("");
  const [municipio, setMunicipio] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarFeriados({ ano });
    if (resultado.success) setFeriados(resultado.data);
    else toast.error(resultado.error);
    setCarregando(false);
  }, [ano]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  function limparFormulario() {
    setEditandoId(null);
    setData("");
    setNome("");
    setEscopo("ESTADUAL");
    setUf("");
    setMunicipio("");
  }

  function editar(feriado: FeriadoExibicao) {
    if (!feriado.id || feriado.escopo === "NACIONAL") return;
    setEditandoId(feriado.id);
    setData(feriado.data);
    setNome(feriado.nome);
    setEscopo(feriado.escopo as "ESTADUAL" | "MUNICIPAL");
    setUf(feriado.uf ?? "");
    setMunicipio(feriado.municipio ?? "");
  }

  function salvar() {
    if (!data || !nome.trim() || !uf.trim()) {
      toast.error("Preencha data, nome e UF.");
      return;
    }
    if (escopo === "MUNICIPAL" && !municipio.trim()) {
      toast.error("Município é obrigatório para feriado municipal.");
      return;
    }

    startTransition(async () => {
      const dados = {
        data: new Date(`${data}T12:00:00`),
        nome: nome.trim(),
        escopo,
        uf: uf.trim().toUpperCase(),
        municipio: escopo === "MUNICIPAL" ? municipio.trim() : undefined,
      };
      const resultado = editandoId
        ? await AtualizarFeriado({ id: editandoId, ...dados })
        : await CriarFeriado(dados);

      if (!resultado.success) {
        toast.error(resultado.error ?? `Erro ao ${editandoId ? "atualizar" : "criar"} feriado`);
        return;
      }

      toast.success(editandoId ? "Feriado atualizado." : "Feriado cadastrado.");
      const anoDoFeriado = Number(data.slice(0, 4));
      limparFormulario();
      if (anoDoFeriado === ano) void carregar();
      else setAno(anoDoFeriado);
    });
  }

  function excluir(id: string) {
    startTransition(async () => {
      const resultado = await ExcluirFeriado({ id });
      if (!resultado.success) {
        toast.error(resultado.error ?? "Erro ao excluir feriado");
        return;
      }
      if (editandoId === id) limparFormulario();
      toast.success("Feriado removido.");
      void carregar();
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        Feriados nacionais são calculados automaticamente e ficam somente para consulta.
        Feriados estaduais e municipais cadastrados aqui podem ser editados ou excluídos.
      </p>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div><Label className="text-slate-400">Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" /></div>
        <div><Label className="text-slate-400">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Aniversário da cidade" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" /></div>
        <div>
          <Label className="text-slate-400">Escopo</Label>
          <Select value={escopo} onValueChange={(value) => setEscopo(value as typeof escopo)}>
            <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ESTADUAL">Estadual</SelectItem><SelectItem value="MUNICIPAL">Municipal</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label className="text-slate-400">UF</Label><Input value={uf} onChange={(e) => setUf(e.target.value)} placeholder="SP" maxLength={2} className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" /></div>
        {escopo === "MUNICIPAL" && <div><Label className="text-slate-400">Município</Label><Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="São Paulo" className="mt-1 border-white/10 bg-slate-950/60 text-slate-200" /></div>}
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
          <Button onClick={salvar} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {editandoId ? "Salvar alterações" : "Cadastrar Feriado"}
          </Button>
          {editandoId && <Button onClick={limparFormulario} disabled={isPending} variant="outline" className="gap-2 border-white/10"><X className="size-4" aria-hidden="true" />Cancelar edição</Button>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-slate-400">Ano</Label>
        <Select value={String(ano)} onValueChange={(value) => setAno(Number(value))}>
          <SelectTrigger className="w-32 border-white/10 bg-slate-950/60 text-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent>{[anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2].map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {carregando ? (
        <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" /></div>
      ) : feriados.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Nenhum feriado para {ano}.</p>
      ) : (
        <div className="space-y-2">
          {feriados.map((feriado, index) => (
            <div key={feriado.id ?? `nacional-${index}`} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-900/40 p-3 ${editandoId === feriado.id ? "border-blue-500/40" : "border-white/5"}`}>
              <div>
                <p className="text-sm font-medium text-white">{feriado.nome}</p>
                <p className="text-xs text-slate-500">{feriado.data} · {ESCOPO_LABEL[feriado.escopo] ?? feriado.escopo}{feriado.uf && ` · ${feriado.uf}`}{feriado.municipio && ` · ${feriado.municipio}`}</p>
              </div>
              {feriado.id ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 border-white/10" disabled={isPending} onClick={() => editar(feriado)}><Pencil className="size-3.5" aria-hidden="true" />Editar</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="gap-1.5 border-white/10 text-rose-400" disabled={isPending}><Trash2 className="size-3.5" aria-hidden="true" />Excluir</Button></AlertDialogTrigger>
                    <AlertDialogContent className="border-white/10 bg-slate-950">
                      <AlertDialogHeader><AlertDialogTitle className="text-slate-200">Excluir &quot;{feriado.nome}&quot;?</AlertDialogTitle><AlertDialogDescription className="text-slate-400">Este feriado deixa de contar no cálculo de dias úteis das comissões.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => excluir(feriado.id!)} className="bg-rose-600 hover:bg-rose-500">Excluir</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : <span className="text-[11px] text-slate-600">Automático · somente leitura</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
