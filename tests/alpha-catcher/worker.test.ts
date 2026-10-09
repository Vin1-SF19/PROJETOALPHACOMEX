import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ permissoes: vi.fn(), executar: vi.fn() }));
vi.mock('@/lib/permissions/effective', () => ({ readEffectiveModulePermissions: mocks.permissoes }));
vi.mock('@/lib/alpha-catcher/worker-executar', () => ({ executarWorkerCatcher: mocks.executar }));
import { assinarWorkerCatcher, verificarWorkerCatcher } from '@/lib/alpha-catcher/worker-auth';
import { encaminharWorkerCatcher } from '@/lib/alpha-catcher/worker-client';
import { POST } from '@/app/api/internal/alpha-catcher/worker/route';
const secret = 'synthetic-test-key-not-a-real-secret-123456';
const body = JSON.stringify({ operacao: 'ler', userId: 42, dados: 'job-42' });
const req = (text = body, headers: Record<string, string> = assinarWorkerCatcher(text, secret)) => new Request('https://worker.test/api/internal/alpha-catcher/worker', { method:'POST',headers:{'Content-Type':'application/json',...headers},body:text });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VERCEL','');vi.stubEnv('ALPHA_CATCHER_WORKER_HOST','true');vi.stubEnv('ALPHA_CATCHER_WORKER_SECRET',secret);vi.stubEnv('ALPHA_CATCHER_WORKER_URL','');mocks.permissoes.mockResolvedValue(['alphaCatcher']);mocks.executar.mockResolvedValue(new Response(JSON.stringify({id:'job-42'}),{status:200})); });
afterEach(() => { vi.unstubAllEnvs();vi.unstubAllGlobals(); });
it('assina identidade/comando/corpo e rejeita adulteração, chave errada e replay', () => {
  const h = new Headers(assinarWorkerCatcher(body,secret));
  expect(verificarWorkerCatcher(body.replace('42','99'),h,secret)).toBe(false);
  expect(verificarWorkerCatcher(body,h,secret+'wrong')).toBe(false);
  expect(verificarWorkerCatcher(body,h,secret)).toBe(true);
  expect(verificarWorkerCatcher(body,h,secret)).toBe(false);
});
it('rejeita tickets vencidos, futuros e assinatura inválida sem lançar erro', () => {
  const now=Date.now();
  expect(verificarWorkerCatcher(body,new Headers(assinarWorkerCatcher(body,secret,now-46000)),secret,now)).toBe(false);
  expect(verificarWorkerCatcher(body,new Headers(assinarWorkerCatcher(body,secret,now+3000)),secret,now)).toBe(false);
  expect(verificarWorkerCatcher(body,new Headers({'x-catcher-assinatura':'short'}),secret)).toBe(false);
});
it('endpoint revalida acesso efetivo e usa somente identidade assinada', async () => {
  expect((await POST(req())).status).toBe(200);
  expect(mocks.permissoes).toHaveBeenCalledWith(42);
  expect(mocks.executar).toHaveBeenCalledWith('ler',42,'job-42');
  mocks.executar.mockClear();mocks.permissoes.mockResolvedValue(['radar']);
  expect((await POST(req())).status).toBe(403);expect(mocks.executar).not.toHaveBeenCalled();
});
it('sem chave válida, papel host, ou sob Vercel não executa operações', async () => {
  expect((await POST(req(body,{}))).status).toBe(401);
  vi.stubEnv('ALPHA_CATCHER_WORKER_HOST','false');expect((await POST(req())).status).toBe(404);
  vi.stubEnv('ALPHA_CATCHER_WORKER_HOST','true');vi.stubEnv('VERCEL','1');expect((await POST(req())).status).toBe(404);
  expect(mocks.executar).not.toHaveBeenCalled();
});
it('rejeita tamanho, operação e subject inválidos antes de executar', async () => {
  expect((await POST(req('X'.repeat(9000)))).status).toBe(413);
  expect((await POST(req(JSON.stringify({operacao:'desconhecida',userId:42,dados:null})))).status).toBe(400);
  expect((await POST(req(JSON.stringify({operacao:'ler',userId:-1,dados:'id'})))).status).toBe(400);
  expect(mocks.executar).not.toHaveBeenCalled();
});
it('Vercel não cai em subprocesso local quando não há configuração', async () => {
  vi.stubEnv('VERCEL','1');
  expect((await encaminharWorkerCatcher('ler',42,'id'))?.status).toBe(503);
  vi.stubEnv('VERCEL','');expect(await encaminharWorkerCatcher('ler',42,'id')).toBeNull();
});
it('proxy transmite corpo assinado, sem cookies, sem redirects e com timeout', async () => {
  vi.stubEnv('VERCEL','1');vi.stubEnv('ALPHA_CATCHER_WORKER_URL','https://worker.test');
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({id:'job-42',estado:'executando'}),{status:202}));vi.stubGlobal('fetch',fetcher);
  expect((await encaminharWorkerCatcher('iniciar',42,{data:'2026-09-28'}))?.status).toBe(202);
  const [url,options]=fetcher.mock.calls[0] as unknown as [URL,RequestInit];
  expect(url.href).toBe('https://worker.test/api/internal/alpha-catcher/worker');expect(options.redirect).toBe('error');expect(options.cache).toBe('no-store');
  const h=new Headers(options.headers);expect(h.has('cookie')).toBe(false);expect(h.has('authorization')).toBe(false);
  const raw=String(options.body);expect(JSON.parse(raw).userId).toBe(42);expect(verificarWorkerCatcher(raw,h,secret)).toBe(true);
});
it('configuração incorreta e worker indisponível retornam 503 sem logs/segredos', async () => {
  vi.stubEnv('VERCEL','1');vi.stubEnv('ALPHA_CATCHER_WORKER_URL','http://worker.test');
  const fetcher=vi.fn(async()=>{throw Error('private upstream token');});vi.stubGlobal('fetch',fetcher);
  expect((await encaminharWorkerCatcher('ler',42,'id'))?.status).toBe(503);expect(fetcher).not.toHaveBeenCalled();
  vi.stubEnv('ALPHA_CATCHER_WORKER_URL','https://worker.test');const result=await encaminharWorkerCatcher('ler',42,'id');
  expect(result?.status).toBe(503);expect(await result?.text()).not.toContain('private upstream token');
});
