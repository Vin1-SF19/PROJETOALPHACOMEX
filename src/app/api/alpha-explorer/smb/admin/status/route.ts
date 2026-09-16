import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveExplorerAuthorization } from "@/lib/alpha-explorer/authorization";
import { ExplorerError } from "@/lib/alpha-explorer/errors";
import { explorerErrorResponse, requireExplorerIdentity, resolveExplorerRequestOrigin } from "@/lib/alpha-explorer/http";
import { auditExplorer, writeExplorerLog } from "@/lib/alpha-explorer/observability";
import { reconcileSmbBindingMetadata } from "@/lib/alpha-explorer/smb/binding-metadata";
import { originForSmbRuntime, readSmbRuntimeConfig } from "@/lib/alpha-explorer/smb/config";
import { issueSmbTicket } from "@/lib/alpha-explorer/smb/ticket";

export const dynamic = "force-dynamic";

const querySchema = z.object({ targetUserId: z.coerce.number().int().positive() }).strict();
const gatewayStatusSchema = z.object({
  linked: z.boolean(),
  principal: z.string().min(1).max(128).nullable(),
  principalKey: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  secretRef: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  credentialVersion: z.number().int().nonnegative(),
  supportId: z.string().uuid(),
}).strict();

export async function GET(request: Request) {
  try {
    const actor = await requireExplorerIdentity();
    if (!actor.authorization.admin) throw new ExplorerError("FORBIDDEN", 403, "Sem permissão administrativa");

    const url = new URL(request.url);
    const input = querySchema.parse(Object.fromEntries(url.searchParams));
    const target = await resolveExplorerAuthorization(input.targetUserId);
    if (!target.active) throw new ExplorerError("TARGET_NOT_FOUND", 404, "Usuário alvo indisponível");
    if (!target.moduleAllowed) throw new ExplorerError("TARGET_MODULE_DENIED", 409, "Alpha Explorer não liberado para o usuário");

    const config = readSmbRuntimeConfig();
    if (!config.enabled) throw new ExplorerError("SMB_DISABLED", 503, "Alpha Explorer SMB indisponível");
    const origin = resolveExplorerRequestOrigin(request, [originForSmbRuntime(config)]);
    const ticket = issueSmbTicket({
      config,
      userId: input.targetUserId,
      actorUserId: actor.userId,
      origin,
      scope: "credential:status",
      resource: "root",
    });

    const gatewayResponse = await fetch(new URL("/v1/admin/credentials/status", ticket.gatewayUrl), {
      method: "GET",
      headers: { Authorization: `Bearer ${ticket.token}`, Origin: origin },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!gatewayResponse.ok) {
      throw new ExplorerError("SMB_GATEWAY_STATUS_FAILED", 503, "Não foi possível consultar o vínculo QNAP");
    }
    const status = gatewayStatusSchema.parse(await gatewayResponse.json());
    await reconcileSmbBindingMetadata({ targetUserId: input.targetUserId, actorUserId: actor.userId, status });
    writeExplorerLog({
      correlationId: status.supportId,
      action: "credential_metadata_reconcile",
      result: "success",
      userId: actor.userId,
    });
    await auditExplorer(actor.userId, "CREDENTIAL_METADATA_RECONCILED", {
      targetUserId: input.targetUserId,
      linked: status.linked,
      credentialVersion: status.credentialVersion,
      supportId: status.supportId,
    });
    return NextResponse.json({
      linked: status.linked,
      principal: status.principal,
      credentialVersion: status.credentialVersion,
      supportId: status.supportId,
    });
  } catch (error) {
    return explorerErrorResponse(error, "smb.admin.status");
  }
}
