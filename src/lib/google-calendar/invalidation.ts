export const CALENDARIO_ALPHA_INVALIDATION_KEY =
  "painel-alpha:calendario-alterado:v1";
export const CALENDARIO_ALPHA_INVALIDATION_EVENT =
  "painel-alpha:calendario-alterado";

const TOOLS_MUTACAO_CALENDARIO = new Set([
  "criar_evento_calendario",
  "editar_evento_calendario",
  "cancelar_evento_calendario",
  "criar_evento_calendario_colega",
  "editar_evento_calendario_colega",
  "cancelar_evento_calendario_colega",
]);

export function resultadoToolAlterouCalendario(
  toolName: string,
  resultado: string,
): boolean {
  if (!TOOLS_MUTACAO_CALENDARIO.has(toolName)) return false;

  try {
    const dados = JSON.parse(resultado) as { ok?: unknown };
    return dados.ok === true;
  } catch {
    return false;
  }
}

/**
 * O painel mantém cada módulo em um iframe persistente. Alterar o localStorage
 * dispara `storage` nos outros iframes da mesma origem, inclusive na agenda oculta.
 */
export function notificarCalendarioAlphaAlterado(): void {
  if (typeof window === "undefined") return;

  try {
    const identificador =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    window.localStorage.setItem(
      CALENDARIO_ALPHA_INVALIDATION_KEY,
      `${Date.now()}:${identificador}`,
    );
  } catch {
    // A mutação já foi concluída; indisponibilidade do storage não deve quebrar o chat.
  }

  try {
    window.dispatchEvent(new Event(CALENDARIO_ALPHA_INVALIDATION_EVENT));
  } catch {
    // Mantém o chat funcional mesmo em um ambiente sem suporte a eventos do DOM.
  }
}
