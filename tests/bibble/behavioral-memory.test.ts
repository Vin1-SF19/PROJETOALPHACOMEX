import { describe, expect, it, vi } from "vitest";
import { loadBehavioralHistory } from "@/lib/bibble/behavioral-memory";
import { BEHAVIOR_HISTORY_LIMIT, BEHAVIOR_MESSAGE_MAX_CHARS } from "@/lib/bibble/adaptive-style";

describe("Bibble behavioral memory isolation", () => {
  it("enforces ownership, native sessions, user role and limits in the database query", async () => {
    const findMany = vi.fn().mockResolvedValue([{ content: `${"a".repeat(2_500)}\n\n---\n### Conteúdo dos arquivos anexados\nprivado`, createdAt: new Date("2026-01-01") }]);
    const result = await loadBehavioralHistory(42, { findMany });
    expect(findMany).toHaveBeenCalledWith({
      where: { role: "user", session: { userId: 42, onyxSessionId: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: BEHAVIOR_HISTORY_LIMIT,
      select: { content: true, createdAt: true },
    });
    expect(result).toHaveLength(1);
    expect(result[0].content).toHaveLength(BEHAVIOR_MESSAGE_MAX_CHARS);
    expect(result[0].content).not.toContain("privado");
  });

  it("keeps deterministic chronological order after descending bounded query", async () => {
    const newest = { content: "novo", createdAt: new Date("2026-01-02") };
    const oldest = { content: "antigo", createdAt: new Date("2026-01-01") };
    const result = await loadBehavioralHistory(1, { findMany: vi.fn().mockResolvedValue([newest, oldest]) });
    expect(result.map(item => item.content)).toEqual(["antigo", "novo"]);
  });
});
