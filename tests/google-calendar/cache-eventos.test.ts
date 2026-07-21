import { describe, expect, it } from "vitest";

import { dadosCacheDeEvento, paraDataOuNull } from "@/lib/google-calendar/cache-eventos";
import type { GoogleEventoDTO } from "@/lib/google-calendar/types";

function eventoBase(overrides: Partial<GoogleEventoDTO> = {}): GoogleEventoDTO {
  return {
    googleEventId: "evt_1",
    status: "confirmed",
    titulo: "Reunião",
    descricao: null,
    localizacao: null,
    inicio: { dataHora: "2026-07-18T14:00:00-03:00", timezone: "America/Sao_Paulo" },
    fim: { dataHora: "2026-07-18T15:00:00-03:00", timezone: "America/Sao_Paulo" },
    diaInteiro: false,
    recorrenciaRegras: null,
    eventoRecorrenteIdOrigem: null,
    participantes: [],
    linkMeet: null,
    etag: "etag-1",
    atualizadoEm: "2026-07-18T10:00:00Z",
    visibilidade: "default",
    ...overrides,
  };
}

describe("paraDataOuNull", () => {
  it("retorna null para undefined e Date para string válida", () => {
    expect(paraDataOuNull(undefined)).toBeNull();
    expect(paraDataOuNull("2026-07-18T00:00:00Z")).toEqual(new Date("2026-07-18T00:00:00Z"));
  });
});

describe("dadosCacheDeEvento", () => {
  it("usa dataHora para evento com horário", () => {
    const dados = dadosCacheDeEvento(eventoBase());
    expect(dados.inicioEm).toEqual(new Date("2026-07-18T14:00:00-03:00"));
    expect(dados.fimEm).toEqual(new Date("2026-07-18T15:00:00-03:00"));
  });

  // Regressão: a atualização de evento só olhava `.dataHora`, perdendo eventos de dia inteiro
  // (que o Google representa via `.data`, não `.dataHora`) — evento sumia da visão de mês/agenda.
  it("usa `.data` (não `.dataHora`) para evento de dia inteiro — regressão do bug de edição", () => {
    const eventoDiaInteiro = eventoBase({
      diaInteiro: true,
      inicio: { data: "2026-07-20" },
      fim: { data: "2026-07-21" },
    });

    const dados = dadosCacheDeEvento(eventoDiaInteiro);

    expect(dados.inicioEm).toEqual(new Date("2026-07-20"));
    expect(dados.fimEm).toEqual(new Date("2026-07-21"));
    expect(dados.diaInteiro).toBe(true);
  });

  it("retorna inicioEm/fimEm null quando o Google não informa nem dataHora nem data", () => {
    const dados = dadosCacheDeEvento(eventoBase({ inicio: {}, fim: {} }));
    expect(dados.inicioEm).toBeNull();
    expect(dados.fimEm).toBeNull();
  });

  it("preserva status, titulo e etag", () => {
    const dados = dadosCacheDeEvento(eventoBase({ status: "tentative", titulo: "Provisório", etag: "etag-2" }));
    expect(dados.status).toBe("tentative");
    expect(dados.titulo).toBe("Provisório");
    expect(dados.etag).toBe("etag-2");
  });
});
