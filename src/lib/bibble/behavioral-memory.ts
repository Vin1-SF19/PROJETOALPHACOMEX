import db from "@/lib/prisma";
import {
  BEHAVIOR_HISTORY_LIMIT,
  sanitizeBehaviorContent,
  type BehavioralSample,
} from "@/lib/bibble/adaptive-style";

type BehavioralMessageStore = {
  findMany(args: {
    where: { role: "user"; session: { userId: number; onyxSessionId: null } };
    orderBy: Array<{ createdAt: "desc" } | { id: "desc" }>;
    take: number;
    select: { content: true; createdAt: true };
  }): Promise<Array<{ content: string; createdAt: Date }>>;
};

export async function loadBehavioralHistory(
  userId: number,
  store: BehavioralMessageStore = db.bibbleMessage,
): Promise<BehavioralSample[]> {
  const messages = await store.findMany({
    where: {
      role: "user",
      session: { userId, onyxSessionId: null },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: BEHAVIOR_HISTORY_LIMIT,
    select: { content: true, createdAt: true },
  });

  return messages
    .reverse()
    .map(message => ({
      content: sanitizeBehaviorContent(message.content),
      createdAt: message.createdAt,
    }))
    .filter(message => message.content.length > 0);
}
