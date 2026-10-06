import { createHash, randomUUID } from 'node:crypto';
import { access, chmod, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function diretorioSessoes(env = process.env) {
  return resolve(env.LOGCOMEX_SESSION_DIR || resolve(env.LOGCOMEX_SECRETS_DIR ||
    resolve(env.LOCALAPPDATA || homedir(), 'LogcomexAutomation'), 'alpha-catcher-sessions'));
}

export function criarCacheSessao(email, { env = process.env, agora = Date.now } = {}) {
  const dir = diretorioSessoes(env);
  const conta = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  const file = resolve(dir, `${conta}.json`);
  const ativo = async () => {
    if (/^(false|0|off)$/i.test(env.LOGCOMEX_SESSION_REUSE || '')) return false;
    try { await access(resolve(dir, 'disabled')); return false; }
    catch (error) { return error.code === 'ENOENT'; }
  };
  return {
    ativo,
    async carregar() {
      if (!await ativo()) return null;
      try {
        const stat = await lstat(file);
        if (!stat.isFile() || (stat.mode & 0o077) || stat.size > 10 * 1024 * 1024) return null;
        const data = JSON.parse(await readFile(file, 'utf8'));
        const idade = agora() - data.salvoEm;
        if (data.versao !== 1 || data.conta !== conta || !Number.isFinite(idade) || idade < 0 || idade > 86400000 ||
          !Array.isArray(data.storageState?.cookies) || !Array.isArray(data.storageState?.origins) ||
          !data.sessionStorage || typeof data.sessionStorage !== 'object' || Array.isArray(data.sessionStorage)) return null;
        if (data.entryUrl && new URL(data.entryUrl).origin !== 'https://plataforma.logcomex.io') return null;
        return data;
      } catch { return null; }
    },
    async salvar(context) {
      if (!await ativo()) return false;
      let temp;
      try {
        const storageState = await context.storageState({ indexedDB: true });
        const sessionStorage = {};
        let entryUrl;
        for (const page of context.pages()) {
          try {
            const url = new URL(page.url());
            if (url.protocol !== 'https:' || !(url.hostname === 'logcomex.io' || url.hostname.endsWith('.logcomex.io'))) continue;
            if (url.origin === 'https://plataforma.logcomex.io' && !/signIn|2FactAuth/i.test(url.pathname)) entryUrl ||= url.origin + url.pathname;
            sessionStorage[url.origin] = await page.evaluate(() => Object.fromEntries(
              Array.from({ length: window.sessionStorage.length }, (_, i) => {
                const key = window.sessionStorage.key(i); return [key, window.sessionStorage.getItem(key)];
              }),
            ));
          } catch { /* Uma aba fechada não impede salvar cookies/localStorage. */ }
        }
        await mkdir(dir, { recursive: true, mode: 0o700 });
        await chmod(dir, 0o700);
        temp = resolve(dir, `.${randomUUID()}.tmp`);
        await writeFile(temp, JSON.stringify({ versao: 1, conta, salvoEm: agora(), storageState, sessionStorage, entryUrl }), { flag: 'wx', mode: 0o600 });
        await rename(temp, file);
        return true;
      } catch {
        if (temp) await rm(temp, { force: true }).catch(() => {});
        return false; // Falha de cache nunca interrompe a importação.
      }
    },
    async invalidar() { await rm(file, { force: true }).catch(() => {}); },
  };
}

export async function tentarSessaoSalva({ browser, cache, validar }) {
  const saved = await cache.carregar();
  if (!saved) return null;
  let context;
  try {
    context = await browser.newContext({ storageState: saved.storageState });
    await context.addInitScript(states => {
      const values = states[window.location.origin];
      if (values && typeof values === 'object') {
        for (const [key, value] of Object.entries(values)) {
          if (typeof value === 'string') window.sessionStorage.setItem(key, value);
        }
      }
    }, saved.sessionStorage);
    const page = await context.newPage();
    const credentials = await validar(page, saved.entryUrl);
    if (!credentials) throw new Error('Sessão não validada');
    return { page, credentials };
  } catch {
    await context?.close().catch(() => {});
    await cache.invalidar();
    return null;
  }
}

// Controle operacional: não lê nem imprime cookies ou tokens.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const action = process.argv[2] || 'status';
  if (!['status', 'enable', 'disable'].includes(action)) throw new Error('Use status, enable ou disable.');
  const dir = diretorioSessoes();
  const marker = resolve(dir, 'disabled');
  if (action === 'disable') {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(marker, '', { mode: 0o600 });
  } else if (action === 'enable') await rm(marker, { force: true });
  console.log(await criarCacheSessao('status').ativo() ? 'Reutilização de sessão habilitada.' : 'Reutilização de sessão desabilitada; login completo a cada importação.');
}
