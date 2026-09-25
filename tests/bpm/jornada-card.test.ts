import { describe, expect, it } from "vitest";
import { projetarPassagensCard } from "@/lib/bpm/jornada-card";

const data = (dia: number) => new Date(`2026-09-${String(dia).padStart(2, "0")}T12:00:00Z`);
const evento = (id: string, acao: string, dia: number, origem: string | null, destino: string | null) => ({
  id, acao, createdAt: data(dia),
  valorAnteriorJson: origem ? JSON.stringify({ etapaId: origem }) : null,
  valorNovoJson: destino ? JSON.stringify({ etapaId: destino }) : null,
});

describe("projeção da jornada do card", () => {
  it("mostra somente passagens registradas e preserva retornos à mesma etapa", () => {
    const passagens = projetarPassagensCard({
      id: "card", etapaId: "b", createdAt: data(1), updatedAt: data(5),
      historico: [
        evento("4", "CARD_MOVIDO", 5, "a", "b"),
        evento("1", "CARD_CRIADO", 1, null, "a"),
        evento("2", "CARD_MOVIDO", 2, "a", "c"),
        evento("3", "CARD_MOVIDO", 4, "c", "a"),
      ],
    });
    expect(passagens.map((passagem) => passagem.etapaId)).toEqual(["a", "c", "a", "b"]);
    expect(passagens.every((passagem) => passagem.origem === "HISTORICO")).toBe(true);
  });

  it("recupera a etapa inicial do primeiro movimento em card antigo", () => {
    const passagens = projetarPassagensCard({
      id: "antigo", etapaId: "final", createdAt: data(1), updatedAt: data(4),
      historico: [evento("2", "CARD_MOVIDO", 3, "inicio", "final")],
    });
    expect(passagens.map((passagem) => passagem.etapaId)).toEqual(["inicio", "final"]);
  });

  it("usa somente a etapa atual quando o histórico não comprova outras passagens", () => {
    const passagens = projetarPassagensCard({
      id: "legado", etapaId: "atual", createdAt: data(1), updatedAt: data(4),
      historico: [evento("1", "CARD_CRIADO_POR_AUTOMACAO", 1, null, null)],
    });
    expect(passagens).toMatchObject([{ etapaId: "atual", origem: "ESTADO_ATUAL" }]);
  });

  it("registra movimentos automáticos e revisitas na ordem real", () => {
    const passagens = projetarPassagensCard({
      id: "auto", etapaId: "inicio", createdAt: data(1), updatedAt: data(5),
      historico: [
        evento("2", "CARD_MOVIDO_POR_AUTOMACAO", 2, "inicio", "destino"),
        evento("3", "MOVIDO_AUTOMACAO", 3, "destino", "inicio"),
      ],
    });
    expect(passagens.map((passagem) => passagem.etapaId)).toEqual(["inicio", "destino", "inicio"]);
    expect(passagens.map((passagem) => passagem.entrouEm)).toEqual([data(1).toISOString(), data(2).toISOString(), data(3).toISOString()]);
  });

  it("não confunde edição posterior com entrada na etapa atual", () => {
    const passagens = projetarPassagensCard({
      id: "legado", etapaId: "atual", createdAt: data(1), updatedAt: data(5),
      historico: [evento("1", "CARD_CRIADO", 1, null, "anterior")],
    });
    expect(passagens.at(-1)).toMatchObject({ etapaId: "atual", entrouEm: null, origem: "ESTADO_ATUAL" });
  });
});
