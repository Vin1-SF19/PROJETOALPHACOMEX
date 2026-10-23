import 'server-only';
import db from '@/lib/prisma';
import { avatarUrlPublica } from '@/lib/perfil/avatar';
import { profileInputSchema } from '../../../contracts/portal-api/v1';
import { unauthenticated, PortalError } from './errors';
import type { PortalActor } from './auth';
export async function profile(actor: PortalActor) {
    const account = await db.clienteOperacional.findUnique({ where: { id: actor.id }, select: { id: true, nome: true, email: true, imagemUrl: true, authSessionVersion: true } });
    if (!account || account.authSessionVersion !== actor.sessionVersion)
        unauthenticated();
    return { id: account.id, nome: account.nome, email: account.email, imagemUrl: avatarUrlPublica(account.imagemUrl) };
}
export async function updateProfile(actor: PortalActor, input: unknown) {
    const c = profileInputSchema.parse(input);
    await db.$transaction(async (tx) => {
        const account = await tx.clienteOperacional.findUnique({ where: { id: actor.id }, select: { authSessionVersion: true } });
        if (!account || account.authSessionVersion !== actor.sessionVersion)
            unauthenticated();
        if (await tx.clienteOperacional.findFirst({ where: { email: c.email, NOT: { id: actor.id } }, select: { id: true } }))
            throw new PortalError('CONFLICT', 409, 'Este e-mail ja esta em uso por outra conta');
        const changed = await tx.clienteOperacional.updateMany({ where: { id: actor.id, authSessionVersion: actor.sessionVersion }, data: { nome: c.nome, email: c.email } });
        if (changed.count !== 1)
            unauthenticated();
    });
    return { success: true as const };
}
