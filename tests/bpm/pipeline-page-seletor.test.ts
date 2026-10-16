import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import Page from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page";
import { ListarPipelinesBpm, ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";

vi.mock("../../auth", () => ({ auth: vi.fn(async () => ({ user: { id: "1", role: "TI" } })) }));
vi.mock("@/lib/temas", () => ({ getTema: vi.fn(() => ({})) }));
vi.mock("@/actions/bpm/Pipelines", () => ({ ListarPipelinesBpm: vi.fn(), ObterPipelineBpm: vi.fn() }));
vi.mock("@/actions/bpm/Quadro", () => ({ SincronizarQuadroBpm: vi.fn() }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

const pipeline = { id: "destino", nome: "Funil autorizado", etapas: [] };
const manifesto = { configVersion: 4, entradas: [] };
beforeEach(() => {
  Object.assign(globalThis, { React });
  vi.clearAllMocks();
  vi.mocked(ObterPipelineBpm).mockResolvedValue({ success: true, data: pipeline } as never);
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, cards: [], manifesto } as never);
  vi.mocked(ListarPipelinesBpm).mockResolvedValue({ success: true, data: [{ ...pipeline, ativo: true, _count: { cards: 4 } }] } as never);
});

it("usa a lista canônica ativa, transporta só id/nome e remonta quadro e manifesto do destino", async () => {
  const result = await Page({ params: Promise.resolve({ pipelineId: "destino" }) });
  expect(ListarPipelinesBpm).toHaveBeenCalledWith();
  expect(ObterPipelineBpm).toHaveBeenCalledWith("destino");
  expect(SincronizarQuadroBpm).toHaveBeenCalledWith("destino");
  expect(result.key).toBe("destino");
  expect(result.props.pipeline).toEqual(pipeline);
  expect(result.props.manifestoInicial).toEqual(manifesto);
  expect(result.props.pipelinesDisponiveis).toEqual([{ id: "destino", nome: "Funil autorizado" }]);
});

it("falha da lista não fornece destinos alternativos", async () => {
  vi.mocked(ListarPipelinesBpm).mockResolvedValue({ success: false, error: "Indisponível", data: [] });
  const result = await Page({ params: Promise.resolve({ pipelineId: "destino" }) });
  expect(result.props.pipelinesDisponiveis).toEqual([]);
});

it("nega o destino mesmo quando ele constava da lista", async () => {
  vi.mocked(ObterPipelineBpm).mockResolvedValue({ success: false, error: "Acesso negado" });
  await expect(Page({ params: Promise.resolve({ pipelineId: "destino" }) })).rejects.toThrow("NOT_FOUND");
});
