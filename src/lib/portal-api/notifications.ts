import 'server-only';
import db from '@/lib/prisma';
import { notificacaoSchema, notificationQuerySchema, incrementalQuerySchema } from '../../../contracts/portal-api/v1';
import type { PortalActor } from './auth';
import { exigirLeituraChecklist } from '@/lib/checklist/acesso';
const select = { id: true, clienteId: true, eventoId: true, tipo: true, titulo: true, mensagem: true, empresaId: true, itemId: true, lida: true, criadaEm: true } as const;
type NotificationRow = {
    id: string;
    clienteId: string;
    eventoId: string | null;
    tipo: string;
    titulo: string;
    mensagem: string | null;
    empresaId: string;
    itemId: string | null;
    lida: boolean;
    criadaEm: Date;
};
export const notificationDTO = (row: NotificationRow) => notificacaoSchema.parse({ ...row, criadaEm: row.criadaEm.toISOString() });
export async function notifications(actor: PortalActor, input: unknown) {
    await exigirLeituraChecklist(actor);
    const p = notificationQuerySchema.parse(input), where = { clienteId: actor.id };
    const [items, totalCount, naoLidas] = await Promise.all([db.notificacaoCliente.findMany({ where, select, orderBy: [{ criadaEm: 'desc' }, { id: 'desc' }], skip: (p.page - 1) * p.pageSize, take: p.pageSize }), db.notificacaoCliente.count({ where }), db.notificacaoCliente.count({ where: { ...where, lida: false } })]);
    return { items: items.map(notificationDTO), totalCount, naoLidas, ...p };
}
export async function readNotification(actor: PortalActor, id: string) { await exigirLeituraChecklist(actor); await db.notificacaoCliente.updateMany({ where: { id, clienteId: actor.id }, data: { lida: true } }); return { id }; }
export async function readAllNotifications(actor: PortalActor) { await exigirLeituraChecklist(actor); await db.notificacaoCliente.updateMany({ where: { clienteId: actor.id, lida: false }, data: { lida: true } }); return { ok: true as const }; }
export async function incremental(actor: PortalActor, input: unknown) {
    await exigirLeituraChecklist(actor);
    const { desde } = incrementalQuerySchema.parse(input);
    return { items: (await db.notificacaoCliente.findMany({ where: { clienteId: actor.id, lida: false, criadaEm: { gte: new Date(desde) } }, select, orderBy: [{ criadaEm: 'asc' }, { id: 'asc' }], take: 100 })).map(notificationDTO) };
}
export async function unread(actor: PortalActor) { return (await db.notificacaoCliente.findMany({ where: { clienteId: actor.id, lida: false }, select, orderBy: [{ criadaEm: 'asc' }, { id: 'asc' }], take: 100 })).map(notificationDTO); }
