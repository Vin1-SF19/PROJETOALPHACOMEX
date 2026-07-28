"use client";

import { useState, useTransition } from "react";
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
import type { PreviewResult, TipoEspelho } from "@/lib/commissions/export/preview-builder";

interface ModalExportarEspelhoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPOS_ESPELHO: Array<{ value: TipoEspelho; label: string }> = [
  { value: "comissoes", label: "Comissões" },
  { value: "premios", label: "Prêmios" },
  { value: "comissao_dsr", label: "Comissão e DSR" },
  { value: "todos", label: "Todos" },
];

function primeiroDiaDoMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function ultimoDiaDoMes(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function ModalExportarEspelho({ open, onOpenChange }: ModalExportarEspelhoProps) {
  const [tipo, setTipo] = useState<TipoEspelho>("todos");
  // TODO(Fase 14 — Configurações): substituir por um seletor de colaborador real (busca
  // por nome) quando a Fase 14 disponibilizar um catálogo de colaboradores do módulo.
  // Por ora, campo numérico simples de ID.
  const [colaboradorId, setColaboradorId] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDiaDoMes());
  const [periodoFim, setPeriodoFim] = useState(ultimoDiaDoMes());
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function montarFiltros() {
    return {
      tipo,
      colaboradorId: colaboradorId.trim() ? Number(colaboradorId) : undefined,
      periodoInicio: new Date(periodoInicio),
      periodoFim: new Date(periodoFim),
      status: status.trim() || undefined,
    };
  }

  function preVisualizar() {
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <Label htmlFor="colaboradorId" className="text-slate-400">Colaborador (ID, opcional)</Label>
            <Input
              id="colaboradorId"
              type="number"
              value={colaboradorId}
              onChange={(e) => setColaboradorId(e.target.value)}
              className="mt-1 border-white/10 bg-slate-900/40 text-slate-200"
              placeholder="Todos"
            />
          </div>

          <div>
            <Label htmlFor="periodoInicio" className="text-slate-400">Período — início</Label>
            <Input
              id="periodoInicio"
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="mt-1 border-white/10 bg-slate-900/40 text-slate-200"
            />
          </div>

          <div>
            <Label htmlFor="periodoFim" className="text-slate-400">Período — fim</Label>
            <Input
              id="periodoFim"
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              className="mt-1 border-white/10 bg-slate-900/40 text-slate-200"
            />
          </div>

          <div>
            <Label htmlFor="status" className="text-slate-400">Status (opcional)</Label>
            <Input
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="Todos"
              className="mt-1 border-white/10 bg-slate-900/40 text-slate-200"
            />
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
