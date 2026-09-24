// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  preflight: vi.fn(), move: vi.fn(), saveAndMove: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/actions/bpm/Checklists", () => ({ ObterResumoChecklistCardBpm: vi.fn(async () => ({ success: false })) }));
vi.mock("@/actions/bpm/Cards", () => ({
  ObterCardBpm: vi.fn(), MoverCardBpm: api.move,
  ObterRequisitosTransicaoBpm: api.preflight,
  SalvarRequisitosEMoverCardBpm: api.saveAndMove,
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext", () => ({ useCardSave: () => ({ flushSaves: async () => true }) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CampoBpmInput", async () => {
  const ReactModule = await import("react");
  return { CampoBpmInput: ({ campo, value, onChange, readOnly }: { campo: { id: string }; value: string; onChange: (value: string) => void; readOnly: boolean }) =>
    ReactModule.createElement("button", { type: "button", "data-field-id": campo.id, disabled: readOnly, onClick: () => onChange(campo.id === "radar" ? "Limitado" : "Maria") }, value || "Preencher") };
});
vi.mock("@/components/ui/dialog", async () => {
  const ReactModule = await import("react");
  const wrapper = ({ children }: { children: React.ReactNode }) => ReactModule.createElement("div", null, children);
  return { Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? wrapper({ children }) : null,
    DialogContent: wrapper, DialogDescription: wrapper, DialogFooter: wrapper, DialogHeader: wrapper, DialogTitle: wrapper };
});

import PainelProximaEtapa from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa";

const card = {
  id: "card-1", pipelineId: "pipeline-1", etapa: { id: "origem", chave: "agendar_reuniao" },
  dataReuniao: new Date("2026-09-25T12:00:00Z"), transcricaoReuniao: null,
} as React.ComponentProps<typeof PainelProximaEtapa>["card"];
const etapas = [{ id: "destino", chave: "reuniao_agendada", nome: "Reunião Agendada", ordem: 2, script: null }];
const field = (id: string, nome: string, editavel = true) => ({
  id, nome, tipo: "texto", obrigatorio: true, opcoesJson: null, editavel, somenteLeitura: !editavel,
  valor: "", contexto: "DESTINO", etapaAplicacaoNome: "Reunião Agendada",
});

describe("requisitos configurados antes da mudança de etapa", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    api.move.mockResolvedValue({ success: true });
    api.saveAndMove.mockResolvedValue({ success: true });
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  async function abrir() {
    await act(async () => root.render(h(PainelProximaEtapa, { card, etapas, podeMoverEtapa: true, accent: "1,2,3", onMovido: vi.fn() })));
    const botao = [...host.querySelectorAll("button")].find((item) => item.textContent?.includes("Reunião Agendada"));
    expect(botao).toBeTruthy();
    await act(async () => botao!.click());
  }

  it("exibe campos da etapa de destino e os envia junto com o movimento", async () => {
    api.preflight.mockResolvedValue({ success: true, data: {
      etapaDestino: { id: "destino", nome: "Reunião Agendada" },
      campos: [field("radar", "Radar pretendido"), field("vendedor", "Vendedor responsável")],
      faltantes: [{ id: "radar", contexto: "DESTINO", etapaAplicacaoNome: "Reunião Agendada" }, { id: "vendedor", contexto: "DESTINO", etapaAplicacaoNome: "Reunião Agendada" }], guardas: [],
    } });
    await abrir();
    expect(api.move).not.toHaveBeenCalled();
    const radar = host.querySelector<HTMLButtonElement>('[data-field-id="radar"]')!;
    const vendedor = host.querySelector<HTMLButtonElement>('[data-field-id="vendedor"]')!;
    await act(async () => radar.click());
    await act(async () => vendedor.click());
    const salvar = [...host.querySelectorAll("button")].find((item) => item.textContent?.includes("Salvar e mover"));
    expect(salvar?.disabled).toBe(false);
    await act(async () => salvar!.click());
    expect(api.saveAndMove).toHaveBeenCalledWith({ cardId: "card-1", etapaDestinoId: "destino", camposValores: { radar: "Limitado", vendedor: "Maria" } });
  });

  it("explica obrigação somente leitura e impede envio sem valor", async () => {
    api.preflight.mockResolvedValue({ success: true, data: {
      etapaDestino: { id: "destino", nome: "Reunião Agendada" },
      campos: [field("estado", "Estado", false)],
      faltantes: [{ id: "estado", contexto: "DESTINO", etapaAplicacaoNome: "Reunião Agendada" }], guardas: [],
    } });
    await abrir();
    expect(host.textContent).toContain("obrigatório e somente leitura");
    expect(host.querySelector('a[href="/PainelAlpha/AlphaCRM/admin/pipelines/pipeline-1?tab=fields&etapaId=destino&campoId=estado"]')).toBeTruthy();
    expect([...host.querySelectorAll("button")].find((item) => item.textContent?.includes("Salvar e mover"))?.disabled).toBe(true);
    expect(api.saveAndMove).not.toHaveBeenCalled();
  });
});
