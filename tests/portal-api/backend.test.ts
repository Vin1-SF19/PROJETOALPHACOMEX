import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { hash, compare } from 'bcryptjs';
import { SignJWT } from 'jose';
import { criarFixtureChecklist } from '../checklist-analistas/sqlite-fixture';
import { PRINCIPAL_TTL_SECONDS, novaSenhaPortalSchema } from '../../contracts/portal-api/v1';
const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient, failCas: false, objects: new Map<string, {
        bytes: Uint8Array;
        mime: string;
    }>(), putHook: undefined as undefined | (() => Promise<void>) }));
vi.mock('@/lib/prisma', () => ({ get default() { return state.failCas ? state.db.$extends({ query: { operacionalClientes: { updateMany: async () => ({ count: 0 }) } } }) : state.db; } }));
vi.mock('../../auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/checklist/storage', async () => {
    const actual = await vi.importActual<typeof import('@/lib/checklist/storage')>('@/lib/checklist/storage');
    return { ...actual, storageDriver: () => ({ async put(key: string, bytes: Uint8Array, mime: string) { state.objects.set(key, { bytes, mime }); await state.putHook?.(); }, async get(key: string) {
                const v = state.objects.get(key);
                if (!v)
                    throw new Error('Missing fixture object');
                return { body: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(v.bytes); c.close(); } }), size: v.bytes.length, mime: v.mime };
            } }) };
});
let fixture: Awaited<ReturnType<typeof criarFixtureChecklist>>;
let auth: typeof import('@/lib/portal-api/auth');
let identity: typeof import('@/lib/portal-api/identity');
let credentials: typeof import('@/lib/portal-api/credentials');
let profile: typeof import('@/lib/portal-api/profile');
let http: typeof import('@/lib/portal-api/http');
const appKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', signKey = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBA';
function request(path = '/identity/me', token?: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', extra: Record<string, string> = {}) {
    return new Request('http://localhost:4391/api/portal/v1' + path, { method, headers: { 'X-Portal-App-Id': 'painelclientes', 'X-Portal-App-Key-Id': 'test-app', 'X-Portal-App-Key': appKey, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function account(senha = 'ExternalPassword_123', senhaHash: string | null = null) { return state.db.clienteOperacional.create({ data: { nome: 'Synthetic', email: randomUUID() + '@example.invalid', senha, senhaHash } }); }
async function principal(row: Awaited<ReturnType<typeof account>>) { return (await auth.issuePrincipal(row)).principalToken; }
async function forged(sub: string, overrides: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ iss: 'urn:alpha-comex:portal-api:local', aud: 'urn:alpha-comex:portal:local', sub, sv: 0, azp: 'painelclientes', env: 'local', iat: now, exp: now + 604800, jti: randomUUID(), ...overrides }).setProtectedHeader({ alg: 'HS256', typ: 'portal-principal+jwt', kid: 'test-sign', ...header }).sign(Buffer.from(signKey, 'base64url'));
}
beforeAll(async () => {
    vi.stubEnv('PORTAL_API_ENVIRONMENT', 'local');
    vi.stubEnv('PORTAL_WEB_ORIGIN', 'http://localhost:4392');
    vi.stubEnv('PORTAL_API_APP_KEYS_JSON', JSON.stringify([{ kid: 'test-app', appId: 'painelclientes', environment: 'local', key: appKey }]));
    vi.stubEnv('PORTAL_API_PRINCIPAL_KEYS_JSON', JSON.stringify({ activeKid: 'test-sign', keys: [{ kid: 'test-sign', secret: signKey }] }));
    vi.stubEnv('AUTH_RATE_LIMIT_SECRET', 'local-synthetic-rate-limit-secret-only-123');
    vi.stubEnv('CHECKLIST_PRIVATE_BLOB_TOKEN', 'synthetic-private-token-never-real');
    vi.stubEnv('CHECKLIST_STORAGE_PREFIX', 'synthetic/checklist/');
    vi.stubEnv('CHECKLIST_LEGACY_ALLOWED_HOSTS', '["legacy.example.invalid"]');
    fixture = await criarFixtureChecklist();
    state.db = fixture.db;
    auth = await import('@/lib/portal-api/auth');
    identity = await import('@/lib/portal-api/identity');
    credentials = await import('@/lib/portal-api/credentials');
    profile = await import('@/lib/portal-api/profile');
    http = await import('@/lib/portal-api/http');
}, 30000);
afterAll(async () => { await fixture?.close(); vi.unstubAllEnvs(); });
it('app/cookie/accountId alone never prove a user, bad config is API-local 503 before DB', async () => {
    const row = await account(), token = await principal(row);
    await expect(auth.verifyPrincipal(request('/identity/me'))).rejects.toMatchObject({ status: 401 });
    await expect(auth.verifyPrincipal(request('/identity/me', undefined, undefined, 'GET', { Cookie: 'alpha-session=staff', 'X-User-Id': row.id }))).rejects.toMatchObject({ status: 401 });
    await expect(auth.verifyPrincipal(request('/identity/me', token, undefined, 'GET', { 'X-Portal-App-Key': 'wrong' }))).rejects.toMatchObject({ status: 401 });
    const valid = await auth.verifyPrincipal(request('/identity/me', token));
    expect(valid.actor).toEqual({ kind: 'PORTAL', id: row.id, sessionVersion: 0 });
    expect(new Date(valid.expiresAt).getTime() - Math.floor(Date.now() / 1000) * 1000).toBeLessThanOrEqual(PRINCIPAL_TTL_SECONDS * 1000);
    vi.stubEnv('PORTAL_API_APP_KEYS_JSON', '');
    const response = await http.route('me', 'P', async () => { throw new Error('should not run'); })(request('/identity/me', token));
    expect(response.status).toBe(503);
    vi.stubEnv('PORTAL_API_APP_KEYS_JSON', JSON.stringify([{ kid: 'test-app', appId: 'painelclientes', environment: 'local', key: appKey }]));
});
it('strict principal claims reject wrong issuer/audience/algorithm/types/lifetime/header and revoked/deleted accounts', async () => {
    const row = await account();
    const now = Math.floor(Date.now() / 1000);
    for (const claims of [{ iss: 'bad' }, { aud: ['urn:alpha-comex:portal:local'] }, { env: 'staging' }, { azp: 'staff' }, { sub: '' }, { sv: -1 }, { sv: '0' }, { jti: 'not-a-uuid' }, { iat: now + 60, exp: now + 60 + 604800 }, { exp: now - 1, iat: now - 604801 }, { exp: now + 100 }, { role: 'ADMIN' }])
        await expect(auth.verifyPrincipal(request('/identity/me', await forged(row.id, claims)))).rejects.toMatchObject({ status: 401 });
    for (const header of [{ jku: 'https://evil.invalid' }, { kid: 'unknown' }, { typ: 'JWT' }])
        await expect(auth.verifyPrincipal(request('/identity/me', await forged(row.id, {}, header)))).rejects.toMatchObject({ status: 401 });
    const token = await principal(row);
    const segments = token.split('.');
    segments[0] = Buffer.from(JSON.stringify({ alg: 'none', typ: 'portal-principal+jwt', kid: 'test-sign' })).toString('base64url');
    await expect(auth.verifyPrincipal(request('/identity/me', segments.join('.')))).rejects.toMatchObject({ status: 401 });
    await state.db.clienteOperacional.update({ where: { id: row.id }, data: { authSessionVersion: { increment: 1 } } });
    await expect(auth.verifyPrincipal(request('/identity/me', token))).rejects.toMatchObject({ status: 401 });
    await expect(auth.verifyPrincipal(request('/identity/me', await forged('missing-account')))).rejects.toMatchObject({ status: 401 });
});
it('real bcrypt Unicode boundary, long exact legacy, hash-first and concurrent CAS upgrades', async () => {
    for (const password of ['a'.repeat(73), 'é'.repeat(37), '😀'.repeat(19), 'x'.repeat(150)]) {
        const row = await account(password);
        expect(await credentials.verificarSenha(row, password)).toBe(true);
        expect(await credentials.verificarSenha(row, password.slice(0, -1))).toBe(false);
        expect((await state.db.clienteOperacional.findUniqueOrThrow({ where: { id: row.id } })).senhaHash).toBeNull();
    }
    for (const password of ['a'.repeat(72), 'é'.repeat(36), '😀'.repeat(18)]) {
        const row = await account(password);
        expect(novaSenhaPortalSchema.safeParse(password).success).toBe(true);
        const result = await Promise.all([credentials.verificarSenha(row, password), credentials.verificarSenha(row, password)]);
        expect(result).toEqual([true, true]);
        const current = await state.db.clienteOperacional.findUniqueOrThrow({ where: { id: row.id } });
        expect(current.senha).toBe('');
        expect(current.senhaHash).toMatch(/^\$2[aby]\$12\$/);
        expect(await compare(password, current.senhaHash!)).toBe(true);
        expect(await credentials.verificarSenha(current, password + 'Z')).toBe(false);
    }
    for (const presentHash of ['', 'invalid-hash'])
        expect(await credentials.verificarSenha(await account('PlaintextMatches', presentHash), 'PlaintextMatches')).toBe(false);
}, 15000);
it('login over100 characters remains exact; no IP body spoof; rate limit real buckets', async () => {
    const row = await account('x'.repeat(150));
    const result = await identity.login(request('/identity/login'), { email: row.email.toUpperCase(), senha: 'x'.repeat(150) });
    expect(result.identity.id).toBe(row.id);
    expect(result).not.toHaveProperty('senha');
    await expect(identity.login(request('/identity/login'), { email: row.email, senha: 'x'.repeat(149) })).rejects.toMatchObject({ status: 401 });
    const absent = randomUUID() + '@example.invalid';
    for (let i = 0; i < 5; i++)
        await expect(identity.login(request('/identity/login', undefined, undefined, 'GET', { 'X-Portal-Client-IP': '127.0.0.1' }), { email: absent, senha: 'bad' })).rejects.toMatchObject({ status: 401 });
    await expect(identity.login(request('/identity/login', undefined, undefined, 'GET', { 'X-Portal-Client-IP': '127.0.0.1' }), { email: absent, senha: 'bad' })).rejects.toMatchObject({ status: 429 });
    expect(auth.clientAddress(request('/identity/login', undefined, undefined, 'GET', { 'X-Portal-Client-IP': 'spoofed' }))).toBe('unavailable');
});
it('reset expiry, race/single-use, password CAS on principal version and profile normalization/unique', async () => {
    const row = await account(), token = randomUUID() + randomUUID();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await state.db.clienteOperacional.update({ where: { id: row.id }, data: { resetSenhaTokenHash: tokenHash, resetSenhaExpiraEm: new Date(Date.now() - 1000) } });
    await expect(identity.reset(request('/identity/reset'), { token, novaSenha: 'NewPassword_12345' })).rejects.toMatchObject({ status: 400 });
    await state.db.clienteOperacional.update({ where: { id: row.id }, data: { resetSenhaExpiraEm: new Date(Date.now() + 900000) } });
    const results = await Promise.allSettled([identity.reset(request('/identity/reset'), { token, novaSenha: 'NewPassword_12345' }), identity.reset(request('/identity/reset'), { token, novaSenha: 'OtherPassword_12345' })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const current = await state.db.clienteOperacional.findUniqueOrThrow({ where: { id: row.id } });
    expect(current).toMatchObject({ senha: '', authSessionVersion: 1, resetSenhaTokenHash: null, resetSenhaExpiraEm: null });
    const logged = await auth.verifyPrincipal(request('/identity/me', await principal(current)));
    await profile.updateProfile(logged.actor, { nome: '  Updated  ', email: '  Updated@Example.Invalid  ' });
    expect(await profile.profile(logged.actor)).toMatchObject({ nome: 'Updated', email: 'updated@example.invalid' });
    const other = await account();
    await expect(profile.updateProfile(logged.actor, { nome: 'Other', email: other.email })).rejects.toMatchObject({ status: 409 });
    const oldActor = { ...logged, actor: { ...logged.actor, sessionVersion: 0 } };
    await expect(identity.password(oldActor, { senhaAtual: 'NewPassword_12345', novaSenha: 'NextPassword_12345' })).rejects.toMatchObject({ status: 401 });
    expect(novaSenhaPortalSchema.safeParse('é'.repeat(37)).success).toBe(false);
}, 10000);
it('cross-account resources are generic404; filtered clienteId never replaces account ACL; history and 11 statuses read', async () => {
    const own = await fixture.atendimento(), foreign = await fixture.atendimento();
    const t = await principal(own.conta);
    const routes = await import('@/lib/portal-api/checklist-handlers');
    const wrapped = (fn: import('@/lib/portal-api/http').PortalHandler) => http.route('test', 'P', fn);
    for (const id of [foreign.empresa.id, 'missing-id']) {
        const res = await wrapped(routes.atendimento(id))(request('/atendimentos/' + id, t));
        expect(res.status).toBe(404);
        expect((await res.json()).error.message).toBe('Recurso não encontrado.');
    }
    const filtered = await wrapped(routes.atendimentos)(request('/atendimentos?clienteId=' + foreign.cliente.id, t));
    expect((await filtered.json()).data.items).toEqual([]);
    const detail = await wrapped(routes.atendimento(own.empresa.id))(request('/atendimentos/' + own.empresa.id, t));
    const dto = (await detail.json()).data;
    expect(dto).not.toHaveProperty('contaPortal');
    expect(dto.cliente).not.toHaveProperty('perfilCadastralJson');
    expect(dto.checklist.criadoEm).toMatch(/Z$/);
    expect(dto.capabilities.canEdit).toBe(false);
    const old = await state.db.checklist.create({ data: { empresaId: own.empresa.id, tipo: 'INICIO_RETOMADA' } });
    await state.db.itemChecklist.create({ data: { checklistId: old.id, codigo: 'OLD', secao: 'LEGACY', descricao: 'Legacy', status: 'FALAR_ANDREW' } });
    const historical = await wrapped(routes.atendimento(own.empresa.id))(request('/atendimentos/' + own.empresa.id + '?checklistId=' + old.id, t));
    expect((await historical.json()).data).toMatchObject({ historical: true, checklist: { itens: [{ status: 'FALAR_ANDREW' }] } });
    const invalid = await wrapped(routes.registerDocument)(request('/documents', t, { itemId: foreign.item.id, recibo: 'r'.repeat(43), mutationId: randomUUID(), expectedRevision: 0 }));
    expect(invalid.status).toBe(404);
});
it('inbox scopes list/read/all/incremental to account and does not disclose missing ids', async () => {
    const f = await fixture.atendimento(), g = await fixture.atendimento(), inbox = await import('@/lib/portal-api/notifications');
    const a = await state.db.notificacaoCliente.create({ data: { clienteId: f.conta.id, empresaId: f.empresa.id, tipo: 'CHECKLIST', titulo: 'Own' } });
    const b = await state.db.notificacaoCliente.create({ data: { clienteId: g.conta.id, empresaId: g.empresa.id, tipo: 'CHECKLIST', titulo: 'Foreign' } });
    const actor = { kind: 'PORTAL' as const, id: f.conta.id, sessionVersion: 0 };
    expect((await inbox.notifications(actor, {})).items.map(n => n.id)).toEqual([a.id]);
    expect(await inbox.readNotification(actor, b.id)).toEqual({ id: b.id });
    expect((await state.db.notificacaoCliente.findUniqueOrThrow({ where: { id: b.id } })).lida).toBe(false);
    await inbox.readAllNotifications(actor);
    expect((await inbox.notifications(actor, {})).naoLidas).toBe(0);
    expect((await inbox.incremental(actor, { desde: '2000-01-01T00:00:00.000Z' })).items).toEqual([]);
});
it('HTTP rejects real oversized/truncated/duplicate/unknown JSON and response overflow without partial data', async () => {
    const f = await account(), t = await principal(f), handlers = await import('@/lib/portal-api/identity-handlers');
    const wrapped = http.route('updateProfile', 'P', handlers.updateProfile);
    const huge = request('/profile', t, { nome: 'a'.repeat(40000), email: 'x@example.invalid' }, 'PATCH');
    expect((await wrapped(huge)).status).toBe(413);
    const truncated = new Request(request('/profile', t, undefined, 'PATCH'), { body: '{"nome":', headers: { ...Object.fromEntries(request('/profile', t).headers), 'Content-Type': 'application/json' } });
    expect((await wrapped(truncated)).status).toBe(400);
    expect((await wrapped(request('/profile', t, { nome: 'Valid', email: 'x@example.invalid', userId: 'other' }, 'PATCH'))).status).toBe(400);
    const get = http.route('profile', 'P', handlers.profile);
    for (const q of ['?page=1&page=2', '?unknown=value'])
        expect((await get(request('/profile' + q, t))).status).toBe(400);
    const over = http.route('large', 'P', async (_r, _p, rid) => http.success({ data: 'x'.repeat(2097152) }, rid));
    expect((await over(request('/profile', t))).status).toBe(413);
});
it('Portal receipt/document/revision/journal are atomic: real SQLite replay, divergent payload and CAS rollback', async () => {
    const f = await fixture.atendimento(), actor = { kind: 'PORTAL' as const, id: f.conta.id, sessionVersion: 0 };
    const docs = await import('@/lib/checklist/documentos'), service = await import('@/lib/checklist/service');
    const bytes = Buffer.from('%PDF-real-fixture');
    const receipt = await docs.iniciarUploadDireto(actor, { itemId: f.item.id, nome: 'test.pdf', mime: 'application/pdf', tamanhoBytes: bytes.length }, async () => 'synthetic-client-upload-token');
    state.objects.set(receipt.pathname, { bytes, mime: 'application/pdf' });
    const command = { itemId: f.item.id, recibo: receipt.recibo, mutationId: randomUUID(), expectedRevision: 0 };
    await expect(docs.registrarDocumento(actor, command)).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
    expect((await docs.finalizarUploadDireto(actor, { itemId: f.item.id, recibo: receipt.recibo })).verificado).toBe(true);
    const g = await fixture.atendimento();
    await expect(docs.finalizarUploadDireto({ kind: 'PORTAL', id: g.conta.id, sessionVersion: 0 }, { itemId: f.item.id, recibo: receipt.recibo })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    state.failCas = true;
    try {
        await expect(docs.registrarDocumento(actor, command)).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    finally {
        state.failCas = false;
    }
    expect(await state.db.documentoChecklist.count({ where: { itemId: f.item.id } })).toBe(0);
    expect(await state.db.checklistEvento.count({ where: { empresaId: f.empresa.id } })).toBe(0);
    const unconsumed = await state.db.checklistUploadRecibo.findUniqueOrThrow({ where: { tokenHash: createHash('sha256').update(receipt.recibo).digest('hex') } });
    expect(unconsumed.documentoId).toBeNull();
    expect(unconsumed.consumidoEm).toBeNull();
    const document = await docs.registrarDocumento(actor, command);
    expect((await docs.registrarDocumento(actor, command)).id).toBe(document.id);
    expect(await state.db.documentoChecklist.count({ where: { itemId: f.item.id } })).toBe(1);
    expect(await state.db.checklistEvento.count({ where: { empresaId: f.empresa.id } })).toBe(1);
    await expect(docs.registrarDocumento(actor, { ...command, expectedRevision: 1 })).rejects.toMatchObject({ code: 'CONFLICT' });
    const patch = { documentoId: document.id, observacao: 'Own note', mutationId: randomUUID(), expectedRevision: 1 };
    expect((await service.alterarDocumento(actor, patch, 'OBSERVACAO')).observacao).toBe('Own note');
    expect((await service.alterarDocumento(actor, patch, 'OBSERVACAO')).observacao).toBe('Own note');
    const remove = { documentoId: document.id, mutationId: randomUUID(), expectedRevision: 2 };
    expect((await service.alterarDocumento(actor, remove, 'EXCLUIR')).deletadoPorContaId).toBe(actor.id);
    expect((await service.alterarDocumento(actor, remove, 'EXCLUIR')).deletadoEm).not.toBeNull();
    expect((await state.db.operacionalClientes.findUniqueOrThrow({ where: { id: f.empresa.id } })).revision).toBe(3);
    const handlers = await import('@/lib/portal-api/checklist-handlers'), token = await principal(f.conta);
    const replay = await http.route('removeDocument', 'P', handlers.removeDocument(document.id))(request('/documents/' + document.id + '/remove', token, { mutationId: remove.mutationId, expectedRevision: 2 }));
    expect(replay.status).toBe(200);
});
it('direct finalize verifies expired receipt/magic/length/SHA and does not trust claimed MIME', async () => {
    const f = await fixture.atendimento(), actor = { kind: 'PORTAL' as const, id: f.conta.id, sessionVersion: 0 }, docs = await import('@/lib/checklist/documentos');
    const receipt = await docs.iniciarUploadDireto(actor, { itemId: f.item.id, nome: 'a.pdf', mime: 'application/pdf', tamanhoBytes: 12 }, async () => 'fixture-token');
    state.objects.set(receipt.pathname, { bytes: Buffer.from('not a PDF!!!'), mime: 'application/pdf' });
    await expect(docs.finalizarUploadDireto(actor, { itemId: f.item.id, recibo: receipt.recibo })).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
    await state.db.checklistUploadRecibo.update({ where: { tokenHash: createHash('sha256').update(receipt.recibo).digest('hex') }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(docs.finalizarUploadDireto(actor, { itemId: f.item.id, recibo: receipt.recibo })).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
});
it('avatar private REF, magic/limits, tenant key binding, legacy SSRF and revocation after storage use real account transaction', async () => {
    const row = await account(), token = await principal(row), handlers = await import('@/lib/portal-api/file-handlers');
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    const {mimeAvatar}=await import('@/lib/perfil/avatar');expect(mimeAvatar(Uint8Array.of(255,216,255))).toBe('image/jpeg');expect(mimeAvatar(Buffer.from('RIFF0000WEBP'))).toBe('image/webp');
    const upload = (body: Uint8Array, mime = 'image/png') => new Request(request('/profile/avatar?filename=photo.png', token, undefined, 'POST', { 'Content-Type': mime }), { body: Buffer.from(body) });
    const post = http.route('uploadAvatar', 'P', handlers.uploadAvatar), get = http.route('avatar', 'P', handlers.avatar);
    expect((await post(upload(png))).status).toBe(200);
    const stored = await state.db.clienteOperacional.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.imagemUrl).toMatch(new RegExp('^perfil-private:v1:synthetic/checklist/perfil/' + row.id + '/'));
    const response = await get(request('/profile/avatar', token));
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
    expect(response.headers.get('cache-control')).toContain('no-store');
    for (const [bytes, mime] of [[new Uint8Array(), 'image/png'], [png, 'image/jpeg'], [png, 'application/pdf']] as const)
        expect((await post(upload(bytes, mime))).status).toBe(400);
    expect((await post(upload(new Uint8Array(2097153)))).status).toBe(413);
    await state.db.clienteOperacional.update({ where: { id: row.id }, data: { imagemUrl: 'perfil-private:v1:synthetic/checklist/perfil/other/a.png' } });
    expect((await get(request('/profile/avatar', token))).status).toBe(403);
    await state.db.clienteOperacional.update({ where: { id: row.id }, data: { imagemUrl: 'http://127.0.0.1/private' } });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await get(request('/profile/avatar', token))).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    state.putHook = async () => { await state.db.clienteOperacional.update({ where: { id: row.id }, data: { authSessionVersion: { increment: 1 }, imagemUrl: null } }); };
    try {
        expect((await post(upload(png))).status).toBe(401);
        expect((await state.db.clienteOperacional.findUniqueOrThrow({ where: { id: row.id } })).imagemUrl).toBeNull();
    }
    finally {
        state.putHook = undefined;
    }
});
it('SSE preserves frames, closes at45s and actively closes after account revocation at8s with abort cleanup', async () => {
    const f = await fixture.atendimento(), token = await principal(f.conta), handlers = await import('@/lib/portal-api/notification-handlers');
    await state.db.notificacaoCliente.create({ data: { clienteId: f.conta.id, empresaId: f.empresa.id, tipo: 'CHECKLIST', titulo: 'Own stream' } });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try {
        const stream = await http.route('notificationStream', 'P', handlers.notificationStream)(request('/notifications/stream', token));
        const reader = stream.body!.getReader();
        const decoder = new TextDecoder();
        expect(decoder.decode((await reader.read()).value)).toBe('retry:3000\n\n');
        const frame = decoder.decode((await reader.read()).value);
        expect(frame).toContain('"tipo":"novas_notificacoes"');
        expect(frame).not.toContain(token);
        expect(frame.endsWith('\n\n')).toBe(true);
        await state.db.clienteOperacional.update({ where: { id: f.conta.id }, data: { authSessionVersion: { increment: 1 } } });
        const pending = expect(reader.read()).rejects.toThrow();
        await vi.advanceTimersByTimeAsync(8001);
        await pending;
        expect(vi.getTimerCount()).toBe(0);
        const current = await state.db.clienteOperacional.findUniqueOrThrow({ where: { id: f.conta.id } });
        const newToken = await principal(current);
        const abort = new AbortController();
        const response = await http.route('notificationStream', 'P', handlers.notificationStream)(new Request(request('/notifications/stream', newToken), { signal: abort.signal }));
        const second = response.body!.getReader();
        await second.read();
        await second.read();
        abort.abort();
        expect((await second.read()).done).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
        const thirdResponse = await http.route('notificationStream', 'P', handlers.notificationStream)(request('/notifications/stream', newToken));
        const third = thirdResponse.body!.getReader();
        await third.read();
        await third.read();
        await vi.advanceTimersByTimeAsync(45001);
        for (;;) {
            if ((await third.read()).done)
                break;
        }
        expect(vi.getTimerCount()).toBe(0);
    }
    finally {
        vi.useRealTimers();
    }
});
it('document download projects safe attachment, denies Range/deleted/foreign resources', async () => {
    const f = await fixture.atendimento(), g = await fixture.atendimento(), token = await principal(f.conta), handlers = await import('@/lib/portal-api/file-handlers');
    const key = 'synthetic/checklist/' + randomUUID();
    const bytes = Buffer.from('%PDF-owned');
    state.objects.set(key, { bytes, mime: 'application/pdf' });
    const doc = await state.db.documentoChecklist.create({ data: { itemId: f.item.id, nome: '../bad\r\nname.pdf', url: '', storageProvider: 'VERCEL_BLOB', storageAccess: 'private', storageKey: key, uploadedByCliente: true, uploadedByContaId: f.conta.id } });
    const get = http.route('downloadDocument', 'P', handlers.downloadDocument(doc.id));
    const res = await get(request('/documents/' + doc.id + '/download', token));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).not.toMatch(/[\r\n]/);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(bytes);
    const foreign = await get(request('/documents/' + doc.id + '/download', await principal(g.conta)));
    expect(foreign.status).toBe(404);
    expect((await get(request('/documents/' + doc.id + '/download', token, undefined, 'GET', { Range: 'bytes=0-1' }))).status).toBe(416);
    await state.db.documentoChecklist.update({ where: { id: doc.id }, data: { deletadoEm: new Date() } });
    expect((await get(request('/documents/' + doc.id + '/download', token))).status).toBe(404);
});
it('credential CAS losing to reset cannot authenticate old plaintext; present bcrypt never falls back',async()=>{
 const row=await account('LegacyPassword_123'),newHash=await hash('DifferentPassword_123',4);
 const checking=credentials.verificarSenha(row,row.senha);
 await state.db.clienteOperacional.update({where:{id:row.id},data:{senha:'',senhaHash:newHash,authSessionVersion:{increment:1}}});expect(await checking).toBe(false);
 const conflicting=await account('PlaintextWouldMatch',newHash);expect(await credentials.verificarSenha(conflicting,conflicting.senha)).toBe(false);expect((await state.db.clienteOperacional.findUniqueOrThrow({where:{id:conflicting.id}})).senha).toBe('PlaintextWouldMatch');
});
it('reset/password reject UTF8 oversize without consuming capability; exact72 byte reset preserves complete password',async()=>{
 const prefix='é'.repeat(36);expect(await compare(prefix+'B',await hash(prefix+'A',4))).toBe(true);
 for(const password of ['a'.repeat(72),prefix]){
  const row=await account('x'.repeat(150)),token=randomUUID()+randomUUID(),tokenHash=createHash('sha256').update(token).digest('hex');await state.db.clienteOperacional.update({where:{id:row.id},data:{resetSenhaTokenHash:tokenHash,resetSenhaExpiraEm:new Date(Date.now()+900000)}});
  for(const oversized of ['a'.repeat(73),'é'.repeat(37)]){await expect(identity.reset(request('/identity/reset'),{token,novaSenha:oversized})).rejects.toHaveProperty('name','ZodError');const user=await auth.verifyPrincipal(request('/identity/me',await principal(row)));await expect(identity.password(user,{senhaAtual:row.senha,novaSenha:oversized})).rejects.toHaveProperty('name','ZodError');}
  expect(await state.db.clienteOperacional.findUniqueOrThrow({where:{id:row.id}})).toMatchObject({senha:row.senha,senhaHash:null,authSessionVersion:0,resetSenhaTokenHash:tokenHash});
  await identity.reset(request('/identity/reset'),{token,novaSenha:password});const changed=await state.db.clienteOperacional.findUniqueOrThrow({where:{id:row.id}});expect(changed.senha).toBe('');expect(changed.authSessionVersion).toBe(1);expect(await compare(password,changed.senhaHash!)).toBe(true);expect(await credentials.verificarSenha(changed,password+'Z')).toBe(false);
 }
});
