import { describe, expect, it } from "vitest";

import { obterErroTranscricaoParaMovimento } from "@/lib/bpm/reuniao-agendada";
import {
  consolidarTranscricao,
  extrairCodigoMeet,
  selecionarRegistroConferencia,
} from "@/lib/bpm/transcricao-reuniao";

describe("Reunião Agendada", () => {
  it("extrai somente meeting code de URL oficial válida", () => {
    expect(extrairCodigoMeet("https://meet.google.com/abc-mnop-xyz?authuser=0")).toBe("abc-mnop-xyz");
    expect(extrairCodigoMeet("https://evil.example/abc-mnop-xyz")).toBeNull();
    expect(extrairCodigoMeet("javascript:alert(1)")).toBeNull();
  });

  it("seleciona a conferência encerrada compatível com a data agendada", () => {
    const escolhida = selecionarRegistroConferencia([
      { name: "conferenceRecords/antiga", startTime: "2026-08-01T14:00:00Z", endTime: "2026-08-01T15:00:00Z" },
      { name: "conferenceRecords/correta", startTime: "2026-08-12T14:03:00Z", endTime: "2026-08-12T15:00:00Z" },
      { name: "conferenceRecords/ativa", startTime: "2026-08-12T14:00:00Z", endTime: null },
    ], new Date("2026-08-12T14:00:00Z"));
    expect(escolhida?.name).toBe("conferenceRecords/correta");
  });

  it("consolida entradas em ordem com participante e horário", () => {
    const texto = consolidarTranscricao([
      { name: "e2", participant: "p2", text: "Segundo", startTime: "2026-08-12T14:00:10Z" },
      { name: "e1", participant: "p1", text: "Primeiro", startTime: "2026-08-12T14:00:01Z" },
    ], new Map([["p1", "Ana"], ["p2", "Bruno"]]));
    expect(texto).toBe("[14:00:01] Ana: Primeiro\n[14:00:10] Bruno: Segundo");
  });

  it("bloqueia avanço sem transcrição e mantém Standby disponível", () => {
    expect(obterErroTranscricaoParaMovimento({
      etapaOrigemNome: "Reunião Agendada",
      etapaDestinoNome: "Em tratativa",
      transcricaoReuniao: "  ",
    })).toContain("ainda não foi recebida");
    expect(obterErroTranscricaoParaMovimento({
      etapaOrigemNome: "Reunião Agendada",
      etapaDestinoNome: "Standby - Follow Up",
      transcricaoReuniao: null,
    })).toBeNull();
    expect(obterErroTranscricaoParaMovimento({
      etapaOrigemNome: "Reunião Agendada",
      etapaDestinoNome: "Agendar reunião",
      transcricaoReuniao: null,
    })).toBeNull();
    expect(obterErroTranscricaoParaMovimento({
      etapaOrigemNome: "Reunião Agendada",
      etapaDestinoNome: "Em tratativa",
      transcricaoReuniao: "[14:00:00] Ana: conteúdo",
    })).toBeNull();
  });
});
