import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_PROVIDERS,
  aiRequestHash,
  callOpenRouterProvider,
  summarizeProviderStatuses,
} from "@/lib/alpha-seo/ai-visibility/service";

describe("AI Visibility", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
  });
  it("mantém quatro perspectivas", () =>
    expect(AI_PROVIDERS).toEqual([
      "CHATGPT",
      "CLAUDE",
      "GEMINI",
      "PERPLEXITY",
    ]));
  it("preserva resultado parcial quando um modelo falha", () => {
    expect(
      summarizeProviderStatuses([
        "fulfilled",
        "rejected",
        "fulfilled",
        "fulfilled",
      ]),
    ).toBe("PARTIAL");
    expect(summarizeProviderStatuses(["rejected", "rejected"])).toBe("FAILED");
  });
  it("hash é canônico para concorrentes", () => {
    const base = {
      projectId: "p",
      kind: "BRAND_LOOKUP" as const,
      query: "marca",
      competitors: ["b", "a"],
      webSearch: true,
      idempotencyKey: "12345678",
    };
    expect(aiRequestHash(base)).toBe(
      aiRequestHash({ ...base, competitors: ["a", "b"] }),
    );
  });
  it("usa OpenRouter e preserva citações com fetch mockado", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "answer" } }],
          citations: ["https://example.com/source"],
          usage: { cost: 0.001 },
        }),
        { status: 200 },
      ),
    );
    const result = await callOpenRouterProvider(
      "CHATGPT",
      { kind: "PROMPT_EXPLORER", query: "q", competitors: [], webSearch: true },
      fetcher,
    );
    expect(result.citations).toEqual(["https://example.com/source"]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
