import { describe, expect, it } from "vitest";

import {
  atualizarEventoSchema,
  atualizarEventoParcialSchema,
  cancelarEventoSchema,
  consultarFreeBusySchema,
  criarEventoSchema,
} from "@/lib/validations/google-calendar";

const BASE_EVENTO = {
  calendarId: "primary",
  titulo: "Reunião de acompanhamento",
  timezone: "America/Sao_Paulo",
  inicio: "2026-07-18T14:00:00-03:00",
  fim: "2026-07-18T15:00:00-03:00",
};

describe("criarEventoSchema", () => {
  it("aceita um evento válido mínimo", () => {
    expect(criarEventoSchema.safeParse(BASE_EVENTO).success).toBe(true);
  });

  it("rejeita título vazio", () => {
    const resultado = criarEventoSchema.safeParse({ ...BASE_EVENTO, titulo: "" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita fim antes do início", () => {
    const resultado = criarEventoSchema.safeParse({
      ...BASE_EVENTO,
      inicio: "2026-07-18T15:00:00-03:00",
      fim: "2026-07-18T14:00:00-03:00",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita fim igual ao início", () => {
    const resultado = criarEventoSchema.safeParse({ ...BASE_EVENTO, fim: BASE_EVENTO.inicio });
    expect(resultado.success).toBe(false);
  });

  it("rejeita duração maior que 30 dias", () => {
    const resultado = criarEventoSchema.safeParse({
      ...BASE_EVENTO,
      inicio: "2026-01-01T00:00:00Z",
      fim: "2026-03-01T00:00:00Z",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita timezone inválido", () => {
    const resultado = criarEventoSchema.safeParse({ ...BASE_EVENTO, timezone: "Nao/Existe" });
    expect(resultado.success).toBe(false);
  });

  it("normaliza e-mail de participante para minúsculo e rejeita e-mail inválido", () => {
    const valido = criarEventoSchema.safeParse({
      ...BASE_EVENTO,
      participantes: ["Fulano@Empresa.com"],
    });
    expect(valido.success).toBe(true);
    if (valido.success) expect(valido.data.participantes).toEqual(["fulano@empresa.com"]);

    const invalido = criarEventoSchema.safeParse({ ...BASE_EVENTO, participantes: ["nao-e-email"] });
    expect(invalido.success).toBe(false);
  });

  it("limita quantidade de participantes", () => {
    const participantes = Array.from({ length: 51 }, (_, i) => `pessoa${i}@empresa.com`);
    expect(criarEventoSchema.safeParse({ ...BASE_EVENTO, participantes }).success).toBe(false);
  });

  it("default de diaInteiro e criarMeet é false", () => {
    const resultado = criarEventoSchema.parse(BASE_EVENTO);
    expect(resultado.diaInteiro).toBe(false);
    expect(resultado.criarMeet).toBe(false);
  });
});

describe("atualizarEventoSchema", () => {
  it("exige googleEventId", () => {
    expect(atualizarEventoSchema.safeParse(BASE_EVENTO).success).toBe(false);
    expect(
      atualizarEventoSchema.safeParse({ ...BASE_EVENTO, googleEventId: "evt_123" }).success,
    ).toBe(true);
  });
});

describe("atualizarEventoParcialSchema", () => {
  const IDENTIFICADORES = {
    calendarId: "primary",
    googleEventId: "evt_123",
  };

  it("aceita alteração isolada de título sem exigir os demais detalhes do evento", () => {
    const resultado = atualizarEventoParcialSchema.safeParse({
      ...IDENTIFICADORES,
      titulo: "Novo título",
    });

    expect(resultado.success).toBe(true);
  });

  it("exige ao menos um campo mutável além dos identificadores e do etag", () => {
    expect(atualizarEventoParcialSchema.safeParse(IDENTIFICADORES).success).toBe(false);
    expect(
      atualizarEventoParcialSchema.safeParse({
        ...IDENTIFICADORES,
        etagConhecido: '"etag-1"',
      }).success,
    ).toBe(false);
  });

  it("exige início, fim e diaInteiro juntos em qualquer mudança temporal", () => {
    expect(
      atualizarEventoParcialSchema.safeParse({
        ...IDENTIFICADORES,
        inicio: "2026-07-24T13:00:00Z",
      }).success,
    ).toBe(false);

    expect(
      atualizarEventoParcialSchema.safeParse({
        ...IDENTIFICADORES,
        inicio: "2026-07-24T13:00:00Z",
        fim: "2026-07-24T14:00:00Z",
        diaInteiro: false,
      }).success,
    ).toBe(true);
  });

  it("valida intervalo e timezone quando a data é alterada", () => {
    expect(
      atualizarEventoParcialSchema.safeParse({
        ...IDENTIFICADORES,
        inicio: "2026-07-24T14:00:00Z",
        fim: "2026-07-24T13:00:00Z",
        diaInteiro: false,
      }).success,
    ).toBe(false);

    expect(
      atualizarEventoParcialSchema.safeParse({
        ...IDENTIFICADORES,
        inicio: "2026-07-24T13:00:00Z",
        fim: "2026-07-24T14:00:00Z",
        diaInteiro: false,
        timezone: "Timezone/Inexistente",
      }).success,
    ).toBe(false);
  });

  it("não permite timezone isolado nem criarMeet false", () => {
    expect(
      atualizarEventoParcialSchema.safeParse({
        ...IDENTIFICADORES,
        timezone: "America/Sao_Paulo",
      }).success,
    ).toBe(false);

    expect(
      atualizarEventoParcialSchema.safeParse({
        ...IDENTIFICADORES,
        criarMeet: false,
      }).success,
    ).toBe(false);
    expect(
      atualizarEventoParcialSchema.safeParse({
        ...IDENTIFICADORES,
        criarMeet: true,
      }).success,
    ).toBe(true);
  });

  it("permite limpar descrição, local e participantes de forma explícita", () => {
    const resultado = atualizarEventoParcialSchema.safeParse({
      ...IDENTIFICADORES,
      descricaoGoogle: "",
      localizacao: "",
      participantes: [],
    });

    expect(resultado.success).toBe(true);
  });

  it("rejeita campos inesperados no payload da IA", () => {
    expect(
      atualizarEventoParcialSchema.safeParse({
        ...IDENTIFICADORES,
        titulo: "Reunião",
        emailUsuario: "outra-pessoa@empresa.com",
      }).success,
    ).toBe(false);
  });
});

describe("cancelarEventoSchema", () => {
  it("exige calendarId, googleEventId e ETag não vazios", () => {
    expect(
      cancelarEventoSchema.safeParse({
        calendarId: "primary",
        googleEventId: "evt_1",
        etagConhecido: '"v1"',
      }).success,
    ).toBe(true);
    expect(
      cancelarEventoSchema.safeParse({
        calendarId: "primary",
        googleEventId: "evt_1",
      }).success,
    ).toBe(false);
    expect(cancelarEventoSchema.safeParse({ calendarId: "", googleEventId: "evt_1" }).success).toBe(false);
  });
});

describe("consultarFreeBusySchema", () => {
  it("exige ao menos 1 calendário e fim depois do início", () => {
    expect(
      consultarFreeBusySchema.safeParse({
        googleCalendarIds: [],
        inicio: "2026-07-18T00:00:00Z",
        fim: "2026-07-19T00:00:00Z",
      }).success,
    ).toBe(false);

    expect(
      consultarFreeBusySchema.safeParse({
        googleCalendarIds: ["primary"],
        inicio: "2026-07-19T00:00:00Z",
        fim: "2026-07-18T00:00:00Z",
      }).success,
    ).toBe(false);

    expect(
      consultarFreeBusySchema.safeParse({
        googleCalendarIds: ["primary"],
        inicio: "2026-07-18T00:00:00Z",
        fim: "2026-07-19T00:00:00Z",
      }).success,
    ).toBe(true);
  });
});
