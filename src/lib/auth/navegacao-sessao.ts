export function deveEncerrarSessaoPorHeartbeat(
  statusHttp: number,
  teveSessaoAutenticada: boolean,
): boolean {
  return statusHttp === 403 || (statusHttp === 401 && teveSessaoAutenticada);
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
