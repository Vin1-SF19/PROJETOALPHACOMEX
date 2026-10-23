import * as c from '../../../contracts/portal-api/v1';
import { jsonInput, queryInput, success, type PortalHandler } from './http';
import * as inbox from './notifications';
import { verifyPrincipal } from './auth';
import { PortalError } from './errors';
export const notifications: PortalHandler = async (req, p, rid) => success(await inbox.notifications(p!.actor, queryInput(req, c.notificationQuerySchema)), rid);
export const incremental: PortalHandler = async (req, p, rid) => success(await inbox.incremental(p!.actor, queryInput(req, c.incrementalQuerySchema)), rid);
export const readNotification = (id: string): PortalHandler => async (req, p, rid) => { c.idSchema.parse(id); queryInput(req, c.emptySchema); await jsonInput(req, c.emptySchema); return success(await inbox.readNotification(p!.actor, id), rid); };
export const readAllNotifications: PortalHandler = async (req, p, rid) => { queryInput(req, c.emptySchema); await jsonInput(req, c.emptySchema); return success(await inbox.readAllNotifications(p!.actor), rid); };
export const notificationStream: PortalHandler = async (req, p) => {
    queryInput(req, c.emptySchema);
    const encoder = new TextEncoder();
    let closed = false, busy = false, total = 0;
    let tick: ReturnType<typeof setInterval> | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const close = (error?: unknown) => { if (closed)
        return; closed = true; clearInterval(tick); clearTimeout(deadline); req.signal.removeEventListener('abort', abort); if (error)
        controller.error(error);
    else
        controller.close(); };
    const abort = () => close();
    const send = (s: string) => { const bytes = encoder.encode(s); total += bytes.length; if (bytes.length > 1048576 || total > 8388608)
        throw new PortalError('LIMIT_EXCEEDED', 413, 'Limite de eventos excedido.'); controller.enqueue(bytes); };
    const poll = async () => { if (closed || busy)
        return; busy = true; try {
        await verifyPrincipal(req);
        const items = await inbox.unread(p!.actor);
        if (closed)
            return;
        if (items.length)
            send('data: ' + JSON.stringify({ tipo: 'novas_notificacoes', notificacoes: items }) + '\n\n');
        else
            send(': heartbeat\n\n');
    }
    catch (e) {
        close(e);
    }
    finally {
        busy = false;
    } };
    const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; send('retry:3000\n\n'); req.signal.addEventListener('abort', abort, { once: true }); if (req.signal.aborted) {
            close();
            return;
        } tick = setInterval(() => void poll(), 8000); deadline = setTimeout(() => close(), 45000); void poll(); }, cancel() { if (closed)
            return; closed = true; clearInterval(tick); clearTimeout(deadline); req.signal.removeEventListener('abort', abort); } });
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' } });
};
