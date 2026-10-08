export async function abrirShipment(page, timeoutMs) {
  const buttons = page.getByRole('button', { name: 'Acessar', exact: true });
  await buttons.first().waitFor({ state: 'visible', timeout: timeoutMs });
  const quantidade = await buttons.count();
  if (quantidade === 1) { await buttons.click({ timeout: timeoutMs }); return; }
  const candidatos = [];
  for (let i = 0; i < quantidade; i++) {
    const shipment = await buttons.nth(i).evaluate(button => {
      for (let parent = button.parentElement; parent; parent = parent.parentElement) {
        const acessos = Array.from(parent.querySelectorAll('button')).filter(b => b.textContent?.trim() === 'Acessar');
        if (acessos.length > 1) break;
        if (/Shipment\s+Intel/i.test(parent.textContent || '')) return true;
      }
      return false;
    });
    if (shipment) candidatos.push(i);
  }
  if (candidatos.length !== 1) throw Object.assign(new Error('Não foi possível identificar um único acesso ao Shipment Intel.'), { code: 'SHIPMENT_ACCESS_AMBIGUOUS' });
  await buttons.nth(candidatos[0]).click({ timeout: timeoutMs });
}
export function diagnosticoShipment(capture, error) {
  const d = capture?.diagnostics || {};
  const statuses = Object.fromEntries(Object.entries(d.statuses || {}).filter(([k, v]) => /^[1-5]\d{2}$/.test(k) && Number.isSafeInteger(v)));
  const codigo = error?.code === 'SHIPMENT_BI_TIMEOUT' ? 'sessao_bi_nao_capturada' : error?.code === 'SHIPMENT_ACCESS_AMBIGUOUS' ? 'acesso_ambiguo' : error?.name === 'TimeoutError' ? 'tempo_esgotado' : 'falha_captura';
  const numero = v => Number.isSafeInteger(v) && v >= 0 ? v : 0;
  return { codigo, respostasBI: numero(d.responses), statuses, semAuthorization: numero(d.missingAuthorization), semInfraKey: numero(d.missingInfraKey), produtoDiferente: numero(d.differentProduct), contaDiferente: numero(d.differentEmail), falhasRede: numero(d.failedRequests), falhasLeituraHeaders: numero(d.headerReadErrors) };
}
