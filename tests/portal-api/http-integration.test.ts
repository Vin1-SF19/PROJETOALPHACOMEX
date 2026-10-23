import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { criarFixtureChecklist } from '../checklist-analistas/sqlite-fixture';
import { createPortalClient, responseMetadata } from '../../contracts/portal-api/sdk.server';
import type { Result } from '../../contracts/portal-api/v1';

const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient }));
// Inject the isolated database only. Authentication, HTTP, DTOs and owners stay real.
vi.mock('@/lib/prisma', () => ({ get default() { return state.db; } }));
vi.mock('../../auth', () => ({ auth: vi.fn() }));

let fixture: Awaited<ReturnType<typeof criarFixtureChecklist>>;
let own: Awaited<ReturnType<typeof fixture.atendimento>>;
let foreign: Awaited<ReturnType<typeof fixture.atendimento>>;
let server: Server;
let client: ReturnType<typeof createPortalClient>;
let token: string;
const appKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function data<T>(result: Result<T>): T {
    if (!result.ok) throw new Error(`Unexpected API error: ${result.error.code}`);
    return result.data;
}

beforeAll(async () => {
    vi.stubEnv('PORTAL_API_ENVIRONMENT', 'local');
    vi.stubEnv('PORTAL_WEB_ORIGIN', 'http://localhost:4392');
    vi.stubEnv('AUTH_RATE_LIMIT_SECRET', 'local-synthetic-http-integration-secret');
    vi.stubEnv('PORTAL_API_APP_KEYS_JSON', JSON.stringify([{ kid: 'http-test', appId: 'painelclientes', environment: 'local', key: appKey }]));
    vi.stubEnv('PORTAL_API_PRINCIPAL_KEYS_JSON', JSON.stringify({ activeKid: 'http-sign', keys: [{ kid: 'http-sign', secret: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBA' }] }));
    fixture = await criarFixtureChecklist();
    state.db = fixture.db;
    own = await fixture.atendimento();
    foreign = await fixture.atendimento();
    await state.db.clienteOperacional.update({ where: { id: own.conta.id }, data: { senha: 'SyntheticPassword_123', senhaHash: null } });

    const login = await import('../../src/app/api/portal/v1/identity/login/route');
    const me = await import('../../src/app/api/portal/v1/identity/me/route');
    const list = await import('../../src/app/api/portal/v1/atendimentos/route');
    const detail = await import('../../src/app/api/portal/v1/atendimentos/[id]/route');
    server = createServer(async (incoming, outgoing) => {
        try {
            const chunks: Buffer[] = [];
            for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
            const request = new Request(`http://localhost${incoming.url}`, {
                method: incoming.method,
                headers: new Headers(Object.entries(incoming.headers).flatMap<[string, string]>(([key, value]) =>
                    value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value]])),
                body: incoming.method === 'POST' ? Buffer.concat(chunks) : undefined,
            });
            const path = new URL(request.url).pathname;
            const id = path.match(/^\/api\/portal\/v1\/atendimentos\/([^/]+)$/)?.[1];
            let response: Response;
            if (incoming.method === 'POST' && path === '/api/portal/v1/identity/login') response = await login.POST(request);
            else if (incoming.method === 'GET' && path === '/api/portal/v1/identity/me') response = await me.GET(request);
            else if (incoming.method === 'GET' && path === '/api/portal/v1/atendimentos') response = await list.GET(request);
            else if (incoming.method === 'GET' && id) response = await detail.GET(request, { params: Promise.resolve({ id }) });
            else response = new Response(null, { status: 404 });
            outgoing.writeHead(response.status, Object.fromEntries(response.headers));
            outgoing.end(Buffer.from(await response.arrayBuffer()));
        } catch {
            outgoing.writeHead(500);
            outgoing.end();
        }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    client = createPortalClient({ origin: `http://127.0.0.1:${port}`, environment: 'local', appId: 'painelclientes', keyId: 'http-test', key: appKey });
    token = data(await client.call('login', { body: { email: own.conta.email, senha: 'SyntheticPassword_123' } })).principalToken;
}, 30000);

afterAll(async () => {
    if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    await fixture?.close();
    vi.unstubAllEnvs();
});

it('normal login and consumer decoding reach real identity and scoped checklist routes over HTTP', async () => {
    expect(data(await client.call('me', { token })).id).toBe(own.conta.id);
    const result = data(await client.call('atendimentos', { token }));
    expect(result.items.map(item => item.id)).toEqual([own.empresa.id]);
    const detail = data(await client.call('atendimento', { token, id: own.empresa.id }));
    expect(detail.cliente?.razaoSocial).toBe(own.cliente.razaoSocial);
    expect(detail.checklist?.itens.map(item => item.id)).toEqual([own.item.id]);
    expect(detail.capabilities.canEdit).toBe(false);
    expect(detail).not.toHaveProperty('contaPortal');
});

it('foreign and missing resources have the same public 404 contract', async () => {
    for (const id of [foreign.empresa.id, 'nonexistent-atendimento']) {
        const result = await client.call('atendimento', { token, id });
        expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } });
        expect(responseMetadata(result)?.status).toBe(404);
    }
    expect(await state.db.operacionalClientes.count()).toBe(2);
});

it('owner session-version revocation is enforced across the real transport', async () => {
    await state.db.clienteOperacional.update({ where: { id: own.conta.id }, data: { authSessionVersion: { increment: 1 } } });
    const result = await client.call('me', { token });
    expect(result).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    expect(responseMetadata(result)?.status).toBe(401);
});
