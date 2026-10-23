import 'server-only';
import db from '@/lib/prisma';
import type { PortalActor } from './auth';
import { notFound } from './errors';
/** API-only existence policy; internal staff helpers retain their original 403 semantics. */
export async function scopeAtendimento(actor: PortalActor, id: string) {
    const row = await db.operacionalClientes.findFirst({ where: { id, clienteOperacionalId: actor.id }, select: { id: true } });
    if (!row)
        notFound();
    return row.id;
}
export async function scopeChecklist(actor: PortalActor, id: string) {
    const row = await db.checklist.findFirst({ where: { id, empresa: { clienteOperacionalId: actor.id } }, select: { empresaId: true } });
    if (!row)
        notFound();
    return row.empresaId;
}
export async function scopeItem(actor: PortalActor, id: string) {
    const row = await db.itemChecklist.findFirst({ where: { id, checklist: { empresa: { clienteOperacionalId: actor.id } } }, select: { id: true } });
    if (!row)
        notFound();
}
export async function scopeDocument(actor: PortalActor, id: string, includeRemoved = false) {
    const row = await db.documentoChecklist.findFirst({ where: { id, ...(includeRemoved ? {} : { deletadoEm: null }), item: { checklist: { empresa: { clienteOperacionalId: actor.id } } } }, select: { id: true } });
    if (!row)
        notFound();
}
/** Recheck API existence policy after a concurrent ownership change denied by a canonical helper. */
export async function recheckOnDenied<T>(check: () => Promise<unknown>, run: () => Promise<T>): Promise<T> {
    try {
        return await run();
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND'))
            await check();
        throw error;
    }
}
