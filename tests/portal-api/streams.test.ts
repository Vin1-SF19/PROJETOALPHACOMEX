import { afterEach, it, expect, vi } from 'vitest';
import { boundedStream, createPortalClient } from '../../contracts/portal-api/sdk.server';
afterEach(() => {
    try {
        if (vi.isFakeTimers()) expect(vi.getTimerCount()).toBe(0);
    } finally {
        vi.useRealTimers();
    }
});
it('active stream revalidation stops a stalled reader on revocation, cleaning timers and upstream', async () => {
    vi.useFakeTimers();
    let revoked = false;
    const cancel = vi.fn(), check = vi.fn(async () => { if (revoked)
        throw new Error('REVOKED'); });
    const source = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(Uint8Array.of(1)); }, cancel });
    const reader = boundedStream(source, { limit: 25 * 1024 * 1024, deadlineMs: 50000, idleMs: 10000, revalidate: check, revalidateMs: 5000 }).getReader();
    expect((await reader.read()).value).toEqual(Uint8Array.of(1));
    revoked = true;
    const pending = reader.read();
    const rejected = expect(pending).rejects.toThrow('REVOKED');
    await vi.advanceTimersByTimeAsync(5001);
    await rejected;
    expect(check).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
});
it('actual byte limits and caller abort cancel once; completion removes timers', async () => {
    const cancel = vi.fn();
    const source = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array(10)); }, cancel });
    const reader = boundedStream(source, { limit: 8, deadlineMs: 50000, idleMs: 10000 }).getReader();
    await expect(reader.read()).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
    vi.useFakeTimers();
    const abort = new AbortController(), stop = vi.fn();
    const active = boundedStream(new ReadableStream<Uint8Array>({ cancel: stop }), { limit: 10, deadlineMs: 50000, idleMs: 10000, signal: abort.signal }).getReader();
    const pending = active.read();
    const denied = expect(pending).rejects.toMatchObject({ status: 504 });
    abort.abort();
    await denied;
    expect(stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
});
it('idle and total deadlines end streams without a new chunk', async () => {
    vi.useFakeTimers();
    const stop = vi.fn();
    const reader = boundedStream(new ReadableStream<Uint8Array>({ cancel: stop }), { limit: 10, deadlineMs: 50000, idleMs: 10000 }).getReader();
    const pending = expect(reader.read()).rejects.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(10001);
    await pending;
    expect(stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
});

it.each([
    {status:200,mime:'text/html'},
    {status:201,mime:'application/pdf'},
])('rejected stream $status/$mime cancels body and aborts upstream before caller cleanup',async({status,mime})=>{
    vi.useFakeTimers();
    const caller=new AbortController(),signals:AbortSignal[]=[];
    // A pending underlying cancellation must not hold the protocol error open.
    const cancel=vi.fn(()=>new Promise<void>(()=>{}));
    const source=new ReadableStream<Uint8Array>({cancel});
    const client=createPortalClient({origin:'http://localhost:4391',environment:'local',appId:'painelclientes',keyId:'test-app',key:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',fetch:async(_url,init)=>{
        if(!init?.signal)throw new Error('Expected upstream signal');
        signals.push(init.signal);
        return new Response(source,{status,headers:{'Content-Type':mime,'X-Portal-Contract-Version':'1.0.0'}});
    }});
    await expect(client.stream('downloadDocument',{id:'document-one',token:'opaque',signal:caller.signal})).rejects.toMatchObject({code:'RETRYABLE',status:502});
    expect(cancel).toHaveBeenCalledOnce();
    expect(signals[0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    caller.abort();
    await vi.advanceTimersByTimeAsync(60000);
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
});
it('preaborted revalidation stream cancels once and creates no surviving timer or callback',async()=>{
    vi.useFakeTimers();
    const caller=new AbortController(),cancel=vi.fn(),revalidate=vi.fn(async()=>{});
    caller.abort();
    const reader=boundedStream(new ReadableStream<Uint8Array>({cancel}),{limit:25*1024*1024,signal:caller.signal,deadlineMs:50000,idleMs:10000,revalidate,revalidateMs:5000}).getReader();
    await expect(reader.read()).rejects.toMatchObject({status:504});
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    caller.abort();
    await reader.cancel().catch(()=>{});
    await vi.advanceTimersByTimeAsync(60000);
    expect(cancel).toHaveBeenCalledOnce();
    expect(revalidate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});
