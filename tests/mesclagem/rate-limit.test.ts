import { describe, expect, it } from "vitest";

import { adquirirLimiteMesclagem } from "@/lib/mesclagem/rate-limit";

describe("Rate limit da Mesclagem", () => {
  it("bloqueia concorrência do mesmo usuário mesmo com outro IP", () => {
    const primeiro = adquirirLimiteMesclagem(91_001, "10.0.0.1");
    expect(primeiro.permitido).toBe(true);
    const segundo = adquirirLimiteMesclagem(91_001, "203.0.113.2");
    expect(segundo).toEqual({ permitido: false, motivo: "CONCURRENT_MESCLAGEM" });
    if (primeiro.permitido) primeiro.liberar();
  });

  it("mantém orçamento por usuário após liberações", () => {
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const limite = adquirirLimiteMesclagem(91_002, `10.0.0.${tentativa}`);
      expect(limite.permitido).toBe(true);
      if (limite.permitido) limite.liberar();
    }
    expect(adquirirLimiteMesclagem(91_002, "198.51.100.8"))
      .toEqual({ permitido: false, motivo: "RATE_LIMIT" });
  });
});
