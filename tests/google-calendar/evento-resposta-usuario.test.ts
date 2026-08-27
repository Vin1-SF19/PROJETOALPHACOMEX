import { describe, expect, it } from "vitest";

import { eventoFoiRecusadoPeloUsuario } from "@/components/CalendarioAlpha/lib/tipos";

describe("eventoFoiRecusadoPeloUsuario", () => {
  it("identifica a resposta declined armazenada pelo sync", () => {
    expect(eventoFoiRecusadoPeloUsuario('{"respostaDoUsuario":"declined"}')).toBe(true);
  });

  it("mantém eventos aceitos, sem resposta e metadados legados sem risco", () => {
    expect(eventoFoiRecusadoPeloUsuario('{"respostaDoUsuario":"accepted"}')).toBe(false);
    expect(eventoFoiRecusadoPeloUsuario('{"focusTimeProperties":{}}')).toBe(false);
    expect(eventoFoiRecusadoPeloUsuario("json inválido")).toBe(false);
  });
});
