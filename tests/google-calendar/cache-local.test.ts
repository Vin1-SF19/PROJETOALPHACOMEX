import { describe, expect, it } from "vitest";

import {
  chaveSnapshotAgenda,
  lerSnapshotAgenda,
  salvarSnapshotAgenda,
  snapshotAgendaEstaValido,
} from "@/components/CalendarioAlpha/lib/cache-local";

describe("cache local da Agenda Alpha", () => {
  it("isola snapshots por conexão, visão e data civil", () => {
    const data = new Date("2026-09-09T15:00:00.000Z");

    expect(chaveSnapshotAgenda("conexao-1", "semana", data)).toBe(
      "conexao-1:semana:2026-09-09",
    );
    expect(chaveSnapshotAgenda("conexao-2", "semana", data)).not.toBe(
      chaveSnapshotAgenda("conexao-1", "semana", data),
    );
  });

  it("aceita snapshots por 24 horas e rejeita os expirados", () => {
    const agora = Date.UTC(2026, 8, 9, 12);

    expect(snapshotAgendaEstaValido({ salvoEm: agora - 1_000 }, agora)).toBe(true);
    expect(
      snapshotAgendaEstaValido({ salvoEm: agora - 24 * 60 * 60 * 1000 - 1 }, agora),
    ).toBe(false);
    expect(snapshotAgendaEstaValido({ salvoEm: agora + 1 }, agora)).toBe(false);
  });

  it("degrada sem erro quando IndexedDB não existe no servidor", async () => {
    await expect(lerSnapshotAgenda("inexistente")).resolves.toBeNull();
    await expect(salvarSnapshotAgenda({
      chave: "conexao-1:semana:2026-09-09",
      conexaoId: "conexao-1",
      salvoEm: Date.now(),
      carregadoEm: new Date().toISOString(),
      eventos: [],
      tarefas: [],
    })).resolves.toBeUndefined();
  });
});
