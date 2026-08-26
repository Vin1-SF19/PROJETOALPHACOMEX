import type { NextRequest } from "next/server";
import {
  requireScope,
  resolveRoadmapApiIdentity,
  ROADMAP_API_WRITE_SCOPE,
} from "@/lib/roadmap-production-api/auth";
import { resolveAuthorLabel } from "@/lib/roadmap-production-api/identity-label";
import { approveRoadmapProductionRun } from "@/lib/roadmap-production-api/operations";
import { handleRoadmapApiError, ok } from "@/lib/roadmap-production-api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const identity = await resolveRoadmapApiIdentity(request);
    requireScope(identity, ROADMAP_API_WRITE_SCOPE);
    const { runId } = await params;
    const authorLabel = await resolveAuthorLabel(identity);
    const run = await approveRoadmapProductionRun(runId, {
      authorKind: identity.credentialId ? "assistant" : "user",
      authorLabel,
      authorUserId: identity.userId,
    });
    return ok(run);
  } catch (error) {
    return handleRoadmapApiError(error);
  }
}
