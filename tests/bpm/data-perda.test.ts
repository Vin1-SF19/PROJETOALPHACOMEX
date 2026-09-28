import { describe, expect, it } from "vitest";
import { ultimaDataPerda } from "@/lib/bpm/data-perda";

describe("data da perda", () => {
  const evento = (etapaId: string, createdAt: string) => ({
    acao: "CARD_MOVIDO",
    valorNovoJson: JSON.stringify({ etapaId }),
    createdAt: new Date(createdAt),
  });

  it("usa a entrada efetiva mais recente em Lost", () => {
    expect(ultimaDataPerda([
      evento("lost", "2026-09-28T12:00:00Z"),
      evento("outra", "2026-09-28T13:00:00Z"),
      evento("lost", "2026-09-28T14:00:00Z"),
    ], "lost")?.toISOString()).toBe("2026-09-28T14:00:00.000Z");
  });

  it("não cria data a partir de tentativa recusada ou evento inválido", () => {
    expect(ultimaDataPerda([
      { acao: "CARD_ATUALIZADO", valorNovoJson: JSON.stringify({ etapaId: "lost" }), createdAt: new Date() },
      { acao: "CARD_MOVIDO", valorNovoJson: "{", createdAt: new Date() },
      evento("outra", "2026-09-28T14:00:00Z"),
    ], "lost")).toBeNull();
  });
});
