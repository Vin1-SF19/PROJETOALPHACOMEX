import { afterEach, describe, expect, it, vi } from "vitest";
import { criarFetchBanco } from "@/lib/db-fetch";
import { PrismaLibSQL } from "@prisma/adapter-libsql/web";

afterEach(() => vi.useRealTimers());

describe("bounded DB transport, no replay", () => {
  it("preserves response and keeps deadline through a body that never finishes", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream({ cancel }), { status: 201, headers: { "x-proof": "kept" } }));
    const response = await criarFetchBanco(transport, 50)("https://db.invalid/v2/pipeline", { method: "POST", body: "write" });
    expect(response.status).toBe(201);
    expect(response.headers.get("x-proof")).toBe("kept");
    const pending = response.text();
    const assertion = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
    expect(cancel).toHaveBeenCalledOnce();
    expect(transport).toHaveBeenCalledOnce();
    expect((transport.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
  });

  it("combines original Request and init signals and preserves abort reason", async () => {
    const original = new AbortController();
    const another = new AbortController();
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream()));
    const response = await criarFetchBanco(transport)(new Request("https://db.invalid", { signal: original.signal }), { signal: another.signal });
    const text = response.text();
    const failure = expect(text).rejects.toBe("original cancelled");
    original.abort("original cancelled");
    await failure;
    expect(transport.mock.calls[0][1]?.signal?.reason).toBe("original cancelled");
  });

  it("does not send an already cancelled request", async () => {
    const controller = new AbortController();
    controller.abort("cancelled");
    const transport = vi.fn<typeof fetch>();
    await expect(criarFetchBanco(transport)("https://db.invalid", { signal: controller.signal })).rejects.toBe("cancelled");
    expect(transport).not.toHaveBeenCalled();
  });

  it("cleans the deadline after completion or consumer cancellation", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("complete"))
      .mockResolvedValueOnce(new Response(new ReadableStream({ cancel })));
    const bounded = criarFetchBanco(transport, 50);
    expect(await (await bounded("https://db.invalid")).text()).toBe("complete");
    expect(vi.getTimerCount()).toBe(0);
    const response = await bounded("https://db.invalid");
    await response.body?.cancel("reader stopped");
    expect(cancel).toHaveBeenCalledWith("reader stopped");
    expect(transport.mock.calls[1][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never retries writes on transport failure", async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(criarFetchBanco(transport)("https://db.invalid", { method: "POST", body: "COMMIT" })).rejects.toThrow("fetch failed");
    expect(transport).toHaveBeenCalledOnce();
  });

  it("measures adapter mutex wait separately from the per-roundtrip budget", async () => {
    vi.useFakeTimers();
    const started: number[] = [];
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => {
      started.push(Date.now());
      return new Response(new ReadableStream({ start(controller) {
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode(JSON.stringify({
            baton: null,
            results: [
              { type: "ok", response: { type: "execute", result: { cols: [{ name: "value", decltype: "INTEGER" }], rows: [[{ type: "integer", value: "1" }]], affected_row_count: 0, last_insert_rowid: null } } },
              { type: "ok", response: { type: "close" } },
            ],
          })));
          controller.close();
        }, 20);
      } }));
    });
    const adapter = await new PrismaLibSQL({ url: "https://db.invalid", fetch: criarFetchBanco(transport, 30) }).connect();
    const start = Date.now();
    const query = { sql: "SELECT 1 AS value", args: [], argTypes: [] };
    const both = Promise.all([adapter.queryRaw(query), adapter.queryRaw(query)]);
    await vi.runAllTimersAsync();
    expect(await both).toHaveLength(2);
    expect(started.map((time) => time - start)).toEqual([0, 20]);
    expect(Date.now() - start).toBe(40); // Each20ms request fits30ms; queue+request does not.
    await adapter.dispose();
  });
});
