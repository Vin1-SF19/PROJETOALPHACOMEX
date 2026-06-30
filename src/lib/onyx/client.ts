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

/**
 * Monta os headers de autenticação.
 * @param userToken  PAT individual do usuário (token_onyx). Quando presente,
 *                   autentica como o próprio usuário no Onyx; quando ausente,
 *                   usa o PAT de serviço (ONYX_API_KEY).
 */
function authHeaders(extra?: Record<string, string>, userToken?: string | null): Record<string, string> {
  const token = userToken?.trim() || API_KEY;
  return {
    Authorization: `Bearer ${token}`,
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

/** Opções de fetch interno, incluindo token individual do usuário. */
type OnyxFetchInit = RequestInit & { timeoutMs?: number; userToken?: string | null };

/** Fetch interno com timeout e tratamento de erro padronizado. */
async function onyxFetch(
  path: string,
  init: OnyxFetchInit = {},
): Promise<Response> {
  if (!isOnyxConfigured()) {
    throw new OnyxError("Onyx não configurado (ONYX_API_URL / ONYX_API_KEY ausentes).", 503);
  }
  const { timeoutMs = 30_000, headers, userToken, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${ONYX_BASE}/api${path}`, {
      ...rest,
      signal: rest.signal ?? ctrl.signal,
      headers: authHeaders(headers as Record<string, string> | undefined, userToken),
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

async function onyxJson<T>(path: string, init: OnyxFetchInit = {}): Promise<T> {
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

export function createAgent(input: CreateAgentInput, userToken?: string | null): Promise<OnyxAgent> {
  return onyxJson<OnyxAgent>("/persona", {
    method: "POST",
    userToken,
    body: JSON.stringify(buildUpsertBody(input)),
  });
}

export function updateAgent(id: number, input: CreateAgentInput, userToken?: string | null): Promise<OnyxAgent> {
  return onyxJson<OnyxAgent>(`/persona/${id}`, {
    method: "PATCH",
    userToken,
    body: JSON.stringify(buildUpsertBody(input)),
  });
}

export async function deleteAgent(id: number, userToken?: string | null): Promise<void> {
  await onyxJson<void>(`/persona/${id}`, { method: "DELETE", userToken });
}

/**
 * Faz upload de uma imagem de agente (multipart) e retorna o file_id que deve
 * ser passado como uploaded_image_id no create/update do agente.
 */
export async function uploadAgentImage(file: Blob, filename: string, userToken?: string | null): Promise<string> {
  if (!isOnyxConfigured()) {
    throw new OnyxError("Onyx não configurado.", 503);
  }
  const form = new FormData();
  form.append("file", file, filename);

  // multipart: NÃO setar Content-Type (o fetch define o boundary sozinho)
  const res = await fetch(`${ONYX_BASE}/api/admin/persona/upload-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken?.trim() || API_KEY}` },
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

export interface OnyxFileDescriptor {
  /** user_files[].id — OBRIGATÓRIO para o Onyx tratar como user file (não project). */
  user_file_id: string;
  /** user_files[].file_id — id do blob no file store. */
  id: string;
  type: string; // "image" | "document" | "plain_text"
  name?: string;
}

/** Item retornado pelo upload novo do Onyx. */
interface OnyxUserFile {
  id: string;            // user_file_id
  file_id: string;       // id do blob
  name: string;
  chat_file_type: string; // "image" | "document" | ...
}

/**
 * Faz upload de arquivo(s) de chat pro Onyx (multipart) e retorna os descriptors
 * prontos para `file_descriptors` no send-chat-message — com user_file_id, que é
 * o que faz o Onyx acionar OCR/visão para o agente "enxergar" a imagem.
 *
 * Endpoint NOVO: /api/user/projects/file/upload. O antigo /api/chat/file (POST)
 * responde 307 e falha — por isso o agente não recebia as imagens.
 */
export async function uploadChatFiles(
  files: Array<{ blob: Blob; name: string }>,
  userToken?: string | null,
): Promise<OnyxFileDescriptor[]> {
  if (!isOnyxConfigured()) throw new OnyxError("Onyx não configurado.", 503);
  if (files.length === 0) return [];

  const form = new FormData();
  for (const f of files) form.append("files", f.blob, f.name);

  const res = await fetch(`${ONYX_BASE}/api/user/projects/file/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken?.trim() || API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OnyxError(body || `Onyx respondeu ${res.status}`, res.status);
  }
  const data = (await res.json()) as { user_files?: OnyxUserFile[] };
  return (data.user_files ?? []).map((uf) => ({
    user_file_id: uf.id,
    id: uf.file_id,
    type: uf.chat_file_type || "image",
    name: uf.name,
  }));
}

// ─── Modelos LLM (Onyx global) ───────────────────────────────────────────────

export interface OnyxLlmModelConfig {
  id: number;
  name: string;
  display_name: string | null;
  is_visible: boolean;
  supports_image_input: boolean;
  max_input_tokens: number | null;
}

export interface OnyxLlmProvider {
  id: number;
  name: string;
  provider: string;
  api_base: string | null;
  is_public: boolean;
  is_auto_mode: boolean;
  model_configurations: OnyxLlmModelConfig[];
  custom_config: Record<string, unknown>;
  api_key: string | null;
  api_version: string | null;
  deployment_name: string | null;
  groups: unknown[];
  personas?: unknown[];
}

export async function listOnyxLlmProviders(): Promise<OnyxLlmProvider[]> {
  const data = await onyxJson<{ providers: OnyxLlmProvider[] }>("/admin/llm/provider");
  return data.providers ?? [];
}

/**
 * Define o modelo padrão do Onyx reordenando model_configurations para que o
 * modelo escolhido fique primeiro — o Onyx usa o primeiro modelo visível como padrão
 * quando is_auto_mode=true. Os campos default_model_name/is_default_provider não
 * existem nesta versão da API.
 */
export async function setOnyxDefaultModel(
  provider: OnyxLlmProvider,
  modelName: string,
): Promise<void> {
  const target = provider.model_configurations.find((m) => m.name === modelName);
  if (!target) throw new OnyxError(`Modelo "${modelName}" não encontrado no provider.`, 404);

  const rest = provider.model_configurations.filter((m) => m.name !== modelName);
  const reordered = [target, ...rest];

  const body = { ...provider, model_configurations: reordered };
  const res = await onyxFetch("/admin/llm/provider", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OnyxError(detail || "Falha ao atualizar modelo padrão.", res.status);
  }
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

export function createChatSession(
  personaId: number,
  description?: string,
  userToken?: string | null,
): Promise<CreateSessionResult> {
  return onyxJson<CreateSessionResult>("/chat/create-chat-session", {
    method: "POST",
    userToken,
    body: JSON.stringify({ persona_id: personaId, description: description ?? null }),
  });
}

// ─── Reidratação de histórico (fonte de verdade = Onyx) ──────────────────────

/** Arquivo anexado a uma mensagem no histórico do Onyx. */
export interface OnyxSessionFile {
  id: string;
  type: string; // "image" | "document" | "plain_text"
  name?: string | null;
}

/** Mensagem como o Onyx devolve em get-chat-session. */
export interface OnyxSessionMessage {
  message_id: number;
  message: string;
  message_type: "user" | "assistant" | string;
  parent_message: number | null;
  files?: OnyxSessionFile[];
}

export interface OnyxChatSession {
  chat_session_id?: string;
  messages: OnyxSessionMessage[];
}

/**
 * Recarrega o histórico COMPLETO de uma sessão Onyx (texto + anexos por mensagem).
 * É a fonte de verdade ao reabrir/atualizar uma conversa com agente: cada mensagem
 * traz seus `files`, de onde reidratamos as imagens (enviadas e geradas).
 */
export function getChatSession(
  sessionId: string,
  userToken?: string | null,
): Promise<OnyxChatSession> {
  return onyxJson<OnyxChatSession>(`/chat/get-chat-session/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    userToken,
    timeoutMs: 30_000,
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
    fileDescriptors?: OnyxFileDescriptor[];
    userToken?: string | null;
    signal?: AbortSignal;
  },
): Promise<Response> {
  return onyxFetch("/chat/send-chat-message", {
    method: "POST",
    timeoutMs: 120_000,
    signal: params.signal,
    userToken: params.userToken,
    body: JSON.stringify({
      chat_session_id: params.chatSessionId,
      message: params.message,
      parent_message_id: params.parentMessageId ?? null,
      ...(params.additionalContext ? { additional_context: params.additionalContext } : {}),
      ...(params.fileDescriptors && params.fileDescriptors.length > 0
        ? { file_descriptors: params.fileDescriptors }
        : {}),
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

// ─── Voz (Omni Voice) ─────────────────────────────────────────────────────────

export interface VoiceStatus {
  stt_enabled: boolean;
  tts_enabled: boolean;
}

/** Status do serviço de voz (TTS/STT habilitados ou não). */
export function getVoiceStatus(): Promise<VoiceStatus> {
  return onyxJson<VoiceStatus>("/voice/status", { method: "GET", timeoutMs: 8_000 });
}

/**
 * TTS: sintetiza fala a partir de texto. Retorna a Response BRUTA do Onyx —
 * a rota proxy decide como repassar o áudio ao browser (binário ou JSON).
 */
export function synthesizeVoice(
  params: { text: string; voice?: string; speed?: number; userToken?: string | null },
): Promise<Response> {
  return onyxFetch("/voice/synthesize", {
    method: "POST",
    timeoutMs: 60_000,
    userToken: params.userToken,
    body: JSON.stringify({
      text: params.text,
      ...(params.voice ? { voice: params.voice } : {}),
      ...(params.speed ? { speed: params.speed } : {}),
    }),
  });
}

/**
 * STT: transcreve áudio para texto (multipart, campo "audio").
 * Retorna a Response BRUTA do Onyx (JSON com o texto transcrito).
 */
export async function transcribeAudio(audio: Blob, filename: string, userToken?: string | null): Promise<Response> {
  if (!isOnyxConfigured()) throw new OnyxError("Onyx não configurado.", 503);
  const form = new FormData();
  form.append("audio", audio, filename);
  return fetch(`${ONYX_BASE}/api/voice/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken?.trim() || API_KEY}` },
    body: form,
  });
}

// ─── Conectores (Connectors / CC-pairs / Credentials / Document Sets) ─────────
//
// No Onyx, uma "fonte de conhecimento" (RAG) é um par Connector + Credential
// (chamado CC-pair). A UI de Conectores gerencia: o estado de indexação de cada
// fonte, criação/edição/pausa/exclusão, reindexação forçada (run-once), as
// credenciais e os document sets (agrupamentos de fontes para busca).
//
// IMPORTANTE: tudo aqui afeta o RAG GLOBAL do Onyx (todos os agentes). As rotas
// /api/onyx/connectors/* restringem a Admin/CEO + permissão conectoresIAlpha.

/** Status de uma fonte de conhecimento (CC-pair). */
export type CCPairStatus = "ACTIVE" | "PAUSED" | "DELETING" | "INVALID";

/** Resultado da última tentativa de indexação. */
export type IndexStatus =
  | "not_started"
  | "in_progress"
  | "success"
  | "canceled"
  | "failed"
  | "completed_with_errors"
  | "invalid";

/** Uma fonte de conhecimento como aparece na tabela de status. */
export interface ConnectorIndexingStatus {
  cc_pair_id: number;
  name: string | null;
  source: string;
  access_type: string;
  cc_pair_status: CCPairStatus;
  in_progress: boolean;
  in_repeated_error_state: boolean;
  last_finished_status: IndexStatus | null;
  last_status: IndexStatus | null;
  last_success: string | null;
  is_editable: boolean;
  docs_indexed: number;
  latest_index_attempt_docs_indexed?: number | null;
}

/** Resumo por tipo de fonte (cabeçalho de cada grupo). */
export interface ConnectorSourceSummary {
  total_connectors: number;
  active_connectors: number;
  public_connectors: number;
  total_docs_indexed: number;
}

/** Grupo de fontes do mesmo tipo (a resposta de indexing-status é paginada/agrupada). */
export interface ConnectorIndexingGroup {
  source: string;
  summary: ConnectorSourceSummary;
  current_page: number;
  total_pages: number;
  indexing_statuses: ConnectorIndexingStatus[];
}

/**
 * Lista o estado de indexação de TODAS as fontes, agrupado por tipo.
 * Endpoint é POST (não GET) e aceita paginação. Sem corpo = primeira página
 * de cada grupo.
 */
export function listConnectorIndexingStatus(
  body: { secondary_index?: boolean } = {},
): Promise<ConnectorIndexingGroup[]> {
  return onyxJson<ConnectorIndexingGroup[]>("/manage/admin/connector/indexing-status", {
    method: "POST",
    timeoutMs: 30_000,
    body: JSON.stringify({ secondary_index: body.secondary_index ?? false }),
  });
}

/** Detalhe completo de um CC-pair (página de detalhe da fonte). */
export interface CCPairFullInfo {
  id: number;
  name: string;
  status: CCPairStatus;
  in_repeated_error_state: boolean;
  num_docs_indexed: number;
  connector: OnyxConnector;
  credential: OnyxCredential | null;
  number_of_index_attempts: number;
  last_index_attempt_status: IndexStatus | null;
  access_type: string;
  is_editable_for_current_user: boolean;
  indexing: boolean;
  creator_email?: string | null;
  last_indexed?: string | null;
  last_pruned?: string | null;
  overall_indexing_speed?: number | null;
  latest_checkpoint_description?: string | null;
  supports_targeted_reindex?: boolean;
}

export function getCCPair(ccPairId: number): Promise<CCPairFullInfo> {
  return onyxJson<CCPairFullInfo>(`/manage/admin/cc-pair/${ccPairId}`, { method: "GET" });
}

/** Pausa ou reativa uma fonte. */
export async function setCCPairStatus(ccPairId: number, status: CCPairStatus): Promise<void> {
  await onyxJson<void>(`/manage/admin/cc-pair/${ccPairId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

/** Renomeia uma fonte. */
export async function renameCCPair(ccPairId: number, name: string): Promise<void> {
  await onyxJson<void>(`/manage/admin/cc-pair/${ccPairId}/name?new_name=${encodeURIComponent(name)}`, {
    method: "PUT",
  });
}

/** Força uma reindexação agora (run-once). */
export async function runConnectorOnce(
  connectorId: number,
  credentialIds: number[],
  fromBeginning = false,
): Promise<void> {
  await onyxJson<void>("/manage/admin/connector/run-once", {
    method: "POST",
    body: JSON.stringify({
      connector_id: connectorId,
      credential_ids: credentialIds,
      from_beginning: fromBeginning,
    }),
  });
}

/** Agenda a exclusão de uma fonte (connector + credential pair). */
export async function deleteCCPair(connectorId: number, credentialId: number): Promise<void> {
  await onyxJson<void>("/manage/admin/deletion-attempt", {
    method: "POST",
    body: JSON.stringify({ connector_id: connectorId, credential_id: credentialId }),
  });
}

// ─── Connector (definição da fonte, sem credencial) ───────────────────────────

export interface OnyxConnector {
  id: number;
  name: string;
  source: string;
  input_type: string;
  connector_specific_config: Record<string, unknown>;
  refresh_freq: number | null;
  prune_freq: number | null;
  indexing_start: string | null;
  credential_ids?: number[];
  time_created?: string;
  time_updated?: string;
}

export interface CreateConnectorInput {
  name: string;
  source: string;
  input_type: string;
  connector_specific_config: Record<string, unknown>;
  access_type?: string;
  refresh_freq?: number | null;
  prune_freq?: number | null;
}

export function createConnector(input: CreateConnectorInput): Promise<OnyxConnector> {
  return onyxJson<OnyxConnector>("/manage/admin/connector", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      source: input.source,
      input_type: input.input_type,
      connector_specific_config: input.connector_specific_config,
      access_type: input.access_type ?? "public",
      refresh_freq: input.refresh_freq ?? null,
      prune_freq: input.prune_freq ?? null,
      groups: [],
    }),
  });
}

export function updateConnector(
  connectorId: number,
  input: CreateConnectorInput,
): Promise<OnyxConnector> {
  return onyxJson<OnyxConnector>(`/manage/admin/connector/${connectorId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: input.name,
      source: input.source,
      input_type: input.input_type,
      connector_specific_config: input.connector_specific_config,
      access_type: input.access_type ?? "public",
      refresh_freq: input.refresh_freq ?? null,
      prune_freq: input.prune_freq ?? null,
      groups: [],
    }),
  });
}

/** Liga um connector a uma credencial, criando o CC-pair com nome de exibição. */
export async function linkConnectorCredential(
  connectorId: number,
  credentialId: number,
  name: string,
  accessType = "public",
): Promise<void> {
  await onyxJson<void>(`/manage/connector/${connectorId}/credential/${credentialId}`, {
    method: "PUT",
    body: JSON.stringify({ name, access_type: accessType, groups: [] }),
  });
}

// ─── Credentials ──────────────────────────────────────────────────────────────

export interface OnyxCredential {
  id: number;
  name: string | null;
  source: string;
  credential_json: Record<string, unknown>;
  admin_public: boolean;
  curator_public: boolean;
  user_email?: string | null;
  time_created?: string;
  time_updated?: string;
}

export function listCredentials(): Promise<OnyxCredential[]> {
  return onyxJson<OnyxCredential[]>("/manage/credential", { method: "GET" });
}

export interface CreateCredentialInput {
  name?: string;
  source: string;
  credential_json: Record<string, unknown>;
  admin_public?: boolean;
  curator_public?: boolean;
}

export function createCredential(input: CreateCredentialInput): Promise<OnyxCredential> {
  return onyxJson<OnyxCredential>("/manage/credential", {
    method: "POST",
    body: JSON.stringify({
      name: input.name ?? null,
      source: input.source,
      credential_json: input.credential_json,
      admin_public: input.admin_public ?? true,
      curator_public: input.curator_public ?? true,
      groups: [],
    }),
  });
}

export async function deleteCredential(credentialId: number): Promise<void> {
  await onyxJson<void>(`/manage/credential/${credentialId}`, { method: "DELETE" });
}

// ─── Document Sets ──────────────────────────────────────────────────────────

export interface OnyxDocumentSet {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  is_up_to_date?: boolean;
  cc_pair_descriptors?: Array<{ id: number; name: string | null }>;
}

export function listDocumentSets(): Promise<OnyxDocumentSet[]> {
  return onyxJson<OnyxDocumentSet[]>("/manage/document-set", { method: "GET" });
}

export interface CreateDocumentSetInput {
  name: string;
  description: string;
  cc_pair_ids: number[];
  is_public?: boolean;
}

export function createDocumentSet(input: CreateDocumentSetInput): Promise<number> {
  return onyxJson<number>("/manage/admin/document-set", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      cc_pair_ids: input.cc_pair_ids,
      is_public: input.is_public ?? true,
      users: [],
      groups: [],
      federated_connectors: [],
    }),
  });
}

export async function updateDocumentSet(input: {
  id: number;
  description: string;
  cc_pair_ids: number[];
  is_public?: boolean;
}): Promise<void> {
  await onyxJson<void>("/manage/admin/document-set", {
    method: "PATCH",
    body: JSON.stringify({
      id: input.id,
      description: input.description,
      cc_pair_ids: input.cc_pair_ids,
      is_public: input.is_public ?? true,
      users: [],
      groups: [],
      federated_connectors: [],
    }),
  });
}

export async function deleteDocumentSet(documentSetId: number): Promise<void> {
  await onyxJson<void>(`/manage/admin/document-set/${documentSetId}`, { method: "DELETE" });
}

// ─── Upload de arquivos para conector File ────────────────────────────────────

export interface UploadedFileRef {
  /** caminho/id retornado pelo Onyx, usado em connector_specific_config.file_locations */
  file_paths: string[];
  file_names: string[];
}

/**
 * Faz upload de arquivos para criar/alimentar um conector do tipo "file".
 * Retorna os file_paths que vão em connector_specific_config.file_locations.
 */
export async function uploadConnectorFiles(
  files: Array<{ blob: Blob; name: string }>,
): Promise<UploadedFileRef> {
  if (!isOnyxConfigured()) throw new OnyxError("Onyx não configurado.", 503);
  if (files.length === 0) return { file_paths: [], file_names: [] };

  const form = new FormData();
  for (const f of files) form.append("files", f.blob, f.name);

  const res = await fetch(`${ONYX_BASE}/api/manage/admin/connector/file/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OnyxError(body || `Onyx respondeu ${res.status}`, res.status);
  }
  const data = (await res.json()) as { file_paths?: string[]; file_names?: string[] };
  return {
    file_paths: data.file_paths ?? [],
    file_names: data.file_names ?? files.map((f) => f.name),
  };
}

// ─── Google (Gmail / Drive) — fluxo de conta de serviço dedicado ──────────────
//
// O Onyx NÃO cria a credencial Google pelo /manage/credential genérico. São dois
// passos próprios:
//   1) PUT .../{gmail|google-drive}/service-account-key  → guarda o JSON da
//      conta de serviço no servidor (a "chave do app").
//   2) PUT .../{gmail|google-drive}/service-account-credential → recebe só o
//      google_primary_admin (e-mail do admin a impersonar) e RETORNA o
//      credential_id já pronto, combinando com a chave guardada.
// Por isso o google_primary_admin nunca vai dentro do credential_json.

export type GoogleSource = "gmail" | "google-drive";

/** Passo 1: guarda o JSON da conta de serviço no servidor. */
export async function setGoogleServiceAccountKey(
  source: GoogleSource,
  serviceAccountKey: Record<string, unknown>,
): Promise<void> {
  await onyxJson<void>(`/manage/admin/connector/${source}/service-account-key`, {
    method: "PUT",
    body: JSON.stringify(serviceAccountKey),
  });
}

/** Passo 2: cria a credencial com o admin a impersonar; retorna o credential_id. */
export async function createGoogleServiceAccountCredential(
  source: GoogleSource,
  googlePrimaryAdmin: string,
): Promise<number> {
  // O Onyx retorna o id da credencial em `id` (não `credential_id`).
  const res = await onyxJson<{ id?: number; credential_id?: number }>(
    `/manage/admin/connector/${source}/service-account-credential`,
    {
      method: "PUT",
      body: JSON.stringify({ google_primary_admin: googlePrimaryAdmin }),
    },
  );
  const id = res.id ?? res.credential_id;
  if (id == null) throw new OnyxError("Onyx não retornou o id da credencial Google.", 502);
  return id;
}
