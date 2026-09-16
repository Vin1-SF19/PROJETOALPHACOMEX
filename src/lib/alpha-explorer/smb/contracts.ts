import { z } from "zod";

export const SMB_OPERATION_TICKET_SCOPES = [
  "health", "link_status", "list", "mkdir", "download", "upload_start", "upload_chunk",
  "upload_commit", "upload_cancel", "rename", "move", "trash", "trash_list", "restore", "upload_reconcile",
] as const;
export const SMB_CREDENTIAL_TICKET_SCOPES = [
  "credential:status", "credential:enroll", "credential:rotate", "credential:unlink",
] as const;
export const SMB_TICKET_SCOPES = [...SMB_OPERATION_TICKET_SCOPES, ...SMB_CREDENTIAL_TICKET_SCOPES] as const;
export type SmbTicketScope = (typeof SMB_TICKET_SCOPES)[number];

export const opaqueHandleSchema = z.union([
  z.literal("root"),
  z.string().regex(/^h_[A-Za-z0-9_-]{22,128}$/),
]);

export const smbTicketRequestSchema = z.object({
  scope: z.enum(SMB_OPERATION_TICKET_SCOPES),
  resource: opaqueHandleSchema.default("root"),
  maxBytes: z.number().int().nonnegative().max(2 * 1024 * 1024 * 1024).nullable().default(null),
  offsetBytes: z.number().int().nonnegative().nullable().default(null),
  destinationHandle: opaqueHandleSchema.nullable().default(null),
  targetName: z.string().min(1).max(255).nullable().default(null),
}).strict();

export const smbCredentialTicketRequestSchema = z.object({
  scope: z.enum(SMB_CREDENTIAL_TICKET_SCOPES),
  targetUserId: z.number().int().positive(),
}).strict();

export const smbTicketClaimsSchema = z.object({
  iss: z.string().min(1).max(200),
  aud: z.string().min(1).max(200),
  sub: z.string().regex(/^user:[1-9][0-9]*$/),
  actor_sub: z.string().regex(/^user:[1-9][0-9]*$/).nullable(),
  origin: z.string().url().refine((value) => new URL(value).origin === value),
  scope: z.enum(SMB_TICKET_SCOPES),
  resource: opaqueHandleSchema,
  jti: z.string().uuid(),
  iat: z.number().int().nonnegative(),
  nbf: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  auth_time: z.number().int().nonnegative().nullable(),
  max_bytes: z.number().int().nonnegative().max(2 * 1024 * 1024 * 1024).nullable(),
  offset: z.number().int().nonnegative().nullable(),
  destination: opaqueHandleSchema.nullable(),
  target_name: z.string().min(1).max(255).nullable(),
  binding_nonce: z.string().uuid().nullable(),
  justification_hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
}).strict().refine((claims) => claims.exp > claims.iat && claims.exp - claims.iat <= 60, {
  message: "Ticket TTL must be between 1 and 60 seconds",
});

export type SmbTicketClaims = z.infer<typeof smbTicketClaimsSchema>;

export const smbGatewayEntrySchema = z.object({
  handle: opaqueHandleSchema,
  name: z.string().min(1).max(255),
  kind: z.enum(["directory", "file"]),
  size: z.number().int().nonnegative().nullable(),
  modifiedAt: z.string().datetime().nullable(),
}).strict();

export const smbGatewayListSchema = z.object({
  entries: z.array(smbGatewayEntrySchema).max(200),
  nextCursor: z.string().max(512).nullable(),
}).strict();

export interface SmbIssuedTicket {
  token: string;
  expiresAt: string;
  gatewayUrl: string;
}
