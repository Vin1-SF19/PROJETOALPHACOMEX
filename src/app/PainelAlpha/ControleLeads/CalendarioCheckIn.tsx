"use client";

import { getDiasComLancamento } from "@/actions/ComercialControle";
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

type CalendarioCheckInProps = {
  colaboradoraId: string;
  somenteLeitura: boolean;
};

function dataIso(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function CalendarioCheckIn({ colaboradoraId, somenteLeitura }: CalendarioCheckInProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agora = new Date();
  const mes = Number(searchParams.get("mes") ?? agora.getMonth());
  const ano = Number(searchParams.get("ano") ?? agora.getFullYear());
  const selecionada = searchParams.get("data") ?? dataIso(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const [diasComLancamento, setDiasComLancamento] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!colaboradoraId || !Number.isInteger(mes) || !Number.isInteger(ano)) return;
    setCarregando(true);
    setErro(null);
    try {
      const dias = await getDiasComLancamento(colaboradoraId, mes, ano);
      setDiasComLancamento(new Set(dias));
    } catch {
      setDiasComLancamento(new Set());
      setErro("Não foi possível conferir os lançamentos deste mês.");
    } finally {
      setCarregando(false);
    }
  }, [ano, colaboradoraId, mes]);

  useEffect(() => {
    const carregamentoInicial = window.setTimeout(() => void carregar(), 0);
    const atualizar = () => void carregar();
    window.addEventListener("alpha-leads:lancamento-salvo", atualizar);
    return () => {
      window.clearTimeout(carregamentoInicial);
      window.removeEventListener("alpha-leads:lancamento-salvo", atualizar);
    };
  }, [carregar]);

  const dias = useMemo(() => {
    const quantidade = new Date(ano, mes + 1, 0).getDate();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const deslocamentoSegunda = (primeiroDia + 6) % 7;
    return [
      ...Array.from({ length: deslocamentoSegunda }, () => null),
      ...Array.from({ length: quantidade }, (_, indice) => indice + 1),
    ];
  }, [ano, mes]);

  const hojeIso = dataIso(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diasUteisAteHoje = dias.filter((dia) => {
    if (!dia) return false;
    const iso = dataIso(ano, mes, dia);
    const semana = new Date(`${iso}T12:00:00Z`).getUTCDay();
    return semana >= 1 && semana <= 5 && iso <= hojeIso;
  }) as number[];
  const concluidos = diasUteisAteHoje.filter((dia) => diasComLancamento.has(dataIso(ano, mes, dia))).length;
  const pendentes = Math.max(0, diasUteisAteHoje.length - concluidos);

  const navegarMes = (incremento: number) => {
    const destino = new Date(ano, mes + incremento, 1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", String(destino.getMonth()));
    params.set("ano", String(destino.getFullYear()));
    params.set("data", dataIso(destino.getFullYear(), destino.getMonth(), 1));
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const selecionarDia = (dia: number) => {
    const iso = dataIso(ano, mes, dia);
    const params = new URLSearchParams(searchParams.toString());
    params.set("data", iso);
    params.set("mes", String(mes));
    params.set("ano", String(ano));
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Checklist mensal de lançamentos">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <CalendarCheck size={17} />
            <h3 className="text-[11px] font-black uppercase tracking-widest">Checklist mensal</h3>
          </div>
          <p className="mt-1 truncate text-[10px] font-bold text-slate-500" title={colaboradoraId}>
            {somenteLeitura ? `Acompanhando ${colaboradoraId}` : "Baseado nos lançamentos salvos"}
          </p>
        </div>
        {carregando && <Loader2 size={16} className="animate-spin text-blue-500" aria-label="Carregando calendário" />}
      </div>

      <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-2 py-1 dark:bg-slate-800/70">
        <button type="button" onClick={() => navegarMes(-1)} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-700" aria-label="Mês anterior">
          <ChevronLeft size={16} />
        </button>
        <strong className="text-[10px] uppercase tracking-widest text-slate-700 dark:text-slate-200">{MESES[mes]} {ano}</strong>
        <button type="button" onClick={() => navegarMes(1)} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-700" aria-label="Próximo mês">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {SEMANA.map((nome) => <span key={nome} className="py-1 text-[8px] font-black text-slate-400">{nome}</span>)}
        {dias.map((dia, indice) => {
          if (!dia) return <span key={`vazio-${indice}`} />;
          const iso = dataIso(ano, mes, dia);
          const completo = diasComLancamento.has(iso);
          const futuro = iso > hojeIso;
          const ativo = iso === selecionada;
          const fimDeSemana = [0, 6].includes(new Date(`${iso}T12:00:00Z`).getUTCDay());
          const pendente = !completo && !futuro && !fimDeSemana;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => selecionarDia(dia)}
              title={completo ? "Lançamento realizado" : pendente ? "Pendente — abrir lançamento" : "Abrir este dia"}
              aria-label={`${dia} de ${MESES[mes]}: ${completo ? "lançamento realizado" : pendente ? "pendente" : "sem pendência"}`}
              className={`relative flex aspect-square items-center justify-center rounded-lg text-[10px] font-black transition ${
                ativo ? "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900" : ""
              } ${
                completo
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : pendente
                    ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {completo ? <Check size={13} strokeWidth={3} /> : dia}
              {iso === hojeIso && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500" />}
            </button>
          );
        })}
      </div>

      {erro ? (
        <p role="alert" className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-[9px] font-bold text-rose-600">{erro}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-emerald-500/10 px-2 py-2"><strong className="block text-sm text-emerald-600">{concluidos}</strong><span className="text-[8px] font-black uppercase text-emerald-700 dark:text-emerald-400">Feitos</span></div>
          <div className="rounded-xl bg-amber-500/10 px-2 py-2"><strong className="block text-sm text-amber-600">{pendentes}</strong><span className="text-[8px] font-black uppercase text-amber-700 dark:text-amber-400">Pendentes</span></div>
        </div>
      )}
      <p className="mt-3 text-center text-[8px] font-bold text-slate-400">Clique em um dia para abrir o registro correspondente.</p>
    </section>
  );
}
