export const MOTIVOS_LOST = [
  "Sem orçamento",
  "Escolheu concorrente",
  "Sem resposta",
  "Empresa não tem viabilidade",
  "Outro",
] as const;

export const MOTIVO_LOST_OUTRO = "Outro" as const;

export const CONFIGURACAO_LOST_INVALIDA_MENSAGEM =
  "A configuração da etapa Lost está inconsistente. Contate um administrador.";
export const MOTIVO_LOST_OBRIGATORIO_MENSAGEM =
  "Informe o Motivo de Lost antes de concluir a movimentação.";
export const MOTIVO_LOST_INVALIDO_MENSAGEM =
  "Selecione um Motivo de Lost válido.";
export const MOTIVO_LOST_OUTRO_OBRIGATORIO_MENSAGEM =
  "Descreva o Motivo de Lost - Outro.";

function normalizarIdentificador(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function etapaEhLost(nome: string | null | undefined): boolean {
  return typeof nome === "string" && normalizarIdentificador(nome) === "lost";
}

export function campoEhMotivoLost(nome: string | null | undefined): boolean {
  return typeof nome === "string"
    && normalizarIdentificador(nome) === "motivo de lost";
}

export function campoEhMotivoLostOutro(
  nome: string | null | undefined,
): boolean {
  return typeof nome === "string"
    && normalizarIdentificador(nome) === "motivo de lost - outro";
}

export function motivoLostExigeComplemento(valor: unknown): boolean {
  return typeof valor === "string"
    && normalizarIdentificador(valor) === normalizarIdentificador(MOTIVO_LOST_OUTRO);
}

export type CampoConfiguracaoLost = {
  id: string;
  pipelineId: string;
  etapaId: string | null;
  nome: string;
  tipo: string;
  opcoesJson: string | null;
  obrigatorio: boolean;
  ordem: number;
  valor?: string | null;
};

export type ConfiguracaoLost = {
  motivo: CampoConfiguracaoLost;
  complemento: CampoConfiguracaoLost;
};

export type ResultadoConfiguracaoLost =
  | { success: true; configuracao: ConfiguracaoLost }
  | { success: false; error: typeof CONFIGURACAO_LOST_INVALIDA_MENSAGEM };

function catalogoMotivosEhExato(opcoesJson: string | null): boolean {
  if (!opcoesJson) return false;
  try {
    const opcoes: unknown = JSON.parse(opcoesJson);
    return Array.isArray(opcoes)
      && opcoes.length === MOTIVOS_LOST.length
      && opcoes.every(
        (opcao, indice) => opcao === MOTIVOS_LOST[indice],
      );
  } catch {
    return false;
  }
}

export function resolverConfiguracaoLost(params: {
  camposPipeline: readonly CampoConfiguracaoLost[];
  etapaLostId: string;
  campoIdsObrigatoriosEtapa: readonly string[];
}): ResultadoConfiguracaoLost {
  const motivos = params.camposPipeline.filter((campo) =>
    campoEhMotivoLost(campo.nome),
  );
  const complementos = params.camposPipeline.filter((campo) =>
    campoEhMotivoLostOutro(campo.nome),
  );
  if (motivos.length !== 1 || complementos.length !== 1) {
    return { success: false, error: CONFIGURACAO_LOST_INVALIDA_MENSAGEM };
  }

  const motivo = motivos[0];
  const complemento = complementos[0];
  const obrigatorios = params.campoIdsObrigatoriosEtapa.filter(
    (campoId) => campoId === motivo.id,
  );
  const motivoDiretoObrigatorio = motivo.etapaId === params.etapaLostId
    && motivo.obrigatorio;
  const motivoGlobalAssociado = motivo.etapaId === null
    && obrigatorios.length === 1;

  if (
    normalizarIdentificador(motivo.tipo) !== "selecao"
    || !catalogoMotivosEhExato(motivo.opcoesJson)
    || (!motivoDiretoObrigatorio && !motivoGlobalAssociado)
    || normalizarIdentificador(complemento.tipo) !== "texto"
    || complemento.etapaId !== null
    || params.campoIdsObrigatoriosEtapa.includes(complemento.id)
  ) {
    return { success: false, error: CONFIGURACAO_LOST_INVALIDA_MENSAGEM };
  }

  return { success: true, configuracao: { motivo, complemento } };
}

export type ResultadoValidacaoMotivoLost =
  | { success: true; valores: { motivo: string; complemento: string } }
  | { success: false; error: string };

export function validarMotivoLost(params: {
  configuracao: ConfiguracaoLost;
  valores: Readonly<Record<string, string | null | undefined>>;
}): ResultadoValidacaoMotivoLost {
  const motivo = (
    params.valores[params.configuracao.motivo.id]
    ?? params.configuracao.motivo.valor
    ?? ""
  ).trim();
  const complemento = (
    params.valores[params.configuracao.complemento.id]
    ?? params.configuracao.complemento.valor
    ?? ""
  ).trim();

  if (!motivo) {
    return { success: false, error: MOTIVO_LOST_OBRIGATORIO_MENSAGEM };
  }
  if (!MOTIVOS_LOST.some((opcao) => opcao === motivo)) {
    return { success: false, error: MOTIVO_LOST_INVALIDO_MENSAGEM };
  }
  if (motivoLostExigeComplemento(motivo) && !complemento) {
    return {
      success: false,
      error: MOTIVO_LOST_OUTRO_OBRIGATORIO_MENSAGEM,
    };
  }

  return { success: true, valores: { motivo, complemento } };
}
