import "server-only";

import { z } from "zod";

const exactOrigin = z.string().url().transform((value, context) => {
  const parsed = new URL(value);
  if (parsed.origin !== value) {
    context.addIssue({ code: "custom", message: "Origin must not contain a path" });
    return z.NEVER;
  }
  return value;
});

const configSchema = z.object({
  runtime: z.enum(["production", "stage"]),
  enabled: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  enrollmentEnabled: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  writeEnabled: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  gatewayUrl: z.string().url().refine((value) => value.startsWith("https://") || value.startsWith("http://127.0.0.1:")),
  audience: z.string().min(8).max(200),
  productionOrigin: exactOrigin,
  stageOrigin: exactOrigin,
  issuer: z.string().min(8).max(200),
  keyId: z.string().regex(/^[A-Za-z0-9._-]{8,64}$/),
  secret: z.string().min(32),
}).strict();

export interface SmbRuntimeConfig {
  runtime: "production" | "stage";
  enabled: boolean;
  enrollmentEnabled: boolean;
  writeEnabled: boolean;
  gatewayUrl: string;
  audience: string;
  productionOrigin: string;
  stageOrigin: string;
  issuer: string;
  keyId: string;
  secret: string;
}

function rawSmbRuntimeConfig(env: Readonly<Record<string, string | undefined>>) {
  return {
    runtime: env.ALPHA_EXPLORER_SMB_RUNTIME,
    enabled: env.ALPHA_EXPLORER_SMB_ENABLED,
    enrollmentEnabled: env.ALPHA_EXPLORER_SMB_ENROLLMENT_ENABLED,
    writeEnabled: env.ALPHA_EXPLORER_SMB_WRITE_ENABLED,
    gatewayUrl: env.ALPHA_EXPLORER_SMB_GATEWAY_URL,
    audience: env.ALPHA_EXPLORER_SMB_AUDIENCE,
    productionOrigin: env.ALPHA_EXPLORER_SMB_PRODUCTION_ORIGIN,
    stageOrigin: env.ALPHA_EXPLORER_SMB_STAGE_ORIGIN,
    issuer: env.ALPHA_EXPLORER_SMB_ISSUER,
    keyId: env.ALPHA_EXPLORER_SMB_TICKET_KID,
    secret: env.ALPHA_EXPLORER_SMB_TICKET_SECRET,
  };
}

export function tryReadSmbRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { ok: true; config: SmbRuntimeConfig } | { ok: false } {
  const parsed = configSchema.safeParse(rawSmbRuntimeConfig(env));
  return parsed.success ? { ok: true, config: parsed.data } : { ok: false };
}

export function readSmbRuntimeConfig(env: Readonly<Record<string, string | undefined>> = process.env): SmbRuntimeConfig {
  const result = tryReadSmbRuntimeConfig(env);
  if (!result.ok) throw new Error("SMB_CONFIG_INVALID");
  return result.config;
}

export function originForSmbRuntime(config: SmbRuntimeConfig): string {
  return config.runtime === "production" ? config.productionOrigin : config.stageOrigin;
}

export function issuerForOrigin(config: SmbRuntimeConfig, origin: string): { issuer: string; secret: string; keyId: string } {
  if (origin !== originForSmbRuntime(config)) throw new Error("SMB_ORIGIN_NOT_ALLOWED");
  return { issuer: config.issuer, secret: config.secret, keyId: config.keyId };
}
