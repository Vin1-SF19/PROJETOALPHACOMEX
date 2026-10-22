import { get, put } from "@vercel/blob";
import { fail } from "./result";
export interface ChecklistStorage {
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  get(
    key: string,
    signal: AbortSignal,
  ): Promise<{ body: ReadableStream<Uint8Array>; mime: string; size: number }>;
}
export function storageConfig() {
  const token = process.env.CHECKLIST_PRIVATE_BLOB_TOKEN;
  const prefix = process.env.CHECKLIST_STORAGE_PREFIX;
  if (
    !token ||
    !prefix ||
    !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_/-]+\/$/.test(prefix) ||
    prefix.includes("..")
  )
    fail("UPLOAD_INVALID", "Armazenamento privado ainda não está configurado.");
  return { token, prefix };
}
export function storageDriver(): ChecklistStorage {
  const { token, prefix } = storageConfig();
  return {
    async put(key, bytes, mime) {
      if (!key.startsWith(prefix))
        fail("UPLOAD_INVALID", "Chave de arquivo inválida.");
      await put(key, Buffer.from(bytes), {
        access: "private",
        token,
        contentType: mime,
        addRandomSuffix: false,
        allowOverwrite: false,
      });
    },
    async get(key, signal) {
      if (!key.startsWith(prefix) || key.includes("..") || key.includes("://"))
        fail("UPLOAD_INVALID", "Chave de arquivo inválida.");
      const response = await get(key, {
        access: "private",
        token,
        abortSignal: signal,
        useCache: false,
      });
      if (!response || response.statusCode !== 200)
        fail("NOT_FOUND", "Arquivo indisponível.");
      return {
        body: response.stream,
        mime: response.blob.contentType,
        size: response.blob.size,
      };
    },
  };
}
export function legacyUrlPermitida(value: string) {
  let hosts: unknown;
  try {
    hosts = JSON.parse(process.env.CHECKLIST_LEGACY_ALLOWED_HOSTS ?? "[]");
  } catch {
    fail("UPLOAD_INVALID", "Allowlist de armazenamento legado inválida.");
  }
  if (
    !Array.isArray(hosts) ||
    hosts.some(
      (h) =>
        typeof h !== "string" ||
        !/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(h) ||
        h.endsWith(".local") ||
        h === "localhost",
    )
  )
    fail("UPLOAD_INVALID", "Allowlist de armazenamento legado inválida.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !hosts.includes(url.hostname)
  )
    fail("UPLOAD_INVALID", "Origem do arquivo legado não autorizada.");
  return url;
}
export async function lerStreamLimitado(
  body: ReadableStream<Uint8Array>,
  max: number,
  signal?: AbortSignal,
) {
  const reader = body.getReader();
  const cancel = () => {
    void reader.cancel();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new Error("ABORTED");
      const { value, done } = await reader.read();
      if (signal?.aborted) throw new Error("ABORTED");
      if (done) break;
      size += value.byteLength;
      if (size > max)
        fail("LIMIT_EXCEEDED", "Arquivo excede o limite permitido.");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal?.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export function nomeArquivoSeguro(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\.+$/, "")
      .trim()
      .slice(-160) || "documento"
  );
}
