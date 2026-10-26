import { signOut } from "next-auth/react";

/** Only a successful Auth.js session response is evidence, never HTTP403 alone. */
export function sessaoConfirmaEncerramento(session: unknown, teveSessaoAutenticada: boolean): boolean {
  if (session === null) return teveSessaoAutenticada;
  return typeof session === "object" && session !== null && "estadoAcesso" in session &&
    session.estadoAcesso === "NEGADO" && "acessoBloqueado" in session && session.acessoBloqueado === true;
}

let encerramento: Promise<unknown> | null = null;
export function encerrarSessaoConfirmada(): Promise<unknown> {
  if (!encerramento) encerramento = signOut({ redirectTo: "/" }).catch(() => { encerramento = null; });
  return encerramento;
}

export function deveEncerrarSessaoPorHeartbeat(
  statusHttp: number,
  teveSessaoAutenticada: boolean,
  sessaoConfirmada?: unknown,
): boolean {
  return (statusHttp === 403 || statusHttp === 401) && sessaoConfirmaEncerramento(sessaoConfirmada, teveSessaoAutenticada);
}

export function urlRepresentaLoginDoPainel(
  href: string,
  origemPainel: string,
): boolean {
  try {
    const url = new URL(href, origemPainel);
    return url.origin === origemPainel && url.pathname === "/";
  } catch {
    return false;
  }
}
