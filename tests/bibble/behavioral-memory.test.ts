import { describe, expect, it, vi } from "vitest";
import {
  BEHAVIORAL_PROFILE_MIN_CONFIDENCE,
  BEHAVIORAL_PROFILE_MIN_SAMPLE,
  inspectBehavioralProfileByName,
  loadBehavioralHistory,
} from "@/lib/bibble/behavioral-memory";
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

describe("Bibble administrative behavioral profile", () => {
  it("returns a safe no-match response without reading messages", async () => {
    const users = { findMany: vi.fn().mockResolvedValue([]) };
    const messages = { findMany: vi.fn() };

    const result = await inspectBehavioralProfileByName("Nailza", { users, messages });

    expect(result).toMatchObject({ status: "not_found", query: "Nailza" });
    expect(messages.findMany).not.toHaveBeenCalled();
  });

  it("refuses ambiguous partial names instead of selecting an arbitrary user", async () => {
    const users = {
      findMany: vi.fn().mockResolvedValue([
        { id: 10, nome: "Ana Lima" },
        { id: 11, nome: "Ana Souza" },
      ]),
    };
    const messages = { findMany: vi.fn() };

    const result = await inspectBehavioralProfileByName("Ana", { users, messages });

    expect(result).toEqual({
      status: "ambiguous",
      query: "Ana",
      candidates: ["Ana Lima", "Ana Souza"],
      truncated: false,
      message: "Há mais de um usuário compatível. Informe o nome completo exato.",
    });
    expect(messages.findMany).not.toHaveBeenCalled();
  });

  it("returns only aggregated Portuguese facts from the last native user messages", async () => {
    const rawMessages = [
      "faz logo a migration secreta",
      "manda o endpoint agora",
      "bora resolver essa API kkk",
      "mostra o resultado",
    ];
    const users = { findMany: vi.fn().mockResolvedValue([{ id: 27, nome: "Nailza Silva" }]) };
    const messages = {
      findMany: vi.fn().mockResolvedValue(rawMessages.map((content, index) => ({
        content,
        createdAt: new Date(`2026-09-${String(12 + index).padStart(2, "0")}T12:00:00.000Z`),
      })).reverse()),
    };

    const result = await inspectBehavioralProfileByName("nailza silva", { users, messages });
    const serialized = JSON.stringify(result);

    expect(users.findMany).toHaveBeenCalledWith({
      where: { nome: { contains: "nailza silva" } },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      take: 6,
      select: { id: true, nome: true },
    });
    expect(messages.findMany).toHaveBeenCalledWith({
      where: { role: "user", session: { userId: 27, onyxSessionId: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: BEHAVIOR_HISTORY_LIMIT,
      select: { content: true, createdAt: true },
    });
    expect(result).toMatchObject({
      status: "ready",
      target: { name: "Nailza Silva" },
      sampleSize: 4,
      insufficientSample: false,
      period: {
        first: "2026-09-12T12:00:00.000Z",
        last: "2026-09-15T12:00:00.000Z",
      },
      aggregate: {
        objetividade: { code: "high", label: "costuma ser direta e objetiva" },
      },
    });
    expect(result.status === "ready" && result.facts).toHaveLength(5);
    for (const rawMessage of rawMessages) expect(serialized).not.toContain(rawMessage);
    expect(serialized).not.toContain("migration secreta");
    expect(serialized).not.toContain("endpoint agora");
  });

  it("marks fewer than three messages as insufficient and omits inferred dimensions", async () => {
    const users = { findMany: vi.fn().mockResolvedValue([{ id: 28, nome: "Nailza" }]) };
    const messages = {
      findMany: vi.fn().mockResolvedValue(Array.from({ length: BEHAVIORAL_PROFILE_MIN_SAMPLE - 1 }, (_, index) => ({
        content: `mensagem ${index}`,
        createdAt: new Date(`2026-09-1${index + 1}T12:00:00.000Z`),
      }))),
    };

    const result = await inspectBehavioralProfileByName("Nailza", { users, messages });

    expect(result).toMatchObject({
      status: "insufficient_sample",
      sampleSize: 2,
      insufficientSample: true,
      confidence: 0,
      confidenceLabel: "insuficiente",
      aggregate: null,
      facts: [],
    });
  });

  it("keeps a three-message profile insufficient when classifier confidence is below the safe threshold", async () => {
    const users = { findMany: vi.fn().mockResolvedValue([{ id: 29, nome: "Nailza" }]) };
    const messages = {
      findMany: vi.fn().mockResolvedValue([
        { content: "primeira mensagem", createdAt: new Date("2026-09-13T12:00:00.000Z") },
        { content: "segunda mensagem", createdAt: new Date("2026-09-14T12:00:00.000Z") },
        { content: "terceira mensagem", createdAt: new Date("2026-09-15T12:00:00.000Z") },
      ]),
    };

    const result = await inspectBehavioralProfileByName("Nailza", { users, messages });

    expect(result.status).toBe("insufficient_sample");
    if (result.status !== "insufficient_sample") return;
    expect(result.sampleSize).toBe(BEHAVIORAL_PROFILE_MIN_SAMPLE);
    expect(result.confidence).toBeLessThan(BEHAVIORAL_PROFILE_MIN_CONFIDENCE);
    expect(result.confidenceLabel).toBe("insuficiente");
    expect(result.aggregate).toBeNull();
  });
});
