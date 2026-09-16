import { NextResponse } from "next/server";

import { ExplorerError } from "@/lib/alpha-explorer/errors";
import { assertExplorerMutationRequest, explorerErrorResponse, requireExplorerAccess } from "@/lib/alpha-explorer/http";
import { consumeExplorerRateLimit } from "@/lib/alpha-explorer/rate-limit";
import { initiateUploadSchema } from "@/lib/alpha-explorer/schemas";
import { initiateExplorerUpload } from "@/lib/alpha-explorer/service";

export async function POST(request: Request) {
  try {
    assertExplorerMutationRequest(request);
    const input = initiateUploadSchema.parse(await request.json());
    const access = await requireExplorerAccess(input.path, "upload", true);
    if (!consumeExplorerRateLimit(access.userId, "session")) throw new ExplorerError("RATE_LIMIT", 429, "Muitas sessões de upload");
    const data = await initiateExplorerUpload({ ...input, userId: access.userId, authorization: access.authorization, fallbackEnabled: access.flags.fallbackEnabled });
    return NextResponse.json({ success: true, data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return explorerErrorResponse(error, "upload.initiate");
  }
}
