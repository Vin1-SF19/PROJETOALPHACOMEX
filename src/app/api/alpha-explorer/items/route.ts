import { NextResponse } from "next/server";

import { assertExplorerMutationRequest, explorerErrorResponse, requireExplorerAccess } from "@/lib/alpha-explorer/http";
import { createFolderSchema, listExplorerSchema } from "@/lib/alpha-explorer/schemas";
import { createExplorerFolder, listExplorerItems } from "@/lib/alpha-explorer/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const input = listExplorerSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const access = await requireExplorerAccess(input.path, input.trash ? "restore" : "list");
    const data = await listExplorerItems({ ...input, authorization: access.authorization });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return explorerErrorResponse(error, "items.list");
  }
}

export async function POST(request: Request) {
  try {
    assertExplorerMutationRequest(request);
    const input = createFolderSchema.parse(await request.json());
    const access = await requireExplorerAccess(input.path, "create_folder", true);
    const data = await createExplorerFolder(access.userId, access.authorization, input.path, input.name);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return explorerErrorResponse(error, "folder.create");
  }
}
