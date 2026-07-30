"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PreviaEspelho } from "./PreviaEspelho";
import { PreviewExportacao } from "@/actions/CommissionExports";
import { BuscarTodosUsuarios } from "@/actions/RecursosHumanos";
import type { PreviewResult, TipoEspelho } from "@/lib/commissions/export/preview-builder";

interface ModalExportarEspelhoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPOS_ESPELHO: Array<{ value: TipoEspelho; label: string }> = [
  { value: "comissoes", label: "Comissões" },
  { value: "premios", label: "Prêmios" },
];

type ModoPeriodo = "mes" | "semana" | "livre";

function primeiroDiaDoMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function ultimoDiaDoMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

/** Domingo a sábado da semana corrente. */
function semanaCorrente(): { inicio: string; fim: string } {
  const hoje = new Date();
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - hoje.getDay());
  const sabado = new Date(domingo);
  sabado.setDate(domingo.getDate() + 6);
  return { inicio: domingo.toISOString().slice(0, 10), fim: sabado.toISOString().slice(0, 10) };
}

export function ModalExportarEspelho({ open, onOpenChange }: ModalExportarEspelhoProps) {
  const [tipo, setTipo] = useState<TipoEspelho>("comissoes");
  const [colaboradorId, setColaboradorId] = useState("");
  const [colaboradores, setColaboradores] = useState<Array<{ id: number; nome: string }>>([]);
  const [carregandoColaboradores, setCarregandoColaboradores] = useState(false);

  const [modoPeriodo, setModoPeriodo] = useState<ModoPeriodo>("mes");
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDiaDoMes());
  const [periodoFim, setPeriodoFim] = useState(ultimoDiaDoMes());

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    let cancelado = false;
    void (async () => {
      setCarregandoColaboradores(true);
      const resultado = await BuscarTodosUsuarios();
      if (cancelado) return;

      if (resultado.success) {
        setColaboradores(
          resultado.data.filter((u) => u.status === "ATIVO").map((u) => ({ id: u.id, nome: u.nome })),
        );
      }
      setCarregandoColaboradores(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [open]);

  function mudarModoPeriodo(modo: ModoPeriodo) {
    setModoPeriodo(modo);
    if (modo === "mes") {
      setPeriodoInicio(primeiroDiaDoMes());
      setPeriodoFim(ultimoDiaDoMes());
    } else if (modo === "semana") {
      const { inicio, fim } = semanaCorrente();
      setPeriodoInicio(inicio);
      setPeriodoFim(fim);
    }
  }

  function montarFiltros() {
    return {
      tipo,
      colaboradorId: Number(colaboradorId),
      periodoInicio: new Date(periodoInicio),
      periodoFim: new Date(periodoFim),
    };
  }

  function preVisualizar() {
    if (!colaboradorId) {
      toast.error("Selecione um colaborador.");
      return;
    }

    setErro(null);
    startTransition(async () => {
      const resultado = await PreviewExportacao(montarFiltros());
      if (!resultado.success) {
        setErro(resultado.error);
        setPreview(null);
        return;
      }
      setPreview(resultado.data);
    });
  }

  function fechar(novoOpen: boolean) {
    if (!novoOpen) {
      setPreview(null);
      setErro(null);
    }
    onOpenChange(novoOpen);
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Exportar Espelho</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-slate-400">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoEspelho)}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-900/40 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ESPELHO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-400">Colaborador</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger className="mt-1 w-full border-white/10 bg-slate-900/40 text-slate-200">
                <SelectValue placeholder={carregandoColaboradores ? "Carregando..." : "Selecionar..."} />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-slate-400">Período</Label>
          <div className="mt-1 flex gap-2">
            {(["mes", "semana", "livre"] as ModoPeriodo[]).map((modo) => (
              <button
                key={modo}
                type="button"
                onClick={() => mudarModoPeriodo(modo)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  modoPeriodo === modo
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 text-slate-400 hover:text-slate-200"
                }`}
              >
                {modo === "mes" ? "Mês" : modo === "semana" ? "Semana (dom-sáb)" : "Data livre"}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="periodoInicio" className="text-slate-400">Início</Label>
              <Input
                id="periodoInicio"
                type="date"
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                disabled={modoPeriodo !== "livre"}
                className="mt-1 border-white/10 bg-slate-900/40 text-slate-200"
              />
            </div>
            <div>
              <Label htmlFor="periodoFim" className="text-slate-400">Fim</Label>
              <Input
                id="periodoFim"
                type="date"
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                disabled={modoPeriodo !== "livre"}
                className="mt-1 border-white/10 bg-slate-900/40 text-slate-200"
              />
            </div>
          </div>
        </div>

        <Button onClick={preVisualizar} disabled={isPending} variant="outline" className="mt-2 w-full gap-2 border-white/10">
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Pré-visualizar
        </Button>

        {erro && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
            Não foi possível montar a prévia. <code className="text-xs text-rose-400/80">{erro}</code>
          </div>
        )}

        {preview && <PreviaEspelho preview={preview} filtros={montarFiltros()} />}
      </DialogContent>
    </Dialog>
  );
}
