// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listar: vi.fn(), copiar: vi.fn() }));
vi.mock("@/actions/bpm/WebhookCampos", () => ({ ListarCamposObrigatoriosWebhookBpm: mocks.listar }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { WebhookCamposObrigatorios } from "@/components/bpm/automacoes/WebhookCamposObrigatorios";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.copiar } });
  mocks.copiar.mockResolvedValue(undefined);
  mocks.listar.mockResolvedValue({ success: true, data: [{ etapaDestino: "REUNIAO_AGENDADA",
    titulo: "Agendar reunião → Reunião Agendada", aviso: null, outrosRequisitos: [],
    campos: [{ id: "campo-radar", nome: "Radar pretendido", tipo: "selecao", condicional: true,
      editavelViaWebhook: true, opcoes: ["Ilimitado"] }],
  }] });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("consulta ao abrir, mostra o ID copiável e distingue dataReuniao de camposValores", async () => {
  await act(async () => root.render(h(WebhookCamposObrigatorios, { endpointId: "endpoint-1" })));
  expect(mocks.listar).not.toHaveBeenCalled();
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(mocks.listar).toHaveBeenCalledWith("endpoint-1");
  expect(host.textContent).toContain("campo-radar");
  expect(host.textContent).toContain("Condicional");
  expect(host.textContent).toContain("Ilimitado");
  expect(host.textContent).toContain("dataReuniao");
  expect(host.textContent).toContain("obrigatório fora de camposValores");
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Copiar ID do campo Radar pretendido"]')!.click());
  expect(mocks.copiar).toHaveBeenCalledWith("campo-radar");
});

it("apresenta falha da consulta sem exibir um catálogo antigo como válido", async () => {
  mocks.listar.mockResolvedValue({ success: false, error: "Sem permissão" });
  await act(async () => root.render(h(WebhookCamposObrigatorios, { endpointId: "endpoint-1" })));
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Sem permissão");
  expect(host.querySelector("table")).toBeNull();
});
