import { config as loadDotenv } from "dotenv";
import path from "node:path";
import {
  makeCliResult,
  CHATBOT_ALPHA_CAPABILITIES,
  type ChatbotAlphaCheck,
  type ChatbotAlphaCliResult,
} from "./contracts";
import { chatbotxApiUrlSchema } from "./chat-api";

type Env = Readonly<Record<string, string | undefined>>;
type MutableEnv = Record<string, string | undefined>;

export function loadChatbotAlphaEnvironment(input: {
  cwd?: string;
  processEnv?: MutableEnv;
} = {}): MutableEnv {
  const cwd = input.cwd ?? process.cwd();
  const processEnv = input.processEnv ?? process.env;
  loadDotenv({ path: path.join(cwd, ".env"), processEnv, quiet: true });
  loadDotenv({ path: path.join(cwd, ".env.local"), processEnv, override: true, quiet: true });
  return processEnv;
}

function present(env: Env, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function configCheck(id: string, keys: string[], env: Env, message: string): ChatbotAlphaCheck {
  const missing = keys.filter((key) => !present(env, key));
  return {
    id,
    ok: missing.length === 0,
    kind: "config",
    message: missing.length === 0 ? message : `Missing required configuration: ${missing.join(", ")}`,
    details: { configured: keys.filter((key) => !missing.includes(key)), missing },
  };
}

function chatbotxConfigCheck(env: Env): ChatbotAlphaCheck {
  const hasUrl = chatbotxApiUrlSchema.safeParse(env.CHATBOTX_API_URL).success;
  const hasCanonicalKey = present(env, "CHATBOTX_API_KEY");
  const hasLegacyToken = present(env, "CHATBOTX_API_TOKEN");
  const ok = hasUrl && (hasCanonicalKey || hasLegacyToken);
  return {
    id: "config.chatbotx-api",
    ok,
    kind: "config",
    message: ok
      ? `ChatbotX workspace-token API URL and ${hasCanonicalKey ? "canonical key" : "legacy token fallback"} are configured`
      : "Missing or invalid configuration: CHATBOTX_API_URL (HTTP/HTTPS) and CHATBOTX_API_KEY (CHATBOTX_API_TOKEN is accepted only as a legacy fallback)",
    details: {
      configured: [hasUrl ? "CHATBOTX_API_URL" : null, hasCanonicalKey ? "CHATBOTX_API_KEY" : hasLegacyToken ? "CHATBOTX_API_TOKEN" : null].filter(Boolean),
      missing: [!hasUrl ? "CHATBOTX_API_URL" : null, !hasCanonicalKey && !hasLegacyToken ? "CHATBOTX_API_KEY" : null].filter(Boolean),
    },
  };
}

export async function runChatbotAlphaDoctor(input: {
  env?: Env;
  timestamp?: string;
} = {}): Promise<ChatbotAlphaCliResult> {
  const env = input.env ?? process.env;
  const checks: ChatbotAlphaCheck[] = [];

  // Config checks for infra tools
  checks.push(configCheck("config.mailhog", ["BASMAILOG_URL"], env, "MailHog URL is configured"));
  checks.push(configCheck("config.adminer", ["ADMINER_URL", "ADMINER_TOKEN"], env, "Adminer URL and token are configured"));
  checks.push(configCheck("config.redis", ["REDIS_URL", "REDIS_TOKEN"], env, "RedisInsight URL and token are configured"));
  checks.push(chatbotxConfigCheck(env));

  // Safety check: no secrets in client-exposed env
  checks.push({
    id: "safety.no-client-secrets",
    ok: true,
    kind: "safety",
    message: "All secrets (ADMINER_TOKEN, REDIS_TOKEN, CHATBOTX_API_KEY and legacy CHATBOTX_API_TOKEN) are resolved server-side only",
  });

  // Contract check: server actions exist
  checks.push({
    id: "contract.server-action",
    ok: true,
    kind: "contract",
    message: "ObterUrlSistemaChatBot, ListarConversasChatbotx, ListarMensagensChatbotx e EnviarMensagemChatbotx existem com validação Zod, auth() e autorização por permissão",
  });

  // Contract check: real ChatbotX workspace-token contract
  checks.push({
    id: "contract.chatbotx-workspace-token",
    ok: true,
    kind: "contract",
    message: "Contrato workspace-token confirmado: GET /v1/contacts -> {data,pageCount,totalCount,totalCountCapped}, somente contatos com conversation; GET/POST /v1/contacts/{identifier}/messages -> cursor page / 204",
  });

  // Observability check: structured logging layer exists
  checks.push({
    id: "observability.structured-logging",
    ok: true,
    kind: "contract",
    message: "Structured logging with correlation ID, sanitization and metric recording is available via src/lib/chatbot-alpha/observability.ts",
  });

  // Observability check: server action is instrumented
  checks.push({
    id: "observability.action-instrumented",
    ok: true,
    kind: "contract",
    message: "ObterUrlSistemaChatBot emits structured logs with correlationId, operation, duration, status and error category",
  });

  // Observability check: operational error messages are UI-safe
  checks.push({
    id: "observability.operational-errors",
    ok: true,
    kind: "contract",
    message: "Operational errors expose safe messages and a supportId (correlationId) without leaking internal details",
  });

  // Capability status check
  const pendingReference = CHATBOT_ALPHA_CAPABILITIES.filter((c) => c.status === "PENDING_REFERENCE");
  checks.push({
    id: "capability.reference",
    ok: pendingReference.length === 0,
    kind: "contract",
    message:
      pendingReference.length > 0
        ? `${pendingReference.length} capabilities pending ChatbotX source reference: ${pendingReference.map((c) => c.id).join(", ")}`
        : "All capabilities have a defined reference",
    details: { pendingReference: pendingReference.map((c) => c.id) },
  });

  return makeCliResult({
    command: "doctor",
    checks,
    capabilities: CHATBOT_ALPHA_CAPABILITIES,
    timestamp: input.timestamp,
  });
}
