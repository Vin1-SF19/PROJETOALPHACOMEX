import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { storageConfig } from "@/lib/checklist/storage";
const keys = ["CHECKLIST_PRIVATE_BLOB_TOKEN", "CHECKLIST_PRODUCTION_READ_WRITE_TOKEN", "CHECKLIST_TARGET_ENVIRONMENT", "VERCEL_ENV", "VERCEL_TARGET_ENV", "CHECKLIST_STORAGE_PREFIX"] as const;
beforeEach(() => { for (const key of keys) vi.stubEnv(key, undefined); vi.stubEnv("CHECKLIST_STORAGE_PREFIX", "checklist/production/"); });
afterEach(() => vi.unstubAllEnvs());
it("preserva a credencial explícita de staging e a precedência da configuração existente", () => {
  vi.stubEnv("CHECKLIST_PRIVATE_BLOB_TOKEN", "synthetic-explicit");
  vi.stubEnv("CHECKLIST_PRODUCTION_READ_WRITE_TOKEN", "synthetic-native");
  vi.stubEnv("CHECKLIST_TARGET_ENVIRONMENT", "staging");
  vi.stubEnv("VERCEL_ENV", "preview");
  expect(storageConfig().token).toBe("synthetic-explicit");
  vi.stubEnv("CHECKLIST_TARGET_ENVIRONMENT", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  expect(storageConfig().token).toBe("synthetic-explicit");
});
it("consome o binding nativo somente no runtime marcado como produção", () => {
  vi.stubEnv("CHECKLIST_TARGET_ENVIRONMENT", "production");
  vi.stubEnv("CHECKLIST_PRODUCTION_READ_WRITE_TOKEN", "synthetic-native");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("VERCEL_TARGET_ENV", "production");
  expect(storageConfig()).toEqual({ token: "synthetic-native", prefix: "checklist/production/" });
});
it.each([undefined, "staging", "preview", "development"])("recusa credencial nativa com marcador %s", marker => {
  vi.stubEnv("CHECKLIST_TARGET_ENVIRONMENT", marker);
  vi.stubEnv("CHECKLIST_PRODUCTION_READ_WRITE_TOKEN", "synthetic-native");
  expect(() => storageConfig()).toThrow("Armazenamento privado");
});
it.each(["VERCEL_ENV", "VERCEL_TARGET_ENV"] as const)("recusa contradição do runtime %s", key => {
  vi.stubEnv("CHECKLIST_TARGET_ENVIRONMENT", "production");
  vi.stubEnv("CHECKLIST_PRODUCTION_READ_WRITE_TOKEN", "synthetic-native");
  vi.stubEnv(key, "preview");
  expect(() => storageConfig()).toThrow("Armazenamento privado");
});
it("falha fechado sem credencial ou com prefixo inválido", () => {
  vi.stubEnv("CHECKLIST_TARGET_ENVIRONMENT", "production");
  expect(() => storageConfig()).toThrow("Armazenamento privado");
  vi.stubEnv("CHECKLIST_PRODUCTION_READ_WRITE_TOKEN", "synthetic-native");
  vi.stubEnv("CHECKLIST_STORAGE_PREFIX", "../staging/");
  expect(() => storageConfig()).toThrow("Armazenamento privado");
});
