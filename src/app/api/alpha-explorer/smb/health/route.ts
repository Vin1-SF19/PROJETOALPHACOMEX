import { NextResponse } from "next/server";

import { explorerErrorResponse, requireExplorerIdentity } from "@/lib/alpha-explorer/http";
import { readSmbRuntimeConfig } from "@/lib/alpha-explorer/smb/config";
import { fetchSmbGatewayHealth } from "@/lib/alpha-explorer/smb/gateway-client";
import { issueSmbTicket } from "@/lib/alpha-explorer/smb/ticket";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requireExplorerIdentity();
    const config = readSmbRuntimeConfig();
    if (!config.enabled) return NextResponse.json({ success: false, code: "SMB_DISABLED" }, { status: 503 });
    const origin = new URL(request.url).origin;
    const ticket = issueSmbTicket({ config, userId: identity.userId, origin, scope: "health", resource: "root" });
    const data = await fetchSmbGatewayHealth(ticket, origin);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return explorerErrorResponse(error, "smb.health");
  }
}
