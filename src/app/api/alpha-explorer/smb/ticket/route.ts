import { NextResponse } from "next/server";

import { assertExplorerMutationRequest, explorerErrorResponse, requireExplorerIdentity } from "@/lib/alpha-explorer/http";
import { ExplorerError } from "@/lib/alpha-explorer/errors";
import { allowedOriginsForSmbRuntime, readSmbRuntimeConfig } from "@/lib/alpha-explorer/smb/config";
import { smbTicketRequestSchema } from "@/lib/alpha-explorer/smb/contracts";
import { issueSmbTicket } from "@/lib/alpha-explorer/smb/ticket";
import { consumeExplorerRateLimit } from "@/lib/alpha-explorer/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const config = readSmbRuntimeConfig();
    const origin = assertExplorerMutationRequest(request, allowedOriginsForSmbRuntime(config));
    const identity = await requireExplorerIdentity();
    const input = smbTicketRequestSchema.parse(await request.json());
    const destructiveScopes = new Set(["mkdir", "rename", "move", "trash", "restore", "upload_cancel", "upload_reconcile"]);
    const rateClass = input.scope === "upload_chunk" ? "parts" : destructiveScopes.has(input.scope) ? "destructive" : "session";
    if (!consumeExplorerRateLimit(identity.userId, rateClass)) {
      throw new ExplorerError("RATE_LIMIT", 429, "Muitas autorizações SMB em pouco tempo");
    }
    if (!config.enabled) return NextResponse.json({ success: false, code: "SMB_DISABLED" }, { status: 503 });
    const writeScopes = new Set(["mkdir", "upload_start", "upload_chunk", "upload_commit", "upload_cancel", "rename", "move", "trash", "restore", "upload_reconcile"]);
    if (writeScopes.has(input.scope) && (!identity.flags.writeEnabled || !config.writeEnabled)) {
      return NextResponse.json({ success: false, code: "SMB_WRITES_DISABLED" }, { status: 503 });
    }
    const ticket = issueSmbTicket({
      config,
      userId: identity.userId,
      origin,
      scope: input.scope,
      resource: input.resource,
      maxBytes: input.maxBytes,
      offsetBytes: input.offsetBytes,
      destinationHandle: input.destinationHandle,
      targetName: input.targetName,
    });
    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    return explorerErrorResponse(error, "smb.ticket.issue");
  }
}
