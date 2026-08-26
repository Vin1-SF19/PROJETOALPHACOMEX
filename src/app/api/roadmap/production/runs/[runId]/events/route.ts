import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireScope,
  resolveRoadmapApiIdentity,
  ROADMAP_API_READ_SCOPE,
  ROADMAP_API_WRITE_SCOPE,
} from "@/lib/roadmap-production-api/auth";
import { resolveAuthorLabel } from "@/lib/roadmap-production-api/identity-label";
import {
  listRoadmapProductionEvents,
  registerRoadmapProductionEvent,
} from "@/lib/roadmap-production-api/operations";
import { handleRoadmapApiError, ok } from "@/lib/roadmap-production-api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    kind: z.enum(["MESSAGE", "QUESTION", "ANSWER", "NOTE"]),
    content: z.string().trim().min(1).max(4_000),
  })
  .strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const identity = await resolveRoadmapApiIdentity(request);
    requireScope(identity, ROADMAP_API_READ_SCOPE);
    const { runId } = await params;
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.trunc(limitParam), 1), 200)
      : 50;
    const cursor = searchParams.get("cursor") ?? undefined;
    const events = await listRoadmapProductionEvents(runId, limit, cursor);
    return ok(events);
  } catch (error) {
    return handleRoadmapApiError(error);
  }
}

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
    const event = await registerRoadmapProductionEvent(runId, input.kind, input.content, {
      authorKind: identity.credentialId ? "assistant" : "user",
      authorLabel,
      authorUserId: identity.userId,
    });
    return ok(event, 201);
  } catch (error) {
    return handleRoadmapApiError(error);
  }
}
