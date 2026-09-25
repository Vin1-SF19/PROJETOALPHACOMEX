// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buscar = vi.hoisted(() => vi.fn());
vi.mock("@/actions/bpm/Jornada", () => ({ ObterJornadaCardPipeline: buscar }));

import PainelHistoricoPipeline from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoPipeline";

describe("painel da jornada por pipeline", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  async function renderizar(onAbrirCard = vi.fn()) {
    await act(async () => root.render(h(PainelHistoricoPipeline, {
      cardId: "card-atual", pipelineId: "financeiro", pipelineNome: "Financeiro",
      accent: "1,2,3", onAbrirCard,
    })));
    return onAbrirCard;
  }

  it("mostra etapas da jornada e abre o card vinculado selecionado", async () => {
    buscar.mockResolvedValue({ success: true, data: [{
      cardId: "card-vinculado", etapaId: "solicitacao", etapaNome: "Solicitação de Contrato",
      entrouEm: "2026-09-25T12:00:00.000Z", origem: "HISTORICO", cardAtual: false,
    }] });
    const abrir = await renderizar();
    expect(host.textContent).toContain("Solicitação de Contrato");
    const botao = host.querySelector<HTMLButtonElement>('button[aria-label^="Abrir card vinculado"]');
    expect(botao).toBeTruthy();
    await act(async () => botao!.click());
    expect(abrir).toHaveBeenCalledWith("card-vinculado");
  });

  it("indica pipeline sem passagem sem listar cards da empresa", async () => {
    buscar.mockResolvedValue({ success: true, data: [] });
    await renderizar();
    expect(host.textContent).toContain("Este card ainda não passou por Financeiro.");
    expect(host.textContent).not.toContain("Cards em Financeiro");
  });

  it("não mostra a jornada do card anterior enquanto outro card carrega", async () => {
    buscar.mockResolvedValueOnce({ success: true, data: [{
      cardId: "antigo", etapaId: "e1", etapaNome: "Etapa antiga",
      entrouEm: "2026-09-25T12:00:00.000Z", origem: "HISTORICO", cardAtual: true,
    }] });
    await renderizar();
    expect(host.textContent).toContain("Etapa antiga");
    buscar.mockReturnValueOnce(new Promise(() => {}));
    await act(async () => root.render(h(PainelHistoricoPipeline, {
      cardId: "novo", pipelineId: "financeiro", pipelineNome: "Financeiro",
      accent: "1,2,3", onAbrirCard: vi.fn(),
    })));
    expect(host.textContent).not.toContain("Etapa antiga");
    expect(host.querySelector('[aria-label="Carregando jornada"]')).toBeTruthy();
  });
});
