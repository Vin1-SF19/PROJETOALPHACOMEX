// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import NolossLeadModal from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => h("div", null, children),
  SheetContent: ({ children }: { children: React.ReactNode }) => h("div", null, children),
  SheetTitle: ({ children }: { children: React.ReactNode }) => h("h2", null, children),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/AtribuirResponsavelPromocaoModal", () => ({
  default: ({ onConfirmar, radarPretendidoInicial }: { onConfirmar: (responsavelId: number, radarPretendido: string) => void; radarPretendidoInicial: string }) =>
    h("button", { type: "button", onClick: () => onConfirmar(7, radarPretendidoInicial) }, "Confirmar responsável"),
}));

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];
const definirValorInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
const definirValorSelect = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;

async function escolherRadar(container: HTMLDivElement) {
  const select = container.querySelector<HTMLSelectElement>("#noloss-lead-radar")!;
  await act(async () => {
    definirValorSelect.call(select, "Radar 50");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function montar(onConfirmarPromocao = vi.fn().mockResolvedValue({ success: true })) {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  const props: React.ComponentProps<typeof NolossLeadModal> = {
    lead: { id: "lead-1", nome: "Lead NoLoss", email: null, telefone: null,
      utmSource: "Google", utmMedium: "cpc", receivedAt: "2026-09-28T12:00:00Z" },
    pipelineId: "pipeline-1", accent: "1,2,3", radarOpcoes: ["Radar 50"], currentUserId: 7,
    onClose: vi.fn(), onPromovido: vi.fn(), onConfirmarPromocao,
  };
  return { container, root, props, onConfirmarPromocao };
}

afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    await act(async () => root.unmount());
    container.remove();
  }
  vi.clearAllMocks();
});

it("mostra a UTM como origem e permite assumir lead sem CNPJ", async () => {
  const { container, root, props, onConfirmarPromocao } = montar();
  await act(async () => root.render(h(NolossLeadModal, props)));
  expect(container.textContent).toContain("Origem: Google");
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Assumir lead")?.click());
  expect(container.textContent).not.toContain("Confirmar responsável");
  expect(container.textContent).toContain("Selecione um Radar pretendido válido");
  await escolherRadar(container);
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Assumir lead")?.click());
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirmar responsável")?.click());
  expect(onConfirmarPromocao).toHaveBeenCalledWith(7, undefined, "Radar 50", undefined);
});

it("exige CNPJ válido quando preenchido e envia apenas os dígitos", async () => {
  const { container, root, props, onConfirmarPromocao } = montar();
  await act(async () => root.render(h(NolossLeadModal, props)));
  await escolherRadar(container);
  const input = container.querySelector<HTMLInputElement>("#noloss-lead-cnpj")!;
  await act(async () => {
    definirValorInput.call(input, "123");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Assumir lead")?.click());
  expect(container.textContent).not.toContain("Confirmar responsável");
  expect(onConfirmarPromocao).not.toHaveBeenCalled();

  await act(async () => {
    definirValorInput.call(input, "11.222.333/0001-81");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Assumir lead")?.click());
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirmar responsável")?.click());
  expect(onConfirmarPromocao).toHaveBeenCalledWith(7, "11222333000181", "Radar 50", undefined);
});
