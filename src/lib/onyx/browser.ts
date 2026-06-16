// Helpers de cliente (browser) para as rotas proxy /api/onyx/*.
// Seguro para importar em componentes client — NUNCA toca no token.

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
  tools?: OnyxToolRef[];
  starter_messages?: Array<{ name?: string; message: string }> | null;
  uploaded_image_id?: string | null;
  /** Enriquecido pelo backend: visibilidade e criador (nível PainelAlpha) */
  createdByName?: string | null;
  ownedByMe?: boolean;
  isPublic?: boolean;
}

/** URL (via proxy) da imagem do agente. Use só quando o agente tem imagem. */
export function agentAvatarUrl(id: number): string {
  return `/api/onyx/agents/${id}/avatar`;
}

export interface OnyxTool {
  id: number;
  name: string;
  display_name?: string | null;
  description?: string | null;
  in_code_tool_id?: string | null;
  definition?: Record<string, unknown> | null;
}

export interface AgentFormData {
  name: string;
  description: string;
  system_prompt: string;
  task_prompt?: string;
  tool_ids?: number[];
  is_public?: boolean;
  uploaded_image_id?: string | null;
  remove_image?: boolean;
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? `Erro ${res.status}`;
  } catch {
    return `Erro ${res.status}`;
  }
}

export async function fetchAgents(): Promise<OnyxAgent[]> {
  const res = await fetch("/api/onyx/agents");
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { agents: OnyxAgent[] };
  return data.agents;
}

/** Detalhe completo de um agente (inclui system_prompt, que a lista NÃO traz). */
export async function fetchAgent(id: number): Promise<OnyxAgent> {
  const res = await fetch(`/api/onyx/agents/${id}`);
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { agent: OnyxAgent };
  return data.agent;
}

export async function fetchTools(): Promise<OnyxTool[]> {
  const res = await fetch("/api/onyx/tools");
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { tools: OnyxTool[] };
  return data.tools;
}

export async function createAgent(form: AgentFormData): Promise<OnyxAgent> {
  const res = await fetch("/api/onyx/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { agent: OnyxAgent };
  return data.agent;
}

export async function updateAgent(id: number, form: AgentFormData): Promise<OnyxAgent> {
  const res = await fetch(`/api/onyx/agents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { agent: OnyxAgent };
  return data.agent;
}

export async function deleteAgent(id: number): Promise<void> {
  const res = await fetch(`/api/onyx/agents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseError(res));
}

// ── Modelos de geração de imagem (default GLOBAL no Onyx) ──────────────────────

export interface OnyxImageModel {
  image_provider_id: string;
  model_name: string;
  is_default: boolean;
}

/** Rótulos amigáveis + ordem por qualidade (0 = mais básico). */
export const IMAGE_MODEL_META: Record<string, { label: string; hint: string; order: number }> = {
  fal_ai_flux_schnell:        { label: "Flux Schnell", hint: "Rápido e econômico", order: 0 },
  fal_ai_flux_dev:            { label: "Flux Dev",      hint: "Equilibrado",        order: 1 },
  fal_ai_flux_pro_v1_1:       { label: "Flux Pro 1.1",  hint: "Alta qualidade",     order: 2 },
  fal_ai_flux_pro_v1_1_ultra: { label: "Flux Pro Ultra", hint: "Máxima qualidade",  order: 3 },
};

export function imageModelLabel(id: string, fallback?: string): { label: string; hint: string } {
  const m = IMAGE_MODEL_META[id];
  if (m) return { label: m.label, hint: m.hint };
  return { label: fallback ?? id, hint: "" };
}

export async function fetchImageModels(): Promise<OnyxImageModel[]> {
  const res = await fetch("/api/onyx/image-models");
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { models: OnyxImageModel[] };
  // ordena por qualidade
  return data.models.sort(
    (a, b) => (IMAGE_MODEL_META[a.image_provider_id]?.order ?? 99) - (IMAGE_MODEL_META[b.image_provider_id]?.order ?? 99),
  );
}

export async function setDefaultImageModel(imageProviderId: string): Promise<void> {
  const res = await fetch("/api/onyx/image-models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageProviderId }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

/** Detecta intenção de gerar imagem no texto do usuário. */
export function detectsImageIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /(ger(e|ar|a)|cri(e|ar|a)|desenh(e|ar|a)|fa[çc]a|fazer|produz(a|ir)|ilustr(e|ar))[^.!?]{0,30}(imagem|imagens|foto|fotos|figura|ilustra|logo|logotipo|desenho|arte|banner|capa|wallpaper|avatar)/i.test(t)
    || /(imagem|ilustra[çc]|desenho|logotipo)\s+(de|do|da|para|com)\b/i.test(t);
}

/** Faz upload da imagem do agente e retorna o uploaded_image_id. */
export async function uploadAgentImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/onyx/agents/upload-image", { method: "POST", body: form });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { uploaded_image_id: string };
  return data.uploaded_image_id;
}

export async function createCustomTool(definition: Record<string, unknown>): Promise<OnyxTool> {
  const res = await fetch("/api/onyx/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ definition }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { tool: OnyxTool };
  return data.tool;
}
