import { NextResponse } from "next/server";

import { resolveExplorerAuthorization } from "@/lib/alpha-explorer/authorization";
import { ExplorerError } from "@/lib/alpha-explorer/errors";
import { assertExplorerMutationRequest, explorerErrorResponse, requireExplorerIdentity } from "@/lib/alpha-explorer/http";
import { auditExplorer, createSupportId, writeExplorerLog } from "@/lib/alpha-explorer/observability";
import { consumeExplorerRateLimit } from "@/lib/alpha-explorer/rate-limit";
import { originForSmbRuntime, readSmbRuntimeConfig } from "@/lib/alpha-explorer/smb/config";
import { smbCredentialTicketRequestSchema } from "@/lib/alpha-explorer/smb/contracts";
import { issueSmbTicket } from "@/lib/alpha-explorer/smb/ticket";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const config = readSmbRuntimeConfig();
    const origin = assertExplorerMutationRequest(request, [originForSmbRuntime(config)]);
    const actor = await requireExplorerIdentity();
    if (!actor.authorization.admin) throw new ExplorerError("FORBIDDEN", 403, "Sem permissão administrativa");
    if (!consumeExplorerRateLimit(actor.userId, "destructive")) {
      throw new ExplorerError("RATE_LIMIT", 429, "Muitas operações administrativas em pouco tempo");
    }

    const input = smbCredentialTicketRequestSchema.parse(await request.json());
    const target = await resolveExplorerAuthorization(input.targetUserId);
    if (!target.active) throw new ExplorerError("TARGET_NOT_FOUND", 404, "Usuário alvo indisponível");
    if (!target.moduleAllowed) throw new ExplorerError("TARGET_MODULE_DENIED", 409, "Libere o Alpha Explorer para o usuário antes do vínculo");

    if (!config.enabled) throw new ExplorerError("SMB_DISABLED", 503, "Alpha Explorer SMB indisponível");
    if (input.scope !== "credential:status" && !config.enrollmentEnabled) {
      throw new ExplorerError("SMB_CREDENTIAL_ADMIN_DISABLED", 503, "Administração de credenciais desabilitada");
    }

    const ticket = issueSmbTicket({
      config,
      userId: input.targetUserId,
      actorUserId: actor.userId,
      origin,
      scope: input.scope,
      resource: "root",
    });
    const supportId = createSupportId();
    writeExplorerLog({ correlationId: supportId, action: "credential_ticket", result: "success", userId: actor.userId });
    await auditExplorer(actor.userId, "CREDENTIAL_TICKET_ISSUED", {
      targetUserId: input.targetUserId,
      credentialAction: input.scope,
      supportId,
    });
    return NextResponse.json({ success: true, data: ticket, supportId });
  } catch (error) {
    return explorerErrorResponse(error, "smb.admin.ticket.issue");
  }
}
