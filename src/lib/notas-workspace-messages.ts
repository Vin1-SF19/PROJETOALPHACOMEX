export const NOTAS_WORKSPACE_ATUALIZADO = "painel-alpha:notas-workspace-atualizado" as const;

interface NotasWorkspaceAtualizadoMessage {
  type: typeof NOTAS_WORKSPACE_ATUALIZADO;
}

export function isNotasWorkspaceAtualizadoMessage(value: unknown): value is NotasWorkspaceAtualizadoMessage {
  if (typeof value !== "object" || value === null) return false;
  return "type" in value && value.type === NOTAS_WORKSPACE_ATUALIZADO;
}

/** A Central roda em iframe; avisa o shell de mesma origem para atualizar a barra global. */
export function notificarWorkspaceNotasAtualizado(): void {
  if (typeof window === "undefined") return;
  window.parent.postMessage({ type: NOTAS_WORKSPACE_ATUALIZADO } satisfies NotasWorkspaceAtualizadoMessage, window.location.origin);
}

