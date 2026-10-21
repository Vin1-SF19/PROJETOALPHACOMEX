import { describe, expect, it } from "vitest";
import { ordenarCardsMaisRecentesPrimeiro } from "@/lib/bpm/ordem-cards";
import { selecionarPaginaQuadro, mesclarResumosQuadro, type EntradaManifestoQuadro } from "@/lib/bpm/quadro-paginado";
import { criarSnapshotBoard, moverCardOtimistaNoBoard, restaurarSnapshotBoard } from "@/lib/bpm/drag-drop-board";

describe("cards mais recentes no topo do funil", () => {
  it("intercala origens pela criação/recebimento, com Date, ISO e fusos", () => {
    const cards = [
      { id: "real-antigo", origem: "real", createdAt: new Date("2026-10-01T10:00:00Z") },
      { id: "noloss-antigo", origem: "noloss", createdAt: "2026-10-10T10:00:00Z" },
      { id: "real-novo", origem: "real", createdAt: "2026-10-21T10:00:00Z" },
      { id: "noloss-novo", origem: "noloss", createdAt: "2026-10-21T08:00:00-03:00" },
    ];
    const ordemOriginal = cards.map((card) => card.id);
    expect(ordenarCardsMaisRecentesPrimeiro(cards).map((card) => card.id)).toEqual(["noloss-novo", "real-novo", "noloss-antigo", "real-antigo"]);
    expect(cards.map((card) => card.id)).toEqual(ordemOriginal);
  });
  it("desempata por ID decrescente e mantém registros sem data no final", () => {
    const cards = [
      { id: "sem-data", createdAt: null }, { id: "a", createdAt: "2026-10-21T10:00:00Z" },
      { id: "invalido", createdAt: "invalido" }, { id: "b", createdAt: new Date("2026-10-21T10:00:00Z") },
    ];
    expect(ordenarCardsMaisRecentesPrimeiro(cards).map((card) => card.id)).toEqual(["b", "a", "sem-data", "invalido"]);
    expect(ordenarCardsMaisRecentesPrimeiro([{ id: "a" }, { id: "z", createdAt: "invalido" }]).map((card) => card.id)).toEqual(["z", "a"]);
    expect(ordenarCardsMaisRecentesPrimeiro([])).toEqual([]);
  });
  it("seleciona os recentes antes de paginar e carregar mais, sem duplicar ou truncar contagens", () => {
    const cards: EntradaManifestoQuadro[] = Array.from({ length: 65 }, (_, i) => ({
      id: `c-${i}`, etapaId: "novos", revision: "1", createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
      nome: "Empresa", cnpj: null, servico: null, responsaveis: [{ id: 7, nome: "Maria" }],
    }));
    const ordenados = ordenarCardsMaisRecentesPrimeiro(cards);
    const primeira = selecionarPaginaQuadro(ordenados);
    const segunda = selecionarPaginaQuadro(ordenados, { limites: { novos: 60 }, busca: "empresa", responsavelId: 7 });
    expect(primeira.ids).toEqual(Array.from({ length: 30 }, (_, i) => `c-${64 - i}`));
    expect(segunda.ids.slice(0, 30)).toEqual(primeira.ids);
    expect(segunda.ids).toHaveLength(60); expect(new Set(segunda.ids).size).toBe(60);
    expect(segunda.totais).toEqual({ novos: 65 });
  });
  it("polling insere resumo novo no topo e preserva objetos e ordem após drag/rollback", () => {
    const antigo = { id: "antigo", etapaId: "entrada", createdAt: "2026-10-01T10:00:00Z" };
    const novo = { id: "novo", etapaId: "entrada", createdAt: "2026-10-21T10:00:00Z" };
    const ids = ordenarCardsMaisRecentesPrimeiro([antigo, novo]).map((card) => card.id);
    const quadro = mesclarResumosQuadro([antigo], [novo], ids);
    expect(quadro).toEqual([novo, antigo]); expect(quadro[1]).toBe(antigo);
    const snapshot = criarSnapshotBoard(quadro);
    const movidos = moverCardOtimistaNoBoard(quadro, "antigo", "destino");
    expect(movidos[1].createdAt).toBe(antigo.createdAt);
    expect(ordenarCardsMaisRecentesPrimeiro(movidos).map((card) => card.id)).toEqual(ids);
    expect(restaurarSnapshotBoard(snapshot)).toEqual(quadro);
    expect(antigo.etapaId).toBe("entrada");
  });
});
