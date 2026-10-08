// Diagnóstico somente leitura: sessão existente e ranking, sem login/Gmail ou importação.
import { readFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { criarCacheSessao, tentarSessaoSalva } from './alpha-catcher-session.mjs';
import { capturarSessaoBI } from './alpha-catcher-bi.mjs';
import { abrirShipment, diagnosticoShipment } from './alpha-catcher-shipment.mjs';
import { compararRanking } from './alpha-catcher-ranking-probe.mjs';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
const release = '/home/ialpha/deployments/painel-alpha-stage/current';
for (const file of ['.env', '.env.local']) {
  try { process.loadEnvFile(resolve(release, file)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
const automacao = resolve(process.env.LOGCOMEX_AUTOMATION_DIR || '../API/automacao-logcomex');
const fork = resolve(process.env.LOGCOMEX_SHIPMENT_DIR || '../API/green-coast-ncm-lgcmx-integracao');
try { process.loadEnvFile(resolve(automacao, '.env')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const importar = file => import(pathToFileURL(file).href);
const config = JSON.parse(await readFile(resolve(automacao, 'config.json'), 'utf8'));
const email = process.env.LOGCOMEX_EMAIL;
if (!email) throw new Error('Conta Logcomex não configurada.');
const { chromium } = await importar(resolve(automacao, 'node_modules/playwright/index.mjs'));
const { cliente } = await importar(resolve(fork, 'logcomex-diagnostico/src/logcomex.ts'));
const { dataMaximaColeta, janelaMeses, coletaSchema } = await importar(resolve(release, 'src/lib/alpha-catcher/logcomex-input.ts'));
const periodo = process.argv[2] && process.argv[3] ? { dataInicio: process.argv[2], dataFinal: process.argv[3] } : janelaMeses(dataMaximaColeta(), 3);
const min = Number(process.argv[4] ?? 1), max = Number(process.argv[5] ?? 2);
if (!coletaSchema.safeParse({ data: periodo.dataFinal, ...periodo, embarquesMin: min, embarquesMax: max, limite: 1 }).success) throw new Error('Período ou faixa de embarques inválidos.');
const permitirLogin = process.argv.includes('--login');
const browser = await chromium.launch({ headless: true });
try {
  const cache = criarCacheSessao(email);
  console.log('Reutilização habilitada:', await cache.ativo(), 'Cache legível e vigente:', Boolean(await cache.carregar()));
  let etapa = 'restauração do contexto';
  const restored = await tentarSessaoSalva({ browser, cache: { ...cache, invalidar: async () => {} }, validar: async (page, entryUrl) => {
    etapa = 'abertura do painel';
    await page.goto(entryUrl || config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (new URL(page.url()).origin !== 'https://plataforma.logcomex.io') throw new Error('Domínio inesperado.');
    etapa = 'validação do menu autenticado';
    await page.locator(config.successSelector).waitFor({ state: 'visible', timeout: 15000 });
    etapa = 'captura da sessão BI';
    const capture = capturarSessaoBI(page.context(), email, 20000);
    try { await abrirShipment(page, 20000); return await capture.promise; }
    catch (error) { console.log('Diagnóstico Shipment:', JSON.stringify(diagnosticoShipment(capture, error))); throw error; }
    finally { capture.cancel(); }
  } });
  if (!restored) {
    console.log('Não foi possível restaurar a sessão existente. Etapa:', etapa);
    if (!permitirLogin) { console.log('Use --login para testar com o login automático do Catcher.'); process.exitCode = 2; }
    else {
      await browser.close();
      console.log('Iniciando diagnóstico pelo login do Catcher; não importa empresas.');
      const input = { data: periodo.dataFinal, ...periodo, embarquesMin: min, embarquesMax: max, limite: 1, diagnostico: true };
      const lock = resolve(tmpdir(), 'painel-alpha-logcomex-login.lock');
      try { await mkdir(lock); } catch { throw new Error('Outra importação está ativa ou existe um lock pendente.'); }
      try {
      const child = spawn(process.execPath, ['--import', resolve(release, 'node_modules/tsx/dist/loader.mjs'), resolve(import.meta.dirname, 'alpha-catcher-logcomex.mjs')], {
        cwd: release, env: { ...process.env, ALPHA_CATCHER_DIAGNOSTIC: '1' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      await new Promise((resolveChild, reject) => {
        let finalizado = false;
        let aguardandoCaptcha = false;
        const terminal = createInterface({ input: process.stdin, output: process.stdout });
        terminal.on('line', () => {
          if (!aguardandoCaptcha || !child.connected) return;
          console.log('Solicitando confirmação do CAPTCHA à Logcomex…');
          child.send({ acao: 'confirmar_captcha' });
        });
        const interromper = () => child.kill('SIGTERM');
        process.once('SIGINT', interromper); process.once('SIGTERM', interromper);
        const timer = setTimeout(() => { child.kill('SIGTERM'); process.exitCode = 2; }, 30 * 60 * 1000);
        child.on('message', message => {
          if (message?.type === 'diagnostico_ranking') { console.log(JSON.stringify(message.resultado)); if (message.resultado?.caso) finalizado = true; }
          else if (message?.type === 'diagnostico_shipment') console.log('Diagnóstico Shipment:', JSON.stringify(message.resultado));
          else if (message?.type === 'diagnostico_falha') console.log('Código da falha:', message.codigo, 'Tipo:', message.tipo);
          else if (message?.type === 'etapa') console.log('Etapa:', message.etapa);
          else if (message?.type === 'captcha') {
            aguardandoCaptcha = message.estado !== 'liberado';
            console.log('CAPTCHA:', message.estado);
            if (['necessario', 'nao_confirmado', 'erro'].includes(message.estado)) console.log('Resolva em https://plataforma.logcomex.io/signIn/ usando a conta da automação; depois pressione Enter neste terminal.');
          }
          else if (message?.type === 'erro') { console.log('Falha antes de concluir o diagnóstico do ranking.'); process.exitCode = 2; }
        });
        child.once('error', error => { terminal.close(); clearTimeout(timer); reject(error); });
        child.once('close', () => { terminal.close(); process.off('SIGINT', interromper); process.off('SIGTERM', interromper); clearTimeout(timer); if (!finalizado) process.exitCode = 2; resolveChild(); });
        child.send(input);
      });
      } finally { await rm(lock, { recursive: true, force: true }); }
    }
  }
  else {
    await compararRanking({ credentials: restored.credentials, cliente, periodo, min, max, janelaMeses });
  }
} finally { await browser.close().catch(() => {}); }
