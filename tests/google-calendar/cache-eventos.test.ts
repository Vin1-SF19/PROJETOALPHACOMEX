import { describe, expect, it } from "vitest";

import { dadosCacheDeEvento, paraDataDeEventoOuNull } from "@/lib/google-calendar/cache-eventos";
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

describe("paraDataDeEventoOuNull", () => {
  it("retorna null quando não há dataHora nem data", () => {
    expect(paraDataDeEventoOuNull({})).toBeNull();
  });

  it("usa dataHora (com offset) quando presente", () => {
    expect(paraDataDeEventoOuNull({ dataHora: "2026-07-18T00:00:00Z" })).toEqual(
      new Date("2026-07-18T00:00:00Z"),
    );
  });

  // Regressão: `new Date("YYYY-MM-DD")` é meia-noite UTC — ao formatar em America/Sao_Paulo
  // (UTC-3) regride para o dia civil anterior (feriado do dia 9 aparecendo no dia 8).
  it("ancora `data` (dia inteiro, sem horário) em meia-noite UTC do próprio dia civil", () => {
    const resultado = paraDataDeEventoOuNull({ data: "2026-08-09" });
    expect(resultado).toEqual(new Date(Date.UTC(2026, 7, 9)));
    expect(resultado?.getUTCFullYear()).toBe(2026);
    expect(resultado?.getUTCMonth()).toBe(7);
    expect(resultado?.getUTCDate()).toBe(9);
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

    expect(dados.inicioEm).toEqual(new Date(Date.UTC(2026, 6, 20)));
    expect(dados.fimEm).toEqual(new Date(Date.UTC(2026, 6, 21)));
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
