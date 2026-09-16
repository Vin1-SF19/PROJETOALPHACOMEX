import { z } from "zod";

import type { SmbIssuedTicket } from "./contracts";
import { SmbGatewayError } from "./browser-client";

export type SmbCredentialAdminScope = "credential:status" | "credential:enroll" | "credential:rotate" | "credential:unlink";

const supportIdSchema = z.string().uuid();
const ticketSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string().min(32),
    expiresAt: z.string().datetime(),
    gatewayUrl: z.string().url(),
  }).strict(),
  supportId: supportIdSchema,
}).strict();
const usersSchema = z.object({
  success: z.literal(true),
  data: z.array(z.object({
    id: z.number().int().positive(),
    nome: z.string(),
    usuario: z.string(),
    email: z.string(),
    role: z.string(),
  }).strict()).max(500),
}).strict();
const statusSchema = z.object({
  linked: z.boolean(),
  principal: z.string().nullable(),
  credentialVersion: z.number().int().nonnegative(),
  supportId: supportIdSchema,
}).strict();
const mutationSchema = z.object({ ok: z.literal(true), linked: z.boolean(), supportId: supportIdSchema }).passthrough();
const errorSchema = z.object({ code: z.string().optional(), supportId: z.string().optional() }).passthrough();

async function parseError(response: Response): Promise<never> {
  const payload: unknown = await response.clone().json().catch(() => null);
  const parsed = errorSchema.safeParse(payload);
  throw new SmbGatewayError(
    parsed.success ? parsed.data.code ?? "SMB_ADMIN_REQUEST_FAILED" : "SMB_ADMIN_REQUEST_FAILED",
    response.status,
    parsed.success ? parsed.data.supportId : undefined,
  );
}

async function requestAdminTicket(
  targetUserId: number,
  scope: SmbCredentialAdminScope,
  signal?: AbortSignal,
): Promise<SmbIssuedTicket> {
  const response = await fetch("/api/alpha-explorer/smb/admin/ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId, scope }),
    signal,
  });
  if (!response.ok) return parseError(response);
  return ticketSchema.parse(await response.json()).data;
}

async function gatewayJson<T>(ticket: SmbIssuedTicket, pathname: string, schema: z.ZodType<T>, init: RequestInit): Promise<T> {
  const response = await fetch(new URL(pathname, ticket.gatewayUrl), {
    ...init,
    headers: { Authorization: `Bearer ${ticket.token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!response.ok) return parseError(response);
  return schema.parse(await response.json());
}

export type SmbAdminUser = z.infer<typeof usersSchema>["data"][number];
export type SmbCredentialStatus = z.infer<typeof statusSchema>;

export async function listSmbAdminUsers(signal?: AbortSignal): Promise<SmbAdminUser[]> {
  const response = await fetch("/api/alpha-explorer/smb/admin/users", { cache: "no-store", signal });
  if (!response.ok) return parseError(response);
  return usersSchema.parse(await response.json()).data;
}

export async function getSmbAdminCredentialStatus(targetUserId: number, signal?: AbortSignal): Promise<SmbCredentialStatus> {
  const response = await fetch(`/api/alpha-explorer/smb/admin/status?targetUserId=${encodeURIComponent(String(targetUserId))}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) return parseError(response);
  return statusSchema.parse(await response.json());
}

export async function writeSmbAdminCredential(input: {
  targetUserId: number;
  mode: "enroll" | "rotate";
  principal: string;
  password: string;
  signal?: AbortSignal;
}): Promise<void> {
  const scope = input.mode === "enroll" ? "credential:enroll" : "credential:rotate";
  const ticket = await requestAdminTicket(input.targetUserId, scope, input.signal);
  await gatewayJson(ticket, `/v1/admin/credentials/${input.mode}`, mutationSchema, {
    method: "POST",
    body: JSON.stringify({ principal: input.principal, password: input.password }),
    signal: input.signal,
  });
}

export async function unlinkSmbAdminCredential(input: {
  targetUserId: number;
  signal?: AbortSignal;
}): Promise<void> {
  const ticket = await requestAdminTicket(input.targetUserId, "credential:unlink", input.signal);
  await gatewayJson(ticket, "/v1/admin/credentials", mutationSchema, {
    method: "DELETE",
    body: JSON.stringify({ confirm: true }),
    signal: input.signal,
  });
}
