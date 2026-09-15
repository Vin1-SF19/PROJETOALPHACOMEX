import { describe, expect, it } from "vitest";

import { mapearComConcorrencia } from "@/lib/google-calendar/concurrency";

describe("Agenda Alpha concurrency", () => {
  it("respeita o limite e preserva a ordem dos resultados", async () => {
    let emAndamento = 0;
    let maximoEmAndamento = 0;

    const resultados = await mapearComConcorrencia([3, 1, 2, 0], 2, async (item) => {
      emAndamento += 1;
      maximoEmAndamento = Math.max(maximoEmAndamento, emAndamento);
      await new Promise((resolve) => setTimeout(resolve, item));
      emAndamento -= 1;
      return item * 2;
    });

    expect(resultados).toEqual([6, 2, 4, 0]);
    expect(maximoEmAndamento).toBe(2);
  });

  it("rejeita limites inválidos", async () => {
    await expect(mapearComConcorrencia([1], 0, async (item) => item)).rejects.toThrow(
      "Limite de concorrência inválido.",
    );
  });
});
