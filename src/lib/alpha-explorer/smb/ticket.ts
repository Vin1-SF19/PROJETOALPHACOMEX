import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { SmbRuntimeConfig } from "./config";
import { issuerForOrigin } from "./config";
import { smbTicketClaimsSchema, type SmbIssuedTicket, type SmbTicketClaims, type SmbTicketScope } from "./contracts";

const ticketHeaderSchema = z.object({
  alg: z.literal("HS256"),
  typ: z.literal("JWT"),
  kid: z.string().regex(/^[A-Za-z0-9._-]{8,64}$/),
}).strict();

function sign(encodedHeader: string, encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
}

export function issueSmbTicket(input: {
  config: SmbRuntimeConfig;
  userId: number;
  actorUserId?: number;
  origin: string;
  scope: SmbTicketScope;
  resource: string;
  maxBytes?: number | null;
  offsetBytes?: number | null;
  destinationHandle?: string | null;
  targetName?: string | null;
  now?: Date;
}): SmbIssuedTicket {
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) throw new Error("SMB_INVALID_SUBJECT");
  const credentialScope = input.scope.startsWith("credential:");
  const credentialMutation = input.scope !== "credential:status" && credentialScope;
  if (credentialScope && (!Number.isSafeInteger(input.actorUserId) || (input.actorUserId ?? 0) <= 0)) {
    throw new Error("SMB_INVALID_ACTOR");
  }
  const authority = issuerForOrigin(input.config, input.origin);
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000);
  const claims = smbTicketClaimsSchema.parse({
    iss: authority.issuer,
    aud: input.config.audience,
    sub: `user:${input.userId}`,
    actor_sub: credentialScope ? `user:${input.actorUserId}` : null,
    origin: input.origin,
    scope: input.scope,
    resource: input.resource,
    jti: randomUUID(),
    iat: nowSeconds,
    nbf: nowSeconds - 2,
    exp: nowSeconds + 45,
    auth_time: null,
    max_bytes: input.maxBytes ?? null,
    offset: input.offsetBytes ?? null,
    destination: input.destinationHandle ?? null,
    target_name: input.targetName ?? null,
    binding_nonce: credentialMutation ? randomUUID() : null,
    justification_hash: null,
  });
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: authority.keyId })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return {
    token: `${encodedHeader}.${payload}.${sign(encodedHeader, payload, authority.secret)}`,
    expiresAt: new Date(claims.exp * 1_000).toISOString(),
    gatewayUrl: input.config.gatewayUrl,
  };
}

export function verifySmbTicketForTest(token: string, config: SmbRuntimeConfig, now = new Date()): SmbTicketClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("SMB_TICKET_INVALID");
  const [encodedHeader, encodedPayload, signature] = parts;
  const header = ticketHeaderSchema.parse(JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")));
  const untrusted = smbTicketClaimsSchema.parse(JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")));
  const authority = issuerForOrigin(config, untrusted.origin);
  if (header.kid !== authority.keyId) throw new Error("SMB_TICKET_HEADER_INVALID");
  if (untrusted.iss !== authority.issuer || untrusted.aud !== config.audience) throw new Error("SMB_TICKET_AUTHORITY_INVALID");
  const expected = Buffer.from(sign(encodedHeader, encodedPayload, authority.secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("SMB_TICKET_SIGNATURE_INVALID");
  if (untrusted.exp <= Math.floor(now.getTime() / 1_000)) throw new Error("SMB_TICKET_EXPIRED");
  if (untrusted.nbf > Math.floor(now.getTime() / 1_000) + 5) throw new Error("SMB_TICKET_NOT_ACTIVE");
  return untrusted;
}
