import { NextResponse } from "next/server";

import { assertExplorerMutationRequest, explorerErrorResponse, requireExplorerIdentity } from "@/lib/alpha-explorer/http";
import { explorerIdSchema } from "@/lib/alpha-explorer/schemas";
import { createExplorerDownload } from "@/lib/alpha-explorer/service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertExplorerMutationRequest(request);
    const access = await requireExplorerIdentity();
    const { id } = await context.params;
    const data = await createExplorerDownload(access.userId, access.authorization, explorerIdSchema.parse(id));
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return explorerErrorResponse(error, "download.authorize");
  }
}
