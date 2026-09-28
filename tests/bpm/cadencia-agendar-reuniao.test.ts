import { describe, expect, it } from "vitest";
import { agendaAgendarConcluida, agendaLigacoesAgendar } from "@/lib/bpm/cadencias/agendar-reuniao";

const passos = Array.from({ length: 8 }, (_, index) => ({
  id: `passo-${index + 1}`, ordem: index + 1, intervaloDias: index === 0 ? 0 : 1,
  tipoTarefa: "LIGACAO", titulo: `Ligação ${index + 1}`, descricao: null, prioridade: "NORMAL",
}));

describe("cadência configurável de Agendar Reunião", () => {
  it("agenda oito ligações em dias úteis e ignora fim de semana e feriado nacional", () => {
    const agenda = agendaLigacoesAgendar(new Date("2026-10-09T15:00:00.000Z"), passos);
    expect(agenda.map((item) => item.dataCivil)).toEqual([
      "2026-10-09", "2026-10-13", "2026-10-14", "2026-10-15",
      "2026-10-16", "2026-10-19", "2026-10-20", "2026-10-21",
    ]);
  });

  it("só conclui após o último dia com uma ligação registrada em cada data", () => {
    const inicio = new Date("2026-10-09T15:00:00.000Z");
    const datas = agendaLigacoesAgendar(inicio, passos).map((item) => new Date(`${item.dataCivil}T16:00:00.000Z`));
    expect(agendaAgendarConcluida(inicio, passos, datas, new Date("2026-10-21T22:00:00.000Z"))).toBe(false);
    expect(agendaAgendarConcluida(inicio, passos, datas.slice(0, -1), new Date("2026-10-22T15:00:00.000Z"))).toBe(false);
    expect(agendaAgendarConcluida(inicio, passos, datas, new Date("2026-10-22T15:00:00.000Z"))).toBe(true);
  });

  it("edição ou exclusão dos passos altera a agenda consultada pelo job", () => {
    const inicio = new Date("2026-10-09T15:00:00.000Z");
    expect(agendaLigacoesAgendar(inicio, []).length).toBe(0);
    expect(agendaLigacoesAgendar(inicio, [{ ...passos[0], intervaloDias: 2 }])[0].dataCivil).toBe("2026-10-14");
  });
});
