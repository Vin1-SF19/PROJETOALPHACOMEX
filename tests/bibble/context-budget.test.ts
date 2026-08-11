import { describe, expect, it } from "vitest";

import {
  calculateRequestBudget,
  estimateTokens,
  resolveEffectiveContextWindow,
  selectRecentHistory,
  selectTextForTokenBudget,
} from "@/lib/bibble/context-budget";

function syntheticLargeDocument(): string {
  return [
    "SENTINELA_INICIO\n",
    "A".repeat(26_000),
    "\nSENTINELA_MEIO\n",
    "B".repeat(26_000),
    "\nSENTINELA_FIM",
  ].join("");
}

describe("Bibble request context budget", () => {
  it("upgrades the legacy 4,096 window for PDF requests on the server", () => {
    const resolved = resolveEffectiveContextWindow({
      model: "qwen3:14b",
      requestedContextWindow: 4_096,
      hasPdf: true,
    });

    expect(resolved.effectiveContextWindow).toBe(32_768);
    expect(resolved.legacyContextAdjusted).toBe(true);
  });

  it("reserves explicit output tokens before exposing the input budget", () => {
    const budget = calculateRequestBudget({
      model: "qwen3:14b",
      requestedContextWindow: 32_768,
      hasPdf: true,
      systemPrompt: "system prompt",
      userPrompt: "analise o documento",
      tools: [],
    });

    expect(budget.outputTokenLimit).toBeGreaterThan(0);
    expect(budget.inputTokenBudget + budget.outputTokenLimit)
      .toBeLessThanOrEqual(budget.effectiveContextWindow);
    expect(budget.fixedInputTokens + budget.availableContentTokens)
      .toBeLessThanOrEqual(budget.inputTokenBudget);
  });

  it("reports insufficient fixed input instead of consuming the output reserve", () => {
    const budget = calculateRequestBudget({
      model: "qwen3:14b",
      requestedContextWindow: 8_192,
      hasPdf: false,
      systemPrompt: "S".repeat(30_000),
      userPrompt: "pergunta",
      tools: [],
    });

    expect(budget.fitsFixedInput).toBe(false);
    expect(budget.availableContentTokens).toBe(0);
    expect(budget.outputTokenLimit).toBeGreaterThan(0);
  });

  it("replaces fixed 50k/25k cuts with an explicit head-middle-tail selection", () => {
    const document = syntheticLargeDocument();
    expect(document.length).toBeGreaterThan(50_000);

    const selected = selectTextForTokenBudget(document, 6_000, "PDF sintético");

    expect(selected.reduced).toBe(true);
    expect(selected.strategy).toBe("head-middle-tail");
    expect(selected.text).toContain("SENTINELA_INICIO");
    expect(selected.text).toContain("SENTINELA_MEIO");
    expect(selected.text).toContain("SENTINELA_FIM");
    expect(selected.text).toContain("não representa leitura integral");
    expect(estimateTokens(selected.text)).toBeLessThanOrEqual(6_000);
  });

  it("applies the same explicit policy to an oversized persisted history message", () => {
    const document = syntheticLargeDocument();
    const selected = selectRecentHistory([
      { role: "user", content: document },
      { role: "assistant", content: "Qual trecho deseja investigar?" },
    ], 6_100);

    expect(selected.reduced).toBe(true);
    expect(selected.estimatedTokens).toBeLessThanOrEqual(6_100);
    expect(selected.messages.map(message => message.content).join("\n"))
      .toContain("não representa leitura integral");
  });
});
