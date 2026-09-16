import { NextResponse } from "next/server";

import { assertExplorerMutationRequest, explorerErrorResponse, requireExplorerIdentity } from "@/lib/alpha-explorer/http";
import { completeUploadSchema, explorerIdSchema } from "@/lib/alpha-explorer/schemas";
import { completeExplorerUpload, finalizeCompletedUpload } from "@/lib/alpha-explorer/service";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    assertExplorerMutationRequest(request);
    const access = await requireExplorerIdentity(true);
    const { sessionId } = await context.params;
    const id = explorerIdSchema.parse(sessionId);
    const body: unknown = await request.json();
    const record = body && typeof body === "object" && "parts" in body
      ? await completeExplorerUpload(access.userId, access.authorization, id, completeUploadSchema.parse(body).parts)
      : await finalizeCompletedUpload(access.userId, access.authorization, id);
    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return explorerErrorResponse(error, "upload.complete");
  }
}
