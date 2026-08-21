import "server-only";

export type AlphaSeoConfigurationEnvironment = Record<string, string | undefined>;

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/**
 * Retorna somente presença de configuração. Valores, comprimentos e prefixes
 * nunca atravessam a fronteira do servidor.
 */
export function getAlphaSeoApiKeyStatus(
  environment: AlphaSeoConfigurationEnvironment = process.env,
) {
  const direct = configured(environment.DATAFORSEO_API_KEY);
  const credentials =
    configured(environment.DATAFORSEO_LOGIN) &&
    configured(environment.DATAFORSEO_PASSWORD);

  return { configured: direct || credentials };
}

export function getAlphaSeoSamAccessSetupStatus(
  environment: AlphaSeoConfigurationEnvironment = process.env,
) {
  const enabled = configured(environment.OPENROUTER_API_KEY);
  return {
    enabled,
    errorMessage: enabled
      ? null
      : "OPENROUTER_API_KEY não está configurada para este ambiente.",
  };
}
