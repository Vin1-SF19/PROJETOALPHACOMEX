import { afterEach, describe, expect, it, vi } from "vitest";

import { improveRoadmapField } from "@/lib/roadmap-alpha/improve-with-ai";

afterEach(() => vi.unstubAllEnvs());

describe("Melhorar com IA", () => {
  it("usa Qwen 3.8 e devolve somente o texto melhorado", async () => {
    vi.stubEnv("BIBBLE_OLLAMA_URL", "https://ollama.test");
    vi.stubEnv("OLLAMA_API_KEY", "secret");
    vi.stubEnv("ROADMAP_QWEN_MODEL", "qwen3.8:27b");
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    "```text\nCriar uma experiência clara e verificável no CRM.\n```",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await improveRoadmapField(
      "desiredOutcome",
      "melhorar crm",
      { title: "CRM" },
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(result).toBe("Criar uma experiência clara e verificável no CRM.");
    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)) as {
      model: string;
      reasoning_effort: string;
    };
    expect(request).toMatchObject({
      model: "qwen3.8:27b",
      reasoning_effort: "low",
    });
  });

  it("melhora um relato de erro sem trocar sua intenção", async () => {
    vi.stubEnv("BIBBLE_OLLAMA_URL", "https://ollama.test");
    vi.stubEnv("OLLAMA_API_KEY", "secret");
    vi.stubEnv("ROADMAP_QWEN_MODEL", "qwen3.8:27b");
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    "O layout mobile oculta os controles; mantenha-os visíveis em 320 px.",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await improveRoadmapField(
      "implementationFeedback",
      "mobile ruim",
      { title: "CRM" },
      { fetchImpl: fetchImpl as typeof fetch },
    );
    expect(result).toContain("320 px");
  });
});
