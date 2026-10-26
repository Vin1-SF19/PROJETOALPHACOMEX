export type BaseRascunhoCard = { versao: string; valores: Record<string, string> };
export type RascunhoLocalCard = {
  valores: Record<string, string>;
  token?: string;
  pendingKey?: string;
  base?: BaseRascunhoCard;
  pendencias?: Array<{ label: string; before?: string; after?: string }>;
};

export function chaveRascunhosCrm(usuarioId?: string | number): string | null {
  const id = String(usuarioId ?? "");
  return /^[1-9]\d*$/.test(id) ? `alpha:crm:rascunhos:v1:usuario:${id}` : null;
}

export function chavePendenciaRascunho(key: string, registrada?: string): string {
  if (registrada) return registrada;
  if (key.includes(":")) return key;
  // IDs de card são CUID ou rdcard_hex, ambos sem hífen. O formato antigo
  // dos formulários usa cardId-instance; pendências precisam de cardId:instance.
  const separator = key.indexOf("-");
  return separator > 0 ? `${key.slice(0, separator)}:${key}` : key;
}

function recordStrings(value: unknown): value is Record<string, string> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every((item) => typeof item === "string");
}

/** Nenhuma chave antiga sem identidade é atribuída ao usuário atual. */
export function lerRascunhosCrm(chave: string | null): Map<string, RascunhoLocalCard> {
  const result = new Map<string, RascunhoLocalCard>();
  if (!chave || typeof window === "undefined") return result;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(chave) ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return result;
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object" || !("valores" in value) || !recordStrings(value.valores)) continue;
      const entry: RascunhoLocalCard = { valores: value.valores };
      if ("token" in value && typeof value.token === "string") entry.token = value.token;
      if ("pendingKey" in value && typeof value.pendingKey === "string") entry.pendingKey = value.pendingKey;
      if ("base" in value && value.base && typeof value.base === "object"
        && "versao" in value.base && typeof value.base.versao === "string"
        && "valores" in value.base && recordStrings(value.base.valores)) {
        entry.base = { versao: value.base.versao, valores: value.base.valores };
      }
      if ("pendencias" in value && Array.isArray(value.pendencias)) {
        entry.pendencias = value.pendencias.flatMap((item: unknown) => {
          if (!item || typeof item !== "object" || !("label" in item) || typeof item.label !== "string") return [];
          return [{ label: item.label,
            ...("before" in item && typeof item.before === "string" ? { before: item.before } : {}),
            ...("after" in item && typeof item.after === "string" ? { after: item.after } : {}) }];
        });
      }
      result.set(key, entry);
    }
  } catch { /* armazenamento indisponível ou conteúdo inválido: não aplicar */ }
  return result;
}

export function chavePertenceAoCard(chave: string, cardId: string): boolean {
  return chave.startsWith(`${cardId}:`) || chave.startsWith(`${cardId}-`);
}
