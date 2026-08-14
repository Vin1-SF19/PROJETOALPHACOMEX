import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";

export const NOME_ETAPA_ALINHAMENTO_ESTRATEGICO = "Alinhamento Estratégico agendado";
export const NOME_CAMPO_RESPONSAVEL_PROCESSO = "Responsável pelo processo";
export const NOME_CAMPO_CPF_RESPONSAVEL = "CPF do responsável";
export const NOME_CAMPO_RESUMO_REUNIAO = "Resumo da reunião";
export const ERRO_ALINHAMENTO_RESUMO_OBRIGATORIO =
  "Cole o resumo da reunião antes de avançar para a próxima etapa.";
export const TEMPLATE_RESUMO_ALINHAMENTO = `Participantes:\n\nObjetivo do alinhamento:\n\nPontos discutidos:\n\nDecisões tomadas:\n\nPróximos passos:`;

const nomesObrigatorios = [
  NOME_CAMPO_RESPONSAVEL_PROCESSO,
  NOME_CAMPO_CPF_RESPONSAVEL,
  NOME_CAMPO_RESUMO_REUNIAO,
].map(normalizarNomeEtapa);

export function etapaEhAlinhamentoEstrategico(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_ALINHAMENTO_ESTRATEGICO);
}

export function campoEhResumoAlinhamento(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_CAMPO_RESUMO_REUNIAO);
}

export function cpfEhValido(valor: string): boolean {
  const cpf = valor.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce((total, caractere, indice) => total + Number(caractere) * (pesoInicial - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return Number(cpf[9]) === digito(cpf.slice(0, 9), 10)
    && Number(cpf[10]) === digito(cpf.slice(0, 10), 11);
}

export function obterErroCamposAlinhamentoParaSaida(params: {
  etapaOrigemNome: string;
  campos: readonly { nome: string; valor: string | null }[];
}): string | null {
  if (!etapaEhAlinhamentoEstrategico(params.etapaOrigemNome)) return null;
  const porNome = new Map(params.campos.map((campo) => [normalizarNomeEtapa(campo.nome), campo.valor?.trim() ?? ""]));
  if (!porNome.get(normalizarNomeEtapa(NOME_CAMPO_RESUMO_REUNIAO))) {
    return ERRO_ALINHAMENTO_RESUMO_OBRIGATORIO;
  }
  for (const nome of nomesObrigatorios) {
    if (!porNome.has(nome)) return "A configuração da etapa Alinhamento Estratégico está incompleta. Contate um administrador.";
    if (!porNome.get(nome)) return "Preencha os campos obrigatórios do Alinhamento Estratégico antes de avançar.";
  }
  return null;
}
