const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", ""]);

export type AgendaAlphaEnvironment = Readonly<
  Record<string, string | undefined>
>;

export interface AgendaAlphaRuntimeConfig {
  distributedLockEnabled: boolean;
  queueEnabled: boolean;
  pushEnabled: boolean;
  webhookBaseUrl: string | null;
  valid: boolean;
  errors: string[];
}

export class AgendaAlphaConfigError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Configuração inválida da Agenda Alpha: ${errors.join("; ")}`);
    this.name = "AgendaAlphaConfigError";
    this.errors = errors;
  }
}

function parseBooleanFlag(
  env: AgendaAlphaEnvironment,
  name: string,
  errors: string[],
): boolean {
  const rawValue = (env[name] ?? "").trim().toLowerCase();
  if (TRUE_VALUES.has(rawValue)) return true;
  if (FALSE_VALUES.has(rawValue)) return false;

  errors.push(`${name} deve ser true ou false`);
  return false;
}

function parsePublicHttpsBaseUrl(
  rawValue: string | undefined,
  required: boolean,
  errors: string[],
): string | null {
  const normalized = rawValue?.trim();
  if (!normalized) {
    if (required) {
      errors.push(
        "AGENDA_ALPHA_WEBHOOK_BASE_URL é obrigatória quando push está habilitado",
      );
    }
    return null;
  }

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();
    const isLocalHostname =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

    if (url.protocol !== "https:" || isLocalHostname || url.username || url.password) {
      errors.push(
        "AGENDA_ALPHA_WEBHOOK_BASE_URL deve ser uma URL HTTPS pública sem credenciais",
      );
      return null;
    }

    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    errors.push("AGENDA_ALPHA_WEBHOOK_BASE_URL não é uma URL válida");
    return null;
  }
}

export function lerAgendaAlphaRuntimeConfig(
  env: AgendaAlphaEnvironment = process.env,
): AgendaAlphaRuntimeConfig {
  const errors: string[] = [];
  const distributedLockEnabled = parseBooleanFlag(
    env,
    "AGENDA_ALPHA_DISTRIBUTED_LOCK_ENABLED",
    errors,
  );
  const queueEnabled = parseBooleanFlag(
    env,
    "AGENDA_ALPHA_QUEUE_ENABLED",
    errors,
  );
  const pushEnabled = parseBooleanFlag(
    env,
    "AGENDA_ALPHA_PUSH_ENABLED",
    errors,
  );
  const webhookBaseUrl = parsePublicHttpsBaseUrl(
    env.AGENDA_ALPHA_WEBHOOK_BASE_URL,
    pushEnabled,
    errors,
  );

  if (queueEnabled && !distributedLockEnabled) {
    errors.push(
      "AGENDA_ALPHA_QUEUE_ENABLED exige AGENDA_ALPHA_DISTRIBUTED_LOCK_ENABLED",
    );
  }
  if (pushEnabled && (!queueEnabled || !distributedLockEnabled)) {
    errors.push(
      "AGENDA_ALPHA_PUSH_ENABLED exige fila e lock distribuído habilitados",
    );
  }

  return {
    distributedLockEnabled,
    queueEnabled,
    pushEnabled,
    webhookBaseUrl,
    valid: errors.length === 0,
    errors,
  };
}

export function exigirAgendaAlphaRuntimeConfig(
  env: AgendaAlphaEnvironment = process.env,
): AgendaAlphaRuntimeConfig {
  const config = lerAgendaAlphaRuntimeConfig(env);
  if (!config.valid) throw new AgendaAlphaConfigError(config.errors);
  return config;
}
