// @vitest-environment happy-dom
import React, { act, createElement as h, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelProximoContato } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato";
import { PainelReuniao } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao";
import { PainelStatusPosFechamento } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento";
import { PainelChecklistFollowUp } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp";
import { toast } from "sonner";
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const backend = vi.hoisted(() => ({ fail: true, resumo: "Original", status: "AGUARDANDO_CONTRATO", contact: "2026-09-22T12:00:00Z", answers: {} as Record<string, string> }));
vi.mock("@/actions/bpm/Cards", () => ({
  ObterCardBpm: vi.fn(async () => ({ success: true, data: { id: "card", googleEventId: "event", updatedAt: new Date("2026-09-22T15:00:00Z"), proximoContatoEm: backend.contact, transcricaoReuniao: backend.resumo, statusPosFechamento: backend.status } })),
  AtualizarCardBpm: vi.fn(async (data: { proximoContatoEm?: string; statusPosFechamento?: string }) => {
    if (backend.fail) return { success: false, error: "offline" };
    if (data.proximoContatoEm) backend.contact = data.proximoContatoEm;
    if (data.statusPosFechamento) backend.status = data.statusPosFechamento;
    return { success: true };
  }),
}));
vi.mock("@/actions/bpm/GoogleMeet", () => ({ AgendarReuniaoGoogleMeetBpm: vi.fn(), ReagendarReuniaoBpm: vi.fn() }));
vi.mock("@/actions/bpm/TranscricaoMeet", () => ({
  SincronizarTranscricaoReuniaoBpm: vi.fn(),
  SalvarResumoReuniaoBpm: vi.fn(async ({ resumo }: { resumo: string }) => {
    if (backend.fail) return { success: false, error: "offline" };
    backend.resumo = resumo; return { success: true };
  }),
}));
vi.mock("@/actions/bpm/FollowUp", () => {
  const data = () => ({ estado: "EM_ANDAMENTO", checklist: { id: "check", perguntas: [{ id: "q", pergunta: "Notas", tipo: "texto", obrigatoria: false, opcoes: [] }], respostas: backend.answers } });
  return {
    ObterUltimoFollowUpBpm: vi.fn(async () => ({ success: true, data: data() })),
    SalvarChecklistFollowUpBpm: vi.fn(async ({ respostas }: { respostas: Record<string, string> }) => {
      if (backend.fail) return { success: false, error: "offline" };
      backend.answers = respostas; return { success: true, data: data() };
    }),
  };
});
// O calendário tem cobertura própria; este teste exercita a persistência do painel.
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/BpmDateTimeField", () => ({
  BpmDateTimeField: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => h("input", { value, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value) }),
}));
type Kind = "contact" | "summary" | "status" | "followup";
type Card = React.ComponentProps<typeof PainelProximoContato>["card"];
let saves: ReturnType<typeof useCardSave>;
let root: Root;
let host: HTMLDivElement;
const noop = () => {};
function Harness({ kind, show, initialSummary = "Original" }: { kind: Kind; show: boolean; initialSummary?: string }) {
  const context = useCardSave();
  const [card, setCard] = useState({ id: "card", googleEventId: "event", updatedAt: new Date("2026-09-22T10:00:00Z"), proximoContatoEm: backend.contact, transcricaoReuniao: initialSummary } as unknown as Card);
  useEffect(() => { saves = context; return context.subscribeConfirmation("card", setCard); }, [context]);
  if (!show) return null;
  if (kind === "contact") return h(PainelProximoContato, { card, onAtualizado: noop, podeEditar: true, realtimeRevision: 0 });
  if (kind === "summary") return h(PainelReuniao, { card, onAtualizado: noop, podeEditar: true, accent: "1,2,3", mostrarFormulario: false });
  if (kind === "status") return h(PainelStatusPosFechamento, { cardId: "card", statusPersistido: card.statusPosFechamento ?? "AGUARDANDO_CONTRATO", versaoPersistidaEm: card.updatedAt, podeEditar: true, realtimeRevision: 0, accent: "1,2,3", onAtualizado: noop });
  return h(PainelChecklistFollowUp, { cardId: "card", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: noop, onEstadoChange: noop });
}
async function render(kind: Kind, show = true) {
  await act(async () => root.render(h(CardSaveProvider, { children: h(Harness, { kind, show }) })));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
}
function input() { return host.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("textarea, input, select")!; }
async function edit(value: string) {
  await act(async () => {
    const element = input();
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.clearAllMocks(); backend.fail = true; backend.resumo = "Original"; backend.status = "AGUARDANDO_CONTRATO"; backend.contact = "2026-09-22T12:00:00Z"; backend.answers = {};
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it.each<[Kind, string]>([["contact", "2026-09-23T14:00"], ["summary", "Resumo editado"], ["status", "CONTRATO_ENVIADO"], ["followup", "Resposta editada"]])("recupera %s após falhar, fechar e reabrir", async (kind, value) => {
  await render(kind); await edit(value);
  await act(async () => { await saves.flushSaves(); });
  await render(kind, false); await render(kind);
  expect(input().value).toBe(value);
  backend.fail = false;
  const options = vi.mocked(toast.error).mock.calls.slice().reverse().find((call) => call[1]?.action)?.[1];
  const action = options?.action;
  if (!action || typeof action !== "object" || !("onClick" in action)) throw new Error("Retry ausente");
  await act(async () => { action.onClick({} as React.MouseEvent<HTMLButtonElement>); await saves.flushSaves(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  expect(input().value).toBe(value);
  expect(saves.getDraft(`card:${({ contact: "proximoContato", summary: "resumo", status: "status", followup: "followup" })[kind]}`)).toBeUndefined();
  expect(host.textContent).not.toContain("mudou externamente");
  expect(host.textContent).not.toContain("mudou enquanto");
});

it("permite registrar resumo quando a transcrição da reunião começa vazia", async () => {
  backend.fail = false;
  backend.resumo = "";
  await act(async () => root.render(h(CardSaveProvider, { children: h(Harness, { kind: "summary", show: true, initialSummary: "" }) })));
  const resumo = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Resumo da reunião"]');
  expect(resumo).toBeTruthy();
  expect(resumo?.value).toBe("");
  await edit("Resumo registrado após a reunião");
  await act(async () => { await saves.flushSaves(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  expect(backend.resumo).toBe("Resumo registrado após a reunião");
});
