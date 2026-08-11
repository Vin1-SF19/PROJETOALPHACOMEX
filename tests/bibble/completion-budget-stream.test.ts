import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  callCompletion,
  consumeCompletionStream,
  isOutputTruncated,
  type ChatMessage,
} from "@/lib/bibble/completion";

const messages: ChatMessage[] = [{ role: "user", content: "SENTINELA_PRIVADA" }];

describe("Bibble provider output budget", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["qwen3:14b", "max_tokens"],
    ["gpt-4o", "max_tokens"],
    ["o1-preview", "max_completion_tokens"],
    ["claude-sonnet-4-6", "max_tokens"],
    ["gemini-2.0-flash", "max_tokens"],
  ])("serializes the output limit for %s", async (model, outputKey) => {
    await callCompletion(
      messages,
      [],
      model,
      new AbortController().signal,
      false,
      0.2,
      32_768,
      4_096,
    );

    const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body[outputKey]).toBe(4_096);
    if (model === "qwen3:14b") {
      expect(body.options).toEqual({ num_ctx: 32_768, num_predict: 4_096 });
    }
  });

  it("serializes the same output limit for the final streaming call", async () => {
    fetchMock.mockResolvedValueOnce(new Response("data: [DONE]\n\n", { status: 200 }));

    await callCompletion(
      messages,
      [],
      "gpt-4o",
      new AbortController().signal,
      true,
      undefined,
      128_000,
      4_096,
    );

    const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      stream: true,
      max_tokens: 4_096,
    });
  });

  it("logs only request metadata and never prompt content", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await callCompletion(
      messages,
      [],
      "gpt-4o",
      new AbortController().signal,
      false,
      undefined,
      128_000,
      4_096,
    );

    expect(JSON.stringify(info.mock.calls)).not.toContain("SENTINELA_PRIVADA");
  });
});

describe("Bibble provider SSE consumption", () => {
  it("preserves every fragmented chunk, including EOF without a final newline", async () => {
    const frames = [
      'data: {"choices":[{"delta":{"content":"início "},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":"meio "},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":"fim"},"finish_reason":"length"}]}',
    ].join("");
    const encoded = new TextEncoder().encode(frames);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, 37));
        controller.enqueue(encoded.slice(37, 101));
        controller.enqueue(encoded.slice(101));
        controller.close();
      },
    });
    let received = "";

    const result = await consumeCompletionStream(
      new Response(stream),
      chunk => { received += chunk; },
    );

    expect(received).toBe("início meio fim");
    expect(result).toEqual({ finishReason: "length", chunks: 3 });
    expect(isOutputTruncated(result.finishReason)).toBe(true);
    expect(isOutputTruncated("stop")).toBe(false);
  });
});
