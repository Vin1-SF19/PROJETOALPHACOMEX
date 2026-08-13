export const STATUS_POS_FECHAMENTO_CODIGOS = [
  "AGUARDANDO_CONTRATO",
  "CONTRATO_A_ENVIAR",
  "CONTRATO_ENVIADO",
  "PAGAMENTO_CONFIRMADO",
  "CONTRATO_ASSINADO",
] as const;

export type StatusPosFechamento = (typeof STATUS_POS_FECHAMENTO_CODIGOS)[number];

export type StatusPosFechamentoConfig = {
  codigo: StatusPosFechamento;
  label: string;
  badgeClassName: string;
  cardClassName: string;
};

export const STATUS_POS_FECHAMENTO_INICIAL: StatusPosFechamento =
  "AGUARDANDO_CONTRATO";

export const STATUS_POS_FECHAMENTO_CONFIG: Readonly<
  Record<StatusPosFechamento, StatusPosFechamentoConfig>
> = {
  AGUARDANDO_CONTRATO: {
    codigo: "AGUARDANDO_CONTRATO",
    label: "Aguardando contrato",
    badgeClassName: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    cardClassName: "border-slate-500/30 bg-slate-500/[0.06]",
  },
  CONTRATO_A_ENVIAR: {
    codigo: "CONTRATO_A_ENVIAR",
    label: "Contrato a enviar",
    badgeClassName: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    cardClassName: "border-blue-500/30 bg-blue-500/[0.06]",
  },
  CONTRATO_ENVIADO: {
    codigo: "CONTRATO_ENVIADO",
    label: "Contrato enviado",
    badgeClassName: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    cardClassName: "border-amber-500/30 bg-amber-500/[0.06]",
  },
  PAGAMENTO_CONFIRMADO: {
    codigo: "PAGAMENTO_CONFIRMADO",
    label: "Pagamento confirmado",
    badgeClassName: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    cardClassName: "border-violet-500/30 bg-violet-500/[0.06]",
  },
  CONTRATO_ASSINADO: {
    codigo: "CONTRATO_ASSINADO",
    label: "Contrato assinado",
    badgeClassName: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    cardClassName: "border-emerald-500/30 bg-emerald-500/[0.06]",
  },
};

export const STATUS_POS_FECHAMENTO_OPCOES: readonly StatusPosFechamentoConfig[] =
  STATUS_POS_FECHAMENTO_CODIGOS.map(
    (codigo) => STATUS_POS_FECHAMENTO_CONFIG[codigo],
  );

export const CONFIGURACAO_FECHADO_INVALIDA_MENSAGEM =
  "A configuração da etapa Fechado está inconsistente. Contate um administrador.";

export type CampoConfiguracaoFechado = {
  nome: string;
  tipo: string;
  opcoesJson: string | null;
  obrigatorio: boolean;
  contexto?: "ORIGEM" | "DESTINO" | "AMBOS";
};

export function statusPosFechamentoEhValido(
  valor: unknown,
): valor is StatusPosFechamento {
  return typeof valor === "string"
    && STATUS_POS_FECHAMENTO_CODIGOS.some((codigo) => codigo === valor);
}

export function obterStatusPosFechamentoConfig(
  valor: unknown,
): StatusPosFechamentoConfig | null {
  return statusPosFechamentoEhValido(valor)
    ? STATUS_POS_FECHAMENTO_CONFIG[valor]
    : null;
}

function normalizarNomeEtapa(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function catalogoSelecaoEhValido(opcoesJson: string | null): boolean {
  if (!opcoesJson) return false;
  try {
    const opcoes: unknown = JSON.parse(opcoesJson);
    return Array.isArray(opcoes)
      && opcoes.length > 0
      && opcoes.every(
        (opcao) => typeof opcao === "string" && opcao.trim().length > 0,
      );
  } catch {
    return false;
  }
}

export function configuracaoEntradaFechadoEhValida(
  campos: readonly CampoConfiguracaoFechado[],
): boolean {
  const aplicaveisAoDestino = campos.filter(
    (campo) => campo.contexto !== "ORIGEM",
  );
  const valor = aplicaveisAoDestino.filter(
    (campo) => normalizarNomeEtapa(campo.nome) === "valor acordado no contrato",
  );
  const forma = aplicaveisAoDestino.filter(
    (campo) => normalizarNomeEtapa(campo.nome) === "forma de pagamento",
  );

  return valor.length === 1
    && forma.length === 1
    && valor[0].obrigatorio
    && normalizarNomeEtapa(valor[0].tipo) === "numero"
    && forma[0].obrigatorio
    && normalizarNomeEtapa(forma[0].tipo) === "selecao"
    && catalogoSelecaoEhValido(forma[0].opcoesJson);
}

export function etapaEhFechado(nome: string | null | undefined): boolean {
  return typeof nome === "string" && normalizarNomeEtapa(nome) === "fechado";
}

export function obterStatusPosFechamentoVisivel(params: {
  etapaNome: string | null | undefined;
  status: unknown;
}): StatusPosFechamentoConfig | null {
  if (!etapaEhFechado(params.etapaNome)) return null;
  return obterStatusPosFechamentoConfig(params.status);
}
