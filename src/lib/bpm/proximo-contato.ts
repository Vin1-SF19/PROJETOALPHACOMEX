export const ERRO_PROXIMO_CONTATO_OBRIGATORIO =
  "Preencha a data do próximo contato antes de mover o card.";
export const ERRO_PROXIMO_CONTATO_ATRASADO =
  "A data do próximo contato está atrasada. Atualize para hoje ou uma data futura.";

export function pipelineEhRevisaoRadar(nome: string | null | undefined): boolean {
  if (!nome) return false;
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase() === "revisao de radar";
}

function chaveDataSaoPaulo(data: Date): string | null {
  if (Number.isNaN(data.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
}

export function obterErroProximoContatoParaMovimento(
  proximoContatoEm: Date | string | null | undefined,
  agora = new Date(),
): string | null {
  if (!proximoContatoEm) return ERRO_PROXIMO_CONTATO_OBRIGATORIO;
  const dataContato = proximoContatoEm instanceof Date ? proximoContatoEm : new Date(proximoContatoEm);
  const contato = chaveDataSaoPaulo(dataContato);
  const hoje = chaveDataSaoPaulo(agora);
  if (!contato || !hoje) return ERRO_PROXIMO_CONTATO_OBRIGATORIO;
  return contato < hoje ? ERRO_PROXIMO_CONTATO_ATRASADO : null;
}
