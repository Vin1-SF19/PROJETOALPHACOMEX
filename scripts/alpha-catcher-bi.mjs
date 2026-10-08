const ORIGIN = 'https://api-plataformabi.logcomex.io';
export function credenciaisBI(url, headers, expectedEmail) {
  if (new URL(url).origin !== ORIGIN) return null;
  const h = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (['authorization', 'x-infra-key', 'user-email', 'product-signature'].includes(name.toLowerCase()) && typeof value === 'string') h.set(name, value);
  }
  const token = h.get('authorization'), infraKey = h.get('x-infra-key'), email = h.get('user-email'), productSignature = h.get('product-signature');
  if (!token?.trim() || !infraKey || email?.toLowerCase() !== expectedEmail.toLowerCase() || !productSignature || !/^[a-zA-Z0-9_-]{1,64}$/.test(productSignature)) return null;
  return { token, authorizationHeader: token, infraKey, email, productSignature };
}
export function capturarSessaoBI(context, email, timeoutMs = 90000) {
  const diagnostics = { responses: 0, statuses: {}, missingAuthorization: 0, missingInfraKey: 0, differentEmail: 0, differentProduct: 0, failedRequests: 0, headerReadErrors: 0 };
  let finish;
  const promise = new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => finish(Object.assign(new Error('Nenhuma sessão BI válida capturada.'), { code: 'SHIPMENT_BI_TIMEOUT' })), timeoutMs);
    const failed = request => { try { if (new URL(request.url()).origin === ORIGIN) diagnostics.failedRequests++; } catch {} };
    const listener = async response => {
      try {
        if (new URL(response.url()).origin !== ORIGIN) return;
        diagnostics.responses++; diagnostics.statuses[response.status()] = (diagnostics.statuses[response.status()] || 0) + 1;
        const headers = response.request().headers();
        const entries = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
        if (!entries.authorization) diagnostics.missingAuthorization++;
        if (!entries['x-infra-key']) diagnostics.missingInfraKey++;
        if (entries['user-email']?.toLowerCase() !== email.toLowerCase()) diagnostics.differentEmail++;
        if (!entries['product-signature']) diagnostics.differentProduct++;
        if (!response.ok()) return;
        const credentials = credenciaisBI(response.url(), headers, email);
        if (credentials) finish(null, credentials);
      } catch { diagnostics.headerReadErrors++; }
    };
    finish = (error, value) => {
      if (finished) return;
      finished = true; clearTimeout(timer); context.off('response', listener); context.off('requestfailed', failed);
      if (error) reject(error); else resolve(value);
    };
    context.on('response', listener); context.on('requestfailed', failed);
  });
  promise.catch(() => {});
  return { promise, diagnostics, cancel: () => finish(new Error('Captura encerrada.')) };
}
export function fetchComProduto(credentials, fetcher = fetch, produtoInicial = 'bi-importacao') {
  // O endpoint de importação utiliza a assinatura original do cliente legado.
  // O header de uma resposta genérica do painel não comprova acesso ao ranking.
  let produto = produtoInicial;
  return async (url, options) => {
    if (new URL(url).origin !== ORIGIN) throw new Error('Origem BI inválida.');
    const headers = new Headers(options.headers);
    headers.set('product-signature', produto);
    const resposta = await fetcher(url, { ...options, headers });
    const capturado = credentials.productSignature;
    if (resposta.status !== 406 || produto !== 'bi-importacao' || !capturado || capturado === produto) return resposta;
    // Uma única comparação com o header já aceito pela sessão, sem alterar filtros.
    await resposta.body?.cancel().catch(() => {});
    const alternativos = new Headers(headers); alternativos.set('product-signature', capturado);
    const tentativa = await fetcher(url, { ...options, headers: alternativos });
    if (tentativa.ok) produto = capturado;
    return tentativa;
  };
}
export async function validarRankingSessao(api, data, faixa) {
  const ranking = await api.ranking(data, 1, faixa);
  if (!Array.isArray(ranking?.result?.[0]?.data)) throw new Error('Ranking da sessão salva inválido.');
  return ranking;
}
export function apiComPrimeiroRanking(api, ranking) {
  let disponivel = ranking !== undefined;
  return { ...api, ranking: async (...args) => {
    if (disponivel && args[1] === 1) { disponivel = false; return ranking; }
    return api.ranking(...args);
  } };
}
