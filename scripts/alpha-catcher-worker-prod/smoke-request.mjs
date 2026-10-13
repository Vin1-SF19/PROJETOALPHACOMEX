const RETRYABLE_STATUS = new Set([502, 503, 504]);

export async function fetchSmoke({ fetchImpl = fetch, url, createRequest, local, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 30000, intervalMs = 500, now = Date.now }) {
  const deadline = now() + timeoutMs;
  let lastFailure = 'sem resposta';
  while (now() < deadline) {
    const request = createRequest();
    const signal = AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - now())));
    try {
      const response = await fetchImpl(url, { ...request, signal });
      if (!local || !RETRYABLE_STATUS.has(response.status)) return { response, request };
      lastFailure = `HTTP ${response.status}`;
      await response.body?.cancel();
    } catch (error) {
      if (!local) throw error;
      lastFailure = 'falha de conexão ou timeout';
    }
    const remaining = deadline - now();
    if (remaining > 0) await wait(Math.min(intervalMs, remaining));
  }
  throw new Error(`Worker local não ficou pronto em ${timeoutMs} ms (${lastFailure}).`);
}
