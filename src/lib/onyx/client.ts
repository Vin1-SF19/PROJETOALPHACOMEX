import { applyGlobalRule } from "@/lib/onyx/rule";

/**
 * Client server-side do Onyx (http://<servidor>:3000).
 * IMPORTANTE: só pode ser importado em código de servidor (rotas/actions).
 * Lê ONYX_API_KEY de process.env — nunca importar em componentes client.
 *
 * Modelo de identidade: CONTA DE SERVIÇO ÚNICA — todas as chamadas usam o PAT
 * em ONYX_API_KEY. O token NUNCA é exposto ao cliente; toda comunicação passa
 * pelas rotas /api/onyx/* que validam a sessão do PainelAlpha antes.
 *
 * Glossário (Onyx → PainelAlpha):
 *   Persona/Assistant  → Agente
 *   Tool               → Skill
 *   Chat session + msg → Chamar o agente
 */

const RAW_URL = process.env.ONYX_API_URL ?? "";
const API_KEY = process.env.ONYX_API_KEY ?? "";

/** Base normalizada, sem barra final. Ex: http://192.168.35.113:3000 */
export const ONYX_BASE = RAW_URL.replace(/\/+$/, "");

export function isOnyxConfigured(): boolean {
  return Boolean(ONYX_BASE && API_KEY);
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export class OnyxError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OnyxError";
    this.status = status;
  }
}

/** Fetch interno com timeout e tratamento de erro padronizado. */
async function onyxFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  if (!isOnyxConfigured()) {
    throw new OnyxError("Onyx não configurado (ONYX_API_URL / ONYX_API_KEY ausentes).", 503);
  }
  const { timeoutMs = 30_000, headers, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${ONYX_BASE}/api${path}`, {
      ...rest,
      signal: rest.signal ?? ctrl.signal,
      headers: authHeaders(headers as Record<string, string> | undefined),
    });
    return res;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new OnyxError("Tempo limite ao falar com o Onyx.", 504);
    }
    throw new OnyxError(`Falha de conexão com o Onyx: ${(err as Error).message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

async function onyxJson<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const res = await onyxFetch(path, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OnyxError(body || `Onyx respondeu ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Tipos ──────────────────────────────────────────────────────────────────────

export interface OnyxToolRef {
  id: number;
  name: string;
  display_name?: string | null;
  description?: string | null;
}

export interface OnyxAgent {
  id: number;
  name: string;
  description: string;
  system_prompt?: string;
  task_prompt?: string;
  is_public?: boolean;
  is_visible?: boolean;
  is_default_persona?: boolean;
  icon_shape?: number | null;
  icon_color?: string | null;
  uploaded_image_id?: string | null;
  tools?: OnyxToolRef[];
  starter_messages?: Array<{ name?: string; message: string }> | null;
  num_chunks?: number | null;
  llm_model_provider_override?: string | null;
  llm_model_version_override?: string | null;
}

export interface OnyxTool {
  id: number;
  name: string;
  display_name?: string | null;
  description?: string | null;
  /** definition = OpenAPI schema (apenas em custom tools) */
  definition?: Record<string, unknown> | null;
  in_code_tool_id?: string | null;
  custom_headers?: Array<{ key: string; value: string }> | null;
  passthrough_auth?: boolean;
}

export interface CreateAgentInput {
  name: string;
  description: string;
  system_prompt: string;
  task_prompt?: string;
  tool_ids?: number[];
  is_public?: boolean;
  starter_messages?: Array<{ name?: string; message: string }>;
  icon_name?: string | null;
  /** id retornado por uploadAgentImage; null/undefined = sem imagem custom */
  uploaded_image_id?: string | null;
  /** true para remover a imagem atual do agente */
  remove_image?: boolean;
}

export interface CreateToolInput {
  /** Schema OpenAPI da skill custom. */
  definition: Record<string, unknown>;
  custom_headers?: Array<{ key: string; value: string }>;
  passthrough_auth?: boolean;
}

// ─── Agentes (Personas) ──────────────────────────────────────────────────────────

export function listAgents(): Promise<OnyxAgent[]> {
  return onyxJson<OnyxAgent[]>("/persona");
}

export function getAgent(id: number): Promise<OnyxAgent> {
  return onyxJson<OnyxAgent>(`/persona/${id}`);
}

/** Monta o PersonaUpsertRequest com defaults seguros para os campos obrigatórios. */
function buildUpsertBody(input: CreateAgentInput): Record<string, unknown> {
  return {
    name: input.name,
    description: input.description,
    // Regra global anexada a todos os agentes (sem duplicar)
    system_prompt: applyGlobalRule(input.system_prompt),
    task_prompt: input.task_prompt ?? "",
    tool_ids: input.tool_ids ?? [],
    document_set_ids: [],
    is_public: input.is_public ?? true,
    datetime_aware: true,
    replace_base_system_prompt: false,
    is_featured: false,
    users: [],
    groups: [],
    hierarchy_node_ids: [],
    document_ids: [],
    starter_messages: input.starter_messages ?? null,
    icon_name: input.icon_name ?? null,
    uploaded_image_id: input.uploaded_image_id ?? null,
    remove_image: input.remove_image ?? null,
  };
}

export function createAgent(input: CreateAgentInput): Promise<OnyxAgent> {
  return onyxJson<OnyxAgent>("/persona", {
    method: "POST",
    body: JSON.stringify(buildUpsertBody(input)),
  });
}

export function updateAgent(id: number, input: CreateAgentInput): Promise<OnyxAgent> {
  return onyxJson<OnyxAgent>(`/persona/${id}`, {
    method: "PATCH",
    body: JSON.stringify(buildUpsertBody(input)),
  });
}

export async function deleteAgent(id: number): Promise<void> {
  await onyxJson<void>(`/persona/${id}`, { method: "DELETE" });
}

/**
 * Faz upload de uma imagem de agente (multipart) e retorna o file_id que deve
 * ser passado como uploaded_image_id no create/update do agente.
 */
export async function uploadAgentImage(file: Blob, filename: string): Promise<string> {
  if (!isOnyxConfigured()) {
    throw new OnyxError("Onyx não configurado.", 503);
  }
  const form = new FormData();
  form.append("file", file, filename);

  // multipart: NÃO setar Content-Type (o fetch define o boundary sozinho)
  const res = await fetch(`${ONYX_BASE}/api/admin/persona/upload-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OnyxError(body || `Onyx respondeu ${res.status}`, res.status);
  }
  const data = (await res.json()) as Record<string, string>;
  const id = data.file_id ?? Object.values(data)[0];
  if (!id) throw new OnyxError("Onyx não retornou o id da imagem.", 502);
  return id;
}

/** Retorna a Response BRUTA da imagem do agente (para a rota proxy de avatar). */
export function getAgentAvatar(id: number, signal?: AbortSignal): Promise<Response> {
  return onyxFetch(`/persona/${id}/avatar`, { method: "GET", signal, timeoutMs: 15_000 });
}

/** Retorna a Response BRUTA de um arquivo de chat (ex: imagem gerada por agente). */
export function getChatFile(fileId: string, signal?: AbortSignal): Promise<Response> {
  return onyxFetch(`/chat/file/${encodeURIComponent(fileId)}`, { method: "GET", signal, timeoutMs: 20_000 });
}

// ─── Modelos de geração de imagem ────────────────────────────────────────────

export interface OnyxImageModel {
  image_provider_id: string;
  model_name: string;
  is_default: boolean;
}

export function listImageModels(): Promise<OnyxImageModel[]> {
  return onyxJson<OnyxImageModel[]>("/admin/image-generation/config");
}

export async function setDefaultImageModel(imageProviderId: string): Promise<void> {
  await onyxFetch(`/admin/image-generation/config/${encodeURIComponent(imageProviderId)}/default`, {
    method: "POST",
  }).then(res => {
    if (!res.ok) throw new OnyxError("Falha ao definir o modelo de imagem.", res.status);
  });
}

/** id da tool de geração de imagem no Onyx (resolve por nome). */
export async function getImageGenToolId(): Promise<number | null> {
  try {
    const tools = await listTools();
    const t = tools.find(x => x.name === "generate_image");
    return t ? t.id : null;
  } catch {
    return null;
  }
}

// ─── Skills (Tools) ──────────────────────────────────────────────────────────────

export function listTools(): Promise<OnyxTool[]> {
  return onyxJson<OnyxTool[]>("/tool");
}

export function createCustomTool(input: CreateToolInput): Promise<OnyxTool> {
  // O Onyx deriva nome/descrição do próprio schema OpenAPI (definition).
  return onyxJson<OnyxTool>("/admin/tool/custom", {
    method: "POST",
    body: JSON.stringify({
      definition: input.definition,
      custom_headers: input.custom_headers ?? null,
      passthrough_auth: input.passthrough_auth ?? false,
    }),
  });
}

export async function deleteCustomTool(id: number): Promise<void> {
  await onyxJson<void>(`/admin/tool/custom/${id}`, { method: "DELETE" });
}

// ─── Chat (chamar o agente) ──────────────────────────────────────────────────────

export interface CreateSessionResult {
  chat_session_id: string;
}

export function createChatSession(personaId: number, description?: string): Promise<CreateSessionResult> {
  return onyxJson<CreateSessionResult>("/chat/create-chat-session", {
    method: "POST",
    body: JSON.stringify({ persona_id: personaId, description: description ?? null }),
  });
}

/**
 * Envia mensagem e retorna a Response BRUTA (stream NDJSON do Onyx) para a rota
 * de chat reempacotar no formato SSE consumido pela UI do chat.
 */
export function sendChatMessageStream(
  params: {
    chatSessionId: string;
    message: string;
    parentMessageId?: number | null;
    additionalContext?: string | null;
    signal?: AbortSignal;
  },
): Promise<Response> {
  return onyxFetch("/chat/send-chat-message", {
    method: "POST",
    timeoutMs: 120_000,
    signal: params.signal,
    body: JSON.stringify({
      chat_session_id: params.chatSessionId,
      message: params.message,
      parent_message_id: params.parentMessageId ?? null,
      ...(params.additionalContext ? { additional_context: params.additionalContext } : {}),
      stream: true,
    }),
  });
}

/**
 * Consulta one-shot à base de conhecimento do Onyx: cria uma sessão temporária
 * com o agente indicado (default = 0), faz a pergunta, coleta a resposta completa
 * do stream NDJSON e devolve o texto. Usado pelo Bibble para acessar o que está
 * documentado/indexado no Onyx (RAG nativo do Onyx).
 *
 * @returns texto da resposta, ou string vazia se nada foi retornado.
 */
export async function askOnyxOneShot(
  pergunta: string,
  personaId = 0,
  timeoutMs = 60_000,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const { chat_session_id } = await createChatSession(personaId, "Bibble — consulta de conhecimento");

    const res = await onyxFetch("/chat/send-chat-message", {
      method: "POST",
      timeoutMs,
      signal: ctrl.signal,
      body: JSON.stringify({
        chat_session_id,
        message: pergunta,
        parent_message_id: null,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      throw new OnyxError(`Onyx respondeu ${res.status}`, res.status);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let answer = "";

    const handle = (line: string) => {
      const t = line.trim();
      if (!t) return;
      try {
        const pkt = JSON.parse(t) as { obj?: { type: string; content?: string } };
        if (pkt.obj?.type === "message_delta" && pkt.obj.content) {
          answer += pkt.obj.content;
        }
      } catch { /* linha parcial */ }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) handle(l);
    }
    if (buf.trim()) handle(buf);

    return answer.trim();
  } finally {
    clearTimeout(timer);
  }
}
