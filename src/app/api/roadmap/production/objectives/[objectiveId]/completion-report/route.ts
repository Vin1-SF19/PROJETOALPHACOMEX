import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireScope,
  resolveRoadmapApiIdentity,
  ROADMAP_API_WRITE_SCOPE,
} from "@/lib/roadmap-production-api/auth";
import { setRoadmapObjectiveCompletionReport } from "@/lib/roadmap-production-api/operations";
import { handleRoadmapApiError, ok } from "@/lib/roadmap-production-api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    reportMarkdown: z.string().trim().min(1).max(200_000),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> },
) {
  try {
    const identity = await resolveRoadmapApiIdentity(request);
    requireScope(identity, ROADMAP_API_WRITE_SCOPE);
    const { objectiveId } = await params;
    const input = bodySchema.parse(await request.json());
    const objective = await setRoadmapObjectiveCompletionReport(objectiveId, input.reportMarkdown);
    return ok(objective, 200);
  } catch (error) {
    return handleRoadmapApiError(error);
  }
}
