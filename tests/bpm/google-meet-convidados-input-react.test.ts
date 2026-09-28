// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PainelReuniao } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao";
import { AgendarReuniaoGoogleMeetBpm, ListarConvidadosReuniaoGoogleMeetBpm } from "@/actions/bpm/GoogleMeet";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/GoogleMeet", () => ({
  AgendarReuniaoGoogleMeetBpm: vi.fn().mockResolvedValue({ success: true, data: { googleEventId: "evento-1" } }),
  ReagendarReuniaoBpm: vi.fn(),
  ListarConvidadosReuniaoGoogleMeetBpm: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock("@/actions/bpm/TranscricaoMeet", () => ({
  SalvarResumoReuniaoBpm: vi.fn(), SincronizarTranscricaoReuniaoBpm: vi.fn(),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext", () => ({
  useCardSave: () => ({
    registerSave: vi.fn(), scheduleSave: vi.fn(), getVersion: vi.fn(),
    confirmVersion: vi.fn(), getDraft: vi.fn(), setDraft: vi.fn(),
  }),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/BpmDateTimeField", () => ({
  BpmDateTimeField: () => h("div", null, "Data e hora da reunião"),
}));

const mounted: Array<{ root: ReturnType<typeof createRoot>; host: HTMLDivElement }> = [];
afterEach(async () => {
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
  vi.clearAllMocks();
});

it("Enter adiciona convidados externos, limpa o input e envia todos ao agendar", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  const card = {
    id: "card-1", dataReuniao: new Date("2026-10-15T15:00:00.000Z"),
    emailClienteReuniao: "cliente@exemplo.com", googleEventId: null,
    transcricaoReuniao: null, googleMeetLink: null,
  } as React.ComponentProps<typeof PainelReuniao>["card"];
  await act(async () => root.render(h(PainelReuniao, { card, accent: "0,200,200", podeEditar: true, onAtualizado: vi.fn() })));
  const input = host.querySelector<HTMLInputElement>('input[name="emailCliente"]')!;
  async function enter(value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
  }
  await enter("CLIENTE@EXEMPLO.COM");
  await enter("Pessoa@GMAIL.COM");
  expect(input.value).toBe("");
  expect(host.textContent).toContain("Principal:cliente@exemplo.com");
  expect(host.textContent).toContain("pessoa@gmail.com");
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Remover pessoa@gmail.com"]')?.click());
  expect(host.textContent).not.toContain("pessoa@gmail.com");
  await enter("Pessoa@GMAIL.COM");
  await enter("contato@hotmail.com");
  const agendar = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Agendar pelo Google Meet"));
  await act(async () => agendar?.click());
  expect(AgendarReuniaoGoogleMeetBpm).toHaveBeenCalledWith(expect.objectContaining({
    emailCliente: "cliente@exemplo.com",
    emailsAdicionais: ["pessoa@gmail.com", "contato@hotmail.com"],
  }));
});

it("reabre o card com o principal salvo e convidados do evento Google", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(ListarConvidadosReuniaoGoogleMeetBpm).mockResolvedValueOnce({
    success: true, data: ["pessoa@gmail.com", "contato@hotmail.com"],
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  const card = {
    id: "card-2", dataReuniao: new Date("2026-10-15T15:00:00.000Z"),
    emailClienteReuniao: "cliente@exemplo.com", googleEventId: "evento-1",
    transcricaoReuniao: null, googleMeetLink: "https://meet.google.com/abc-defg-hij",
  } as React.ComponentProps<typeof PainelReuniao>["card"];
  await act(async () => root.render(h(PainelReuniao, { card, accent: "0,200,200", podeEditar: true, onAtualizado: vi.fn() })));
  expect(host.textContent).toContain("Principal:cliente@exemplo.com");
  expect(host.textContent).toContain("pessoa@gmail.com");
  expect(host.textContent).toContain("contato@hotmail.com");
});
