import { ExplorerError } from "./errors";

export function resolveExplorerRequestOrigin(request: Request, allowedOrigins?: readonly string[]): string {
  const origin = request.headers.get("origin");
  if (origin) {
    if (!allowedOrigins) {
      let requestOrigin: string;
      try {
        requestOrigin = new URL(request.url).origin;
      } catch {
        throw new ExplorerError("INVALID_ORIGIN", 403, "Origem inválida");
      }
      if (origin !== requestOrigin) throw new ExplorerError("INVALID_ORIGIN", 403, "Origem não permitida");
      return origin;
    }
    if (!allowedOrigins.includes(origin)) throw new ExplorerError("INVALID_ORIGIN", 403, "Origem não permitida");
    return origin;
  }

  if (!allowedOrigins) throw new ExplorerError("INVALID_ORIGIN", 403, "Origem obrigatória");

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const candidates: string[] = [];
  if (host && (forwardedProto === "http" || forwardedProto === "https")) {
    candidates.push(`${forwardedProto}://${host}`);
  }
  try {
    candidates.push(new URL(request.url).origin);
  } catch {
    // A ausência de uma URL válida será tratada pela allowlist abaixo.
  }
  const trustedOrigin = candidates.find((candidate) => allowedOrigins.includes(candidate));
  if (!trustedOrigin) throw new ExplorerError("INVALID_ORIGIN", 403, "Origem não permitida");
  return trustedOrigin;
}

export function assertTrustedExplorerMutationRequest(request: Request, allowedOrigins: readonly string[]): string {
  const origin = resolveExplorerRequestOrigin(request, allowedOrigins);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ExplorerError("CROSS_SITE_REQUEST", 403, "Requisição cross-site não permitida");
  }
  return origin;
}
