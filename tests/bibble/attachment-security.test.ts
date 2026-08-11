import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BIBBLE_MAX_FILES_PER_TURN,
  BIBBLE_HISTORY_MESSAGE_MAX_CHARS,
  BIBBLE_HISTORY_TOTAL_MAX_CHARS,
  BIBBLE_UPLOAD_TEXT_MAX_CHARS,
  BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET,
  bibbleChatInputSchema,
  fetchTrustedBibbleBlob,
  hasPdfMagicBytes,
  parseTrustedBibbleBlobUrl,
  readRequestTextWithLimit,
} from "@/lib/bibble/attachment-security";
import { selectTextForTokenBudget } from "@/lib/bibble/context-budget";
import { resolveSameOriginUrl } from "@/lib/bibble/pdf24-ocr";

const validFile = {
  name: "documento.pdf",
  type: "application/pdf",
  size: 128,
  url: "https://store.public.blob.vercel-storage.com/bibble-chat/opaque-id",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fronteiras de anexos do Bibble", () => {
  it("mantém as proteções conectadas às rotas nativas", () => {
    const chatRoute = readFileSync(resolve("src/app/api/bibble/chat/route.ts"), "utf8");
    const uploadRoute = readFileSync(resolve("src/app/api/bibble/upload-to-blob/route.ts"), "utf8");
    const tika = readFileSync(resolve("src/lib/bibble/tika.ts"), "utf8");
    const pdf24 = readFileSync(resolve("src/lib/bibble/pdf24-ocr.ts"), "utf8");
    const input = readFileSync(resolve("src/components/BibbleChatHome/BibbleChatInput.tsx"), "utf8");
    const layout = readFileSync(resolve("src/components/BibbleChatHome/BibbleChatLayout.tsx"), "utf8");

    expect(chatRoute).toContain("bibbleChatInputSchema.safeParse");
    expect(chatRoute).toContain("const toolsForTurn = hasAttachments ? [] : toolsToUse;");
    expect(chatRoute).toContain("status: 413");
    expect(uploadRoute).toContain("hasPdfMagicBytes(buffer)");
    expect(uploadRoute).toContain("const uniqueName = crypto.randomUUID();");
    expect(uploadRoute).toContain("selectTextForTokenBudget(");
    expect(tika).toContain("fetchTrustedBibbleBlob(url");
    expect(pdf24).toContain("const url = resolveSameOriginUrl(PDF24_URL, file.path).href;");
    expect(pdf24).toContain("redirect: \"manual\"");
    expect(input).toContain("accept={BIBBLE_ATTACHMENT_ACCEPT}");
    expect(layout).toContain("selectAttachmentsWithinLimit(uploadFiles, acceptedFiles)");
    expect(layout).toContain("if (uploadFiles.length > BIBBLE_MAX_FILES_PER_TURN) return;");
  });

  it("aceita somente HTTPS do Vercel Blob no prefixo isolado", () => {
    expect(parseTrustedBibbleBlobUrl(validFile.url)?.pathname).toBe("/bibble-chat/opaque-id");
    expect(parseTrustedBibbleBlobUrl("http://store.public.blob.vercel-storage.com/bibble-chat/id")).toBeNull();
    expect(parseTrustedBibbleBlobUrl("https://store.public.blob.vercel-storage.com/outro/id")).toBeNull();
    expect(parseTrustedBibbleBlobUrl("https://blob.vercel-storage.com.evil.test/bibble-chat/id")).toBeNull();
    expect(parseTrustedBibbleBlobUrl("https://store.public.blob.vercel-storage.com/bibble-chat/%2e%2e/secret")).toBeNull();
  });

  it("bloqueia redirects antes de seguir para outra origem", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { Location: "https://evil.test/file" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTrustedBibbleBlob(validFile.url)).rejects.toThrow("Redirecionamento");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("valida magic bytes de PDF", () => {
    expect(hasPdfMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
    expect(hasPdfMagicBytes(new TextEncoder().encode("not a pdf"))).toBe(false);
  });

  it("aplica Zod strict e limites ao ChatInput", () => {
    expect(bibbleChatInputSchema.safeParse({ message: "leia", history: [], files: [validFile] }).success).toBe(true);
    expect(bibbleChatInputSchema.safeParse({ message: "oi", history: [], extra: true }).success).toBe(false);
    expect(bibbleChatInputSchema.safeParse({ message: "oi", history: [], files: [{ ...validFile, type: "" }] }).success).toBe(false);
    expect(bibbleChatInputSchema.safeParse({ message: "oi", history: [], files: [{ ...validFile, type: "image/svg+xml" }] }).success).toBe(false);
    expect(bibbleChatInputSchema.safeParse({ message: "oi", history: [], files: [{ ...validFile, type: "application/zip" }] }).success).toBe(false);
    expect(bibbleChatInputSchema.safeParse({
      message: "oi",
      history: [],
      files: Array.from({ length: BIBBLE_MAX_FILES_PER_TURN + 1 }, () => validFile),
    }).success).toBe(false);
    expect(bibbleChatInputSchema.safeParse({ message: "oi", history: [], contextWindow: 512 }).success).toBe(true);
    expect(bibbleChatInputSchema.safeParse({ message: "oi", history: [], files: [{ ...validFile, base64: "abc" }] }).success).toBe(false);
  });

  it("aceita no turno seguinte o histórico persistido com o envelope máximo de anexos", () => {
    const extracted = "x".repeat(BIBBLE_UPLOAD_TEXT_MAX_CHARS);
    const persistedTurn = [
      "pergunta original",
      "---\n### Conteúdo dos arquivos anexados",
      ...Array.from(
        { length: BIBBLE_MAX_FILES_PER_TURN },
        (_, index) => `#### 📄 arquivo-${index}.pdf\n\`\`\`\n${extracted}\n\`\`\``,
      ),
      "---",
    ].join("\n\n");

    expect(persistedTurn.length).toBeGreaterThan(BIBBLE_UPLOAD_TEXT_MAX_CHARS);
    expect(persistedTurn.length).toBeLessThanOrEqual(BIBBLE_HISTORY_MESSAGE_MAX_CHARS);
    expect(bibbleChatInputSchema.safeParse({
      message: "agora compare as conclusões",
      history: [{ role: "user", text: persistedTurn }],
    }).success).toBe(true);
    expect(bibbleChatInputSchema.safeParse({
      message: "continuação",
      history: [{ role: "user", text: "x".repeat(BIBBLE_HISTORY_MESSAGE_MAX_CHARS + 1) }],
    }).success).toBe(false);
  });

  it("limita o texto do upload preservando início, meio e fim com aviso", () => {
    const input = `INICIO-${"a".repeat(BIBBLE_UPLOAD_TEXT_MAX_CHARS)}-MEIO-${"b".repeat(BIBBLE_UPLOAD_TEXT_MAX_CHARS)}-FIM`;
    const selected = selectTextForTokenBudget(input, BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET, "upload");

    expect(selected.reduced).toBe(true);
    expect(selected.strategy).toBe("head-middle-tail");
    expect(selected.text.length).toBeLessThanOrEqual(BIBBLE_UPLOAD_TEXT_MAX_CHARS);
    expect(selected.text).toContain("INICIO");
    expect(selected.text).toContain("MEIO");
    expect(selected.text).toContain("FIM");
    expect(selected.text).toContain("CAPACIDADE");
  });

  it("rejeita histórico agregado e corpo bruto acima dos tetos", async () => {
    const historyChunk = "x".repeat(BIBBLE_HISTORY_MESSAGE_MAX_CHARS);
    const excessiveHistory = Array.from(
      { length: Math.ceil(BIBBLE_HISTORY_TOTAL_MAX_CHARS / historyChunk.length) + 1 },
      () => ({ role: "user" as const, text: historyChunk }),
    );
    expect(bibbleChatInputSchema.safeParse({ message: "continuação", history: excessiveHistory }).success).toBe(false);

    const oversizedRequest = new Request("https://app.test/api/bibble/chat", {
      method: "POST",
      body: "payload maior que o limite",
    });
    await expect(readRequestTextWithLimit(oversizedRequest, 8)).rejects.toThrow("excede o limite");
  });

  it("mantém downloads PDF24 na mesma origem configurada", () => {
    expect(resolveSameOriginUrl("https://pdf24.example/api", "/files/result.pdf").href)
      .toBe("https://pdf24.example/files/result.pdf");
    expect(() => resolveSameOriginUrl("https://pdf24.example/api", "https://evil.test/result.pdf"))
      .toThrow("fora da origem");
  });
});
