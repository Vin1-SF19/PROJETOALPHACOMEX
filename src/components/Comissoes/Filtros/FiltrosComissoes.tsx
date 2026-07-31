"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  BuscarOpcoesFiltrosComissao,
  type CommissionDashboardFilters,
} from "@/actions/CommissionDashboard";
import { formatarFormaPagamentoComissao } from "../lib/formatters";

const DEBOUNCE_MS = 350;
const TODOS = "__todos__";
type TipoPeriodo = "mes" | "semana" | "intervalo";

function isoDate(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function inicioMesAtual() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
}

function periodoMes(referencia: Date) {
  return {
    inicio: new Date(referencia.getFullYear(), referencia.getMonth(), 1),
    fim: new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0),
  };
}

function periodoSemana(referencia: Date) {
  const inicio = new Date(referencia);
  const dia = inicio.getDay();
  inicio.setDate(inicio.getDate() - (dia === 0 ? 6 : dia - 1));
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 6);
  return { inicio, fim };
}

interface FiltrosComissoesProps {
  onFiltrosChange: (filtros: CommissionDashboardFilters) => void;
}

export function FiltrosComissoes({ onFiltrosChange }: FiltrosComissoesProps) {
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>("mes");
  const [referencia, setReferencia] = useState(inicioMesAtual);
  const periodoInicial = periodoMes(referencia);
  const [inicioLivre, setInicioLivre] = useState(isoDate(periodoInicial.inicio));
  const [fimLivre, setFimLivre] = useState(isoDate(periodoInicial.fim));
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [opcoes, setOpcoes] = useState<{
    usuarios: Array<{ id: number; nome: string; cargo: string | null }>;
    cargos: string[];
    formasPagamento: string[];
  }>({ usuarios: [], cargos: [], formasPagamento: [] });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void BuscarOpcoesFiltrosComissao().then((resultado) => {
      if (resultado.success) setOpcoes(resultado.data);
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setBuscaAplicada(busca.trim()), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busca]);

  const periodo = useMemo(() => {
    if (tipoPeriodo === "mes") return periodoMes(referencia);
    if (tipoPeriodo === "semana") return periodoSemana(referencia);
    return {
      inicio: new Date(`${inicioLivre}T00:00:00`),
      fim: new Date(`${fimLivre}T00:00:00`),
    };
  }, [tipoPeriodo, referencia, inicioLivre, fimLivre]);

  useEffect(() => {
    const colaboradorId = extras.colaboradorId ? Number(extras.colaboradorId) : undefined;
    onFiltrosChange({
      busca: buscaAplicada || undefined,
      periodoInicio: periodo.inicio,
      periodoFim: periodo.fim,
      eventType: extras.eventType || undefined,
      componentType: extras.componentType || undefined,
      vinculo: extras.vinculo || undefined,
      setor: extras.setor || undefined,
      cargo: extras.cargo || undefined,
      colaboradorId,
      formaPagamento: extras.formaPagamento || undefined,
      status: extras.status || undefined,
    });
  }, [buscaAplicada, extras, onFiltrosChange, periodo]);

  function moverPeriodo(delta: number) {
    setReferencia((atual) => {
      const proximo = new Date(atual);
      if (tipoPeriodo === "mes") proximo.setMonth(proximo.getMonth() + delta);
      else proximo.setDate(proximo.getDate() + delta * 7);
      return proximo;
    });
  }

  function definirExtra(campo: string, valor: string) {
    setExtras((atual) => ({ ...atual, [campo]: valor === TODOS ? "" : valor }));
  }

  function limpar() {
    setBusca("");
    setTipoPeriodo("mes");
    setReferencia(inicioMesAtual());
    setExtras({});
  }

  const labelPeriodo =
    tipoPeriodo === "mes"
      ? referencia.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : `${periodo.inicio.toLocaleDateString("pt-BR")} – ${periodo.fim.toLocaleDateString("pt-BR")}`;

  const filtroAtivo = Object.values(extras).some(Boolean);

  return (
    <section className="mb-6 space-y-3 rounded-2xl border border-white/5 bg-slate-900/35 p-3 sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex rounded-xl border border-white/10 bg-slate-950/50 p-1">
          {(["mes", "semana", "intervalo"] as TipoPeriodo[]).map((tipo) => (
            <Button
              key={tipo}
              type="button"
              size="sm"
              variant={tipoPeriodo === tipo ? "secondary" : "ghost"}
              className="flex-1 capitalize"
              onClick={() => setTipoPeriodo(tipo)}
            >
              {tipo}
            </Button>
          ))}
        </div>

        {tipoPeriodo === "intervalo" ? (
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <Input type="date" value={inicioLivre} onChange={(event) => setInicioLivre(event.target.value)} className="border-white/10 bg-slate-950/50" />
            <Input type="date" value={fimLivre} onChange={(event) => setFimLivre(event.target.value)} className="border-white/10 bg-slate-950/50" />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center gap-3">
            <Button type="button" size="icon" variant="ghost" onClick={() => moverPeriodo(-1)} aria-label="Período anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-52 text-center text-sm font-medium capitalize text-slate-200">{labelPeriodo}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => moverPeriodo(1)} aria-label="Próximo período">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}

        <div className="relative min-w-0 flex-[1.4]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Empresa, CNPJ, serviço, colaborador ou cargo..."
            className="border-white/10 bg-slate-950/50 pl-9"
          />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2 border-white/10">
              <SlidersHorizontal className="size-4" />
              Filtros
              {filtroAtivo && <span className="size-2 rounded-full bg-cyan-400" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full overflow-y-auto border-white/10 bg-slate-950 sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="text-slate-200">Filtros do relatório</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-8 pt-5">
              <FiltroSelect label="Evento" value={extras.eventType} onChange={(v) => definirExtra("eventType", v)} items={[["CONTRACTING", "Contratação"], ["PROCESS_SUCCESS", "Êxito"]]} />
              <FiltroSelect label="Tipo de lançamento" value={extras.componentType} onChange={(v) => definirExtra("componentType", v)} items={[["COMISSAO", "Comissão"], ["PREMIO", "Prêmio"], ["DSR", "DSR"], ["AJUSTE", "Ajuste"]]} />
              <FiltroSelect label="Vínculo" value={extras.vinculo} onChange={(v) => definirExtra("vinculo", v)} items={[["CLT", "CLT"], ["PJ", "PJ"]]} />
              <FiltroSelect label="Setor" value={extras.setor} onChange={(v) => definirExtra("setor", v)} items={[["Comercial", "Comercial"], ["Operacional", "Operacional"]]} />
              <FiltroSelect label="Cargo" value={extras.cargo} onChange={(v) => definirExtra("cargo", v)} items={opcoes.cargos.map((cargo) => [cargo, cargo])} />
              <FiltroSelect label="Colaborador" value={extras.colaboradorId} onChange={(v) => definirExtra("colaboradorId", v)} items={opcoes.usuarios.map((usuario) => [String(usuario.id), `${usuario.nome}${usuario.cargo ? ` — ${usuario.cargo}` : ""}`])} />
              <FiltroSelect label="Forma de pagamento" value={extras.formaPagamento} onChange={(v) => definirExtra("formaPagamento", v)} items={opcoes.formasPagamento.map((forma) => [forma, formatarFormaPagamentoComissao(forma)])} />
              <FiltroSelect label="Status do pagamento" value={extras.status} onChange={(v) => definirExtra("status", v)} items={["Pendente", "Programado", "ParcialmentePago", "Pago", "Bloqueado", "EmDivergencia", "Vencido"].map((status) => [status, status])} />
              <Button type="button" variant="outline" className="w-full gap-2 border-white/10" onClick={limpar}>
                <RotateCcw className="size-4" />
                Limpar todos os filtros
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </section>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  items: string[][];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-400">{label}</Label>
      <Select value={value || TODOS} onValueChange={onChange}>
        <SelectTrigger className="w-full border-white/10 bg-slate-900/60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos</SelectItem>
          {items.map(([valor, texto]) => (
            <SelectItem key={valor} value={valor}>{texto}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
