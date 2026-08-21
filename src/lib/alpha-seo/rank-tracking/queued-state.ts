import { z } from "zod";

const taskSchema = z.object({
  keywordId: z.string().min(1),
  keyword: z.string().min(1),
  device: z.enum(["DESKTOP", "MOBILE"]),
});

const postedTaskSchema = taskSchema.extend({ providerTaskId: z.string().min(1) });

export const rankQueuedStateSchema = z.object({
  version: z.literal(1),
  postOffset: z.number().int().nonnegative(),
  pending: z.array(postedTaskSchema),
  fallback: z.array(taskSchema),
  pollRound: z.number().int().nonnegative(),
  queueTasks: z.number().int().nonnegative(),
  queueCollected: z.number().int().nonnegative(),
  fallbackTasks: z.number().int().nonnegative(),
  fallbackChecked: z.number().int().nonnegative(),
  actualUnits: z.number().int().nonnegative(),
  actualMicrosUsd: z.number().int().nonnegative(),
});

export type RankQueuedState = z.infer<typeof rankQueuedStateSchema>;

export function newRankQueuedState(): RankQueuedState {
  return { version: 1, postOffset: 0, pending: [], fallback: [], pollRound: 0, queueTasks: 0, queueCollected: 0, fallbackTasks: 0, fallbackChecked: 0, actualUnits: 0, actualMicrosUsd: 0 };
}

export function parseRankQueuedState(value: unknown): RankQueuedState | undefined {
  const parsed = rankQueuedStateSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function rankQueueAuditSummary(state: RankQueuedState) {
  return {
    mode: "queued" as const,
    postOffset: state.postOffset,
    pendingTasks: state.pending.length,
    queueTasks: state.queueTasks,
    queueCollected: state.queueCollected,
    fallbackTasks: state.fallbackTasks,
    fallbackChecked: state.fallbackChecked,
    pollRound: state.pollRound,
    actualUnits: state.actualUnits,
    actualMicrosUsd: state.actualMicrosUsd,
  };
}
