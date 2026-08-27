import { describe, expect, it } from "vitest";

import { eventoFoiCompartilhadoComUsuario, eventoFoiRecusadoPeloUsuario } from "@/components/CalendarioAlpha/lib/tipos";

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

describe("eventoFoiCompartilhadoComUsuario", () => {
  it("identifica evento organizado por outra pessoa", () => {
    expect(eventoFoiCompartilhadoComUsuario('{"compartilhadoComUsuario":true}')).toBe(true);
    expect(eventoFoiCompartilhadoComUsuario('{"compartilhadoComUsuario":false}')).toBe(false);
  });
});
