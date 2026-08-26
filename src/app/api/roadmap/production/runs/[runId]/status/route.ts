import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireScope,
  resolveRoadmapApiIdentity,
  ROADMAP_API_WRITE_SCOPE,
} from "@/lib/roadmap-production-api/auth";
import { resolveAuthorLabel } from "@/lib/roadmap-production-api/identity-label";
import { updateRoadmapProductionRunStatus } from "@/lib/roadmap-production-api/operations";
import { handleRoadmapApiError, ok } from "@/lib/roadmap-production-api/response";
import { ROADMAP_RUN_STATUSES } from "@/lib/roadmap-production-api/status-machine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    status: z.enum(ROADMAP_RUN_STATUSES),
    resultSummary: z.string().trim().min(1).max(4_000).optional(),
    errorCode: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const identity = await resolveRoadmapApiIdentity(request);
    requireScope(identity, ROADMAP_API_WRITE_SCOPE);
    const { runId } = await params;
    const input = bodySchema.parse(await request.json());
    const authorLabel = await resolveAuthorLabel(identity);
    const run = await updateRoadmapProductionRunStatus(runId, input.status, {
      authorKind: identity.credentialId ? "assistant" : "user",
      authorLabel,
      authorUserId: identity.userId,
    }, {
      resultSummary: input.resultSummary,
      errorCode: input.errorCode,
    });
    return ok(run);
  } catch (error) {
    return handleRoadmapApiError(error);
  }
}
