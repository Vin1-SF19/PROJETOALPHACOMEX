import type { NextRequest } from "next/server";
import {
  requireScope,
  resolveRoadmapApiIdentity,
  ROADMAP_API_READ_SCOPE,
} from "@/lib/roadmap-production-api/auth";
import { getRoadmapProductionRunDetail } from "@/lib/roadmap-production-api/operations";
import { handleRoadmapApiError, ok } from "@/lib/roadmap-production-api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const identity = await resolveRoadmapApiIdentity(request);
    requireScope(identity, ROADMAP_API_READ_SCOPE);
    const { runId } = await params;
    const run = await getRoadmapProductionRunDetail(runId);
    return ok(run);
  } catch (error) {
    return handleRoadmapApiError(error);
  }
}
