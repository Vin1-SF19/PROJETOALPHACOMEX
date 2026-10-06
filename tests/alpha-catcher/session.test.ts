import { afterEach, describe, expect, it, vi } from 'vitest';
import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { criarCacheSessao, tentarSessaoSalva } from '../../scripts/alpha-catcher-session.mjs';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
async function fixture(extra = {}) {
  const dir = await mkdtemp(resolve(tmpdir(), 'catcher-session-test-')); dirs.push(dir);
  const env: NodeJS.ProcessEnv & { LOGCOMEX_SESSION_DIR: string } = { NODE_ENV: 'test', LOGCOMEX_SESSION_DIR: resolve(dir, 'sessions'), ...extra };
  const context = { storageState: vi.fn().mockResolvedValue({ cookies: [{ name: 'session', value: 'PRIVATE_COOKIE' }], origins: [] }), pages: () => [
    { url: () => 'https://plataforma.logcomex.io/dashboard', evaluate: vi.fn().mockResolvedValue({ token: 'PRIVATE_STORAGE' }) },
  ] };
  const cache = criarCacheSessao('account@example.test', { env, agora: () => 100000000 });
  return { dir: env.LOGCOMEX_SESSION_DIR, env, context, cache };
}

describe('sessão Logcomex reversível', () => {
  it('salva estado com IndexedDB, sessionStorage e permissões restritas', async () => {
    const { cache, context, dir } = await fixture();
    expect(await cache.salvar(context)).toBe(true);
    expect(context.storageState).toHaveBeenCalledWith({ indexedDB: true });
    const files = await readdir(dir); expect(files).toHaveLength(1);
    expect(files[0]).not.toContain('account');
    expect((await stat(resolve(dir, files[0]))).mode & 0o777).toBe(0o600);
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
    expect((await cache.carregar())?.sessionStorage).toEqual({ 'https://plataforma.logcomex.io': { token: 'PRIVATE_STORAGE' } });
    expect((await cache.carregar())?.entryUrl).toBe('https://plataforma.logcomex.io/dashboard');
  });
  it('outra conta não reutiliza a sessão', async () => {
    const { cache, context, env } = await fixture(); await cache.salvar(context);
    expect(await criarCacheSessao('different@example.test', { env }).carregar()).toBeNull();
  });
  it('sessão vencida retorna ao login completo', async () => {
    const { cache, context, env } = await fixture(); await cache.salvar(context);
    expect(await criarCacheSessao('account@example.test', { env, agora: () => 200000000 }).carregar()).toBeNull();
  });
  it('JSON corrompido e permissões abertas não são aceitos', async () => {
    const { cache, context, dir } = await fixture(); await cache.salvar(context);
    const file = resolve(dir, (await readdir(dir))[0]);
    await chmod(file, 0o644); expect(await cache.carregar()).toBeNull();
    await chmod(file, 0o600); await writeFile(file, '{'); expect(await cache.carregar()).toBeNull();
  });
  it('flag desativada não lê nem grava sessão', async () => {
    const { cache, context, dir } = await fixture({ LOGCOMEX_SESSION_REUSE: 'false' });
    expect(await cache.ativo()).toBe(false); expect(await cache.carregar()).toBeNull();
    expect(await cache.salvar(context)).toBe(false); expect(context.storageState).not.toHaveBeenCalled();
    await expect(stat(dir)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('marcador operacional desativa a sessão existente sem apagá-la', async () => {
    const { cache, context, dir } = await fixture(); await cache.salvar(context);
    const file = resolve(dir, (await readdir(dir))[0]); const before = await readFile(file, 'utf8');
    await writeFile(resolve(dir, 'disabled'), '', { mode: 0o600 });
    expect(await cache.carregar()).toBeNull(); expect(await cache.salvar(context)).toBe(false);
    expect(await readFile(file, 'utf8')).toBe(before);
    await rm(resolve(dir, 'disabled')); expect(await cache.carregar()).not.toBeNull();
  });
  it('falha de persistência não interrompe a importação nem deixa arquivo temporário', async () => {
    const { cache, context, dir } = await fixture(); await cache.salvar(context);
    context.storageState.mockRejectedValueOnce(new Error('PRIVATE_ERROR'));
    expect(await cache.salvar(context)).toBe(false);
    expect((await readdir(dir)).some(file => file.endsWith('.tmp'))).toBe(false);
  });
  it('restaura estado e retorna credenciais somente após validação BI', async () => {
    const { cache, context } = await fixture(); await cache.salvar(context);
    const page = {}; const restored = { addInitScript: vi.fn(), newPage: vi.fn().mockResolvedValue(page), close: vi.fn() };
    const browser = { newContext: vi.fn().mockResolvedValue(restored) };
    const validar = vi.fn().mockResolvedValue({ authorizationHeader: 'PRIVATE_BI' });
    expect(await tentarSessaoSalva({ browser, cache, validar })).toEqual({ page, credentials: { authorizationHeader: 'PRIVATE_BI' } });
    expect(validar).toHaveBeenCalledWith(page, 'https://plataforma.logcomex.io/dashboard'); expect(restored.close).not.toHaveBeenCalled();
    expect(restored.addInitScript).toHaveBeenCalled();
    const [init, states] = restored.addInitScript.mock.calls[0];
    const setItem = vi.fn();
    vi.stubGlobal('window', { location: { origin: 'https://other.example' }, sessionStorage: { setItem } });
    try {
      init(states); expect(setItem).not.toHaveBeenCalled();
      vi.stubGlobal('window', { location: { origin: 'https://plataforma.logcomex.io' }, sessionStorage: { setItem } });
      init(states); expect(setItem).toHaveBeenCalledWith('token', 'PRIVATE_STORAGE');
    } finally { vi.unstubAllGlobals(); }
  });
  it('falha de acesso BI fecha contexto, invalida cache e permite novo login', async () => {
    const { cache, context } = await fixture(); await cache.salvar(context);
    const restored = { addInitScript: vi.fn(), newPage: vi.fn().mockResolvedValue({}), close: vi.fn().mockResolvedValue(undefined) };
    const browser = { newContext: vi.fn().mockResolvedValue(restored) };
    expect(await tentarSessaoSalva({ browser, cache, validar: vi.fn().mockRejectedValue(new Error('Sessão expirada')) })).toBeNull();
    expect(restored.close).toHaveBeenCalledOnce(); expect(await cache.carregar()).toBeNull();
  });
  it('sem cache ou com reutilização desativada não abre contexto restaurado', async () => {
    const { cache } = await fixture(); const browser = { newContext: vi.fn() }; const validar = vi.fn();
    expect(await tentarSessaoSalva({ browser, cache, validar })).toBeNull();
    expect(browser.newContext).not.toHaveBeenCalled(); expect(validar).not.toHaveBeenCalled();
  });
  it('CLI disable e enable revertem o comportamento sem exibir sessão', async () => {
    const { cache, context, env } = await fixture(); await cache.salvar(context);
    const run = (action: string) => execFileSync(process.execPath, ['scripts/alpha-catcher-session.mjs', action], { env: { ...process.env, ...env }, encoding: 'utf8' });
    expect(run('disable')).toContain('desabilitada'); expect(await cache.carregar()).toBeNull();
    expect(run('enable')).toContain('habilitada'); expect(await cache.carregar()).not.toBeNull();
    expect(run('status')).not.toContain('PRIVATE_');
  });
});
