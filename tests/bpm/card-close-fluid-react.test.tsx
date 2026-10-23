// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PainelCardState } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardModalHost";
import { useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import CardFullViewModal from "@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { ObterUltimoFollowUpBpm } from "@/actions/bpm/FollowUp";
import { toast } from "sonner";
import { BPM_CAPABILITIES } from "@/lib/bpm/ontology";

vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/Pipelines", () => ({ ObterPipelineBpm: vi.fn(async () => ({ success: true, data: { etapas: [] } })) }));
vi.mock("@/actions/bpm/Interacoes", () => ({ ListarInteracoesCardBpm: vi.fn(async () => ({ data: [] })) }));
vi.mock("@/actions/bpm/FollowUp", () => ({ ObterUltimoFollowUpBpm: vi.fn(), SalvarChecklistFollowUpBpm: vi.fn() }));
vi.mock("@/components/PerfilEmpresaGlobal/PerfilEmpresaProvider", () => ({ PerfilEmpresaProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaDrawer", () => ({ useDadosEmpresaDrawer: () => ({ aberto: false }) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelNotaFiscalConcluida", () => ({ PainelNotaFiscalConcluida: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelBoasVindasOperacional", () => ({ PainelBoasVindasOperacional: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelAlinhamentoEstrategico", () => ({ PainelAlinhamentoEstrategico: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout", () => ({ CardAbertoLayout: ({ children, card, onAbrirCard }: { children: React.ReactNode; card: { id: string }; onAbrirCard: (id: string) => void }) => h("div", { "data-card-atual": card.id }, children, h("button", { onClick: () => onAbrirCard("card-b") }, "Abrir vinculado")) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar", async () => {
  const { PainelChecklistFollowUp } = await import("@/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp");
  const estado = () => {};
  return { default: ({ card }: { card: { id: string } }) => h(PainelChecklistFollowUp, { cardId: card.id, accent: "1,2,3", podeEditar: true, onAtualizado: () => {}, realtimeRevision: 0, onEstadoChange: estado }) };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));

let root: Root, host: HTMLDivElement, context: ReturnType<typeof useCardSave>;
let abrir!: (id?: string) => void;
const fechado = vi.fn();
function Probe() { const value = useCardSave(); React.useEffect(() => { context = value; }, [value]); return null; }
function Board() {
  const [id, setId] = React.useState<string | null>("card-a");
  React.useEffect(() => { abrir = (novo = "card-a") => setId(novo); }, []);
  return id && h(CardFullViewModal, { cardId: id, accent: "1,2,3", currentUserId: 7, currentUserRole: "ADMIN", onClose: () => { fechado(); setId(null); }, onAtualizado: () => {}, onAbrirCard: setId });
}
const dadosCard = (id: string) => ({
  id, pipelineId: "pipeline", pipeline: { id: "pipeline", nome: "Revisão de Radar" }, etapa: { id: "etapa", nome: "Em tratativa" }, membros: [], nolossLeadOrigem: [], nolossLeadId: null, importadoRdLinks: [], empresa: { cnpj: "000" },
  updatedAt: "2026-10-23T12:00:00Z", versao: 1, formularioEtapa: { secoes: [{ componentes: [{ valido: true, visivel: true, capability: BPM_CAPABILITIES.FOLLOW_UP_CHECKLIST }] }] },
}) as unknown as NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(ObterCardBpm).mockImplementation(async (id) => ({ success: true, data: dadosCard(id) }));
  vi.mocked(ObterUltimoFollowUpBpm).mockResolvedValue({ success: true, data: { estado: "NAO_INICIADO", checklist: null } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render() { await act(async () => root.render(h(PainelCardState, null, h(Probe), h(Board)))); }
function x() { return document.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')!; }
async function fechar() { await act(async () => { x().click(); expect(fechado).toHaveBeenCalledOnce(); }); }

it("X fecha sincronamente enquanto o follow-up real continua pendente, sem erro falso de save", async () => {
  let resolve!: (r: Awaited<ReturnType<typeof ObterUltimoFollowUpBpm>>) => void;
  vi.mocked(ObterUltimoFollowUpBpm).mockReturnValue(new Promise(ok => { resolve = ok; }));
  await render(); expect(ObterUltimoFollowUpBpm).toHaveBeenCalledWith("card-a");
  expect(document.querySelector('[data-card-atual="card-a"]')).toBeTruthy();
  await fechar(); expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(toast.error).not.toHaveBeenCalled();
  await act(async () => resolve({ success: true, data: { estado: "NAO_INICIADO", checklist: null } }));
  expect(fechado).toHaveBeenCalledOnce(); expect(toast.error).not.toHaveBeenCalled();
});
it.each(["NAO_INICIADO", "EM_ANDAMENTO"] as const)("estado %s não condiciona o fechamento da visualização", async (estado) => {
  const data = estado === "NAO_INICIADO" ? { estado, checklist: null }
    : { estado, checklist: { id: "follow-up-sintetico", perguntas: [], respostas: {}, completo: false, criadoEm: new Date("2026-10-23T12:00:00Z") } };
  vi.mocked(ObterUltimoFollowUpBpm).mockResolvedValue({ success: true, data });
  await render(); await fechar(); expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(toast.error).not.toHaveBeenCalled();
});
it("erro de leitura de follow-up permite Escape sem converter leitura em falha de salvamento", async () => {
  vi.mocked(ObterUltimoFollowUpBpm).mockRejectedValue(new Error("leitura sintética indisponível"));
  await render(); vi.mocked(toast.error).mockClear();
  await act(async () => { x().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  expect(fechado).toHaveBeenCalledOnce(); expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(toast.error).not.toHaveBeenCalled();
});
it("dispensa por clique externo sem aguardar follow-up nem saves", async () => {
  vi.mocked(ObterUltimoFollowUpBpm).mockReturnValue(new Promise(() => {}));
  await render(); await act(async () => { await new Promise(ok => setTimeout(ok, 0)); });
  await act(async () => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 })));
  expect(fechado).toHaveBeenCalledOnce(); expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it("autosave lento termina depois de fechar; sua resposta nunca fecha o card seguinte", async () => {
  await render();
  let resolve!: (r: boolean) => void;
  const save = vi.fn(() => new Promise<boolean>(ok => { resolve = ok; }));
  context.scheduleSave("card-a:campo", () => { void context.registerSave(save, "card-a", "card-a:campo"); }, 60_000);
  await fechar(); expect(save).toHaveBeenCalledOnce();
  await act(async () => abrir("card-b")); expect(document.querySelector('[data-card-atual="card-b"]')).toBeTruthy();
  await act(async () => { resolve(true); await context.flushSaves("card-a"); });
  expect(document.querySelector('[data-card-atual="card-b"]')).toBeTruthy(); expect(fechado).toHaveBeenCalledOnce(); expect(toast.error).not.toHaveBeenCalled();
});
it("falha real em background preserva rascunho/retry e não reabre nem fecha outra visualização", async () => {
  await render();
  const key = "card-a:resumo"; context.setDraft(key, { valor: "Rascunho sintético" }); context.setPendingFields(key, ["Resumo"]);
  let resolve!: (r: boolean) => void;
  const save = vi.fn().mockImplementationOnce(() => new Promise<boolean>(ok => { resolve = ok; })).mockImplementation(async () => { context.setDraft(key); context.setPendingFields(key, []); return true; });
  void context.registerSave(save, "card-a", key);
  await fechar(); await act(async () => { resolve(false); await context.flushSaves("card-a"); });
  expect(context.getDraft(key)?.valor).toBe("Rascunho sintético"); expect(context.getFailedSaveKeys("card-a")).toEqual([key]); expect(document.querySelector('[role="dialog"]')).toBeNull();
  const options = vi.mocked(toast.error).mock.calls.at(-1)?.[1];
  expect(options).toMatchObject({ id: "card-save:card-a", duration: Infinity });
  await act(async () => { expect(await context.retryFailedSaves("card-a")).toBe(true); });
  expect(save).toHaveBeenCalledTimes(2); expect(context.getDraft(key)).toBeUndefined(); expect(fechado).toHaveBeenCalledOnce();
});
it("fechar mantém rascunho manual reabrível sem submeter seu handler nem produzir falso erro", async () => {
  await render(); const manual = vi.fn().mockResolvedValue(true);
  context.setDraft("card-a:manual", { nome: "Rascunho manual" }); context.setPendingFields("card-a:manual", ["Dados da empresa"]); context.registerManualSave("card-a", "manual", manual);
  await fechar(); expect(manual).not.toHaveBeenCalled(); expect(context.getDraft("card-a:manual")?.nome).toBe("Rascunho manual"); expect(toast.error).not.toHaveBeenCalled();
  await act(async () => abrir()); expect(context.getDraft("card-a:manual")?.nome).toBe("Rascunho manual"); expect(manual).not.toHaveBeenCalled();
});
it("read de card que rejeita depois de fechar é tratado sem unhandled ou erro no próximo card", async () => {
  let reject!: (error: Error) => void;
  vi.mocked(ObterCardBpm).mockImplementationOnce(() => new Promise((_, no) => { reject = no; }));
  await render(); await fechar(); await act(async () => abrir("card-b"));
  await act(async () => { reject(new Error("timeout sintético")); await Promise.resolve(); });
  expect(document.querySelector('[data-card-atual="card-b"]')).toBeTruthy(); expect(toast.error).not.toHaveBeenCalled(); expect(fechado).toHaveBeenCalledOnce();
});

it("troca expressa no host attached abre vinculado sem bloquear pelo rascunho do card anterior", async () => {
  await render(); context.setDraft("card-a:manual", { valor: "Preservado" }); context.setPendingFields("card-a:manual", ["Manual"]);
  await act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "Abrir vinculado")!.click());
  expect(document.querySelector('[data-card-atual="card-b"]')).toBeTruthy(); expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(context.getDraft("card-a:manual")?.valor).toBe("Preservado"); expect(fechado).not.toHaveBeenCalled();
});
it("onOpenChange do Sheet dispensa a visualização mesmo quando a leitura segue pendente", async () => {
  vi.mocked(ObterUltimoFollowUpBpm).mockReturnValue(new Promise(() => {})); await render();
  // O Close nativo do Radix exerce onOpenChange, sem substituir o Sheet por mock.
  const closeRadix = [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "Fechar" && !b.hasAttribute("aria-label"))!;
  expect(closeRadix).toBeTruthy(); await act(async () => closeRadix.click());
  expect(fechado).toHaveBeenCalledOnce(); expect(document.querySelector('[role="dialog"]')).toBeNull();
});
