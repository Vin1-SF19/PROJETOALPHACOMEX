import 'server-only';
import { createHash } from 'node:crypto';
import { hash } from 'bcryptjs';
import db from '@/lib/prisma';
import { consumeAuthRateLimit, clearAuthRateLimit, type AuthRateLimitScope } from '@/lib/auth/rate-limit';
import { verificarSenha } from './credentials';
import { issuePrincipal, type PortalPrincipal } from './auth';
import { clientAddress } from './auth';
import { PortalError, unauthenticated } from './errors';
import { loginSchema, recoverySchema, resetSchema, passwordSchema } from '../../../contracts/portal-api/v1';
export async function limit(scope: AuthRateLimitScope, subject: string) { const r = await consumeAuthRateLimit(scope, subject); if (!r.allowed)
    throw new PortalError('RATE_LIMITED', 429, 'Aguarde antes de tentar novamente.', r.retryAfterSeconds); }
export async function login(request: Request, input: unknown) {
    const c = loginSchema.parse(input);
    await Promise.all([limit('login_ip', 'portal:' + clientAddress(request)), limit('login_identifier', 'portal:' + c.email)]);
    const account = await db.clienteOperacional.findUnique({ where: { email: c.email }, select: { id: true, nome: true, email: true, senha: true, senhaHash: true, authSessionVersion: true } });
    if (!account || !await verificarSenha(account, c.senha))
        unauthenticated();
    // A password/reset racing the bcrypt comparison cannot mint a current principal.
    const current = await db.clienteOperacional.findUnique({ where: { id: account.id }, select: { id: true, nome: true, email: true, authSessionVersion: true } });
    if (!current || current.authSessionVersion !== account.authSessionVersion)
        unauthenticated();
    await clearAuthRateLimit('login_identifier', 'portal:' + c.email);
    return issuePrincipal(current);
}
export async function recovery(request: Request, input: unknown) {
    const c = recoverySchema.parse(input);
    await limit('recovery_ip', 'portal:' + clientAddress(request));
    await consumeAuthRateLimit('recovery_identifier', 'portal:' + c.email);
    return { message: 'Se houver uma conta elegível, solicite um link de acesso ao analista responsável.' };
}
export async function reset(request: Request, input: unknown) {
    const c = resetSchema.parse(input), tokenHash = createHash('sha256').update(c.token).digest('hex');
    await Promise.all([limit('recovery_ip', 'portal:' + clientAddress(request)), limit('recovery_identifier', 'portal-reset:' + tokenHash)]);
    const changed = await db.clienteOperacional.updateMany({ where: { resetSenhaTokenHash: tokenHash, resetSenhaExpiraEm: { gt: new Date() } }, data: { senhaHash: await hash(c.novaSenha, 12), senha: '', resetSenhaTokenHash: null, resetSenhaExpiraEm: null, authSessionVersion: { increment: 1 } } });
    if (changed.count !== 1)
        throw new PortalError('VALIDATION', 400, 'Link inválido ou expirado. Solicite um novo acesso.');
    return { reautenticar: true as const };
}
export async function password(principal: PortalPrincipal, input: unknown) {
    const c = passwordSchema.parse(input), actor = principal.actor;
    const account = await db.clienteOperacional.findUnique({ where: { id: actor.id }, select: { id: true, senha: true, senhaHash: true, authSessionVersion: true } });
    if (!account || account.authSessionVersion !== actor.sessionVersion)
        unauthenticated();
    if (!await verificarSenha(account, c.senhaAtual))
        throw new PortalError('VALIDATION', 400, 'Senha atual incorreta');
    const changed = await db.clienteOperacional.updateMany({ where: { id: actor.id, authSessionVersion: actor.sessionVersion }, data: { senha: '', senhaHash: await hash(c.novaSenha, 12), resetSenhaTokenHash: null, resetSenhaExpiraEm: null, authSessionVersion: { increment: 1 } } });
    if (changed.count !== 1)
        unauthenticated();
    return { reautenticar: true as const };
}
export async function me(principal: PortalPrincipal) {
    const account = await db.clienteOperacional.findUnique({ where: { id: principal.actor.id }, select: { id: true, nome: true, email: true, authSessionVersion: true } });
    if (!account || account.authSessionVersion !== principal.actor.sessionVersion)
        unauthenticated();
    return { ...account, principalExpiresAt: principal.expiresAt };
}
