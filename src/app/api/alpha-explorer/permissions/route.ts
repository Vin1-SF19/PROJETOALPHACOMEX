import { NextResponse } from "next/server";

import { assertExplorerMutationRequest, explorerErrorResponse, requireExplorerIdentity } from "@/lib/alpha-explorer/http";
import { aclSchema } from "@/lib/alpha-explorer/schemas";
import { upsertExplorerAcl } from "@/lib/alpha-explorer/service";

export async function PUT(request: Request) {
  try {
    assertExplorerMutationRequest(request);
    const access = await requireExplorerIdentity(true);
    const input = aclSchema.parse(await request.json());
    const data = await upsertExplorerAcl(access.userId, input);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return explorerErrorResponse(error, "permissions.update");
  }
}
