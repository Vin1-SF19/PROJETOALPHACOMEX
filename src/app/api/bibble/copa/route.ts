import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Calendário da Seleção Brasileira — Copa do Mundo 2026 ────────────────────
// Grupo C: Brasil, Marrocos, Escócia, Haiti. Os 3 jogos da fase de grupos
// acontecem nos EUA. Horários em horário de Brasília (UTC-3).
// Fonte: FIFA / CNN / Olympics (calendário oficial da fase de grupos).
//
// Datas das fases finais ainda dependem da classificação — quando a fase de
// grupos terminar e não houver mais jogos cadastrados, o Bibble entra em modo
// "torcida genérica" (sem data específica).

interface Jogo {
  /** ISO em horário de Brasília (UTC-3) */
  kickoff: string;
  adversario: string;
  fase: string;
  local: string;
}

const JOGOS_BRASIL: Jogo[] = [
  { kickoff: "2026-06-13T19:00:00-03:00", adversario: "Marrocos", fase: "Fase de grupos", local: "MetLife Stadium, Nova Jersey" },
  { kickoff: "2026-06-19T21:30:00-03:00", adversario: "Haiti",    fase: "Fase de grupos", local: "Lincoln Financial Field, Filadélfia" },
  { kickoff: "2026-06-24T19:00:00-03:00", adversario: "Escócia",  fase: "Fase de grupos", local: "Estados Unidos" },
];

// ── Falas temáticas (não dependem de data) ───────────────────────────────────

const FALAS_GERAIS: { mood: string; fala: string }[] = [
  { mood: "copa-tranquilo", fala: "Você já vestiu sua camisa da seleção hoje? Eu já tô no clima." },
  { mood: "copa-tranquilo", fala: "Copa do Mundo rolando e você aqui trabalhando comigo. Respeito a dedicação." },
  { mood: "copa-serio",     fala: "Hexa é meta. Foco total na seleção esse ano." },
  { mood: "copa-tranquilo", fala: "Já separou o verde e amarelo? A Copa não espera." },
  { mood: "copa-serio",     fala: "Se o Brasil jogar, o expediente para. Regra não oficial, mas deveria ser." },
  { mood: "copa-tranquilo", fala: "Confesso: tô dividido entre monitorar o painel e a tabela da Copa." },
  { mood: "copa-serio",     fala: "Brasil no grupo C: Marrocos, Escócia e Haiti. Bora pro mata-mata." },
  { mood: "copa-tranquilo", fala: "Toda Copa eu fico arrepiado. E olha que eu sou digital." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function formatarData(d: Date): { dia: number; mes: string; diaSemana: string; hora: string } {
  // Renderiza no fuso de Brasília independentemente do fuso do servidor
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dia = Number(get("day"));
  const mesIdx = Number(get("month")) - 1;
  return {
    dia,
    mes: MESES[mesIdx] ?? "",
    diaSemana: get("weekday"),
    hora: `${get("hour")}h${get("minute") !== "00" ? get("minute") : ""}`,
  };
}

function diffDias(de: Date, ate: Date): number {
  const ms = ate.getTime() - de.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const agora = new Date();

  // Próximo jogo ainda não encerrado (margem de 2h após o kickoff = "ao vivo")
  const proximo = JOGOS_BRASIL.find((j) => {
    const kickoff = new Date(j.kickoff);
    const fimEstimado = new Date(kickoff.getTime() + 2 * 60 * 60 * 1000);
    return fimEstimado >= agora;
  });

  // Pool base sempre disponível
  const pool: { mood: string; fala: string }[] = [...FALAS_GERAIS];

  if (proximo) {
    const kickoff = new Date(proximo.kickoff);
    const fimEstimado = new Date(kickoff.getTime() + 2 * 60 * 60 * 1000);
    const { dia, mes, diaSemana, hora } = formatarData(kickoff);
    const dias = diffDias(agora, kickoff);
    const aoVivo = agora >= kickoff && agora <= fimEstimado;

    if (aoVivo) {
      pool.push(
        { mood: "copa-serio", fala: `É AGORA! Brasil x ${proximo.adversario} rolando. Como você ainda tá aqui?` },
        { mood: "copa-serio", fala: `Jogo do Brasil ao vivo contra ${proximo.adversario}. Eu seguro o painel, vai assistir!` },
      );
    } else if (dias <= 0) {
      pool.push(
        { mood: "copa-serio",     fala: `É HOJE! Brasil x ${proximo.adversario} às ${hora}. Já tô contando os minutos.` },
        { mood: "copa-tranquilo", fala: `Hoje tem seleção! ${proximo.adversario} às ${hora}. Camisa já separada?` },
      );
    } else if (dias === 1) {
      pool.push(
        { mood: "copa-tranquilo", fala: `Amanhã tem Brasil x ${proximo.adversario}, às ${hora}. Ansiedade no talo.` },
        { mood: "copa-serio",     fala: `Falta só 1 dia pro jogo contra ${proximo.adversario}. Bora torcer!` },
      );
    } else {
      pool.push(
        { mood: "copa-tranquilo", fala: `Já tô ansioso pro jogo do Brasil dia ${dia} de ${mes} (${diaSemana}), contra ${proximo.adversario}.` },
        { mood: "copa-tranquilo", fala: `Faltam ${dias} dias pro Brasil enfrentar ${proximo.adversario}, dia ${dia}/${mes.slice(0, 3)} às ${hora}.` },
        { mood: "copa-serio",     fala: `Próximo desafio: ${proximo.adversario}, ${diaSemana} dia ${dia}. ${proximo.fase}.` },
      );
    }
  } else {
    // Sem jogos cadastrados à frente — modo torcida genérica
    pool.push(
      { mood: "copa-tranquilo", fala: "Fase de grupos encerrada. Agora é mata-mata e meu coração digital não aguenta." },
      { mood: "copa-serio",     fala: "Seguimos firmes na Copa. Cada jogo daqui é decisão." },
    );
  }

  const escolhida = pool[Math.floor(Math.random() * pool.length)];

  return NextResponse.json({
    mood: escolhida.mood,
    fala: escolhida.fala,
    proximoJogo: proximo
      ? { adversario: proximo.adversario, kickoff: proximo.kickoff, fase: proximo.fase }
      : null,
  });
}
