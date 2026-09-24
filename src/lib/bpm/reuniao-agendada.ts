import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";
import { BPM_STAGE_KEYS } from "@/lib/bpm/ontology";

export const NOME_ETAPA_REUNIAO_AGENDADA = "Reunião Agendada";
export const AUTOMACAO_ORIGEM_REUNIAO_AGENDADA =
  "reuniao_agendada_8_dias_uteis";

export function etapaEhReuniaoAgendada(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_REUNIAO_AGENDADA);
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
    : ["Em tratativa", "Sem viabilidade"].map(normalizarNomeEtapa).includes(normalizarNomeEtapa(params.etapaDestinoNome));
  if (!destinoExigeTranscricao) {
    return null;
  }

  if (params.transcricaoReuniao?.trim()) return null;

  return "A transcrição da reunião ainda não foi recebida. Sincronize a transcrição antes de avançar.";
}
