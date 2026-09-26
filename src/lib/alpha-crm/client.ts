import "server-only";

export async function callStandaloneCrm(path: string, init?: { method?: "GET" | "POST"; body?: unknown }) {
  const base = process.env.ALPHA_CRM_BASE_URL;
  const token = process.env.ALPHA_BRIDGE_TOKEN;
  if (!base || !token || token.length < 32) throw new Error("Integração Alpha CRM não configurada.");
  const url = new URL(path, base);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("ALPHA_CRM_BASE_URL inválida.");
  const response = await fetch(url, {
    method: init?.method || "GET",
    headers: { Authorization: `Bearer ${token}`, ...(init?.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}
