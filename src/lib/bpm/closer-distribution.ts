export const CHAVE_CONFIG_DISTRIBUICAO_CLOSERS = "distribuicaoClosers";

export type ConfiguracaoDistribuicaoClosers = {
  ativa: boolean;
  usuariosIds: number[];
  ultimoUsuarioId: number | null;
};

export type ResultadoDistribuicaoCloser = {
  responsavelId: number | null;
  onlineNaEscolha: boolean;
  proximoConfig: ConfiguracaoDistribuicaoClosers;
};

export function lerConfiguracaoDistribuicaoClosers(
  visualizacaoConfigJson: string | null | undefined,
): ConfiguracaoDistribuicaoClosers {
  try {
    const raiz = JSON.parse(visualizacaoConfigJson ?? "{}") as Record<string, unknown>;
    const config = raiz[CHAVE_CONFIG_DISTRIBUICAO_CLOSERS];
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return { ativa: false, usuariosIds: [], ultimoUsuarioId: null };
    }
    const valor = config as Record<string, unknown>;
    const usuariosIds = Array.isArray(valor.usuariosIds)
      ? [...new Set(valor.usuariosIds.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0))]
      : [];
    return {
      ativa: valor.ativa === true,
      usuariosIds,
      ultimoUsuarioId: Number.isSafeInteger(valor.ultimoUsuarioId) && Number(valor.ultimoUsuarioId) > 0
        ? Number(valor.ultimoUsuarioId)
        : null,
    };
  } catch {
    return { ativa: false, usuariosIds: [], ultimoUsuarioId: null };
  }
}

export function gravarConfiguracaoDistribuicaoClosers(
  visualizacaoConfigJson: string | null | undefined,
  config: ConfiguracaoDistribuicaoClosers,
): string {
  let raiz: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(visualizacaoConfigJson ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      raiz = parsed as Record<string, unknown>;
    }
  } catch {
    // Configuração legada inválida é substituída mantendo um JSON válido.
  }
  return JSON.stringify({ ...raiz, [CHAVE_CONFIG_DISTRIBUICAO_CLOSERS]: config });
}

export function escolherProximoCloser(params: {
  config: ConfiguracaoDistribuicaoClosers;
  elegiveisIds: readonly number[];
  onlineIds: readonly number[];
}): ResultadoDistribuicaoCloser {
  const elegiveis = new Set(params.elegiveisIds);
  const selecionados = params.config.usuariosIds.filter((id) => elegiveis.has(id));
  const online = new Set(params.onlineIds);
  const onlineSelecionados = selecionados.filter((id) => online.has(id));
  const candidatos = onlineSelecionados.length > 0 ? onlineSelecionados : selecionados;
  if (candidatos.length === 0) {
    return { responsavelId: null, onlineNaEscolha: false, proximoConfig: params.config };
  }

  const ultimoIndice = params.config.usuariosIds.indexOf(params.config.ultimoUsuarioId ?? -1);
  for (let passo = 1; passo <= params.config.usuariosIds.length; passo += 1) {
    const indice = (ultimoIndice + passo + params.config.usuariosIds.length) % params.config.usuariosIds.length;
    const candidato = params.config.usuariosIds[indice];
    if (candidatos.includes(candidato)) {
      return {
        responsavelId: candidato,
        onlineNaEscolha: onlineSelecionados.length > 0,
        proximoConfig: { ...params.config, ultimoUsuarioId: candidato },
      };
    }
  }
  return { responsavelId: null, onlineNaEscolha: false, proximoConfig: params.config };
}

export function usuarioOnlinePeloHeartbeat(ultimoAviso: string | null | undefined, agora = new Date()): boolean {
  if (!ultimoAviso) return false;
  const timestamp = Date.parse(ultimoAviso);
  if (!Number.isFinite(timestamp)) return false;
  const idadeMs = agora.getTime() - timestamp;
  return idadeMs >= 0 && idadeMs <= 60_000;
}
