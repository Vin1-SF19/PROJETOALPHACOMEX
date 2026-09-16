import { NextResponse } from "next/server";

import { ExplorerError } from "@/lib/alpha-explorer/errors";
import { assertExplorerMutationRequest, explorerErrorResponse, requireExplorerIdentity } from "@/lib/alpha-explorer/http";
import { consumeExplorerRateLimit } from "@/lib/alpha-explorer/rate-limit";
import { explorerIdSchema, signPartsSchema } from "@/lib/alpha-explorer/schemas";
import { signExplorerParts } from "@/lib/alpha-explorer/service";
import { listExplorerUploadedParts } from "@/lib/alpha-explorer/service";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const access = await requireExplorerIdentity(true);
    const { sessionId } = await context.params;
    const data = await listExplorerUploadedParts(access.userId, access.authorization, explorerIdSchema.parse(sessionId));
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return explorerErrorResponse(error, "upload.parts.list");
  }
}

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    assertExplorerMutationRequest(request);
    const access = await requireExplorerIdentity(true);
    if (!consumeExplorerRateLimit(access.userId, "parts")) throw new ExplorerError("RATE_LIMIT", 429, "Muitas assinaturas de partes");
    const { sessionId } = await context.params;
    const input = signPartsSchema.parse(await request.json());
    const data = await signExplorerParts(access.userId, access.authorization, explorerIdSchema.parse(sessionId), input.partNumbers);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return explorerErrorResponse(error, "upload.parts");
  }
}
