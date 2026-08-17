import { describe, expect, it, vi } from "vitest";

import { runRoadmapDoctor, runRoadmapModuleCheck } from "@/lib/roadmap-alpha/doctor";
import { readRoadmapRuntimeConfig } from "@/lib/roadmap-alpha/runtime-config";

const validEnv = {
  BIBBLE_OLLAMA_URL: "https://ollama.internal.example",
  OLLAMA_API_KEY: "super-secret-token",
  ROADMAP_QWEN_MODEL: "qwen3.8:27b",
};

const fixedNow = () => new Date("2026-08-15T15:00:00.000Z");

describe("roadmap:doctor", () => {
  it("valida configuração sem fallback e sem expor segredos", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer super-secret-token");
      return new Response(JSON.stringify({ models: [{ name: "qwen3.8:27b" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await runRoadmapDoctor({ env: validEnv, fetchImpl, now: fixedNow });
    expect(result).toMatchObject({ ok: true, command: "doctor", code: 0, timestamp: fixedNow().toISOString() });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(validEnv.OLLAMA_API_KEY);
    expect(serialized).not.toContain(validEnv.BIBBLE_OLLAMA_URL);
    expect(serialized).not.toContain("Authorization");
  });

  it("rejeita env ausente ou modelo que não seja tag Qwen 3.8", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const missing = await runRoadmapDoctor({ env: {}, fetchImpl, now: fixedNow });
    expect(missing).toMatchObject({ ok: false, code: 2 });
    expect(fetchImpl).not.toHaveBeenCalled();

    expect(readRoadmapRuntimeConfig({ ...validEnv, ROADMAP_QWEN_MODEL: "qwen3.6:latest" }).ok).toBe(false);
  });

  it("exige correspondência exata da tag", async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ models: [{ name: "qwen3.8:27b-extra" }] }),
      { status: 200 },
    )) as unknown as typeof fetch;
    const result = await runRoadmapDoctor({ env: validEnv, fetchImpl, now: fixedNow });
    expect(result).toMatchObject({ ok: false, code: 1 });
    expect(JSON.stringify(result)).toContain("MODEL_NOT_FOUND");
  });

  it.each([
    [401, "AUTH_FAILED"],
    [403, "AUTH_FAILED"],
    [500, "HTTP_ERROR"],
  ])("classifica HTTP %i sem incluir resposta bruta", async (status, code) => {
    const fetchImpl = vi.fn(async () => new Response("segredo-no-body", { status })) as unknown as typeof fetch;
    const result = await runRoadmapDoctor({ env: validEnv, fetchImpl, now: fixedNow });
    expect(result).toMatchObject({ ok: false, code: 1 });
    expect(JSON.stringify(result)).toContain(code);
    expect(JSON.stringify(result)).not.toContain("segredo-no-body");
  });

  it("classifica JSON inválido", async () => {
    const fetchImpl = vi.fn(async () => new Response("não-json", { status: 200 })) as unknown as typeof fetch;
    const result = await runRoadmapDoctor({ env: validEnv, fetchImpl, now: fixedNow });
    expect(JSON.stringify(result)).toContain("INVALID_JSON");
  });

  it("aborta por timeout", async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })) as unknown as typeof fetch;
    const result = await runRoadmapDoctor({ env: validEnv, fetchImpl, timeoutMs: 1, now: fixedNow });
    expect(JSON.stringify(result)).toContain("TIMEOUT");
  });
});

describe("roadmap:check-modules", () => {
  it("retorna auditoria sanitizada e saudável", () => {
    const result = runRoadmapModuleCheck(fixedNow);
    expect(result).toMatchObject({ ok: true, command: "check-modules", code: 0 });
  });
});
