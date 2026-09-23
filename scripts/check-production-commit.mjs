const expected = process.env.EXPECTED_COMMIT_SHA?.trim();
const baseUrl = process.env.PAINELALPHA_PUBLIC_URL?.trim();

if (!expected || !/^[a-f0-9]{40}$/.test(expected)) {
  throw new Error("EXPECTED_COMMIT_SHA inválido ou ausente");
}
if (!baseUrl) {
  throw new Error("PAINELALPHA_PUBLIC_URL ausente");
}

const endpoint = new URL("/api/health/version", baseUrl);
if (endpoint.protocol !== "https:") {
  throw new Error("URL de produção deve usar HTTPS");
}

const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
if (!response.ok) {
  throw new Error(`Health check de produção retornou HTTP ${response.status}`);
}
const body = await response.json();
if (body?.status !== "ok" || body?.deployedCommitSha !== expected) {
  throw new Error("SHA implantado em produção diverge do commit esperado");
}

process.stdout.write(`${JSON.stringify({ status: "ok", deployedCommitSha: expected })}\n`);
