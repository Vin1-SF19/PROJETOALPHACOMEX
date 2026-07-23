import { describe, expect, it } from "vitest";

import { paraSchemaEventoParcial } from "@/lib/google-calendar/client";

describe("paraSchemaEventoParcial", () => {
  it("mapeia somente os campos informados e não apaga detalhes omitidos", () => {
    const payload = paraSchemaEventoParcial({
      titulo: "Título atualizado",
    });

    expect(payload).toEqual({ summary: "Título atualizado" });
    expect(payload).not.toHaveProperty("description");
    expect(payload).not.toHaveProperty("location");
    expect(payload).not.toHaveProperty("attendees");
    expect(payload).not.toHaveProperty("conferenceData");
    expect(payload).not.toHaveProperty("start");
    expect(payload).not.toHaveProperty("end");
  });

  it("diferencia omissão de limpeza explícita", () => {
    const payload = paraSchemaEventoParcial({
      descricaoGoogle: "",
      localizacao: "",
      participantes: [],
    });

    expect(payload).toEqual({
      description: "",
      location: "",
      attendees: [],
    });
  });

  it("mapeia início e fim com timezone para evento com horário", () => {
    const payload = paraSchemaEventoParcial({
      inicio: new Date("2026-07-24T13:00:00Z"),
      fim: new Date("2026-07-24T14:00:00Z"),
      diaInteiro: false,
      timezone: "America/Sao_Paulo",
    });

    expect(payload.start).toEqual({
      dateTime: "2026-07-24T13:00:00.000Z",
      timeZone: "America/Sao_Paulo",
    });
    expect(payload.end).toEqual({
      dateTime: "2026-07-24T14:00:00.000Z",
      timeZone: "America/Sao_Paulo",
    });
  });

  it("mapeia evento de dia inteiro sem horário e sem timezone", () => {
    const payload = paraSchemaEventoParcial({
      inicio: new Date("2026-07-24T00:00:00Z"),
      fim: new Date("2026-07-25T00:00:00Z"),
      diaInteiro: true,
      timezone: "America/Sao_Paulo",
    });

    expect(payload.start).toEqual({ date: "2026-07-24" });
    expect(payload.end).toEqual({ date: "2026-07-25" });
  });

  it("só inclui criação de Meet quando explicitamente solicitada", () => {
    const payload = paraSchemaEventoParcial({ criarMeet: true });

    expect(payload.conferenceData?.createRequest?.conferenceSolutionKey?.type).toBe("hangoutsMeet");
    expect(payload.conferenceData?.createRequest?.requestId).toMatch(/^calalpha-/);
  });
});
