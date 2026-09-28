import { etapaEhStandbyFollowUp, normalizarNomeEtapa } from "@/lib/bpm/novos-leads";
import { adicionarDias, inicioDoDia } from "@/components/CalendarioAlpha/lib/datas";
import { BPM_STAGE_KEYS } from "@/lib/bpm/ontology";

export const NOME_ETAPA_REUNIAO_AGENDADA = "Reunião Agendada";
export const AUTOMACAO_ORIGEM_REUNIAO_AGENDADA =
  "reuniao_agendada_8_dias_uteis";

export function etapaEhReuniaoAgendada(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_REUNIAO_AGENDADA);
}

export function destinoPermitidoReuniaoAgendada(nome: string): boolean {
  return ["Em tratativa", "Em tratativas", "Sem viabilidade"]
    .map(normalizarNomeEtapa).includes(normalizarNomeEtapa(nome)) || etapaEhStandbyFollowUp(nome);
}

/** A primeira ligação pode ocorrer no primeiro dia útil após a reunião. */
export function inicioTentativasAposReuniao(entradaEtapa: Date, dataReuniao: Date): Date {
  const diaSeguinte = adicionarDias(inicioDoDia(dataReuniao), 1);
  return diaSeguinte > entradaEtapa ? diaSeguinte : entradaEtapa;
}

export function transcricaoRealRegistrada(texto: string | null | undefined): boolean {
  const conteudo = texto?.trim() ?? "";
  return Boolean(conteudo) && !conteudo.startsWith("Resumo parcial do evento (Google Calendar):");
}

export function obterErroTranscricaoParaMovimento(params: {
  etapaOrigemNome: string;
  etapaDestinoNome: string;
  etapaOrigemChave?: string | null;
  etapaDestinoChave?: string | null;
  transcricaoReuniao: string | null;
}): string | null {
  const origemEhReuniaoAgendada = params.etapaOrigemChave
    ? params.etapaOrigemChave === BPM_STAGE_KEYS.REUNIAO_AGENDADA
    : etapaEhReuniaoAgendada(params.etapaOrigemNome);
  if (!origemEhReuniaoAgendada) return null;

  const destinoExigeTranscricao = params.etapaDestinoChave
    ? [BPM_STAGE_KEYS.EM_TRATATIVA, BPM_STAGE_KEYS.SEM_VIABILIDADE].some((chave) => chave === params.etapaDestinoChave)
    : ["Em tratativa", "Em tratativas", "Sem viabilidade"].map(normalizarNomeEtapa).includes(normalizarNomeEtapa(params.etapaDestinoNome));
  if (!destinoExigeTranscricao) {
    return null;
  }

  if (transcricaoRealRegistrada(params.transcricaoReuniao)) return null;

  return "A transcrição da reunião ainda não foi recebida. Sincronize a transcrição antes de avançar.";
}
