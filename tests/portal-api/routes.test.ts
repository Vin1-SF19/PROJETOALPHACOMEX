/// <reference types="vite/client" />
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { operations } from '../../contracts/portal-api/v1';
const modules = import.meta.glob('../../src/app/api/portal/v1/**/route.ts');
beforeAll(() => { vi.stubEnv('PORTAL_API_ENVIRONMENT', 'local'); vi.stubEnv('PORTAL_WEB_ORIGIN', 'http://localhost:4392'); vi.stubEnv('PORTAL_API_APP_KEYS_JSON', JSON.stringify([{ kid: 'app', appId: 'painelclientes', environment: 'local', key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }])); vi.stubEnv('PORTAL_API_PRINCIPAL_KEYS_JSON', JSON.stringify({ activeKid: 'sign', keys: [{ kid: 'sign', secret: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBA' }] })); });
afterAll(() => vi.unstubAllEnvs());
it('every allowlisted operation rejects Alpha cookies without app credentials before loading business modules', async () => {
    for (const op of operations) {
        const loader = modules['../../src/app/api/portal/v1' + op.path + '/route.ts'];
        expect(loader).toBeDefined();
        const mod = await loader();
        if (!mod || typeof mod !== 'object' || !(op.method in mod))
            throw new Error('Missing route');
        const fn = Reflect.get(mod, op.method);
        if (typeof fn !== 'function')
            throw new Error('Missing method');
        const res: Response = await fn(new Request('http://localhost:4391/api/portal/v1' + op.path.replace('[id]', 'synthetic-id'), { method: op.method, headers: { Cookie: 'alpha.authjs.session-token=staff', ...(op.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}) }, body: op.method === 'GET' ? undefined : '{}' }), { params: Promise.resolve({ id: 'synthetic-id' }) });
        expect(res.status).toBe(401);
        expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
    }
});
it('unsupported administrative endpoints404 and nonallowlisted methods405 preserve Allow', async () => {
    const missing = await modules['../../src/app/api/portal/v1/[...unsupported]/route.ts']();
    if (!missing || typeof missing !== 'object')
        throw new Error();
    const fn = Reflect.get(missing, 'POST');
    if (typeof fn !== 'function')
        throw new Error();
    expect((await fn()).status).toBe(404);
    const mod = await modules['../../src/app/api/portal/v1/profile/route.ts']();
    if (!mod || typeof mod !== 'object')
        throw new Error();
    const put = Reflect.get(mod, 'PUT');
    if (typeof put !== 'function')
        throw new Error();
    const response: Response = await put();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, PATCH');
});
