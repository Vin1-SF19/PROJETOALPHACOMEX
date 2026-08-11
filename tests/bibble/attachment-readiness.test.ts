import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  areAttachmentsReady,
  BIBBLE_MAX_FILES_PER_TURN,
  canSendBibbleMessage,
  selectAttachmentsWithinLimit,
} from "@/lib/bibble/attachments";

const readyFile = {
  uploading: false,
  uploadUrl: "https://blob.invalid/document.pdf",
};

describe("Bibble attachment send guard", () => {
  it.each([
    { file: { uploading: true, uploadUrl: undefined }, scenario: "upload pendente" },
    { file: { uploading: false, error: "falhou", uploadUrl: undefined }, scenario: "upload com erro" },
    { file: { uploading: false, uploadUrl: undefined }, scenario: "anexo sem URL confirmada" },
  ])("blocks button and Enter for $scenario", ({ file }) => {
    const onSend = vi.fn();
    const canSend = canSendBibbleMessage({
      text: "analise",
      files: [file],
      isStreaming: false,
    });
    if (canSend) onSend();

    expect(canSend).toBe(false);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("allows one send only after every attachment becomes ready", () => {
    expect(areAttachmentsReady([readyFile, { ...readyFile, uploading: true }])).toBe(false);
    expect(canSendBibbleMessage({
      text: "",
      files: [readyFile, readyFile],
      isStreaming: false,
    })).toBe(true);
  });

  it("blocks the eleventh attachment before upload or send", () => {
    const current = Array.from({ length: BIBBLE_MAX_FILES_PER_TURN }, (_, index) => index);
    expect(selectAttachmentsWithinLimit(current, [10])).toEqual([]);
    expect(selectAttachmentsWithinLimit(current.slice(0, -1), [9, 10])).toEqual([9]);
  });

  it("keeps the defensive layout guard before any message or input cleanup", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/BibbleChatHome/BibbleChatLayout.tsx"),
      "utf8",
    );
    const guard = source.indexOf("if (!areAttachmentsReady(uploadFiles)) return;");
    const clearText = source.indexOf('setInputValue("");', guard);
    const clearFiles = source.indexOf("setUploadFiles([]);", guard);
    const createMessage = source.indexOf("const userMsg", guard);

    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(clearText);
    expect(guard).toBeLessThan(clearFiles);
    expect(guard).toBeLessThan(createMessage);
    expect(source).toContain("lastSentRef.current = { text, files: filesAtSend }");
    expect(source).toContain("const readyFiles = filesAtSend;");
    expect(source).toContain("const filesForChat = filesAtSend");
  });

  it("migrates the client default away from the legacy 4,096 window", () => {
    const layout = readFileSync(
      join(process.cwd(), "src/components/BibbleChatHome/BibbleChatLayout.tsx"),
      "utf8",
    );
    expect(layout).toContain("const DEFAULT_CONTEXT_WINDOW = 32_768;");
    expect(layout).toContain("stored > 4_096");
  });

  it("uses the direct single-generation path for PDF turns", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/bibble/chat/route.ts"),
      "utf8",
    );
    expect(route).toContain("const toolsForTurn = hasAttachments ? [] : toolsToUse;");
    expect(route).toContain("!hasAttachments && mensagemSolicitaAbrirChamado(message)");
    expect(route).toContain("if (tools.length > 0)");
    expect(route).toContain("const streamRes = await callCompletion(");
    expect(route).toContain("export const maxDuration = 120;");
    expect(route).toContain("successful: !truncated");
  });

  it("restores the exact turn and returns before persistence on stream failure", () => {
    const layout = readFileSync(
      join(process.cwd(), "src/components/BibbleChatHome/BibbleChatLayout.tsx"),
      "utf8",
    );
    const consume = layout.indexOf("fullResponse = await consumeChatStream");
    const failureCatch = layout.indexOf("} catch (err) {", consume);
    const restoreFiles = layout.indexOf("setUploadFiles(filesAtSend);", failureCatch);
    const stopFailureFlow = layout.indexOf("return;", restoreFiles);
    const persist = layout.indexOf(
      "await saveMessages(sessionId, persistedContent, fullResponse);",
      failureCatch,
    );

    expect(failureCatch).toBeGreaterThan(consume);
    expect(restoreFiles).toBeGreaterThan(failureCatch);
    expect(stopFailureFlow).toBeLessThan(persist);
  });

  it("contains no legacy fixed PDF cuts in upload, route, or persistence", () => {
    const files = [
      "src/app/api/bibble/upload-to-blob/route.ts",
      "src/app/api/bibble/chat/route.ts",
      "src/components/BibbleChatHome/BibbleChatLayout.tsx",
    ].map(path => readFileSync(join(process.cwd(), path), "utf8"));
    const combined = files.join("\n");

    expect(combined).not.toContain("MAX_CONTENT_CHARS");
    expect(combined).not.toContain("slice(0, 50000)");
    expect(combined).not.toContain("slice(0, 25000)");
  });
});
