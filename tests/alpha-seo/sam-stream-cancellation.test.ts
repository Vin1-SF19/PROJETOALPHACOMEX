import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAccess: vi.fn(),
  projectFind: vi.fn(),
  sessionUpdateMany: vi.fn(),
  runSamTurn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    alphaSeoProject: { findUnique: mocks.projectFind },
    alphaSeoSamSession: { updateMany: mocks.sessionUpdateMany },
  },
}));
vi.mock("@/lib/alpha-seo/project-access", () => ({
  requireAlphaSeoProjectAccess: mocks.requireAccess,
}));
vi.mock(
  "@/lib/alpha-seo/sam/service",
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import("@/lib/alpha-seo/sam/service")
    >();
    return { ...actual, runSamTurn: mocks.runSamTurn };
  },
);

import { POST } from "@/app/api/alpha-seo/sam/stream/route";

describe("SAM SSE cancellation", () => {
  it("cancelar o body aborta a execução e persiste a sessão CANCELLED", async () => {
    mocks.requireAccess.mockResolvedValue({ userId: 7 });
    mocks.projectFind.mockResolvedValue({ domain: "example.com" });
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
    let executionSignal: AbortSignal | undefined;
    mocks.runSamTurn.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          executionSignal = signal;
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const response = await POST(
      new Request("https://alpha.test/api/alpha-seo/sam/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: "p",
          sessionId: "s",
          message: "continue",
        }),
      }),
    );
    expect(response.status).toBe(200);

    await response.body?.cancel();

    expect(executionSignal?.aborted).toBe(true);
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "s",
        projectId: "p",
        userId: 7,
        status: "ACTIVE",
      },
      data: { status: "CANCELLED", cancelledAt: expect.any(Date) },
    });
  });
});
