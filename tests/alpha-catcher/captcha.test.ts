import { describe, expect, it, vi } from 'vitest';
import { verificarCaptcha, aguardarCaptcha, criarSinalCaptcha, aguardarEtapaLogin } from '../../scripts/alpha-catcher-captcha.mjs';

describe('verificação de CAPTCHA Logcomex', () => {
  it.each([true, false])('interpreta somente booleano real: %s', async necessario => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ recaptchaRequired: necessario }));
    expect(await verificarCaptcha('conta@example.test', fetcher)).toBe(necessario);
    expect(fetcher).toHaveBeenCalledWith('https://apiauth.logcomex.io/api/check-recaptcha-required', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'conta@example.test' }) }));
  });
  it.each([429, 500, 403])('HTTP %s não é interpretado como liberação', async status => {
    await expect(verificarCaptcha('conta@example.test', vi.fn().mockResolvedValue(new Response('', { status })))).rejects.toThrow();
  });
  it('corpo inválido não confirma nem presume requisito', async () => {
    await expect(verificarCaptcha('conta@example.test', vi.fn().mockResolvedValue(Response.json({ recaptchaRequired: 'false' })))).rejects.toThrow();
  });
  it('continua automaticamente só quando o backend muda para false', async () => {
    let agora = 10000;
    const publicar = vi.fn(), verificar = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
    await aguardarCaptcha({ verificar, publicar, sinal: criarSinalCaptcha(), agora: () => agora, esperar: async ms => { agora += ms; } });
    expect(verificar).toHaveBeenCalledTimes(2); expect(publicar).toHaveBeenLastCalledWith('liberado');
    expect(publicar).toHaveBeenCalledWith('nao_confirmado');
  });
  it('clicar em confirmar não libera se o provedor ainda exige CAPTCHA', async () => {
    let agora = 10000;
    const sinal = criarSinalCaptcha(), publicar = vi.fn();
    await expect(aguardarCaptcha({ verificar: vi.fn().mockResolvedValue(true), publicar, sinal, agora: () => agora,
      timeoutMs: 1000, esperar: async ms => { agora += ms; sinal.solicitar(); } })).rejects.toThrow('CAPTCHA_WAIT_TIMEOUT');
    expect(publicar).not.toHaveBeenCalledWith('liberado');
  });
  it('reCAPTCHA observado no browser exige confirmação humana antes de novo login', async () => {
    let agora = 10000;
    const sinal = criarSinalCaptcha(), publicar = vi.fn();
    await aguardarCaptcha({ verificar: vi.fn().mockResolvedValue(false), publicar, sinal, exigirConfirmacao: true,
      agora: () => agora, esperar: async ms => { agora += ms; sinal.solicitar(); } });
    expect(publicar.mock.calls.map(c => c[0])).toEqual(['necessario', 'verificando', 'necessario', 'verificando', 'liberado']);
  });
  it('falha temporária mantém espera e nova checagem pode retomar', async () => {
    let agora = 10000;
    const publicar = vi.fn();
    await aguardarCaptcha({ verificar: vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(false), publicar,
      sinal: criarSinalCaptcha(), agora: () => agora, esperar: async ms => { agora += ms; } });
    expect(publicar).toHaveBeenCalledWith('erro'); expect(publicar).toHaveBeenLastCalledWith('liberado');
  });
  it('reconhece OTP sem exigir captcha pela simples presença de scripts', async () => {
    const page = { locator: vi.fn().mockReturnValue({ first: () => ({ isVisible: async () => true }) }) };
    expect(await aguardarEtapaLogin(page, 'otp', 1000)).toBe('otp');
  });
  it('detecta desafio visível na página de login', async () => {
    const page = { locator: (selector: string) => selector === 'otp'
      ? { first: () => ({ isVisible: async () => false }) }
      : { count: async () => 1, nth: () => ({ isVisible: async () => true }) } };
    expect(await aguardarEtapaLogin(page, 'otp', 1000)).toBe('captcha');
  });
});
