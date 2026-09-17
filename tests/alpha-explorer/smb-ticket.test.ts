import { describe, expect, it } from "vitest";

import { issuerForOrigin, readSmbRuntimeConfig, type SmbRuntimeConfig } from "@/lib/alpha-explorer/smb/config";
import { issueSmbTicket, verifySmbTicketForTest } from "@/lib/alpha-explorer/smb/ticket";

const config: SmbRuntimeConfig = {
  runtime: "stage",
  enabled: true,
  enrollmentEnabled: false,
  writeEnabled: false,
  gatewayUrl: "https://gateway.example.test",
  audience: "alpha-explorer-smb-gateway",
  productionOrigin: "https://painel.alpha-comex.com",
  stageOrigin: "https://stagealpha-sistema.alpak.ai",
  additionalOrigins: ["https://painel-alpha.alpak.ai"],
  issuer: "alpha-explorer-stage",
  keyId: "stage-key-2026",
  secret: "stage-secret-with-more-than-thirty-two-bytes",
};

describe("SMB operation ticket", () => {
  it("binds subject, stage issuer, origin, scope and resource for 45 seconds", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const issued = issueSmbTicket({ config, userId: 42, origin: config.stageOrigin, scope: "list", resource: "root", now });
    const claims = verifySmbTicketForTest(issued.token, config, new Date("2026-09-15T12:00:30.000Z"));
    expect(claims).toMatchObject({
      iss: config.issuer, aud: config.audience, sub: "user:42", origin: config.stageOrigin, scope: "list", resource: "root",
    });
    expect(claims.exp - claims.iat).toBe(45);
    expect(issued.token).not.toContain("user:42");
  });

  it("blocks administrative enrollment without an actor", () => {
    expect(() => issueSmbTicket({
      config, userId: 42, origin: config.stageOrigin, scope: "credential:enroll", resource: "root",
    })).toThrow("SMB_INVALID_ACTOR");
  });

  it("binds administrative actor and target without recent authentication or justification", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const fresh = issueSmbTicket({
      config,
      userId: 42,
      actorUserId: 1,
      origin: config.stageOrigin,
      scope: "credential:enroll",
      resource: "root",
      now,
    });
    expect(verifySmbTicketForTest(fresh.token, config, now)).toMatchObject({
      sub: "user:42",
      actor_sub: "user:1",
      scope: "credential:enroll",
      auth_time: null,
      justification_hash: null,
    });
  });

  it("loads only its runtime authority and rejects tampering or other deployment origins", () => {
    const issued = issueSmbTicket({ config, userId: 1, origin: config.stageOrigin, scope: "health", resource: "root" });
    expect(() => verifySmbTicketForTest(`${issued.token.slice(0, -1)}x`, config)).toThrow("SMB_TICKET_SIGNATURE_INVALID");
    expect(() => issuerForOrigin(config, config.productionOrigin)).toThrow("SMB_ORIGIN_NOT_ALLOWED");
    expect(issuerForOrigin(config, "https://painel-alpha.alpak.ai").issuer).toBe(config.issuer);
    expect(() => issuerForOrigin(config, "https://evil.example")).toThrow("SMB_ORIGIN_NOT_ALLOWED");
  });

  it("fails closed on incomplete server-only configuration", () => {
    expect(() => readSmbRuntimeConfig({})).toThrow();
  });

  it("builds a stage runtime with only the stage authority present", () => {
    const loaded = readSmbRuntimeConfig({
      ALPHA_EXPLORER_SMB_RUNTIME: "stage",
      ALPHA_EXPLORER_SMB_ENABLED: "true",
      ALPHA_EXPLORER_SMB_ENROLLMENT_ENABLED: "false",
      ALPHA_EXPLORER_SMB_WRITE_ENABLED: "false",
      ALPHA_EXPLORER_SMB_GATEWAY_URL: "https://gateway.example.test",
      ALPHA_EXPLORER_SMB_AUDIENCE: "alpha-explorer-smb-gateway",
      ALPHA_EXPLORER_SMB_PRODUCTION_ORIGIN: "https://painel.alpha-comex.com",
      ALPHA_EXPLORER_SMB_STAGE_ORIGIN: "https://stagealpha-sistema.alpak.ai",
      ALPHA_EXPLORER_SMB_ISSUER: "alpha-explorer-stage",
      ALPHA_EXPLORER_SMB_TICKET_KID: "stage-key-2026",
      ALPHA_EXPLORER_SMB_TICKET_SECRET: "stage-secret-with-more-than-thirty-two-bytes",
    });
    expect(loaded.runtime).toBe("stage");
    expect(loaded.issuer).toBe("alpha-explorer-stage");
    expect(Object.keys(loaded)).not.toContain("productionSecret");
  });
});
