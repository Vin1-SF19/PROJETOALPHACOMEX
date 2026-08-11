import { describe, expect, it } from "vitest";

import {
  BibbleIncompleteStreamError,
  consumeBibbleAppStream,
} from "@/lib/bibble/client-stream";

function responseFromFrames(frames: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  }));
}

describe("Bibble application SSE protocol", () => {
  it("accepts a stream only after an explicit successful done event", async () => {
    const events: string[] = [];
    const response = responseFromFrames([
      'data: {"type":"text","text":"resposta"}\n\n',
      'data: {"type":"done","finishReason":"stop","successful":true}\n\n',
    ]);

    const result = await consumeBibbleAppStream(response, event => events.push(event.type));

    expect(events).toEqual(["text", "done"]);
    expect(result.doneEvent.finishReason).toBe("stop");
  });

  it("rejects physical EOF after partial text when app done never arrived", async () => {
    const partial: string[] = [];
    const response = responseFromFrames([
      'data: {"type":"text","text":"parcial"}\n\n',
    ]);

    await expect(consumeBibbleAppStream(response, event => {
      if (event.text) partial.push(event.text);
    })).rejects.toBeInstanceOf(BibbleIncompleteStreamError);
    expect(partial).toEqual(["parcial"]);
  });

  it("rejects an explicit done marked unsuccessful", async () => {
    const response = responseFromFrames([
      'data: {"type":"error","message":"provider-eof"}\n\n',
      'data: {"type":"done","successful":false}\n\n',
    ]);

    await expect(consumeBibbleAppStream(response, () => undefined))
      .rejects.toThrow("incompleto");
  });

  it("rejects truncated done even if a legacy server marks it successful", async () => {
    const messages: string[] = [];
    const response = responseFromFrames([
      'data: {"type":"error","message":"A resposta atingiu o limite de saída."}\n\n',
      'data: {"type":"done","finishReason":"length","truncated":true,"successful":true}\n\n',
    ]);

    await expect(consumeBibbleAppStream(response, event => {
      if (event.message) messages.push(event.message);
    })).rejects.toThrow("limite de saída");
    expect(messages).toEqual(["A resposta atingiu o limite de saída."]);
  });
});
