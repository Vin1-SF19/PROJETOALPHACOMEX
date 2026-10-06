// Helpers testáveis sem acessar a conta real ou controlar um navegador.
export async function verificarCaptcha(email, fetcher = fetch) {
  const response = await fetcher('https://apiauth.logcomex.io/api/check-recaptcha-required', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('CAPTCHA_CHECK_UNAVAILABLE');
  const data = await response.json();
  if (typeof data?.recaptchaRequired !== 'boolean') throw new Error('CAPTCHA_CHECK_INVALID');
  return data.recaptchaRequired;
}

export function criarSinalCaptcha() {
  let pedidos = 0;
  return { solicitar: () => { pedidos++; }, quantidade: () => pedidos };
}

export async function aguardarCaptcha({ verificar, publicar, sinal, exigirConfirmacao = false, estadoInicial = 'necessario',
  agora = Date.now, esperar = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 15 * 60 * 1000 }) {
  const inicio = agora();
  const pedidosIniciais = sinal.quantidade();
  let ultima = 0;
  let checados = pedidosIniciais;
  await publicar(estadoInicial);
  while (agora() - inicio < timeoutMs) {
    const pedidos = sinal.quantidade();
    if (pedidos !== checados || agora() - ultima >= 8000) {
      checados = pedidos; ultima = agora();
      await publicar('verificando');
      try {
        const necessario = await verificar();
        // Se o browser efetivamente exibiu o desafio apesar do requisito false,
        // pedir confirmação humana antes de tentar outro login, evitando loop.
        if (!necessario && (!exigirConfirmacao || pedidos > pedidosIniciais)) {
          await publicar('liberado'); return;
        }
        await publicar(necessario ? 'nao_confirmado' : 'necessario');
      } catch { await publicar('erro'); }
    }
    await esperar(250);
  }
  throw new Error('CAPTCHA_WAIT_TIMEOUT');
}

export async function aguardarEtapaLogin(page, otpSelector, timeoutMs, { agora = Date.now,
  esperar = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const inicio = agora();
  while (agora() - inicio < timeoutMs) {
    if (await page.locator(otpSelector).first().isVisible()) return 'otp';
    // Uma textarea escondida ou o script reCAPTCHA sozinho não comprovam desafio.
    const desafios = page.locator('iframe[src*="recaptcha"][src*="bframe"], iframe[title*="challenge"], iframe[title*="desafio"]');
    for (let i = 0; i < await desafios.count(); i++) if (await desafios.nth(i).isVisible()) return 'captcha';
    const checkbox = page.locator('iframe[src*="recaptcha"][src*="anchor"]');
    for (let i = 0; i < await checkbox.count(); i++) if (await checkbox.nth(i).isVisible()) return 'captcha';
    await esperar(250);
  }
  throw new Error('LOGIN_STEP_TIMEOUT');
}
