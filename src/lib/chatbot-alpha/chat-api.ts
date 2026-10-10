// ChatBot Alpha — Cliente de API para o backend ChatbotX (self-hosted externo, workspace-token API)
// Proxy server-side: nunca expõe tokens ou URLs internas ao navegador.
//
// Contrato confirmado em código real do ChatbotX para contacts e Inbox públicos.
// O identificador de contato usa o formato "id:<id>" | "email:<email>" | "phone:<numero>"
// (resolveContactId em apps/builder/src/features/contacts/queries/public-find-contact.ts).

import { z } from "zod";

// ─── Configuração ─────────────────────────────────────────────────────────────

export const chatbotxApiUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "CHATBOTX_URL deve usar HTTP ou HTTPS");

function getChatbotxConfig(): { baseUrl?: string; apiKey?: string } {
  const parsedAppUrl = chatbotxApiUrlSchema.safeParse(process.env.CHATBOTX_URL);
  const parsedLegacyApiUrl = chatbotxApiUrlSchema.safeParse(process.env.CHATBOTX_API_URL);
  const appBaseUrl = parsedAppUrl.success ? parsedAppUrl.data.replace(/\/+$/, "") : undefined;
  return {
    baseUrl: appBaseUrl
      ? /\/api$/i.test(appBaseUrl) ? appBaseUrl : `${appBaseUrl}/api`
      : parsedLegacyApiUrl.success ? parsedLegacyApiUrl.data : undefined,
    apiKey: process.env.CHATBOTX_API_KEY?.trim() || process.env.CHATBOTX_API_TOKEN?.trim() || undefined,
  };
}

export function isChatbotxConfigured(): boolean {
  const { baseUrl, apiKey } = getChatbotxConfig();
  return Boolean(baseUrl && apiKey);
}

// ─── Identificador de contato ──────────────────────────────────────────────────

export const contatoIdentifierSchema = z.string().min(1).regex(
  /^(id|email|phone):.+$/,
  "Identificador de contato deve ter o formato id:<id>, email:<email> ou phone:<numero>",
);

export type ContatoIdentifier = z.infer<typeof contatoIdentifierSchema>;

export function identificadorPorId(contactId: string): ContatoIdentifier {
  return `id:${contactId}`;
}

// ─── Schemas Zod (subconjunto real, tolerante a campos extras) ────────────────

const conversaBaseResourceSchema = z
  .object({
    id: z.string(),
    contactId: z.string(),
    workspaceId: z.string(),
  })
  .passthrough();

const contatoResourceSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    avatar: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    fullName: z.string().nullable().optional(),
    blockedAt: z.string().nullable().optional(),
    conversation: conversaBaseResourceSchema.nullable().optional(),
  })
  .passthrough();

export type ChatbotxContato = z.infer<typeof contatoResourceSchema>;

const mensagemSenderTypeSchema = z.enum(["bot", "contact", "system", "user", "api"]);
const mensagemTypeSchema = z.enum(["incoming", "outgoing", "activity"]);
const mensagemContentTypeSchema = z.enum(["text", "location", "refLink"]);

const mensagemResourceSchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    conversationId: z.string(),
    contactInboxId: z.string(),
    workspaceId: z.string().optional(),
    text: z.string().nullable().optional(),
    messageType: mensagemTypeSchema,
    contentType: mensagemContentTypeSchema.optional(),
    senderType: mensagemSenderTypeSchema,
    senderId: z.string().nullable().optional(),
    contact: contatoResourceSchema.optional(),
    attachments: z.array(z.unknown()).optional(),
  })
  .passthrough();

export type ChatbotxMensagem = z.infer<typeof mensagemResourceSchema>;

const conversaResourceSchema = z
  .object({
    ...conversaBaseResourceSchema.shape,
    contact: contatoResourceSchema.nullable().optional(),
    messages: z.array(mensagemResourceSchema).optional(),
  })
  .passthrough();

export type ChatbotxConversa = z.infer<typeof conversaResourceSchema>;

const listarContatosResponseSchema = z.object({
  data: z.array(contatoResourceSchema),
  pageCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  totalCountCapped: z.boolean(),
});

const listarMensagensResponseSchema = z.object({
  data: z.array(mensagemResourceSchema),
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable(),
});

const conversaInboxSchema = z.object({ inboxId: z.string() }).passthrough();
const conversaPublicaSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  contact: z.object({
    id: z.string(),
    workspaceId: z.string().optional(),
    avatar: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    fullName: z.string().nullable().optional(),
    blockedAt: z.string().nullable().optional(),
  }).passthrough().nullable().optional(),
  contactInboxes: z.array(conversaInboxSchema).optional().default([]),
  assignedUser: z.object({ id: z.string(), name: z.string().optional() }).nullable().optional(),
  assignedInboxTeam: z.unknown().optional(),
  messages: z.array(mensagemResourceSchema).optional().default([]),
}).passthrough();
const listarConversasPublicasResponseSchema = z.object({
  data: z.array(conversaPublicaSchema),
  nextCursor: z.string().nullable(),
  prevCursor: z.string().nullable(),
});

export type ChatbotxConversaPublica = z.infer<typeof conversaPublicaSchema>;
export type ChatbotxPaginaConversasPublicas = z.infer<typeof listarConversasPublicasResponseSchema>;

export type ChatbotxPagina<T> = {
  data: T[];
  nextCursor: string | null;
  prevCursor: string | null;
};

export type ChatbotxPaginaConversas = {
  data: ChatbotxConversa[];
  pageCount: number;
  totalCount: number;
  totalCountCapped: boolean;
};

export const chatbotxListarConversasInputSchema = z.object({
  keyword: z.string().trim().min(1).optional(),
  page: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(100).optional(),
});

export type ChatbotxListarConversasInput = z.infer<typeof chatbotxListarConversasInputSchema>;

export const chatbotxListarMensagensInputSchema = z.object({
  contatoIdentifier: contatoIdentifierSchema,
  cursor: z.string().optional(),
  perPage: z.number().int().min(1).max(100).optional(),
});

export type ChatbotxListarMensagensInput = z.infer<typeof chatbotxListarMensagensInputSchema>;

export const chatbotxEnviarMensagemInputSchema = z.object({
  contatoIdentifier: contatoIdentifierSchema,
  text: z.string().trim().min(1).max(1000),
});

export type ChatbotxEnviarMensagemInput = z.infer<typeof chatbotxEnviarMensagemInputSchema>;

// ─── Resultado padronizado ────────────────────────────────────────────────────

export type ChatbotxApiResult<T> =
  | { success: true; data: T; correlationId: string }
  | { success: false; error: string; correlationId: string; supportId: string; retryable: boolean };

// ─── Cliente HTTP ─────────────────────────────────────────────────────────────

async function chatbotxFetch(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {},
  correlationId: string,
): Promise<ChatbotxApiResult<unknown>> {
  const { baseUrl, apiKey } = getChatbotxConfig();
  if (!baseUrl || !apiKey) {
    return {
      success: false,
      error: "Backend ChatbotX não configurado. Defina CHATBOTX_URL e CHATBOTX_API_KEY no ambiente.",
      correlationId,
      supportId: correlationId,
      retryable: false,
    };
  }

  const url = new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Correlation-Id": correlationId,
  };

  headers["Authorization"] = `Bearer ${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      success: false,
      error: isTimeout
        ? "Tempo esgotado ao comunicar com o backend ChatbotX."
        : "Não foi possível conectar ao backend ChatbotX.",
      correlationId,
      supportId: correlationId,
      retryable: true,
    };
  }

  if (!response.ok) {
    const serverError =
      response.status === 401 || response.status === 403
        ? "O backend ChatbotX recusou a credencial configurada."
        : response.status === 404
          ? "Recurso não encontrado no backend ChatbotX."
          : response.status === 429
            ? "Limite de requisições do backend ChatbotX excedido."
            : response.status >= 500
              ? "Backend ChatbotX temporariamente indisponível."
              : `Falha na solicitação ao backend ChatbotX (HTTP ${response.status}).`;

    return {
      success: false,
      error: serverError,
      correlationId,
      supportId: correlationId,
      retryable: response.status >= 500 || response.status === 429,
    };
  }

  // Sucesso sem corpo (ex.: 204 no envio de mensagem)
  if (response.status === 204) {
    return { success: true, data: undefined, correlationId };
  }

  let rawData: unknown;
  try {
    rawData = await response.json();
  } catch {
    return {
      success: false,
      error: "Resposta inválida do backend ChatbotX (corpo não-JSON).",
      correlationId,
      supportId: correlationId,
      retryable: false,
    };
  }

  return { success: true, data: rawData, correlationId };
}

function toApiResult<T>(
  result: ChatbotxApiResult<unknown>,
  schema: z.ZodType<T>,
  correlationId: string,
): ChatbotxApiResult<T> {
  if (!result.success) return result;

  const parsed = schema.safeParse(result.data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Resposta malformada do backend ChatbotX.",
      correlationId,
      supportId: correlationId,
      retryable: false,
    };
  }

  return { success: true, data: parsed.data, correlationId };
}

// ─── Operações ────────────────────────────────────────────────────────────────

export async function listarConversas(
  input: ChatbotxListarConversasInput,
  correlationId: string,
): Promise<ChatbotxApiResult<ChatbotxPaginaConversas>> {
  const parsedInput = chatbotxListarConversasInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: "Parâmetros inválidos para listar conversas.", correlationId, supportId: correlationId, retryable: false };
  }
  const result = await chatbotxFetch(
    "/v1/contacts",
    {
      query: {
        keyword: parsedInput.data.keyword,
        page: parsedInput.data.page ? String(parsedInput.data.page) : undefined,
        perPage: parsedInput.data.perPage ? String(parsedInput.data.perPage) : undefined,
      },
    },
    correlationId,
  );
  const parsed = toApiResult(result, listarContatosResponseSchema, correlationId);
  if (!parsed.success) return parsed;
  return {
    success: true,
    data: {
      ...parsed.data,
      data: parsed.data.data.flatMap((contact) =>
        contact.conversation
          ? [conversaResourceSchema.parse({ ...contact.conversation, contact, messages: [] })]
          : [],
      ),
    },
    correlationId,
  };
}

export async function listarMensagens(
  input: ChatbotxListarMensagensInput,
  correlationId: string,
): Promise<ChatbotxApiResult<ChatbotxPagina<ChatbotxMensagem>>> {
  const parsedInput = chatbotxListarMensagensInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: "Parâmetros inválidos para listar mensagens.", correlationId, supportId: correlationId, retryable: false };
  }
  const result = await chatbotxFetch(
    `/v1/contacts/${encodeURIComponent(parsedInput.data.contatoIdentifier)}/messages`,
    { query: { cursor: parsedInput.data.cursor, perPage: parsedInput.data.perPage ? String(parsedInput.data.perPage) : undefined } },
    correlationId,
  );
  return toApiResult(result, listarMensagensResponseSchema, correlationId);
}

export async function enviarMensagem(
  input: ChatbotxEnviarMensagemInput,
  correlationId: string,
): Promise<ChatbotxApiResult<void>> {
  const parsedInput = chatbotxEnviarMensagemInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: "Parâmetros inválidos para enviar mensagem.", correlationId, supportId: correlationId, retryable: false };
  }
  const result = await chatbotxFetch(
    `/v1/contacts/${encodeURIComponent(parsedInput.data.contatoIdentifier)}/messages`,
    { method: "POST", body: { text: parsedInput.data.text } },
    correlationId,
  );
  if (!result.success) return result;
  return { success: true, data: undefined, correlationId };
}

// Client for the public Inbox API used by CRM card chat. IDs remain strings.
const campoFiltroSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  valueType: z.string(),
}).passthrough();

export type ChatbotxCampoFiltro = z.infer<typeof campoFiltroSchema>;

export async function listarCamposFiltroContato(
  correlationId: string,
): Promise<ChatbotxApiResult<ChatbotxCampoFiltro[]>> {
  const result = await chatbotxFetch("/v1/contacts/filter-fields", {}, correlationId);
  const parsed = toApiResult(result, z.object({ customFields: z.array(campoFiltroSchema) }), correlationId);
  return parsed.success ? { success: true, data: parsed.data.customFields, correlationId } : parsed;
}

export async function obterCampoPersonalizadoContato(
  contactId: string,
  fieldId: string,
  correlationId: string,
): Promise<ChatbotxApiResult<string>> {
  if (!/^\d+$/.test(contactId) || !/^\d+$/.test(fieldId)) {
    return { success: false, error: "ID de contato ou campo inválido.", correlationId, supportId: correlationId, retryable: false };
  }
  const identifier = encodeURIComponent(identificadorPorId(contactId));
  const result = await chatbotxFetch(`/v1/contacts/${identifier}/custom-fields/${encodeURIComponent(fieldId)}`, {}, correlationId);
  const parsed = toApiResult(result, z.object({ value: z.string() }), correlationId);
  return parsed.success ? { success: true, data: parsed.data.value, correlationId } : parsed;
}

export type ChatbotxFiltroContato = {
  operator: "and";
  conditions: [{
    field: "customField";
    customFieldId: string;
    customFieldType: string;
    valueType: string;
    operator: "eq";
    value: string;
  }];
};

export async function listarConversasInbox(
  input: { keyword?: string; contactFilter?: ChatbotxFiltroContato; cursor?: string; perPage?: number },
  correlationId: string,
): Promise<ChatbotxApiResult<ChatbotxPaginaConversasPublicas>> {
  const filterSchema = z.object({
    operator: z.literal("and"),
    conditions: z.tuple([z.object({
      field: z.literal("customField"),
      customFieldId: z.string().min(1),
      customFieldType: z.string().min(1),
      valueType: z.string().min(1),
      operator: z.literal("eq"),
      value: z.string().min(1),
    })]),
  });
  const parsedInput = z.object({ keyword: z.string().trim().min(1).optional(), contactFilter: filterSchema.optional(), cursor: z.string().optional(), perPage: z.number().int().min(1).max(50).optional() }).safeParse(input);
  if (!parsedInput.success) return { success: false, error: "Parâmetros inválidos para listar conversas.", correlationId, supportId: correlationId, retryable: false };
  const result = await chatbotxFetch("/v1/conversations", {
    query: { keyword: parsedInput.data.keyword, contactFilter: parsedInput.data.contactFilter ? JSON.stringify(parsedInput.data.contactFilter) : undefined, cursor: parsedInput.data.cursor, perPage: String(parsedInput.data.perPage ?? 20) },
  }, correlationId);
  return toApiResult(result, listarConversasPublicasResponseSchema, correlationId);
}

export async function listarMensagensConversa(
  conversationId: string,
  input: { cursor?: string; perPage?: number },
  correlationId: string,
): Promise<ChatbotxApiResult<ChatbotxPagina<ChatbotxMensagem>>> {
  const parsed = z.object({ conversationId: z.string().regex(/^\d+$/), cursor: z.string().optional(), perPage: z.number().int().min(1).max(50).optional() }).safeParse({ conversationId, ...input });
  if (!parsed.success) return { success: false, error: "Parâmetros inválidos para listar mensagens.", correlationId, supportId: correlationId, retryable: false };
  const result = await chatbotxFetch(`/v1/conversations/${encodeURIComponent(parsed.data.conversationId)}/messages`, {
    query: { cursor: parsed.data.cursor, perPage: String(parsed.data.perPage ?? 20) },
  }, correlationId);
  return toApiResult(result, listarMensagensResponseSchema, correlationId);
}

export async function obterConversaInbox(
  conversationId: string,
  correlationId: string,
): Promise<ChatbotxApiResult<ChatbotxConversaPublica>> {
  if (!/^\d+$/.test(conversationId)) return { success: false, error: "ID de conversa inválido.", correlationId, supportId: correlationId, retryable: false };
  const result = await chatbotxFetch(`/v1/conversations/${encodeURIComponent(conversationId)}`, {}, correlationId);
  const parsed = toApiResult(result, z.object({ data: conversaPublicaSchema }), correlationId);
  return parsed.success ? { success: true, data: parsed.data.data, correlationId } : parsed;
}

export async function enviarMensagemConversa(
  input: { conversationId: string; text: string; inboxId?: string },
  correlationId: string,
): Promise<ChatbotxApiResult<void>> {
  const parsed = z.object({ conversationId: z.string().regex(/^\d+$/), text: z.string().trim().min(1).max(1000), inboxId: z.string().regex(/^\d+$/).optional() }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Parâmetros inválidos para enviar mensagem.", correlationId, supportId: correlationId, retryable: false };
  const result = await chatbotxFetch(`/v1/conversations/${encodeURIComponent(parsed.data.conversationId)}/messages`, {
    method: "POST", body: { text: parsed.data.text, ...(parsed.data.inboxId ? { inboxId: parsed.data.inboxId } : {}) },
  }, correlationId);
  if (!result.success) return result;
  return { success: true, data: undefined, correlationId };
}
