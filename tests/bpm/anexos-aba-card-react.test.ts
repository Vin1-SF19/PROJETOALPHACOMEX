// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DocumentosContratacaoComercial } from "@/lib/bpm/contratos-comerciais";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ upload: vi.fn(), registrar: vi.fn() }));
// Keep the real Dossie component; isolate only its server-action boundary.
vi.mock("@/actions/bpm/ChecklistDocumental", () => ({
  obterDossieChecklistCard: vi.fn().mockResolvedValue({ ok: true, data: { dossie: null, vinculo: null, revision: 0, cardUpdatedAt: "2026-10-22T12:00:00.000Z" }, requestId: "fixture" }),
  listarDossiesCandidatosCard: vi.fn(),
  vincularDossieChecklistCard: vi.fn(),
}));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: api.registrar, ExcluirAnexoBpm: vi.fn() }));
vi.mock("@vercel/blob/client", () => ({ upload: api.upload }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard", () => ({ PainelChecklistsCard: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo", () => ({ PainelTarefasPorTipo: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelTimelineCard", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoPipeline", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/EditorAnotacaoCard", () => ({ EditorAnotacaoCard: () => null }));
vi.mock("@/components/bpm/cadencias/PainelCadenciasCard", () => ({ PainelCadenciasCard: () => null }));
vi.mock("@/components/bpm/anexos/VisualizadorAnexoCard", () => ({ VisualizadorAnexoCard: ({ anexo, cardId }: { anexo: { nome: string; urlAcesso?: string } | null; cardId?: string }) => anexo ? h("div", { role: "dialog", "data-url-acesso": anexo.urlAcesso, "data-card-id": cardId }, anexo.nome) : null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoRd", () => ({ default: () => null, EstadoHistoricoRd: () => null, EventoHistoricoRdItem: () => null, useHistoricoRd: () => ({ eventos: [], carregando: false, erro: null, recarregar: vi.fn() }) }));
import PainelHistorico from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico";
type Card = React.ComponentProps<typeof PainelHistorico>["card"];
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(anexos: Card["anexos"] = [], onAtualizado = vi.fn(), documentosContratacao: DocumentosContratacaoComercial | null = null, admin = false) {
  const card = { id: "rdcard_0123456789abcdef0123456789ab", pipelineId: "pipeline", pipeline: { nome: "Comercial" }, etapa: { id: "etapa" }, membros: [], tarefas: [], campoValores: [], historico: [], anexos, documentosContratacao, capacidades: { editarCard: admin, gerenciarMembros: admin, moverEtapa: admin, administrarPipeline: admin } } as unknown as Card;
  await act(async () => root.render(h(PainelHistorico, { card, accent: "1,2,3", onAtualizado, etapas: [], podeTrabalharTarefas: false, podeEditar: false, realtimeRevision: 0, onInteracaoCriada: vi.fn(), anotacoes: [], onAbrirCard: vi.fn() })));
  const aba = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(t => t.textContent?.includes("Anexos"))!;
  await act(async () => aba.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true })));
}
it("mostra estado vazio amigável sem confundir tarefas com arquivos", async () => {
  await render();
  expect(host.textContent).toContain("Nenhum anexo neste card");
  expect(host.textContent).toContain("Os arquivos enviados para este card aparecerão aqui");
});
it("lista anexos persistidos e permite abri-los", async () => {
  await render([{ id: "anexo", nome: "contrato.pdf", tamanho: 100, tipo: "application/pdf" }] as Card["anexos"]);
  expect(host.textContent).not.toContain("Nenhum anexo neste card");
  const abrir = [...host.querySelectorAll('button')].find(b => b.textContent === "contrato.pdf")!;
  expect(abrir).toBeTruthy();
  await act(async () => abrir.click());
  expect(host.querySelector('[role="dialog"]')?.textContent).toBe("contrato.pdf");
});


it("registra upload e atualiza a aba com o arquivo retornado pela nova leitura do card", async () => {
  const anexo = { id: "anexo-enviado", nome: "novo.pdf", tamanho: 12, tipo: "application/pdf" } as Card["anexos"][number];
  api.upload.mockResolvedValue({ pathname: "bpm/card/novo.pdf" });
  api.registrar.mockResolvedValue({ success: true, data: anexo });
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, file: { recibo: "recibo-assinado" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const onAtualizado = vi.fn(() => { void render([anexo]); });
  await render([], onAtualizado);
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [new File(["%PDF-1.7"], "novo.pdf", { type: "application/pdf" })] });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 25)); });
  expect(api.registrar).toHaveBeenCalledWith({ cardId: "rdcard_0123456789abcdef0123456789ab", recibo: "recibo-assinado" });
  expect(onAtualizado).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("novo.pdf");
  expect(host.textContent).not.toContain("Nenhum anexo neste card");
});


it("combina contratos projetados e locais com uma contagem única e exclui apenas arquivos próprios", async () => {
  const cardId = "rdcard_0123456789abcdef0123456789ab";
  const documento = { id: "contratacao:envio", nome: "Financeiro final.pdf", tipo: "application/pdf", urlAcesso: `/api/bpm/cards/${cardId}/contrato?tipo=para_envio`, origem: "CONTRATACAO" as const, somenteLeitura: true as const };
  const docs: DocumentosContratacaoComercial = { paraEnvio: { estado: "DISPONIVEL", documento }, assinado: { estado: "DISPONIVEL", documento } };
  await render([{ id: "local", nome: "Comercial manual.pdf", tamanho: 12, tipo: "application/pdf" }] as Card["anexos"], vi.fn(), docs, true);
  const aba = [...host.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent?.includes("Anexos"))!;
  expect(aba.textContent?.replace(/\s/g, "")).toBe("Anexos2");
  expect([...host.querySelectorAll("button")].filter((button) => button.textContent === documento.nome)).toHaveLength(1);
  expect(host.textContent).toContain("Financeiro · Somente leitura");
  expect(host.querySelector('[aria-label="Excluir anexo Financeiro final.pdf"]')).toBeNull();
  expect(host.querySelector('[aria-label="Excluir anexo Comercial manual.pdf"]')).toBeTruthy();
  const abrir = [...host.querySelectorAll("button")].find((button) => button.textContent === documento.nome)!;
  await act(async () => abrir.click());
  expect(host.querySelector('[role="dialog"]')?.getAttribute("data-url-acesso")).toBe(documento.urlAcesso);
  expect(host.querySelector('[role="dialog"]')?.getAttribute("data-card-id")).toBe(cardId);
});
