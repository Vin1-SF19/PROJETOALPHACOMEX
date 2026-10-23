import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod/v3';
import { CONTRACT_VERSION, JSON_REQUEST_BYTES, JSON_RESPONSE_BYTES, errorCodeSchema } from '../../../contracts/portal-api/v1';
import { readBounded, PortalTransportError } from '../../../contracts/portal-api/sdk.server';
import { verifyApp, verifyPrincipal, type PortalPrincipal } from './auth';
import { PortalError } from './errors';
export async function jsonInput<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
    if (request.headers.get('content-encoding') || request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
        throw new PortalError('UNSUPPORTED_MEDIA', 415, 'Envie JSON UTF-8 sem compressão.');
    if (Number(request.headers.get('content-length')) > JSON_REQUEST_BYTES) {
        await request.body?.cancel();
        throw new PortalError('LIMIT_EXCEEDED', 413, 'Corpo excede o limite.');
    }
    const bytes = await readBounded(request.body, JSON_REQUEST_BYTES, request.signal);
    let data: unknown;
    try {
        data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes), (key, value) => { if (key === '__proto__' || key === 'constructor' || key === 'prototype')
            throw new Error(); return value; });
    }
    catch {
        throw new PortalError('VALIDATION', 400, 'JSON inválido.');
    }
    return schema.parse(data);
}
export function queryInput<S extends z.ZodTypeAny>(request: Request, schema: S): z.infer<S> {
    const query = new URL(request.url).searchParams;
    const values: Record<string, unknown> = Object.create(null);
    for (const [key, value] of query) {
        if (key in values)
            throw new PortalError('VALIDATION', 400, 'Parâmetro repetido.');
        if (['page', 'pageSize', 'analistaId', 'clienteId'].includes(key)) {
            if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
                throw new PortalError('VALIDATION', 400, 'Número inválido.');
            values[key] = Number(value);
        }
        else if (['semAnalista', 'excluidos'].includes(key)) {
            if (value !== 'true' && value !== 'false')
                throw new PortalError('VALIDATION', 400, 'Booleano inválido.');
            values[key] = value === 'true';
        }
        else
            values[key] = value;
    }
    return schema.parse(values);
}
function headers(requestId: string) { return { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId, 'X-Portal-Contract-Version': CONTRACT_VERSION }; }
function json(data: unknown, status: number, requestId: string, extra?: Record<string, string>) { const body = JSON.stringify(data); if (Buffer.byteLength(body) > JSON_RESPONSE_BYTES)
    throw new PortalError('LIMIT_EXCEEDED', 413, 'Resposta excede o limite.'); return new Response(body, { status, headers: { ...headers(requestId), ...extra } }); }
export function success(data: unknown, requestId: string) { return json({ ok: true, data, requestId }, 200, requestId); }
export function failure(error: unknown, requestId: string) {
    let code = 'INTERNAL', status = 500, message = 'Não foi possível concluir a operação.', retryAfter: number | undefined;
    if (error instanceof PortalError || error instanceof PortalTransportError) {
        ({ code, status, message } = error);
        if (error instanceof PortalError)
            retryAfter = error.retryAfter;
    }
    else if (error instanceof z.ZodError || (error instanceof Error && error.name === 'ZodError')) {
        code = 'VALIDATION';
        status = 400;
        message = 'Confira os campos informados.';
    }
    else if (error instanceof Error && 'code' in error) {
        const parsed = errorCodeSchema.safeParse(error.code);
        if (parsed.success) {
            code = parsed.data;
            status = { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, CONFLICT: 409, UPLOAD_INVALID: 400, LIMIT_EXCEEDED: 413, RETRYABLE: 503, MODEL_EMPTY: 409, MODEL_CODE_CONFLICT: 409, INTERNAL: 500, UNSUPPORTED_MEDIA: 415, RATE_LIMITED: 429, GONE: 410 }[parsed.data];
            message = error.message;
        }
        else if (error.code === 'P2002') {
            code = 'CONFLICT';
            status = 409;
            message = 'Este e-mail ja esta em uso por outra conta';
        }
        else if (String(error).includes('SQLITE_BUSY')) {
            code = 'RETRYABLE';
            status = 503;
            message = 'Serviço ocupado. Repita a mesma operação.';
        }
    }
    if (code === 'NOT_FOUND')
        message = 'Recurso não encontrado.';
    return json({ ok: false, error: { code, message }, requestId }, status, requestId, retryAfter ? { 'Retry-After': String(Math.max(1, Math.min(3600, retryAfter))) } : undefined);
}
export type PortalHandler = (request: Request, principal: PortalPrincipal | undefined, requestId: string) => Promise<Response>;
export function route(operationId: string, mode: 'A' | 'P', handler: PortalHandler) {
    return async (request: Request) => {
        const requestId = randomUUID(), start = Date.now();
        let response: Response;
        const abort = new AbortController();
        const cancel = () => abort.abort();
        request.signal.addEventListener('abort', cancel, { once: true });
        const timer = setTimeout(cancel, operationId === 'notificationStream' ? 45000 : ['avatar', 'uploadAvatar', 'downloadDocument'].includes(operationId) ? 50000 : 20000);
        try {
            if (Buffer.byteLength(new URL(request.url).pathname + new URL(request.url).search) > 8192)
                throw new PortalError('LIMIT_EXCEEDED', 413, 'URL excede o limite.');
            if (request.method === 'GET' && (request.body || Number(request.headers.get('content-length')) > 0 || request.headers.has('transfer-encoding')))
                throw new PortalError('VALIDATION', 400, 'GET não aceita corpo.');
            const scoped = new Request(request, { signal: AbortSignal.any([request.signal, abort.signal]) });
            const principal = mode === 'P' ? await verifyPrincipal(scoped) : (verifyApp(scoped), undefined);
            response = await Promise.race([handler(scoped, principal, requestId), new Promise<never>((_, reject) => { if (abort.signal.aborted)
                    reject(new PortalError('RETRYABLE', 504, 'Tempo limite excedido.'));
                else
                    abort.signal.addEventListener('abort', () => reject(new PortalError('RETRYABLE', 504, 'Tempo limite excedido.')), { once: true }); })]);
            response.headers.set('X-Portal-Contract-Version', CONTRACT_VERSION);
            response.headers.set('X-Request-Id', requestId);
        }
        catch (error) {
            response = failure(error, requestId);
        }
        finally {
            clearTimeout(timer);
            request.signal.removeEventListener('abort', cancel);
        }
        console.info('[portal-api]', { requestId, operationId, status: response.status, durationMs: Date.now() - start });
        return response;
    };
}
export function methodNotAllowed(allow: string) { return () => { const response = failure(new PortalError('VALIDATION', 405, 'Método não permitido.'), randomUUID()); response.headers.set('Allow', allow); return response; }; }
