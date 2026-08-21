import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionFind: vi.fn(),
  approvalFind: vi.fn(),
  messageCreate: vi.fn(),
  messageFindMany: vi.fn(),
  getMemory: vi.fn(),
  renderMemory: vi.fn(),
  applyMemory: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    alphaSeoSamSession: { findFirst: mocks.sessionFind },
    alphaSeoCostApproval: { findFirst: mocks.approvalFind },
    alphaSeoSamMessage: {
      create: mocks.messageCreate,
      findMany: mocks.messageFindMany,
    },
  },
}));

vi.mock(
  "@/lib/alpha-seo/project-memory/service",
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import("@/lib/alpha-seo/project-memory/service")
    >();
    return {
      ...actual,
      getProjectMemory: mocks.getMemory,
      renderProjectMemory: mocks.renderMemory,
      applyProjectMemoryUpdates: mocks.applyMemory,
    };
  },
);

import { runSamTurn } from "@/lib/alpha-seo/sam/service";
import { executeSamTool } from "@/lib/alpha-seo/sam/tools";

describe("SAM cancellation", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.clearAllMocks();
    mocks.sessionFind.mockResolvedValue({ id: "session" });
    mocks.approvalFind.mockResolvedValue({ id: "approval" });
    mocks.messageCreate.mockResolvedValue({ id: "message" });
    mocks.messageFindMany.mockResolvedValue([]);
    mocks.getMemory.mockResolvedValue({
      sections: [],
      missingSections: [],
      competitors: [],
      keyPages: [],
      researchLog: [],
    });
    mocks.renderMemory.mockReturnValue("memory");
  });

  it("propaga abort até OpenRouter e não persiste resposta cobrada", async () => {
    const controller = new AbortController();
    let providerSignal: AbortSignal | undefined;
    const fetcher = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          providerSignal = init?.signal ?? undefined;
          providerSignal?.addEventListener(
            "abort",
            () => reject(providerSignal?.reason),
            { once: true },
          );
        }),
    );
    const turn = runSamTurn({
      userId: 901,
      data: { projectId: "p", sessionId: "session", message: "analise" },
      projectDomain: "example.com",
      fetcher,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());

    controller.abort(new DOMException("cancelled", "AbortError"));

    await expect(turn).rejects.toMatchObject({ name: "AbortError" });
    expect(providerSignal?.aborted).toBe(true);
    expect(mocks.messageCreate).toHaveBeenCalledTimes(1);
    expect(mocks.messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "USER" }),
      }),
    );
  });

  it("não inicia mutação de memória se a tool já foi cancelada", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("cancelled", "AbortError"));

    await expect(
      executeSamTool(
        "update_project_context",
        {
          updates: [
            {
              kind: "upsertSection",
              key: "goals",
              content: "crescer tráfego",
            },
          ],
        },
        {
          projectId: "p",
          userId: 1,
          projectDomain: "example.com",
          signal: controller.signal,
        },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.applyMemory).not.toHaveBeenCalled();
  });
});
