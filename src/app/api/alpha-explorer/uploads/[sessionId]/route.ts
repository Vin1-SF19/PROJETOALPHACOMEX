import { NextResponse } from "next/server";

import { assertExplorerMutationRequest, explorerErrorResponse, requireExplorerIdentity } from "@/lib/alpha-explorer/http";
import { explorerIdSchema } from "@/lib/alpha-explorer/schemas";
import { cancelExplorerUpload } from "@/lib/alpha-explorer/service";

export async function DELETE(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    assertExplorerMutationRequest(request);
    const access = await requireExplorerIdentity();
    const { sessionId } = await context.params;
    const data = await cancelExplorerUpload(access.userId, access.authorization, explorerIdSchema.parse(sessionId));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return explorerErrorResponse(error, "upload.cancel");
  }
}
