import "server-only";

import {
  listRoadmapProductionQueue,
  createRoadmapProductionRun,
  getRoadmapProductionRunDetail,
  updateRoadmapProductionRunStatus,
  approveRoadmapProductionRun,
  listRoadmapProductionEvents,
  registerRoadmapProductionEvent,
  setRoadmapObjectiveCompletionReport,
} from "@/lib/roadmap-production-api/operations";
import { resolveAuthorLabel } from "@/lib/roadmap-production-api/identity-label";
import type { RoadmapApiIdentity } from "@/lib/roadmap-production-api/auth";
import { requireRoadmapMcpWrite } from "./auth";
import type { RoadmapMcpToolName } from "./registry";

type Args = Record<string, unknown>;

function stringArg(args: Args, key: string): string {
  const value = args[key];
  if (typeof value !== "string") throw new Error(`INVALID_INPUT:${key}`);
  return value;
}

function optionalString(args: Args, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function numberArg(args: Args, key: string, fallback?: number): number {
  const value = args[key] ?? fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`INVALID_INPUT:${key}`);
  return value;
}

async function author(identity: RoadmapApiIdentity) {
  const authorLabel = await resolveAuthorLabel(identity);
  return {
    authorKind: identity.credentialId ? ("assistant" as const) : ("user" as const),
    authorLabel,
    authorUserId: identity.userId,
  };
}

export async function executeRoadmapMcpTool(
  name: RoadmapMcpToolName,
  args: Args,
  identity: RoadmapApiIdentity,
): Promise<unknown> {
  switch (name) {
    case "roadmap_whoami":
      return {
        userId: identity.userId,
        credentialId: identity.credentialId,
        scopes: identity.scopes,
      };

    case "roadmap_list_queue":
      return listRoadmapProductionQueue({
        status: optionalString(args, "status"),
        moduleKey: optionalString(args, "moduleKey"),
        assignee: optionalString(args, "assignee"),
      });

    case "roadmap_create_run": {
      requireRoadmapMcpWrite(identity);
      return createRoadmapProductionRun(
        stringArg(args, "objectiveId"),
        numberArg(args, "phaseNumber"),
        optionalString(args, "assignee") ?? "claude",
        identity.userId,
      );
    }

    case "roadmap_get_run":
      return getRoadmapProductionRunDetail(stringArg(args, "runId"));

    case "roadmap_update_run_status": {
      requireRoadmapMcpWrite(identity);
      const runId = stringArg(args, "runId");
      const status = stringArg(args, "status");
      return updateRoadmapProductionRunStatus(runId, status, await author(identity), {
        resultSummary: optionalString(args, "resultSummary"),
        errorCode: optionalString(args, "errorCode"),
      });
    }

    case "roadmap_list_events": {
      const runId = stringArg(args, "runId");
      const limit = numberArg(args, "limit", 50);
      const cursor = optionalString(args, "cursor");
      return listRoadmapProductionEvents(runId, limit, cursor);
    }

    case "roadmap_add_event": {
      requireRoadmapMcpWrite(identity);
      const runId = stringArg(args, "runId");
      const kind = stringArg(args, "kind") as "MESSAGE" | "QUESTION" | "ANSWER" | "NOTE";
      const content = stringArg(args, "content");
      return registerRoadmapProductionEvent(runId, kind, content, await author(identity));
    }

    case "roadmap_approve_run": {
      requireRoadmapMcpWrite(identity);
      return approveRoadmapProductionRun(stringArg(args, "runId"), await author(identity));
    }

    case "roadmap_set_completion_report": {
      requireRoadmapMcpWrite(identity);
      return setRoadmapObjectiveCompletionReport(
        stringArg(args, "objectiveId"),
        stringArg(args, "reportMarkdown"),
      );
    }

    default:
      throw new Error(`UNKNOWN_TOOL:${name}`);
  }
}
