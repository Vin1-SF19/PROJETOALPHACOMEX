"use client";

import { useState } from "react";
import { CalendarCheck, CheckCircle2, Loader2 } from "lucide-react";
import {
  ListarChecksCalendario,
  RegistrarCheckLeadsDia,
} from "@/actions/ComercialCheckIn";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface UsuarioCheckIn {
  id: number;
  nome: string;
}

interface CalendarioCheckInClientProps {
  proprioId: number | null;
  podeVerEquipe: boolean;
  registrosIniciais: string[];
  equipeInicial: UsuarioCheckIn[];
  erroInicial: string | null;
}

function chaveDia(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function CalendarioCheckInClient({
  proprioId,
  podeVerEquipe,
  registrosIniciais,
  equipeInicial,
  erroInicial,
}: CalendarioCheckInClientProps) {
  const hoje = new Date();
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<number | null>(null);
  const [diasComCheck, setDiasComCheck] = useState(
    () => new Set(registrosIniciais.map((data) => chaveDia(new Date(data))))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(erroInicial);
  const [isRegistrando, setIsRegistrando] = useState(false);

  const modoAuditoria = usuarioSelecionado !== null && usuarioSelecionado !== proprioId;

  async function carregarChecks(usuarioId: number | null = usuarioSelecionado) {
    if (proprioId === null) return;
    setIsLoading(true);
    setErro(null);

    try {
      const registros = await ListarChecksCalendario(
        hoje.getMonth(),
        hoje.getFullYear(),
        usuarioId ?? proprioId
      );
      setDiasComCheck(new Set(registros.map((registro) => chaveDia(new Date(registro.data)))));
    } catch {
      setDiasComCheck(new Set());
      setErro("Não foi possível carregar o calendário de check-in.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUsuarioChange(valor: string) {
    const novoUsuario = valor ? Number(valor) : null;
    setUsuarioSelecionado(novoUsuario);
    await carregarChecks(novoUsuario);
  }

  async function handleClickDia(dia: number) {
    if (modoAuditoria || isRegistrando || proprioId === null) return;
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
    if (data > hoje || diasComCheck.has(chaveDia(data))) return;

    setIsRegistrando(true);
    setErro(null);
    try {
      const resultado = await RegistrarCheckLeadsDia(data);
      if (resultado.success) {
        setDiasComCheck((anteriores) => new Set(anteriores).add(chaveDia(data)));
      } else {
        setErro(resultado.error || "Falha ao registrar check-in.");
      }
    } catch {
      setErro("Falha ao registrar check-in.");
    } finally {
      setIsRegistrando(false);
    }
  }

  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const totalDias = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const celulas: (number | null)[] = [
    ...Array(primeiroDiaMes.getDay()).fill(null),
    ...Array.from({ length: totalDias }, (_, indice) => indice + 1),
  ];

  return (
    <section
      aria-labelledby="titulo-calendario-checkin"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4 flex items-center gap-2">
        <CalendarCheck aria-hidden="true" size={16} className="text-blue-500" />
        <h4 id="titulo-calendario-checkin" className="text-[10px] font-black uppercase tracking-widest text-blue-600">
          Check-in de Leads · {MESES[hoje.getMonth()]}
        </h4>
      </div>

      {podeVerEquipe && (
        <div className="mb-4 space-y-1">
          <label htmlFor="closer-calendario-checkin" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Calendário do closer
          </label>
          <select
            id="closer-calendario-checkin"
            value={usuarioSelecionado ?? ""}
            onChange={(evento) => void handleUsuarioChange(evento.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold outline-none dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">Meu calendário</option>
            {equipeInicial.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 aria-hidden="true" size={16} className="mr-2 animate-spin motion-reduce:animate-none" />
          <span className="text-xs font-bold">Carregando...</span>
        </div>
      ) : erro ? (
        <div role="alert" className="py-4 text-center">
          <p className="text-xs font-bold text-red-500">{erro}</p>
          {proprioId !== null && (
            <button
              type="button"
              onClick={() => void carregarChecks()}
              className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Tentar novamente
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden="true">
            {DIAS_SEMANA.map((dia, indice) => (
              <span key={indice} className="text-center text-[9px] font-black text-slate-400">{dia}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Check-ins de ${MESES[hoje.getMonth()]}`}>
            {celulas.map((dia, indice) => {
              if (dia === null) return <span key={`vazio-${indice}`} aria-hidden="true" />;
              const data = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
              const checado = diasComCheck.has(chaveDia(data));
              const futuro = data > hoje;
              const ehHoje = chaveDia(data) === chaveDia(hoje);
              const clicavel = !modoAuditoria && !futuro && !checado;

              return (
                <button
                  key={dia}
                  type="button"
                  role="gridcell"
                  disabled={!clicavel}
                  aria-selected={checado}
                  onClick={() => void handleClickDia(dia)}
                  aria-label={`Dia ${dia}${checado ? ", check registrado" : futuro ? ", indisponível" : ", sem check"}`}
                  className={`flex aspect-square items-center justify-center rounded-lg text-[10px] font-black transition-all
                    ${checado ? "bg-emerald-500/15 text-emerald-500" : "text-slate-500 dark:text-slate-400"}
                    ${ehHoje && !checado ? "ring-2 ring-blue-500" : ""}
                    ${clicavel ? "cursor-pointer hover:bg-blue-500/10" : futuro ? "cursor-not-allowed opacity-30" : "cursor-default"}`}
                >
                  {checado ? <CheckCircle2 aria-hidden="true" size={12} /> : dia}
                </button>
              );
            })}
          </div>
          {diasComCheck.size === 0 && (
            <p className="mt-3 text-center text-[10px] font-bold text-slate-400">
              {modoAuditoria ? "Nenhum check-in registrado neste mês." : "Nenhum check-in seu neste mês ainda."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
