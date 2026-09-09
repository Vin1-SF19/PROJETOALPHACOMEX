// ChatBot Alpha — Cliente de API para o backend ChatbotX (self-hosted externo, workspace-token API)
// Proxy server-side: nunca expõe tokens ou URLs internas ao navegador.
//
// Contrato confirmado em código real (apps/builder/src/features/.../api/workspace-token.ts
// do ChatbotX-main): GET /v1/contacts, GET/POST /v1/contacts/{identifier}/messages.
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
  }, "CHATBOTX_API_URL deve usar HTTP ou HTTPS");

function getChatbotxConfig(): { baseUrl?: string; apiKey?: string } {
  const parsedUrl = chatbotxApiUrlSchema.safeParse(process.env.CHATBOTX_API_URL);
  return {
    baseUrl: parsedUrl.success ? parsedUrl.data : undefined,
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
    workspaceId: z.string(),
    text: z.string().nullable(),
    messageType: mensagemTypeSchema,
    contentType: mensagemContentTypeSchema,
    senderType: mensagemSenderTypeSchema,
    senderId: z.string().nullable().optional(),
    contact: contatoResourceSchema.optional(),
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
      error: "Backend ChatbotX não configurado. Defina CHATBOTX_API_URL e CHATBOTX_API_KEY no ambiente.",
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
