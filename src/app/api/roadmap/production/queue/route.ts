import type { NextRequest } from "next/server";
import {
  requireScope,
  resolveRoadmapApiIdentity,
  ROADMAP_API_READ_SCOPE,
} from "@/lib/roadmap-production-api/auth";
import { listRoadmapProductionQueue } from "@/lib/roadmap-production-api/operations";
import { handleRoadmapApiError, ok } from "@/lib/roadmap-production-api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await resolveRoadmapApiIdentity(request);
    requireScope(identity, ROADMAP_API_READ_SCOPE);
    const { searchParams } = new URL(request.url);
    const queue = await listRoadmapProductionQueue({
      status: searchParams.get("status") ?? undefined,
      moduleKey: searchParams.get("moduleKey") ?? undefined,
      assignee: searchParams.get("assignee") ?? undefined,
    });
    return ok(queue);
  } catch (error) {
    return handleRoadmapApiError(error);
  }
}
