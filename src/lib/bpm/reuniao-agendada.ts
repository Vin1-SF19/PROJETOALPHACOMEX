import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";

export const NOME_ETAPA_REUNIAO_AGENDADA = "Reunião Agendada";
export const AUTOMACAO_ORIGEM_REUNIAO_AGENDADA =
  "reuniao_agendada_8_dias_uteis";

export function etapaEhReuniaoAgendada(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_REUNIAO_AGENDADA);
}

export function obterErroTranscricaoParaMovimento(params: {
  etapaOrigemNome: string;
  etapaDestinoNome: string;
  transcricaoReuniao: string | null;
}): string | null {
  if (!etapaEhReuniaoAgendada(params.etapaOrigemNome)) return null;

  const destinosExigemTranscricao = ["Em tratativa", "Sem viabilidade"]
    .map(normalizarNomeEtapa);
  if (!destinosExigemTranscricao.includes(normalizarNomeEtapa(params.etapaDestinoNome))) {
    return null;
  }

  if (params.transcricaoReuniao?.trim()) return null;

  return "A transcrição da reunião ainda não foi recebida. Sincronize a transcrição antes de avançar.";
}
