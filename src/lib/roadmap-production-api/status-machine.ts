export const ROADMAP_RUN_STATUSES = [
  "PENDING",
  "AWAITING_APPROVAL",
  "IN_PROGRESS",
  "NEEDS_INPUT",
  "BLOCKED",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export type RoadmapRunStatus = (typeof ROADMAP_RUN_STATUSES)[number];

const TRANSITIONS: Record<RoadmapRunStatus, RoadmapRunStatus[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED"],
  AWAITING_APPROVAL: ["PENDING", "CANCELLED"],
  IN_PROGRESS: ["SUCCEEDED", "FAILED", "NEEDS_INPUT", "BLOCKED", "CANCELLED"],
  NEEDS_INPUT: ["IN_PROGRESS", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: ["PENDING"],
  CANCELLED: [],
};

export function isValidRoadmapRunStatus(value: string): value is RoadmapRunStatus {
  return (ROADMAP_RUN_STATUSES as readonly string[]).includes(value);
}

export function canTransitionRoadmapRun(
  from: RoadmapRunStatus,
  to: RoadmapRunStatus,
): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export function assertRoadmapRunTransition(
  from: RoadmapRunStatus,
  to: RoadmapRunStatus,
): void {
  if (!canTransitionRoadmapRun(from, to)) {
    throw new Error(`INVALID_TRANSITION:${from}->${to}`);
  }
}
