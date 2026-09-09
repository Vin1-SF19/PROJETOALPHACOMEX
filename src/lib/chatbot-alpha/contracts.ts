import { z } from "zod";

// ─── Error codes ───────────────────────────────────────────────────────────────

export const chatbotAlphaErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "SERVICE_NOT_CONFIGURED",
  "SERVICE_UNAVAILABLE",
  "TIMEOUT",
  "CONTRACT_INVALID",
]);

export type ChatbotAlphaErrorCode = z.infer<typeof chatbotAlphaErrorCodeSchema>;

export const chatbotAlphaErrorSchema = z.object({
  code: chatbotAlphaErrorCodeSchema,
  message: z.string().min(1),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ChatbotAlphaError = z.infer<typeof chatbotAlphaErrorSchema>;

// ─── Check schema (doctor) ─────────────────────────────────────────────────────

export const chatbotAlphaCheckSchema = z.object({
  id: z.string().min(1),
  ok: z.boolean(),
  kind: z.enum(["config", "dependency", "contract", "safety"]),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ChatbotAlphaCheck = z.infer<typeof chatbotAlphaCheckSchema>;

// ─── Capability registry ───────────────────────────────────────────────────────

export const chatbotAlphaCapabilityStatusSchema = z.enum([
  "AVAILABLE",
  "NOT_CONFIGURED",
  "UNAVAILABLE",
  "PENDING_REFERENCE",
]);

export type ChatbotAlphaCapabilityStatus = z.infer<typeof chatbotAlphaCapabilityStatusSchema>;

export const chatbotAlphaCapabilitySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  status: chatbotAlphaCapabilityStatusSchema,
  serverAction: z.string().min(1).optional(),
  cliCommand: z.string().min(1).optional(),
  requiresAdmin: z.boolean().default(false),
  requiresPermission: z.string().optional(),
});

export type ChatbotAlphaCapability = z.infer<typeof chatbotAlphaCapabilitySchema>;

// ─── CLI result ────────────────────────────────────────────────────────────────

export const chatbotAlphaExitCodeSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
]);

export type ChatbotAlphaExitCode = z.infer<typeof chatbotAlphaExitCodeSchema>;

export const chatbotAlphaCliResultSchema = z.object({
  ok: z.boolean(),
  command: z.enum(["doctor", "capabilities", "list"]),
  code: chatbotAlphaExitCodeSchema,
  checks: z.array(chatbotAlphaCheckSchema),
  capabilities: z.array(chatbotAlphaCapabilitySchema).optional(),
  timestamp: z.string().datetime(),
});

export type ChatbotAlphaCliResult = z.infer<typeof chatbotAlphaCliResultSchema>;

// ─── Factory ───────────────────────────────────────────────────────────────────

export function makeCliResult(input: {
  command: ChatbotAlphaCliResult["command"];
  checks: ChatbotAlphaCheck[];
  capabilities?: ChatbotAlphaCapability[];
  timestamp?: string;
}): ChatbotAlphaCliResult {
  const ok = input.checks.every((c) => c.ok);
  const code: ChatbotAlphaExitCode = ok ? 0 : input.checks.some((c) => c.kind === "config") ? 1 : 2;
  return {
    ok,
    command: input.command,
    code,
    checks: input.checks,
    capabilities: input.capabilities,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

// ─── Capability registry (static) ──────────────────────────────────────────────

export const CHATBOT_ALPHA_CAPABILITIES: ChatbotAlphaCapability[] = [
  {
    id: "infra.adminer",
    label: "Adminer (Postgres)",
    description: "Acesso ao banco de dados do ChatbotX via Adminer",
    status: "NOT_CONFIGURED",
    serverAction: "ObterUrlSistemaChatBot",
    cliCommand: "chatbot-alpha:doctor",
    requiresAdmin: true,
  },
  {
    id: "infra.redis",
    label: "RedisInsight",
    description: "Acesso ao Redis do ChatbotX via RedisInsight",
    status: "NOT_CONFIGURED",
    serverAction: "ObterUrlSistemaChatBot",
    cliCommand: "chatbot-alpha:doctor",
    requiresAdmin: true,
  },
  {
    id: "infra.mailhog",
    label: "MailHog",
    description: "Acesso ao MailHog do ChatbotX",
    status: "NOT_CONFIGURED",
    serverAction: "ObterUrlSistemaChatBot",
    cliCommand: "chatbot-alpha:doctor",
    requiresAdmin: false,
    requiresPermission: "chatBotAlpha",
  },
  {
    id: "chat.conversations",
    label: "Conversas",
    description: "Listar contatos com conversa do ChatbotX (GET /v1/contacts)",
    status: "NOT_CONFIGURED",
    serverAction: "ListarConversasChatbotx",
    cliCommand: "chatbot-alpha:list-conversations",
    requiresAdmin: false,
    requiresPermission: "chatBotAlpha",
  },
  {
    id: "chat.messages",
    label: "Mensagens",
    description: "Listar e enviar mensagens por contato (GET/POST /v1/contacts/{identifier}/messages)",
    status: "NOT_CONFIGURED",
    serverAction: "ListarMensagensChatbotx, EnviarMensagemChatbotx",
    cliCommand: "chatbot-alpha:list-messages, chatbot-alpha:send-message",
    requiresAdmin: false,
    requiresPermission: "chatBotAlpha",
  },
  {
    id: "chat.uploads",
    label: "Uploads",
    description: "Anexar arquivo/mediaFile em mensagens — suportado pelo contrato real (createMessageRequest), não implementado nesta fase",
    status: "PENDING_REFERENCE",
    requiresAdmin: false,
    requiresPermission: "chatBotAlpha",
  },
];
