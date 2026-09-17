import { describe, expect, it } from "vitest";

import { allowedOriginsForSmbRuntime, readSmbRuntimeConfig, tryReadSmbRuntimeConfig } from "@/lib/alpha-explorer/smb/config";

const validConfig = {
  ALPHA_EXPLORER_SMB_RUNTIME: "stage",
  ALPHA_EXPLORER_SMB_ENABLED: "true",
  ALPHA_EXPLORER_SMB_ENROLLMENT_ENABLED: "false",
  ALPHA_EXPLORER_SMB_WRITE_ENABLED: "false",
  ALPHA_EXPLORER_SMB_GATEWAY_URL: "https://files.example.test",
  ALPHA_EXPLORER_SMB_AUDIENCE: "alpha-explorer-smb-gateway",
  ALPHA_EXPLORER_SMB_PRODUCTION_ORIGIN: "https://painel.alpha-comex.com",
  ALPHA_EXPLORER_SMB_STAGE_ORIGIN: "https://stagealpha-sistema.alpak.ai",
  ALPHA_EXPLORER_SMB_ADDITIONAL_ORIGINS: "https://painel-alpha.alpak.ai",
  ALPHA_EXPLORER_SMB_ISSUER: "alpha-explorer-stage",
  ALPHA_EXPLORER_SMB_TICKET_KID: "stage-key-2026",
  ALPHA_EXPLORER_SMB_TICKET_SECRET: "synthetic-secret-with-more-than-32-bytes",
} as const;

describe("Alpha Explorer SMB runtime configuration", () => {
  it("accepts a complete server-only configuration", () => {
    const result = tryReadSmbRuntimeConfig(validConfig);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.runtime).toBe("stage");
      expect(result.config.additionalOrigins).toEqual(["https://painel-alpha.alpak.ai"]);
      expect(allowedOriginsForSmbRuntime(result.config)).toEqual([
        "https://stagealpha-sistema.alpak.ai",
        "https://painel-alpha.alpak.ai",
      ]);
    }
  });

  it("allows the page to fall back safely when configuration is incomplete", () => {
    expect(tryReadSmbRuntimeConfig({ ALPHA_EXPLORER_SMB_ENABLED: "true" })).toEqual({ ok: false });
  });

  it("throws only a sanitized code from strict callers", () => {
    expect(() => readSmbRuntimeConfig({ ALPHA_EXPLORER_SMB_ENABLED: "true" })).toThrow("SMB_CONFIG_INVALID");
  });
});
