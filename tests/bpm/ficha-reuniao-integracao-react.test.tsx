// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ agendar: vi.fn(), garantir: vi.fn(), legado: vi.fn(), custom: vi.fn(), info: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: { custom: api.custom, info: api.info, error: api.error, success: api.success } }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/GoogleMeet", () => ({ AgendarReuniaoGoogleMeetBpm: api.agendar, ReagendarReuniaoBpm: vi.fn(), ListarConvidadosReuniaoGoogleMeetBpm: vi.fn().mockResolvedValue({ success: true, data: [] }) }));
vi.mock("@/actions/bpm/FichaViabilidade", () => ({ GarantirFichaViabilidadeBpm: api.garantir, GerarFichaViabilidadeBpm: api.legado }));
vi.mock("@/actions/bpm/TranscricaoMeet", () => ({ SalvarResumoReuniaoBpm: vi.fn(), SincronizarTranscricaoReuniaoBpm: vi.fn(), ObterArtefatosMeetBpm: vi.fn() }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/BpmDateTimeField", () => ({ BpmDateTimeField: () => h("div", null, "Data") }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext", () => ({ useCardSave: () => ({ registerSave: vi.fn(), scheduleSave: vi.fn(), getVersion: vi.fn(), confirmVersion: vi.fn(), getDraft: vi.fn(), setDraft: vi.fn(), setPendingFields: vi.fn() }) }));
import { PainelReuniao } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao";
import { BPM_PIPELINE_KEYS } from "@/lib/bpm/ontology";
let root: Root, host: HTMLDivElement;
const ficha = { anexoId: "anexo-integracao", revision: 1, empresaNome: "Empresa Agendada", empresaId: 1, dados: {}, userLogado: "TI" };
const card = { id: "cm12345678901234567890123", pipelineId: "pipeline-1", pipeline: { chave: BPM_PIPELINE_KEYS.RADAR, nome: "Revisão de Radar" }, dataReuniao: new Date("2027-10-23T15:00:00Z"), emailClienteReuniao: "teste@example.test", googleEventId: null, transcricaoReuniao: null, googleMeetLink: null } as React.ComponentProps<typeof PainelReuniao>["card"];
beforeEach(() => { vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(formulario = false, podeEditar = true) { await act(async () => root.render(h(PainelReuniao, { card, accent: "1,2,3", podeEditar, mostrarFormulario: formulario, onAtualizado: vi.fn() }))); }
const gerar = () => [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.includes("Gerar ficha de viabilidade"))!;
it("agendamento real da UI encaminha a resposta causal confirmada ao toast, sem chamar geração manual", async () => {
  api.agendar.mockResolvedValue({ success: true, data: { googleEventId: "evento", avancoConcluido: true, fichaViabilidade: ficha, fichaViabilidadeEstado: "PRONTA", fichaViabilidadeGerada: true, fichaViabilidadeSolicitacaoId: "intent-agendar" } });
  await render(true);
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.includes("Agendar pelo Google Meet"))!.click());
  expect(api.agendar).toHaveBeenCalledOnce(); expect(api.custom).toHaveBeenCalledOnce(); expect(api.garantir).not.toHaveBeenCalled(); expect(api.legado).not.toHaveBeenCalled();
});
it("sem Meet vinculado a retentativa Radar permanece disponível e usa o anexo persistido uma vez", async () => {
  let resolve!: (value: unknown) => void;
  api.garantir.mockReturnValue(new Promise(ok => { resolve = ok; }));
  await render(); expect(gerar()).toBeTruthy();
  await act(async () => { gerar().click(); gerar().click(); });
  expect(api.garantir).toHaveBeenCalledExactlyOnceWith({ cardId: card.id }); expect(api.legado).not.toHaveBeenCalled();
  await act(async () => resolve({ success: true, estado: "PRONTA", data: { ...ficha, anexoId: "anexo-retry" }, gerada: true, solicitacaoId: "intent-retry" }));
  expect(api.custom).toHaveBeenCalledOnce();
});
it("somente leitura não oferece geração mutante e resposta sem ficha não anuncia existência", async () => {
  await render(false, false); expect(gerar().disabled).toBe(true);
  await render(); api.garantir.mockResolvedValue({ success: true, estado: "AUSENTE", data: null, gerada: false, solicitacaoId: null });
  await act(async () => gerar().click());
  expect(api.custom).not.toHaveBeenCalled(); expect(api.info).not.toHaveBeenCalled(); expect(api.error).toHaveBeenCalledWith("A ficha ainda não está disponível para este card.");
});
