import * as c from '../../../contracts/portal-api/v1';
import { boundedStream } from '../../../contracts/portal-api/sdk.server';
import { queryInput, success, type PortalHandler } from './http';
import { abrirAvatar, salvarAvatar, MAX_AVATAR_BYTES } from '@/lib/perfil/avatar';
import { abrirDocumento } from '@/lib/checklist/documentos';
import { nomeArquivoSeguro } from '@/lib/checklist/storage';
import { scopeDocument } from './scope';
import { verifyPrincipal } from './auth';
import { PortalError } from './errors';
function noRange(request: Request) { if (request.headers.has('range'))
    throw new PortalError('VALIDATION', 416, 'Intervalos não são aceitos.'); }
function sourceSignal(req: Request) { return AbortSignal.any([req.signal, AbortSignal.timeout(10000)]); }
export const uploadAvatar: PortalHandler = async (req, p, rid) => {
    const q = queryInput(req, c.avatarUploadQuerySchema);
    const mime = req.headers.get('content-type')?.split(';')[0] ?? '';
    if (req.headers.has('content-encoding'))
        throw new PortalError('UNSUPPORTED_MEDIA', 415, 'Compressão não é aceita.');
    if (!req.body)
        throw new PortalError('UPLOAD_INVALID', 400, 'Arquivo vazio.');
    if (Number(req.headers.get('content-length')) > MAX_AVATAR_BYTES) {
        await req.body.cancel();
        throw new PortalError('LIMIT_EXCEEDED', 413, 'Foto excede 2 MiB.');
    }
    const result = await salvarAvatar(p!.actor, { nome: q.filename, mime, body: req.body, signal: req.signal });
    await verifyPrincipal(req);
    return success(result, rid);
};
export const avatar: PortalHandler = async (req, p) => {
    queryInput(req, c.avatarQuerySchema);
    noRange(req);
    const source = await abrirAvatar(p!.actor, sourceSignal(req));
    await verifyPrincipal(req);
    return new Response(boundedStream(source.body, { limit: MAX_AVATAR_BYTES, signal: req.signal, deadlineMs: 50000, idleMs: 10000, revalidate: async () => { await verifyPrincipal(req); }, revalidateMs: 5000 }), { headers: { 'Content-Type': source.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
};
export const downloadDocument = (id: string): PortalHandler => async (req, p) => {
    c.idSchema.parse(id);
    queryInput(req, c.emptySchema);
    noRange(req);
    await scopeDocument(p!.actor, id);
    const source = await abrirDocumento(p!.actor, id, sourceSignal(req));
    await verifyPrincipal(req);
    await scopeDocument(p!.actor, id);
    const mime = ['application/pdf', 'image/jpeg', 'image/png'].includes(source.mime.split(';')[0]) ? source.mime.split(';')[0] : 'application/octet-stream';
    return new Response(boundedStream(source.body, { limit: 26214400, signal: req.signal, deadlineMs: 50000, idleMs: 10000, revalidate: async () => { await verifyPrincipal(req); await scopeDocument(p!.actor, id); }, revalidateMs: 5000 }), { headers: { 'Content-Type': mime, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nomeArquivoSeguro(source.nome))}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
};
