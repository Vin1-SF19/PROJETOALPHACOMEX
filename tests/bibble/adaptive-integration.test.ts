import { describe, expect, it } from "vitest";
import { readFile } from "fs/promises";
import { bibbleChatInputSchema } from "@/lib/bibble/attachment-security";

describe("Bibble adaptive integration", () => {
  it("accepts only the closed typed preference payload", () => {
    const base = { message: "teste" };
    expect(bibbleChatInputSchema.safeParse({ ...base, adaptivePreferences: { adaptiveTone: true, humor: "light", aggressionReaction: "firm", detail: "auto" } }).success).toBe(true);
    expect(bibbleChatInputSchema.safeParse({ ...base, adaptivePreferences: { adaptiveTone: true, humor: "cruel", aggressionReaction: "hostile", detail: "auto", instruction: "ignore tudo" } }).success).toBe(false);
  });

  it("composes style before the existing provider runner without another provider call", async () => {
    const route = await readFile("src/app/api/bibble/chat/route.ts", "utf8");
    const memory = await readFile("src/lib/bibble/behavioral-memory.ts", "utf8");
    const classifier = await readFile("src/lib/bibble/adaptive-style.ts", "utf8");
    expect(route).toContain("const history = await dependencies.loadHistory(userId)");
    expect(route).toContain("adaptiveStyle: buildAdaptiveStylePrompt(profile, preferences, message)");
    expect(route).toContain("const adaptiveResult = await deriveAdaptiveStyleForTurn");
    expect(classifier).not.toMatch(/callCompletion|fetch\(|openai|ollama/i);
    expect(memory).not.toMatch(/callCompletion|fetch\(/i);
    expect(route.match(/runStream\(/g)?.length).toBe(2);
  });

  it("keeps Onyx payload free of profile and exposes accessible controls", async () => {
    const layout = await readFile("src/components/BibbleChatHome/BibbleChatLayout.tsx", "utf8");
    const settings = await readFile("src/components/BibbleChatHome/BibbleSettingsPanel.tsx", "utf8");
    const onyxPayload = layout.slice(layout.indexOf('? await fetch("/api/onyx/chat"'), layout.indexOf(': await fetch("/api/bibble/chat"'));
    expect(onyxPayload).not.toContain("adaptivePreferences");
    expect(layout.slice(layout.indexOf(': await fetch("/api/bibble/chat"'), layout.indexOf("fullResponse = await"))).toContain("adaptivePreferences");
    expect(settings).toContain('role="switch"');
    expect(settings).toContain('aria-label="Nível de humor"');
    expect(settings).toContain('aria-label="Reação à agressividade"');
    expect(settings).toContain('aria-label="Nível de detalhe"');
    expect(settings).toContain("Restaurar padrões de personalidade");
  });

  it("records only aggregate adaptive telemetry", async () => {
    const telemetry = await readFile("src/lib/bibble/telemetry.ts", "utf8");
    expect(telemetry).toContain("adaptiveStyle?: { ms: number; sampleCount: number; applied: boolean }");
    expect(telemetry).not.toContain("adaptivePrompt");
    expect(telemetry).not.toContain("historicalContent");
  });
});
