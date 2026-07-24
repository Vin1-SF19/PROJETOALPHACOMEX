import db from "@/lib/prisma";

export interface EventoCancelamentoPendente {
  googleEventId: string;
  etag: string;
  titulo: string;
  calendarioNome: string;
}

interface EventoCandidatoCancelamento extends EventoCancelamentoPendente {
  status: string;
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function mensagemSolicitaCancelamentoCalendario(mensagem: string): boolean {
  const texto = normalizarTexto(mensagem);
  const mencionaAcao = /\b(?:cancel|exclu|apag|delet|remov)\w*/.test(texto);
  const mencionaAgenda = /\b(?:event|agenda|compromiss)\w*/.test(texto);
  return mencionaAcao && mencionaAgenda;
}

export function mensagemConfirmaCancelamentoCalendario(mensagem: string): boolean {
  const texto = normalizarTexto(mensagem)
    .replace(/[.,!?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const confirmacoesCurtas = new Set([
    "sim",
    "confirmo",
    "confirmado",
    "pode",
    "pode sim",
    "pode cancelar",
    "pode sim cancelar",
    "sim pode",
    "sim pode cancelar",
    "cancele",
    "cancele sim",
  ]);
  if (confirmacoesCurtas.has(texto)) return true;

  return (
    /^(?:sim|confirmo|confirmado|pode)\b/.test(texto) &&
    mensagemSolicitaCancelamentoCalendario(texto)
  );
}

export function respostaAlegaCancelamentoConcluido(resposta: string): boolean {
  const texto = normalizarTexto(resposta);
  if (
    resposta.includes("?") &&
    /\b(?:confirm|deseja|posso)\w*/.test(texto)
  ) {
    return false;
  }
  return /\b(?:cancelad|excluid|apagad|removid)\w*/.test(texto);
}

export function protegerRespostaDeFalsoCancelamento(
  resposta: string,
  cancelamentoExecutado: boolean,
): string {
  if (
    !cancelamentoExecutado &&
    respostaAlegaCancelamentoConcluido(resposta)
  ) {
    return "Não consegui executar o cancelamento no Google Agenda. Consulte o evento novamente e confirme a exclusão.";
  }
  return resposta;
}

export function resultadoCancelamentoConcluido(
  toolName: string,
  resultado: string,
): boolean {
  if (
    toolName !== "cancelar_evento_calendario" &&
    toolName !== "cancelar_evento_calendario_colega"
  ) {
    return false;
  }

  try {
    const dados = JSON.parse(resultado) as {
      ok?: unknown;
      cancelado?: unknown;
    };
    return dados.ok === true && dados.cancelado === true;
  } catch {
    return false;
  }
}

/**
 * Seleciona o título mais recentemente mencionado pelo Bibble.
 * Empates ou eventos duplicados com o mesmo título são deliberadamente ambíguos.
 */
export function selecionarEventoConfirmado(
  mensagemBibble: string,
  eventos: EventoCandidatoCancelamento[],
): EventoCancelamentoPendente | null {
  const texto = normalizarTexto(mensagemBibble);
  const candidatos = eventos
    .filter((evento) => evento.status !== "cancelled" && evento.titulo.trim())
    .map((evento) => ({
      evento,
      tituloNormalizado: normalizarTexto(evento.titulo),
    }))
    .filter(
      ({ tituloNormalizado }) =>
        tituloNormalizado.length >= 3 && texto.includes(tituloNormalizado),
    );

  if (candidatos.length === 0) return null;

  const porTitulo = new Map<string, typeof candidatos>();
  for (const candidato of candidatos) {
    const grupo = porTitulo.get(candidato.tituloNormalizado) ?? [];
    grupo.push(candidato);
    porTitulo.set(candidato.tituloNormalizado, grupo);
  }

  const ordenados = [...porTitulo.entries()]
    .map(([tituloNormalizado, grupo]) => ({
      tituloNormalizado,
      grupo,
      ultimaMencao: texto.lastIndexOf(tituloNormalizado),
    }))
    .sort((a, b) => b.ultimaMencao - a.ultimaMencao);

  const escolhido = ordenados[0];
  if (!escolhido || escolhido.grupo.length !== 1) return null;
  if (ordenados[1]?.ultimaMencao === escolhido.ultimaMencao) return null;

  const evento = escolhido.grupo[0].evento;
  return {
    googleEventId: evento.googleEventId,
    etag: evento.etag,
    titulo: evento.titulo,
    calendarioNome: evento.calendarioNome,
  };
}

export async function resolverEventoConfirmadoDoUsuario(
  userId: number,
  mensagemBibble: string,
): Promise<EventoCancelamentoPendente | null> {
  const eventos = await db.googleCalendarEventoCache.findMany({
    where: {
      status: { not: "cancelled" },
      calendario: {
        gravavel: true,
        conexao: { userId },
      },
    },
    select: {
      googleEventId: true,
      etag: true,
      titulo: true,
      status: true,
      calendario: {
        select: { nome: true },
      },
    },
  });

  return selecionarEventoConfirmado(
    mensagemBibble,
    eventos
      .filter(
        (evento): evento is typeof evento & { titulo: string } =>
          typeof evento.titulo === "string",
      )
      .map((evento) => ({
        googleEventId: evento.googleEventId,
        etag: evento.etag,
        titulo: evento.titulo,
        status: evento.status,
        calendarioNome: evento.calendario.nome,
      })),
  );
}
