// Worker privado, iniciado por logcomex-job.ts. Não recebe credenciais pela UI.
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { capturarSessaoBI, fetchComProduto, validarRankingSessao, apiComPrimeiroRanking } from './alpha-catcher-bi.mjs';
import { abrirShipment, diagnosticoShipment } from './alpha-catcher-shipment.mjs';
import { coletarProgressivo } from './alpha-catcher-stream.mjs';
import { diagnosticoColeta } from './alpha-catcher-diagnostic.mjs';
import { fetchComPeriodo } from './alpha-catcher-filters.mjs';
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
    const { cliente, coletar, periodo } = await importar(resolve(fork, 'logcomex-diagnostico/src/logcomex.ts'));
    const intervalo = input.dataInicio && input.dataFinal ? { dataInicio: input.dataInicio, dataFinal: input.dataFinal } : periodo(input.data);
    browser = await chromium.launch({ headless: true });
    const cache = criarCacheSessao(email);
    const capturar = async (page, timeoutMs = 90000) => {
      await emitir({ type: 'etapa', etapa: 'shipment' });
      const capture = capturarSessaoBI(page.context(), email, timeoutMs);
      try {
        await abrirShipment(page, timeoutMs);
        return await capture.promise;
      } catch (error) {
        if (process.env.ALPHA_CATCHER_DIAGNOSTIC === '1') await emitir({ type: 'diagnostico_shipment', resultado: diagnosticoShipment(capture, error) });
        throw error;
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
    let apiValidada;
    let rankingInicial;
    const criarApi = credentials => cliente({ ...credentials, fetcher: fetchComPeriodo(intervalo, fetchComProduto(credentials)) });
    const restored = await tentarSessaoSalva({ browser, cache, validar: async (page, entryUrl) => {
      await emitir({ type: 'etapa', etapa: 'login' });
      await page.goto(entryUrl || config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (new URL(page.url()).origin !== login.origin) throw new Error('Domínio inesperado');
      await page.locator(config.successSelector).waitFor({ state: 'visible', timeout: 15000 });
      const credentials = await capturar(page, 20000);
      const api = criarApi(credentials);
      rankingInicial = await validarRankingSessao(api, input.data, [input.embarquesMin ?? 1, input.embarquesMax ?? 2]);
      apiValidada = api;
      return credentials;
    } });
    if (parando) return;
    const page = restored?.page || await loginCompleto();
    if (parando || !page) return;
    const credentials = restored?.credentials || await capturar(page);
    await cache.salvar(page.context());
    if (input.diagnostico === true && process.env.ALPHA_CATCHER_DIAGNOSTIC === '1') {
      await emitir({ type: 'etapa', etapa: 'preparando_diagnostico' });
      const { compararRanking } = await import('./alpha-catcher-ranking-probe.mjs');
      const { janelaMeses } = await import('../src/lib/alpha-catcher/logcomex-input.ts');
      await compararRanking({ credentials, cliente, periodo: intervalo, min: input.embarquesMin ?? 1, max: input.embarquesMax ?? 2, janelaMeses,
        publicar: resultado => emitir({ type: 'diagnostico_ranking', resultado }) });
      return;
    }
    await emitir({ type: 'etapa', etapa: 'coleta' });
    const resumir = result => ({ empresas: result.empresas.map(row => ({ cnpj: row.cnpj, consignatario: row.consignatario })) });
    const result = await coletarProgressivo({
      coletar, emitir,
      api: apiComPrimeiroRanking(apiValidada || criarApi(credentials), rankingInicial), data: input.data, limite: (input.limite ?? 0) === 0 ? Infinity : input.limite, faixa: [input.embarquesMin ?? 1, input.embarquesMax ?? 2],
      salvar: async parcial => { parcial.periodo = intervalo; await emitir({ type: 'parcial', resultado: resumir(parcial) }); },
    });
    await emitir({ type: 'resultado', completo: result.status === 'concluido' && result.detalhesCompletos === true,
      resultado: resumir(result), diagnostico: diagnosticoColeta(result) });
  } catch (error) {
    if (process.env.ALPHA_CATCHER_DIAGNOSTIC === '1') await emitir({ type: 'diagnostico_falha', codigo: typeof error?.code === 'string' && /^[A-Z_]{1,80}$/.test(error.code) ? error.code : 'FALHA_SEM_CODIGO', tipo: error?.name === 'TimeoutError' ? 'timeout' : 'outro' });
    await emitir({ type: 'erro' });
  } finally {
    await browser?.close().catch(() => {});
    if (process.connected) process.disconnect();
  }
});
