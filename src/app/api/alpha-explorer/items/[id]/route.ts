import { NextResponse } from "next/server";

import { assertExplorerMutationRequest, explorerErrorResponse, requireExplorerIdentity } from "@/lib/alpha-explorer/http";
import { consumeExplorerRateLimit } from "@/lib/alpha-explorer/rate-limit";
import { explorerIdSchema, itemActionSchema } from "@/lib/alpha-explorer/schemas";
import { mutateExplorerItem } from "@/lib/alpha-explorer/service";
import { ExplorerError } from "@/lib/alpha-explorer/errors";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertExplorerMutationRequest(request);
    const access = await requireExplorerIdentity(true);
    if (!consumeExplorerRateLimit(access.userId, "destructive")) throw new ExplorerError("RATE_LIMIT", 429, "Muitas operações");
    const { id } = await context.params;
    const itemId = explorerIdSchema.parse(id);
    const input = itemActionSchema.parse(await request.json());
    const data = await mutateExplorerItem({ userId: access.userId, authorization: access.authorization, id: itemId, ...input });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return explorerErrorResponse(error, "item.mutate");
  }
}
