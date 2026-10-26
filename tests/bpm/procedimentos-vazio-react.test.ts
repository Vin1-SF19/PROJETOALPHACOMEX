// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ listar: vi.fn() }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/Checklists", () => ({ ListarChecklistsCardBpm: api.listar, AdicionarItemExclusivoChecklistCardBpm: vi.fn(), AtualizarItemChecklistCardBpm: vi.fn(), CriarChecklistDocumentalAvulsoBpm: vi.fn() }));
import { CardKanbanRenderer } from "@/components/bpm/kanban/CardKanbanRenderer";
import { PainelChecklistsCard } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistsCard";
let root: Root, host: HTMLDivElement;
const card = { id: "rdcard_0123456789abcdef0123456789ab", responsavel: { id: 7, nome: "Responsável" }, membros: [], pipelineId: "pipeline", etapaId: "etapa" } as unknown as React.ComponentProps<typeof PainelChecklistsCard>["card"];
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render() {
  await act(async () => root.render(h(PainelChecklistsCard, { card, accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn() })));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
}
it("mostra mensagem informativa quando não há procedimento, sem botão de erro", async () => {
  api.listar.mockResolvedValue({ success: true, data: [] });
  await render();
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Nenhum procedimento para esta etapa");
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.textContent).not.toContain("Tentar novamente");
});
it("preserva erro e retry para indisponibilidade e permite recuperar", async () => {
  api.listar.mockResolvedValueOnce({ success: false, error: "Falha ao consultar" }).mockResolvedValueOnce({ success: true, data: [] });
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Falha ao consultar");
  expect(host.textContent).not.toContain("Nenhum procedimento para esta etapa");
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent?.includes("Tentar novamente"))!.click());
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.textContent).toContain("Nenhum procedimento para esta etapa");
});
it("preserva o estado de erro quando a solicitação falha", async () => {
  api.listar.mockRejectedValue(new Error("offline"));
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Não foi possível carregar os procedimentos");
  expect(host.textContent).not.toContain("Nenhum procedimento para esta etapa");
});


it.each([
  { tarefas: "2", anexos: "1", esperado: ["2 tarefas", "1 anexo"] },
  { tarefas: "1", anexos: "2", esperado: ["1 tarefa", "2 anexos"] },
])("identifica tarefas/anexos também nos cards de composição configurada", async ({ tarefas, anexos, esperado }) => {
  await act(async () => root.render(h(CardKanbanRenderer, {
    composicao: [{ kind: "NATIVE", key: "TAREFAS" }, { kind: "NATIVE", key: "ANEXOS" }],
    valores: { nativos: { TAREFAS: { status: "ok", valor: tarefas }, ANEXOS: { status: "ok", valor: anexos } }, campos: {}, camposLabel: {} },
  })));
  for (const texto of esperado) expect(host.textContent).toContain(texto);
});
