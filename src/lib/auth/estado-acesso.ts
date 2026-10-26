/** Client-safe protocol. Identity in a cookie is not permission to operate. */
export const AUTH_UNAVAILABLE = "AUTH_UNAVAILABLE";
export const AUTH_RETRY_AFTER_SECONDS = 5;
export const AUTH_UNAVAILABLE_MESSAGE = "Não foi possível validar o acesso agora. Tente novamente em instantes.";

export type EstadoAcessoSessao = "PERMITIDO" | "NEGADO" | "INDISPONIVEL";

export function sessaoEstaIndisponivel(session: unknown): boolean {
  return typeof session === "object" && session !== null &&
    "estadoAcesso" in session && session.estadoAcesso === "INDISPONIVEL";
}

export function sessaoPermiteOperacao(session: unknown): boolean {
  if (!session || typeof session !== "object" || sessaoEstaIndisponivel(session)) return false;
  if (!("estadoAcesso" in session) || session.estadoAcesso !== "PERMITIDO") return false;
  if ("acessoBloqueado" in session && session.acessoBloqueado === true) return false;
  if (!("user" in session) || !session.user || typeof session.user !== "object") return false;
  return "id" in session.user && typeof session.user.id === "string" && session.user.id.length > 0;
}
