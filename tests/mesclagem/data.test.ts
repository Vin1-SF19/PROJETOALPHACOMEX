import { describe, expect, it } from "vitest";

import { formatarDataMesclagem } from "@/lib/mesclagem/data";

describe("Datas da Mesclagem", () => {
  it.each([
    ["2026-09-15T00:00:00.000Z", "15/09/2026"],
    ["2026-09-15 14:35:10", "15/09/2026"],
    ["15/09/2026 00:00:00", "15/09/2026"],
    ["5/9/2026", "05/09/2026"],
    ["45550", "15/09/2024"],
  ])("formata %s sem horário", (entrada, esperado) => {
    expect(formatarDataMesclagem(entrada)).toBe(esperado);
  });

  it("preserva texto que não representa uma data válida", () => {
    expect(formatarDataMesclagem("31/02/2026 00:00:00")).toBe("31/02/2026 00:00:00");
    expect(formatarDataMesclagem("não informado")).toBe("não informado");
  });
});
