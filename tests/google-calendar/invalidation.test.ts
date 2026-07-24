import { describe, expect, it } from "vitest";

import { resultadoToolAlterouCalendario } from "@/lib/google-calendar/invalidation";

describe("Calendar Alpha iframe invalidation", () => {
  it("recognizes a successful Bibble calendar cancellation", () => {
    expect(
      resultadoToolAlterouCalendario(
        "cancelar_evento_calendario",
        JSON.stringify({ ok: true, cancelado: true }),
      ),
    ).toBe(true);
  });

  it("does not invalidate the agenda when the tool failed", () => {
    expect(
      resultadoToolAlterouCalendario(
        "cancelar_evento_calendario",
        JSON.stringify({ ok: false, erro: "Google indisponível" }),
      ),
    ).toBe(false);
  });

  it("ignores non-calendar tools and malformed results", () => {
    expect(
      resultadoToolAlterouCalendario(
        "buscar_clientes",
        JSON.stringify({ ok: true }),
      ),
    ).toBe(false);
    expect(
      resultadoToolAlterouCalendario("editar_evento_calendario", "invalid-json"),
    ).toBe(false);
  });
});
