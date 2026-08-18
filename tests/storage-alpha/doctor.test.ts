import { describe, expect, it } from "vitest";

import type { StorageProvider } from "@/lib/storage/contracts";
import { runStorageDoctor } from "@/lib/storage/doctor";
import { validStorageEnv } from "../helpers/storage-fixtures";

function diagnosticProvider(id: "quobjects" | "vercel-blob", ok: boolean): StorageProvider {
  return {
    id,
    diagnose: async () => ({ ok, provider: id, latencyMs: 2, errorCode: ok ? undefined : "NETWORK_ERROR" }),
    startMultipart: async () => { throw new Error("not used"); },
    uploadPart: async () => { throw new Error("not used"); },
    completeMultipart: async () => { throw new Error("not used"); },
    abortMultipart: async () => {},
    head: async () => { throw new Error("not used"); },
    download: async () => { throw new Error("not used"); },
    createDownloadUrl: async () => { throw new Error("not used"); },
    delete: async () => {},
  };
}

describe("storage:doctor", () => {
  it("retorna os dois providers saudáveis sem secrets ou endpoint interno", async () => {
    const result = await runStorageDoctor({
      env: validStorageEnv,
      now: () => new Date("2026-08-18T12:00:00.000Z"),
      providers: { primary: diagnosticProvider("quobjects", true), fallback: diagnosticProvider("vercel-blob", true) },
    });
    expect(result).toMatchObject({ ok: true, command: "doctor", code: 0 });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(validStorageEnv.STORAGE_QUOBJECTS_SECRET_ACCESS_KEY);
    expect(serialized).not.toContain(validStorageEnv.STORAGE_QUOBJECTS_ACCESS_KEY_ID);
    expect(serialized).not.toContain(validStorageEnv.STORAGE_VERCEL_BLOB_TOKEN);
    expect(serialized).not.toContain(validStorageEnv.STORAGE_QUOBJECTS_INTERNAL_ENDPOINT);
  });

  it("classifica config inválida com exit code 2", async () => {
    await expect(runStorageDoctor({ env: {} })).resolves.toMatchObject({ ok: false, command: "doctor", code: 2 });
  });

  it("classifica indisponibilidade com exit code 1", async () => {
    const result = await runStorageDoctor({
      env: validStorageEnv,
      providers: { primary: diagnosticProvider("quobjects", false), fallback: diagnosticProvider("vercel-blob", true) },
    });
    expect(result).toMatchObject({ ok: false, code: 1 });
  });

  it("sanitiza exceção inesperada do provider", async () => {
    const primary = diagnosticProvider("quobjects", true);
    primary.diagnose = async () => { throw new Error("secret provider detail"); };
    const result = await runStorageDoctor({
      env: validStorageEnv,
      providers: { primary, fallback: diagnosticProvider("vercel-blob", true) },
    });
    expect(result).toMatchObject({
      ok: false,
      code: 1,
      checks: { quobjects: { errorCode: "NETWORK_ERROR" } },
    });
    expect(JSON.stringify(result)).not.toContain("secret provider detail");
  });
});
