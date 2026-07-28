import { describe, expect, it } from "vitest";
import { parseClienteDateString } from "@/lib/commissions/adapters/date-parsing";

describe("parseClienteDateString — parse defensivo (clientes.dataContratacao/dataExito são String?)", () => {
  it("string vazia/nula é ausência legítima, não divergência", () => {
    expect(parseClienteDateString(null)).toEqual({ date: null, invalid: false });
    expect(parseClienteDateString(undefined)).toEqual({ date: null, invalid: false });
    expect(parseClienteDateString("")).toEqual({ date: null, invalid: false });
    expect(parseClienteDateString("   ")).toEqual({ date: null, invalid: false });
  });

  it("formato ISO é interpretado corretamente", () => {
    const result = parseClienteDateString("2026-07-15");
    expect(result.invalid).toBe(false);
    expect(result.date).not.toBeNull();
  });

  it("formato brasileiro DD/MM/YYYY é interpretado corretamente", () => {
    const result = parseClienteDateString("15/07/2026");
    expect(result.invalid).toBe(false);
    expect(result.date?.getUTCFullYear()).toBe(2026);
    expect(result.date?.getUTCMonth()).toBe(6); // julho = índice 6
    expect(result.date?.getUTCDate()).toBe(15);
  });

  it("string presente mas não reconhecida vira divergência explícita (invalid=true), nunca crash", () => {
    const result = parseClienteDateString("data desconhecida");
    expect(result.invalid).toBe(true);
    expect(result.date).toBeNull();
  });

  it("formato parcial 'DD/MM' sem ano (caso real documentado em Transacao.dataOriginalTexto) também vira divergência", () => {
    const result = parseClienteDateString("15/07");
    expect(result.invalid).toBe(true);
    expect(result.date).toBeNull();
  });
});
