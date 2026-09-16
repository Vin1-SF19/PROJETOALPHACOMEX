import "server-only";

import { z } from "zod";

import type { SmbIssuedTicket } from "./contracts";

const healthSchema = z.object({
  ok: z.boolean(),
  service: z.literal("alpha-explorer-smb-gateway"),
  version: z.literal("v1"),
  checks: z.record(z.string(), z.boolean()),
  supportId: z.string().uuid(),
}).strict();

export async function fetchSmbGatewayHealth(ticket: SmbIssuedTicket, origin: string): Promise<z.infer<typeof healthSchema>> {
  const response = await fetch(new URL("/v1/health", ticket.gatewayUrl), {
    method: "GET",
    headers: { authorization: `Bearer ${ticket.token}`, origin },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("SMB_GATEWAY_UNAVAILABLE");
  return healthSchema.parse(body);
}
