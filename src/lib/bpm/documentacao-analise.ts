export const PIPELINE_DOCUMENTACAO_OPERACIONAL_ID = "cmuih4tnh000409gm5z34jvss";
export const ETAPA_DOCUMENTACAO_ANALISE_ID = "draft-stage-86098ead-66b3-4032-a920-04832b71dc0c";

const SEMANA_MS = 7 * 86_400_000;

export function cicloSemanal(entradaEm: Date, ultimaAnotacaoEm: Date | null, agora: Date): number {
  const referencia = ultimaAnotacaoEm && ultimaAnotacaoEm > entradaEm ? ultimaAnotacaoEm : entradaEm;
  return Math.max(0, Math.floor((agora.getTime() - referencia.getTime()) / SEMANA_MS));
}
