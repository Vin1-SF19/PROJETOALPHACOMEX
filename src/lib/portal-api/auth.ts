import 'server-only';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { SignJWT, jwtVerify, decodeProtectedHeader } from 'jose';
import { z } from 'zod/v3';
import { idSchema, revisionSchema, PRINCIPAL_TTL_SECONDS } from '../../../contracts/portal-api/v1';
import { portalConfig } from './config';
import { PortalError, unauthenticated } from './errors';
export type PortalActor = {
    kind: 'PORTAL';
    id: string;
    sessionVersion: number;
};
export type PortalPrincipal = {
    actor: PortalActor;
    token: string;
    expiresAt: string;
    clientIp: string;
};
const digest = (s: string) => createHash('sha256').update(s).digest();
export function verifyApp(request: Request) {
    const config = portalConfig();
    const app = request.headers.get('x-portal-app-id') ?? '', kid = request.headers.get('x-portal-app-key-id') ?? '', key = request.headers.get('x-portal-app-key') ?? '';
    if (app.length + kid.length + key.length + (request.headers.get('authorization')?.length ?? 0) > 8192)
        throw new PortalError('LIMIT_EXCEEDED', 413, 'Cabeçalhos excedem o limite.');
    const match = config.apps.find(k => k.kid === kid && k.appId === app);
    if (!match || !/^[A-Za-z0-9_-]{43}$/.test(key) || !timingSafeEqual(digest(key), digest(match.key)))
        unauthenticated();
    return config;
}
export function clientAddress(request: Request) { const ip = request.headers.get('x-portal-client-ip') ?? ''; return ip.length <= 128 && isIP(ip) ? ip : 'unavailable'; }
export async function issuePrincipal(account: {
    id: string;
    nome: string;
    email: string;
    authSessionVersion: number;
}) {
    const config = portalConfig(), key = config.principal.keys.find(k => k.kid === config.principal.activeKid)!;
    const now = Math.floor(Date.now() / 1000), exp = now + PRINCIPAL_TTL_SECONDS;
    const principalToken = await new SignJWT({ sv: account.authSessionVersion, azp: 'painelclientes', env: config.environment }).setProtectedHeader({ alg: 'HS256', typ: 'portal-principal+jwt', kid: key.kid }).setIssuer('urn:alpha-comex:portal-api:' + config.environment).setAudience('urn:alpha-comex:portal:' + config.environment).setSubject(account.id).setIssuedAt(now).setExpirationTime(exp).setJti(randomUUID()).sign(Buffer.from(key.secret, 'base64url'));
    const principalExpiresAt = new Date(exp * 1000).toISOString();
    return { principalToken, principalExpiresAt, identity: { id: account.id, nome: account.nome, email: account.email, authSessionVersion: account.authSessionVersion, principalExpiresAt } };
}
export async function verifyPrincipal(request: Request): Promise<PortalPrincipal> {
    const config = verifyApp(request), authorization = request.headers.get('authorization') ?? '';
    if (!authorization.startsWith('Bearer ') || authorization.length > 8192)
        unauthenticated();
    const token = authorization.slice(7);
    let actor: PortalActor, expiresAt: string;
    try {
        const header = decodeProtectedHeader(token);
        if (Object.keys(header).sort().join(',') !== 'alg,kid,typ' || header.alg !== 'HS256' || header.typ !== 'portal-principal+jwt')
            unauthenticated();
        const key = config.principal.keys.find(k => k.kid === header.kid);
        if (!key)
            unauthenticated();
        const { payload } = await jwtVerify(token, Buffer.from(key.secret, 'base64url'), { algorithms: ['HS256'], issuer: 'urn:alpha-comex:portal-api:' + config.environment, audience: 'urn:alpha-comex:portal:' + config.environment, clockTolerance: 0, requiredClaims: ['iss', 'aud', 'sub', 'sv', 'azp', 'env', 'iat', 'exp', 'jti'] });
        const claims = z.object({ iss: z.literal('urn:alpha-comex:portal-api:' + config.environment), aud: z.literal('urn:alpha-comex:portal:' + config.environment), sub: idSchema, sv: revisionSchema, azp: z.literal('painelclientes'), env: z.literal(config.environment), iat: z.number().int().safe().nonnegative(), exp: z.number().int().safe().nonnegative(), jti: z.string().uuid() }).strict().parse(payload);
        if (claims.exp - claims.iat !== PRINCIPAL_TTL_SECONDS || claims.iat > Math.floor(Date.now() / 1000) + 30)
            unauthenticated();
        actor = { kind: 'PORTAL', id: claims.sub, sessionVersion: claims.sv };
        expiresAt = new Date(claims.exp * 1000).toISOString();
    }
    catch {
        unauthenticated();
    }
    const { default: db } = await import('@/lib/prisma');
    const account = await db.clienteOperacional.findUnique({ where: { id: actor.id }, select: { authSessionVersion: true } });
    if (!account || account.authSessionVersion !== actor.sessionVersion)
        unauthenticated();
    return { actor, token, expiresAt, clientIp: clientAddress(request) };
}
