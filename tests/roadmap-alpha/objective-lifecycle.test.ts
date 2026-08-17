import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMany } = vi.hoisted(() => ({ deleteMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  default: {
    roadmapObjective: { deleteMany },
  },
}));

import { purgeExpiredDeletedRoadmapObjectives } from "@/lib/roadmap-alpha/objectives";

describe("roadmap objective trash lifecycle", () => {
  beforeEach(() => {
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 2 });
  });

  it("purges only deleted objectives after the three-day retention window", async () => {
    const count = await purgeExpiredDeletedRoadmapObjectives(
      new Date("2026-08-17T15:00:00.000Z"),
    );

    expect(count).toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        status: "DELETED",
        archivedAt: { lte: new Date("2026-08-14T15:00:00.000Z") },
      },
    });
  });
});
