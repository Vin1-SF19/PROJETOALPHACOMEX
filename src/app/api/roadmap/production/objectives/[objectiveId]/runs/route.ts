import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireScope,
  resolveRoadmapApiIdentity,
  ROADMAP_API_WRITE_SCOPE,
} from "@/lib/roadmap-production-api/auth";
import { createRoadmapProductionRun } from "@/lib/roadmap-production-api/operations";
import { handleRoadmapApiError, ok } from "@/lib/roadmap-production-api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    phaseNumber: z.number().int().min(0).max(99),
    assignee: z.enum(["claude", "codex", "manual"]).default("claude"),
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
    const run = await createRoadmapProductionRun(
      objectiveId,
      input.phaseNumber,
      input.assignee,
      identity.userId,
    );
    return ok(run, 201);
  } catch (error) {
    return handleRoadmapApiError(error);
  }
}
