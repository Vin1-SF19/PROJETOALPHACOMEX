import { describe, expect, it } from "vitest";

import {
  formatarDataCalendarioParaBibble,
  TIMEZONE_CALENDARIO_BIBBLE,
} from "@/lib/bibble/calendar-timezone";

describe("timezone dos eventos retornados ao Bibble", () => {
  it("apresenta um instante UTC no horário de São Paulo com offset explícito", () => {
    expect(
      formatarDataCalendarioParaBibble(
        new Date("2026-07-24T12:00:00.000Z"),
        false,
      ),
    ).toBe("2026-07-24T09:00:00-03:00");
  });

  it("não desloca novamente um horário que já veio com offset de São Paulo", () => {
    expect(
      formatarDataCalendarioParaBibble(
        "2026-07-24T09:00:00-03:00",
        false,
      ),
    ).toBe("2026-07-24T09:00:00-03:00");
  });

  it("respeita mudança de data provocada pelo fuso", () => {
    expect(
      formatarDataCalendarioParaBibble("2026-07-24T01:00:00Z", false),
    ).toBe("2026-07-23T22:00:00-03:00");
  });

  it("preserva a data civil de eventos de dia inteiro", () => {
    expect(formatarDataCalendarioParaBibble("2026-07-24", true)).toBe(
      "2026-07-24",
    );
    expect(
      formatarDataCalendarioParaBibble(
        new Date("2026-07-24T00:00:00.000Z"),
        true,
      ),
    ).toBe("2026-07-24");
  });

  it("trata valores ausentes ou inválidos sem inventar horário", () => {
    expect(formatarDataCalendarioParaBibble(null, false)).toBeNull();
    expect(formatarDataCalendarioParaBibble("inválido", false)).toBeNull();
  });

  it("documenta o timezone único usado na conversa", () => {
    expect(TIMEZONE_CALENDARIO_BIBBLE).toBe("America/Sao_Paulo");
  });
});
