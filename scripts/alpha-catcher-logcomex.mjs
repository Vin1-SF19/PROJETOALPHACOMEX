// Worker privado, iniciado por logcomex-job.ts. Não recebe credenciais pela UI.
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { criarCacheSessao, tentarSessaoSalva } from './alpha-catcher-session.mjs';
import { verificarCaptcha, aguardarCaptcha, criarSinalCaptcha, aguardarEtapaLogin } from './alpha-catcher-captcha.mjs';

const automacao = resolve(process.env.LOGCOMEX_AUTOMATION_DIR || '../API/automacao-logcomex');
const fork = resolve(process.env.LOGCOMEX_SHIPMENT_DIR || '../API/green-coast-ncm-lgcmx-integracao');
const importar = file => import(pathToFileURL(file).href);
const emitir = message => new Promise(resolveSend => {
  if (!process.connected) return resolveSend();
  process.send(message, () => resolveSend());
});
let browser;
let parando = false;
const sinalCaptcha = criarSinalCaptcha();
process.on('message', message => {
  if (message?.acao === 'confirmar_captcha' || message?.acao === 'tentar_captcha') sinalCaptcha.solicitar();
});
process.on('SIGTERM', async () => {
  parando = true;
  try { await browser?.close(); } finally { process.exit(0); }
});

process.once('message', async input => {
  try {
    try { await access(resolve(automacao, '.env')); process.loadEnvFile(resolve(automacao, '.env')); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const config = JSON.parse(await readFile(resolve(automacao, 'config.json'), 'utf8'));
    const login = new URL(config.loginUrl);
    if (login.origin !== 'https://plataforma.logcomex.io' || login.username || login.password) throw new Error('Login inválido');
    if (!config.gmailAccount || !config.sender || !config.recipient || !config.subject || !config.otpSelector || !config.successSelector ||
      !Number.isFinite(config.timeoutSeconds) || config.timeoutSeconds < 15 || config.timeoutSeconds > 540) throw new Error('Configuração inválida');
    const email = process.env.LOGCOMEX_EMAIL, password = process.env.LOGCOMEX_PASSWORD;
    if (!email || !password) throw new Error('Login não configurado');
    const { chromium } = await importar(resolve(automacao, 'node_modules/playwright/index.mjs'));
    const { connectGmail } = await importar(resolve(automacao, 'src/gmail.js'));
    const { waitForCode } = await importar(resolve(automacao, 'src/otp.js'));
    // A pasta original referencia logcomex-diagnostico inexistente em API/.
    // O fork já contém o coletor Shipment compatível e a captura de sessão BI.
    const { captureBiSession } = await importar(resolve(fork, 'automacao-logcomex/src/download.js'));
    const { cliente, coletar, periodo } = await importar(resolve(fork, 'logcomex-diagnostico/src/logcomex.ts'));
    periodo(input.data);
    browser = await chromium.launch({ headless: true });
    const cache = criarCacheSessao(email);
    const capturar = async (page, timeoutMs = 90000) => {
      await emitir({ type: 'etapa', etapa: 'shipment' });
      const capture = captureBiSession(page.context(), email, timeoutMs);
      try {
        await page.getByRole('button', { name: 'Acessar', exact: true }).click({ timeout: timeoutMs });
        return await capture.promise;
      } finally { capture.cancel(); }
    };
    const loginCompleto = async () => {
      await emitir({ type: 'etapa', etapa: 'gmail' });
      const gmail = await connectGmail(config.gmailAccount);
      if (parando) return;
      const checar = () => verificarCaptcha(email);
      const publicar = estado => emitir({ type: 'captcha', estado });
      await emitir({ type: 'etapa', etapa: 'captcha_check' });
      let requisito;
      try { requisito = await checar(); } catch {
        await publicar('erro');
        await aguardarCaptcha({ verificar: checar, publicar, sinal: sinalCaptcha, estadoInicial: 'erro' });
        requisito = false;
      }
      if (requisito) await aguardarCaptcha({ verificar: checar, publicar, sinal: sinalCaptcha });
      let page;
      let startedAt;
      for (;;) {
        const context = await browser.newContext();
        page = await context.newPage();
        await emitir({ type: 'etapa', etapa: 'login' });
        await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        if (new URL(page.url()).origin !== login.origin) throw new Error('Domínio inesperado');
        await page.getByLabel('E-mail', { exact: true }).fill(email);
        await page.getByLabel('Senha', { exact: true }).fill(password);
        startedAt = Date.now();
        await page.getByRole('button', { name: 'ENTRAR', exact: true }).click();
        const etapa = await aguardarEtapaLogin(page, config.otpSelector, config.timeoutSeconds * 1000);
        if (etapa === 'otp') break;
        // Fechar o contexto pendente antes de reiniciar um login após confirmação.
        await context.close();
        await aguardarCaptcha({ verificar: checar, publicar, sinal: sinalCaptcha, exigirConfirmacao: true });
      }
      await emitir({ type: 'etapa', etapa: 'otp' });
      const code = await waitForCode(gmail, config, startedAt);
      if (new URL(page.url()).origin !== login.origin) throw new Error('Domínio inesperado');
      const fields = page.locator(config.otpSelector);
      const count = await fields.count();
      if (count === 1) await fields.fill(code);
      else if (count === code.length) for (let i = 0; i < count; i++) await fields.nth(i).fill(code[i]);
      else throw new Error('Campos de código inesperados');
      if (!config.otpAutoSubmit) {
        if (!config.otpSubmitSelector) throw new Error('Confirmação não configurada');
        await page.locator(config.otpSubmitSelector).click();
      }
      await page.locator(config.successSelector).waitFor({ state: 'visible', timeout: 60000 });
      return page;
    };
    // Só dispensa Gmail/OTP depois de confirmar acesso real ao Shipment Intel.
    const restored = await tentarSessaoSalva({ browser, cache, validar: async (page, entryUrl) => {
      await emitir({ type: 'etapa', etapa: 'login' });
      await page.goto(entryUrl || config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (new URL(page.url()).origin !== login.origin) throw new Error('Domínio inesperado');
      await page.locator(config.successSelector).waitFor({ state: 'visible', timeout: 15000 });
      return capturar(page, 20000);
    } });
    if (parando) return;
    const page = restored?.page || await loginCompleto();
    if (parando || !page) return;
    const credentials = restored?.credentials || await capturar(page);
    await cache.salvar(page.context());
    await emitir({ type: 'etapa', etapa: 'coleta' });
    const resumir = result => ({ empresas: result.empresas.map(row => ({ cnpj: row.cnpj, consignatario: row.consignatario })) });
    const result = await coletar({
      api: cliente(credentials), dataFinal: input.data, limite: input.limite, faixa: [1, 2],
      salvar: async parcial => emitir({ type: 'parcial', resultado: resumir(parcial) }), progresso: () => {},
    });
    await emitir({ type: 'resultado', completo: result.status === 'concluido' && result.detalhesCompletos === true,
      resultado: resumir(result) });
  } catch {
    await emitir({ type: 'erro' });
  } finally {
    await browser?.close().catch(() => {});
    if (process.connected) process.disconnect();
  }
});
