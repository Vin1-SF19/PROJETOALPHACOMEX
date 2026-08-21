import "server-only";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function configuredUrls(): URL[] {
  const values = [
    process.env.ALPHA_SEO_MCP_PUBLIC_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];
  const urls: URL[] = [];
  for (const value of values) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) urls.push(url);
    } catch {
      // Configuração inválida não deve ampliar a allowlist.
    }
  }
  return urls;
}

function configuredHosts(): Set<string> {
  const hosts = new Set<string>(LOCAL_HOSTS);
  for (const url of configuredUrls()) hosts.add(url.hostname.toLowerCase());
  for (const raw of (process.env.ALPHA_SEO_MCP_ALLOWED_HOSTS ?? "").split(",")) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    try {
      const parsed = new URL(value.includes("://") ? value : `https://${value}`);
      hosts.add(parsed.hostname.toLowerCase());
    } catch {
      // Entrada inválida é ignorada.
    }
  }
  return hosts;
}

function requestHostname(request: Request): string | null {
  const host = request.headers.get("host")?.trim();
  if (!host || /[\s\\/@]/.test(host)) return null;
  try { return new URL(`http://${host}`).hostname.toLowerCase(); }
  catch { return null; }
}

export function validateAlphaSeoMcpHostAndOrigin(request: Request): Response | null {
  const allowed = configuredHosts();
  const hostname = requestHostname(request);
  if (!hostname || !allowed.has(hostname)) return Response.json({ error: "HOST_NOT_ALLOWED" }, { status: 421 });
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    const local = LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
    if ((parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash || !allowed.has(parsed.hostname.toLowerCase())) {
      return Response.json({ error: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "ORIGIN_INVALID" }, { status: 403 });
  }
  return null;
}

export function alphaSeoMcpPublicOrigin(request: Request): string {
  const configured = configuredUrls()[0];
  if (configured) return configured.origin;
  const url = new URL(request.url);
  if (!LOCAL_HOSTS.has(url.hostname.toLowerCase())) throw new Error("MCP_PUBLIC_URL_NOT_CONFIGURED");
  return url.origin;
}
