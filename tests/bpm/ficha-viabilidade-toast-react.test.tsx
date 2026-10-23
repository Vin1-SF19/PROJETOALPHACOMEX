// @vitest-environment happy-dom
import React, { act, createElement as h, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ custom: vi.fn(), dismiss: vi.fn(), error: vi.fn(), obter: vi.fn() }));
vi.mock("sonner", () => ({ toast: { custom: api.custom, dismiss: api.dismiss, error: api.error } }));
vi.mock("@/actions/bpm/FichaViabilidade", () => ({ ObterFichaViabilidadeBpm: api.obter }));
import { avisarFichaViabilidadeDoRetorno, avisarResultadoFichaViabilidade } from "@/components/bpm/anexos/ficha-viabilidade-toast";
import type { FichaViabilidadeDTO } from "@/lib/bpm/ficha-viabilidade-documento";
const destino = { cardId: "cm12345678901234567890123", pipelineId: "pipeline-1" };
const ficha: FichaViabilidadeDTO = { anexoId: "anexo-ficha-toast", empresaNome: "Empresa da ficha", revision: 1, empresaId: 1, dados: {}, userLogado: "TI" };
const parentDescriptor = Object.getOwnPropertyDescriptor(window, "parent");
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); if (parentDescriptor) Object.defineProperty(window, "parent", parentDescriptor); });
it("somente retorno confirmado do gerador exibe o toast verde, deduplica e clique abre os anexos corretos", async () => {
  const postMessage = vi.fn(); Object.defineProperty(window, "parent", { configurable: true, value: { postMessage } });
  avisarFichaViabilidadeDoRetorno({ fichaViabilidadeEstado: "PRONTA", fichaViabilidade: ficha, fichaViabilidadeGerada: false }, destino);
  expect(api.custom).not.toHaveBeenCalled();
  const retorno = { fichaViabilidadeEstado: "PRONTA", fichaViabilidade: ficha, fichaViabilidadeGerada: true };
  avisarFichaViabilidadeDoRetorno(retorno, destino); avisarFichaViabilidadeDoRetorno(retorno, destino);
  expect(api.custom).toHaveBeenCalledOnce();
  const conteudo = (api.custom.mock.calls[0][0] as (id: string) => ReactNode)("toast-id");
  await act(async () => root.render(h(React.Fragment, null, conteudo)));
  const button = host.querySelector("button")!;
  expect(button.textContent).toContain("Ficha de análise de viabilidade gerada para: Empresa da ficha");
  expect(button.className).toContain("bg-emerald");
  await act(async () => button.click());
  expect(api.dismiss).toHaveBeenCalledWith("toast-id");
  expect(postMessage).toHaveBeenCalledWith({ type: "ALPHA_OPEN_TAB", url: `/PainelAlpha/AlphaCRM/pipeline/pipeline-1?cardId=${destino.cardId}&abaInicial=anexos`, label: "CRM" }, window.location.origin);
});
it("pendência acompanha só a solicitação causal e não anuncia a conclusão de outro ator", async () => {
  vi.useFakeTimers(); api.obter.mockResolvedValue({ success: true, estado: "PRONTA", data: { ...ficha, anexoId: "anexo-outro-ator" }, gerada: false, solicitacaoId: "intent-outro" });
  avisarResultadoFichaViabilidade({ estado: "PENDENTE", data: null, gerada: false, solicitacaoId: "intent-outro" }, destino);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(api.obter).toHaveBeenCalledExactlyOnceWith({ cardId: destino.cardId, solicitacaoId: "intent-outro" });
  expect(api.custom).not.toHaveBeenCalled();
});
it("conclusão recuperada confirmada para o ator anuncia uma vez e falha nunca dá sucesso", async () => {
  vi.useFakeTimers(); api.obter.mockResolvedValue({ success: true, estado: "PRONTA", data: { ...ficha, anexoId: "anexo-recuperado" }, gerada: true, solicitacaoId: "intent-recuperado" });
  const pending = { estado: "PENDENTE" as const, data: null, gerada: false, solicitacaoId: "intent-recuperado" };
  avisarResultadoFichaViabilidade(pending, destino); avisarResultadoFichaViabilidade(pending, destino);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(api.obter).toHaveBeenCalledOnce(); expect(api.custom).toHaveBeenCalledOnce();
  api.custom.mockClear(); avisarFichaViabilidadeDoRetorno({ fichaViabilidadeEstado: "FALHA", fichaViabilidadeGerada: true, fichaViabilidade: ficha }, destino);
  expect(api.custom).not.toHaveBeenCalled(); expect(api.error).toHaveBeenCalled();
});
