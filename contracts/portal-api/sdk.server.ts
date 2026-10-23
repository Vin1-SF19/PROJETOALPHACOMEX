import 'server-only';
import { z } from 'zod/v3';
import { CONTRACT_MAJOR, JSON_REQUEST_BYTES, JSON_RESPONSE_BYTES, errorSchema, operations, responseSchemas, successOf, idSchema, type JsonOperationId, type OperationData, type Result, type ErrorCode } from './v1';
export type ResponseMetadata = {
    status: number;
    retryAfterSeconds?: number;
};
const responseMetadataStore = new WeakMap<object, ResponseMetadata>();
/** Transport-only metadata never becomes an enumerable wire/session field. */
export const responseMetadata = (result: object) => responseMetadataStore.get(result);
function httpMetadata(response: Response): ResponseMetadata {
    const value = response.headers.get('retry-after') ?? '';
    return { status: response.status, ...(/^[1-9]\d{0,3}$/.test(value) && Number(value) <= 3600 ? { retryAfterSeconds: Number(value) } : {}) };
}
export class PortalTransportError extends Error {
    readonly requestId: string;
    constructor(public code: ErrorCode, message: string, public status: number, public retryAfterSeconds?: number, requestId?: string) { super(message); this.requestId = requestId ?? crypto.randomUUID(); }
}
export function validateOrigin(value: string, environment: 'local' | 'staging'): string {
    const url = new URL(value);
    if (url.origin !== value || url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(environment === 'local' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))))
        throw new Error('Invalid fixed Portal origin');
    return value;
}
export type PortalClientConfig = {
    origin: string;
    environment: 'local' | 'staging';
    appId: 'painelclientes';
    keyId: string;
    key: string;
    fetch?: typeof fetch;
};
export type CallOptions = {
    token?: string;
    id?: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    signal?: AbortSignal;
    clientIp?: string;
};
export async function readBounded(body: ReadableStream<Uint8Array> | null, limit: number, signal?: AbortSignal): Promise<Uint8Array> {
    if (!body)
        return new Uint8Array();
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const abort = () => { void reader.cancel().catch(() => { }); };
    signal?.addEventListener('abort', abort, { once: true });
    try {
        for (;;) {
            if (signal?.aborted)
                throw new PortalTransportError('RETRYABLE', 'Tempo limite excedido.', 504);
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > limit)
                throw new PortalTransportError('LIMIT_EXCEEDED', 'Limite de dados excedido.', 413);
            chunks.push(value);
        }
        if (signal?.aborted)
            throw new PortalTransportError('RETRYABLE', 'Tempo limite excedido.', 504);
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
        }
        return bytes;
    }
    catch (error) {
        void reader.cancel().catch(() => { });
        throw error;
    }
    finally {
        signal?.removeEventListener('abort', abort);
        reader.releaseLock();
    }
}
/** Backpressure, actual byte accounting, idempotent cancellation and active deadlines. */
export function boundedStream(source: ReadableStream<Uint8Array>, options: {
    limit: number;
    signal?: AbortSignal;
    deadlineMs: number;
    idleMs: number;
    revalidate?: () => Promise<void>;
    revalidateMs?: number;
    onClose?: () => void;
}): ReadableStream<Uint8Array> {
    const reader = source.getReader();
    let closed = false, total = 0;
    let idle: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval> | undefined;
    let busy = false;
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const finish = (error?: unknown) => {
        if (closed)
            return;
        closed = true;
        clearTimeout(deadline);
        clearTimeout(idle);
        if (interval)
            clearInterval(interval);
        options.signal?.removeEventListener('abort', abort);
        options.onClose?.();
        if (error)
            controller.error(error);
        else
            controller.close();
        void reader.cancel(error).catch(() => { });
    };
    const abort = () => finish(new PortalTransportError('RETRYABLE', 'Transferência interrompida.', 504));
    const deadline = setTimeout(abort, options.deadlineMs);
    const resetIdle = () => { clearTimeout(idle); idle = setTimeout(abort, options.idleMs); };
    return new ReadableStream<Uint8Array>({
        start(c) {
            controller = c;
            resetIdle();
            options.signal?.addEventListener('abort', abort, { once: true });
            if (options.signal?.aborted) {
                abort();
                return;
            }
            if (options.revalidate)
                interval = setInterval(async () => {
                    if (busy || closed)
                        return;
                    busy = true;
                    try {
                        await options.revalidate?.();
                    }
                    catch (e) {
                        finish(e);
                    }
                    finally {
                        busy = false;
                    }
                }, options.revalidateMs ?? 5000);
        },
        async pull(c) {
            if (closed)
                return;
            try {
                const { done, value } = await reader.read();
                if (closed)
                    return;
                if (done) {
                    finish();
                    return;
                }
                total += value.byteLength;
                if (total > options.limit)
                    throw new PortalTransportError('LIMIT_EXCEEDED', 'Limite de arquivo excedido.', 413);
                resetIdle();
                c.enqueue(value);
            }
            catch (e) {
                finish(e);
            }
        },
        cancel(reason) {
            if (closed)
                return;
            closed = true;
            clearTimeout(deadline);
            clearTimeout(idle);
            if (interval)
                clearInterval(interval);
            options.signal?.removeEventListener('abort', abort);
            options.onClose?.();
            return reader.cancel(reason);
        },
    });
}
export function safeStreamHeaders(response: Response, sse = false): Headers {
    const headers = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    const type = response.headers.get('content-type')?.split(';')[0];
    if (type && (sse ? type === 'text/event-stream' : ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'].includes(type)))
        headers.set('Content-Type', sse ? 'text/event-stream; charset=utf-8' : type);
    else
        throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', 502);
    const disposition = response.headers.get('content-disposition');
    if (disposition && !/[\x00-\x1f\x7f]/.test(disposition) && disposition.length <= 1000 && /^(inline|attachment)(;|$)/.test(disposition))
        headers.set('Content-Disposition', disposition);
    const rid = response.headers.get('x-request-id');
    if (rid && z.string().uuid().safeParse(rid).success)
        headers.set('X-Request-Id', rid);
    if (sse)
        headers.set('X-Accel-Buffering', 'no');
    return headers;
}
export function createPortalClient(config: PortalClientConfig) {
    validateOrigin(config.origin, config.environment);
    if (config.appId !== 'painelclientes' || !/^[A-Za-z0-9_-]{1,40}$/.test(config.keyId) || !/^[A-Za-z0-9_-]{43}$/.test(config.key))
        throw new Error('Invalid Portal app configuration');
    const transport = config.fetch ?? fetch;
    async function open(operationId: typeof operations[number]['id'], options: CallOptions, body?: BodyInit | null, contentType?: string) {
        const op = operations.find(o => o.id === operationId);
        if (!op)
            throw new Error('Unknown operation');
        if (op.authMode === 'P' && (!options.token || options.token.length > 8192))
            throw new PortalTransportError('UNAUTHENTICATED', 'Entre novamente.', 401);
        let path: string = op.path;
        if (path.includes('[id]'))
            path = path.replace('[id]', encodeURIComponent(idSchema.parse(options.id)));
        const url = new URL(config.origin + '/api/portal/v1' + path);
        for (const [k, v] of Object.entries(options.query ?? {}))
            if (v !== undefined)
                url.searchParams.set(k, String(v));
        if (new TextEncoder().encode(url.pathname + url.search).length > 8192)
            throw new PortalTransportError('LIMIT_EXCEEDED', 'URL excede o limite.', 413);
        const headers = new Headers({ 'X-Portal-App-Id': config.appId, 'X-Portal-App-Key-Id': config.keyId, 'X-Portal-App-Key': config.key });
        if (op.authMode === 'P')
            headers.set('Authorization', 'Bearer ' + options.token);
        if (options.clientIp && options.clientIp.length <= 128)
            headers.set('X-Portal-Client-IP', options.clientIp);
        if (contentType)
            headers.set('Content-Type', contentType);
        const abort = new AbortController();
        const cancel = () => abort.abort();
        options.signal?.addEventListener('abort', cancel, { once: true });
        if (options.signal?.aborted)
            cancel();
        const total = setTimeout(cancel, operationId === 'notificationStream' ? 50000 : operationId === 'uploadAvatar' || operationId === 'avatar' || operationId === 'downloadDocument' ? 55000 : 25000);
        const initial = setTimeout(cancel, 10000);
        const cleanup = () => { clearTimeout(total); clearTimeout(initial); options.signal?.removeEventListener('abort', cancel); };
        let response: Response | undefined;
        // Until a stream is handed off, this scope owns both fetch and its body.
        // Cancellation hooks may never settle, so disposal must not await them.
        const discard = () => {
            cancel();
            void response?.body?.cancel().catch(() => { });
            cleanup();
        };
        try {
            const init: RequestInit & {
                duplex?: 'half';
            } = { method: op.method, headers, body, redirect: 'manual', cache: 'no-store', signal: abort.signal };
            if (body instanceof ReadableStream)
                init.duplex = 'half';
            response = await transport(url, init);
            clearTimeout(initial);
            if (response.status >= 300 && response.status < 400) {
                throw new PortalTransportError('RETRYABLE', 'Redirecionamento recusado.', 502);
            }
            const version = response.headers.get('x-portal-contract-version');
            if (!version || !/^\d+\.\d+\.\d+$/.test(version) || Number(version.split('.')[0]) !== CONTRACT_MAJOR) {
                throw new PortalTransportError('RETRYABLE', 'Versão de contrato incompatível.', 502);
            }
            return { response, signal: abort.signal, cleanup, discard };
        }
        catch (e) {
            const wasAborted = abort.signal.aborted;
            discard();
            if (e instanceof PortalTransportError)
                throw e;
            throw new PortalTransportError('RETRYABLE', 'Serviço indisponível.', wasAborted ? 504 : 503);
        }
    }
    async function decode(response: Response, signal: AbortSignal): Promise<unknown> {
        if (response.headers.get('content-type')?.split(';')[0] !== 'application/json') {
            throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', 502);
        }
        let bytes: Uint8Array;
        try {
            bytes = await readBounded(response.body, JSON_RESPONSE_BYTES, signal);
        }
        catch (error) {
            if (error instanceof PortalTransportError)
                throw error;
            throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', signal.aborted ? 504 : 502);
        }
        try {
            return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        }
        catch {
            throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', 502);
        }
    }
    return {
        async call<K extends JsonOperationId>(id: K, options: CallOptions = {}): Promise<Result<OperationData<K>>> {
            const body = options.body === undefined ? undefined : JSON.stringify(options.body);
            if (body && new TextEncoder().encode(body).length > JSON_REQUEST_BYTES)
                throw new PortalTransportError('LIMIT_EXCEEDED', 'Corpo excede o limite.', 413);
            const { response, signal, cleanup, discard } = await open(id, options, body, body ? 'application/json' : undefined);
            try {
                const raw = await decode(response, signal);
                if (!response.ok) {
                    const error = errorSchema.safeParse(raw);
                    if (!error.success)
                        throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', 502);
                    responseMetadataStore.set(error.data, httpMetadata(response));
                    return error.data;
                }
                if (response.status !== 200)
                    throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', 502);
                const parsed = successOf(responseSchemas[id]).safeParse(raw);
                if (!parsed.success)
                    throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', 502);
                // Runtime schema chosen by the same operation key validates this association.
                return parsed.data as Result<OperationData<K>>;
            }
            catch (error) {
                discard();
                throw error;
            }
            finally {
                cleanup();
            }
        },
        async stream(id: 'avatar' | 'downloadDocument' | 'notificationStream', options: CallOptions = {}): Promise<Response> {
            const { response, signal, cleanup, discard } = await open(id, options);
            try {
                if (!response.ok) {
                    const error = errorSchema.safeParse(await decode(response, signal));
                    throw new PortalTransportError(error.success ? error.data.error.code : 'RETRYABLE', error.success ? error.data.error.message : 'Resposta inválida.', error.success ? response.status : 502, httpMetadata(response).retryAfterSeconds, error.success ? error.data.requestId : undefined);
                }
                if (response.status !== 200 || !response.body)
                    throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', 502);
                const sse = id === 'notificationStream';
                const headers = safeStreamHeaders(response, sse);
                return new Response(boundedStream(response.body, { limit: sse ? 8388608 : id === 'avatar' ? 2097152 : 26214400, signal, deadlineMs: sse ? 50000 : 55000, idleMs: sse ? 20000 : 10000, onClose: cleanup }), { headers });
            }
            catch (e) {
                discard();
                throw e;
            }
        },
        async uploadAvatar(body: ReadableStream<Uint8Array>, mime: string, options: CallOptions): Promise<Result<{
            url: string;
        }>> {
            const uploadAbort = new AbortController();
            const uploadSignal = options.signal ? AbortSignal.any([options.signal, uploadAbort.signal]) : uploadAbort.signal;
            const bounded = boundedStream(body, { limit: 2097152, signal: uploadSignal, deadlineMs: 50000, idleMs: 10000 });
            try {
                const { response, signal, cleanup, discard } = await open('uploadAvatar', { ...options, signal: uploadSignal }, bounded, mime);
                try {
                    const raw = await decode(response, signal);
                    if (!response.ok) {
                        const error = errorSchema.safeParse(raw);
                        if (error.success) {
                            responseMetadataStore.set(error.data, httpMetadata(response));
                            return error.data;
                        }
                        throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', 502);
                    }
                    if (response.status !== 200)
                        throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', 502);
                    const result = successOf(responseSchemas.uploadAvatar).safeParse(raw);
                    if (!result.success)
                        throw new PortalTransportError('RETRYABLE', 'Resposta inválida.', 502);
                    return result.data;
                }
                catch (error) {
                    discard();
                    throw error;
                }
                finally {
                    cleanup();
                }
            }
            finally {
                uploadAbort.abort();
            }
        },
    };
}
