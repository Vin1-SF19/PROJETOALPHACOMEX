import 'server-only';
import { z } from 'zod/v3';
import { validateOrigin } from '../../../contracts/portal-api/sdk.server';
import { environmentSchema } from '../../../contracts/portal-api/v1';
import { PortalError } from './errors';
const kid = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/).refine(v => Buffer.from(v, 'base64url').length === 32 && Buffer.from(v, 'base64url').toString('base64url') === v);
const appSchema = z.array(z.object({ kid, appId: z.literal('painelclientes'), environment: environmentSchema, key: secret }).strict()).min(1).max(2);
const principalSchema = z.object({ activeKid: kid, keys: z.array(z.object({ kid, secret }).strict()).min(1).max(2) }).strict();
/** Deliberately lazy: missing API configuration cannot break staff imports/build. */
export function portalConfig() {
    try {
        const environment = environmentSchema.parse(process.env.PORTAL_API_ENVIRONMENT);
        const webOrigin = validateOrigin(z.string().parse(process.env.PORTAL_WEB_ORIGIN), environment);
        const apps = appSchema.parse(JSON.parse(process.env.PORTAL_API_APP_KEYS_JSON ?? ''));
        const principal = principalSchema.parse(JSON.parse(process.env.PORTAL_API_PRINCIPAL_KEYS_JSON ?? ''));
        if (apps.some(a => a.environment !== environment) || new Set(apps.map(a => a.kid)).size !== apps.length || new Set(principal.keys.map(k => k.kid)).size !== principal.keys.length || !principal.keys.some(k => k.kid === principal.activeKid))
            throw new Error();
        const staffSecrets = [process.env.AUTH_SECRET, process.env.NEXTAUTH_SECRET].filter(Boolean);
        if (principal.keys.some(k => staffSecrets.includes(k.secret) || apps.some(a => a.key === k.secret)) || apps.some(a => staffSecrets.includes(a.key)))
            throw new Error();
        return { environment, webOrigin, apps, principal };
    }
    catch {
        throw new PortalError('RETRYABLE', 503, 'Serviço indisponível.');
    }
}
