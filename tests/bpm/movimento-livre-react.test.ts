// @vitest-environment happy-dom
import React, { act, createElement as h, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ preflight: vi.fn(), move: vi.fn(), saveAndMove: vi.fn(), disponibilidade: vi.fn(), flush: vi.fn(), list: vi.fn(), sync: vi.fn(), error: vi.fn() }));
const drag = vi.hoisted(() => ({ current: null as null | ComponentProps<typeof import("@dnd-kit/core").DndContext> }));
vi.mock("@/actions/bpm/NotificacoesLeads", () => ({ ObterLeadPendenteNotificacaoBpm: vi.fn() }));
vi.mock("@dnd-kit/core", async (original) => {
  const actual = await original<typeof import("@dnd-kit/core")>();
  return { ...actual, DndContext: (props: ComponentProps<typeof actual.DndContext>) => { drag.current = props; return h(actual.DndContext, props); } };
});
vi.mock("next/navigation", () => { const router = { push: vi.fn(), refresh: vi.fn() }; return { useRouter: () => router }; });
vi.mock("sonner", () => ({ toast: { error: api.error, success: vi.fn() } }));
vi.mock("@/lib/pusher", () => ({ pusherClient: null }));
vi.mock("@/actions/bpm/Quadro", () => ({ SincronizarQuadroBpm: api.sync }));
vi.mock("@/actions/bpm/NolossLeads", () => ({ PromoverNolossLead: vi.fn() }));
vi.mock("@/actions/bpm/InstagramLeads", () => ({ AssumirLeadInstagram: vi.fn() }));
vi.mock("@/actions/bpm/Checklists", () => ({ ObterResumoChecklistCardBpm: vi.fn(async () => ({ success: false })) }));
vi.mock("@/actions/bpm/DisponibilidadeEtapasCard", () => ({ ObterDisponibilidadeEtapasCardBpm: api.disponibilidade }));
vi.mock("@/actions/bpm/Cards", () => ({
  ObterCardBpm: vi.fn(), MoverCardBpm: api.move, ObterRequisitosTransicaoBpm: api.preflight,
  SalvarRequisitosEMoverCardBpm: api.saveAndMove, ListarCardsPipelineBpm: api.list, CriarCardBpm: vi.fn(),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext", () => ({ useCardSave: () => ({ flushSaves: api.flush }) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CampoBpmInput", () => ({ CampoBpmInput: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/BpmDateTimeField", () => ({ BpmDateTimeField: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/AtribuirLeadAgendarModal", () => ({ AtribuirLeadAgendarModal: ({ open }: { open: boolean }) => open ? h("div", null, "Atribuição indevida") : null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/AtribuirResponsavelPromocaoModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard", () => ({ GrupoAvataresMembrosCard: ({ membros }: { membros: { usuario: { nome: string } }[] }) => h("span", { "data-membros": true }, membros.map((membro) => membro.usuario.nome).join(", ")) }));
vi.mock("@/hooks/useLazyColumn", () => ({ useLazyColumn: () => [React.createRef(), true] }));

import PainelProximaEtapa from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa";
import PipelineBoardClient from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";

const preview = () => ({ success: true, data: {
  etapaDestino: { id: "destino", nome: "Destino" }, campos: [], faltantes: [{ id: "email", nome: "E-mail do contato" }], guardas: [],
} });
const detalhe = {
  id: "card-rd", versao: 2, pipelineId: "pipeline", pipeline: { nome: "Funil Sintético" },
  etapa: { id: "origem", nome: "Origem", chave: null }, updatedAt: new Date("2026-10-16T12:00:00Z"),
} as unknown as ComponentProps<typeof PainelProximaEtapa>["card"];
const cardBoard = {
  id: "card-rd", etapaId: "origem", servico: null, status: "ATIVO", origem: "real", nolossLeadId: null,
  createdAt: "2026-10-16T12:00:00Z", empresa: { id: 1, razaoSocial: "Empresa Sintética", nomeFantasia: null, cnpj: null },
  responsavel: { id: 1, nome: "Responsável Sintético" }, membros: [], _count: { tarefas: 0, anexos: 0 }, tarefas: [], podeAgirEtapa: true,
} satisfies ComponentProps<typeof PipelineBoardClient>["cardsIniciais"][number];

let host: HTMLDivElement, root: Root;
const onMovido = vi.fn();
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim() === label)!;
const click = async (label: string) => { expect(button(label)).toBeDefined(); await act(async () => button(label).click()); };
async function painel(card = detalhe, destino = "Destino") {
  await act(async () => root.render(h(PainelProximaEtapa, { card, etapas: [{ id: "destino", nome: destino, chave: null, ordem: 1, script: null }], podeMoverEtapa: true, accent: "1,2,3", onMovido })));
}
async function board(podeMoverLivremente = false, contagens = { tarefas: 0, anexos: 0 }, paginado = false, recebimentoPendente = false) {
  await act(async () => root.render(h(PipelineBoardClient, {
    pipeline: { id: "pipeline", nome: "Funil Sintético", etapas: [{ id: "origem", nome: "Origem", ordem: 0 }, { id: "destino", nome: "Destino", ordem: 1 }] },
    manifestoInicial: paginado ? { configVersion: 1, entradas: [{ id: cardBoard.id, etapaId: "origem", revision: "1", nome: "Empresa Sintética", cnpj: null, servico: null, responsaveis: [] }] } : undefined,
    cardsIniciais: [{ ...cardBoard, recebimentoPendente, _count: contagens, podeMoverLivremente, podeAgirEtapa: !podeMoverLivremente }], visual: { accent: "1,2,3" } as ComponentProps<typeof PipelineBoardClient>["visual"], currentUserId: 1, currentUserRole: "ADMIN",
  })));
}
async function drop() {
  const active = { id: "card-rd" };
  await act(async () => drag.current!.onDragStart!({ active } as import("@dnd-kit/core").DragStartEvent));
  await act(async () => { await drag.current!.onDragEnd!({ active, over: { id: "destino" } } as import("@dnd-kit/core").DragEndEvent); });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  api.flush.mockResolvedValue(true); api.preflight.mockResolvedValue(preview()); api.move.mockResolvedValue({ success: true });
  api.disponibilidade.mockResolvedValue({ success: true, data: [{ etapaId: "destino", oculta: false, pendencias: ["E-mail do contato"] }] });
  api.list.mockResolvedValue({ success: true, data: [{ ...cardBoard, etapaId: "destino" }] });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("alpha-pipeline-column") ? 800 : 240; });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(260);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

describe("movimento livre com autoridade calculada no servidor", () => {
  it("modal move diretamente sem formulário ou confirmação", async () => {
    api.disponibilidade.mockResolvedValue({ success: true, data: [{ etapaId: "destino", oculta: false, pendencias: [] }] });
    await painel({ ...detalhe, podeMoverLivremente: true });
    await click("Destino");
    expect(api.move).toHaveBeenCalledWith(expect.objectContaining({ cardId: "card-rd", etapaDestinoId: "destino", idempotencyKey: expect.any(String) }));
    expect(api.preflight).not.toHaveBeenCalled();
    expect(api.saveAndMove).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onMovido).toHaveBeenCalled();
  });
  it("kanban permite salto sem aresta configurada e sem vínculo de edição", async () => {
    await board(true);
    await drop();
    expect(api.move).toHaveBeenCalledWith(expect.objectContaining({ cardId: "card-rd", etapaDestinoId: "destino", idempotencyKey: expect.any(String) }));
    expect(api.preflight).not.toHaveBeenCalled();
    expect(api.error).not.toHaveBeenCalled();
  });
});


it("identifica contadores de tarefas e anexos por texto no Kanban", async () => {
  await board(false, { tarefas: 2, anexos: 1 });
  expect(host.textContent).toContain("2 tarefas");
  expect(host.textContent).toContain("1 anexo");
});

it("bloqueia um segundo clique no mesmo frame enquanto salva o movimento", async () => {
  api.disponibilidade.mockResolvedValue({ success: true, data: [{ etapaId: "destino", oculta: false, pendencias: [] }] });
  let liberar!: (valor: boolean) => void;
  api.flush.mockImplementationOnce(() => new Promise<boolean>((resolve) => { liberar = resolve; }));
  await painel({ ...detalhe, podeMoverLivremente: true });
  await act(async () => { const destino = button("Destino"); destino.click(); destino.click(); });
  expect(api.flush).toHaveBeenCalledTimes(1);
  expect(api.move).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Salvando e atualizando a etapa");
  await act(async () => { liberar(true); });
  expect(api.move).toHaveBeenCalledTimes(1);
});


it.each([true, false])("contador e card mudam juntos e reconciliam sucesso=%s", async (sucesso) => {
  let liberar!: (valor: { success: boolean; error?: string }) => void;
  api.move.mockImplementationOnce(() => new Promise((resolve) => { liberar = resolve; }));
  const entrada = { id: cardBoard.id, etapaId: sucesso ? "destino" : "origem", revision: "2", nome: "Empresa Sintética", cnpj: null, servico: null, responsaveis: [] };
  api.sync.mockResolvedValue({ success: true, manifesto: { configVersion: 1, entradas: [entrada] }, ids: [cardBoard.id], cards: [{ ...cardBoard, podeMoverLivremente: true, etapaId: entrada.etapaId }] });
  await board(true, { tarefas: 0, anexos: 0 }, true);
  const totais = () => [...host.querySelectorAll('.alpha-pipeline-column-header [aria-live="polite"]')].map((item) => item.textContent?.trim());
  expect(totais()).toEqual(["1", "0"]);
  await act(async () => drag.current!.onDragStart!({ active: { id: cardBoard.id } } as import("@dnd-kit/core").DragStartEvent));
  let movimento: void | Promise<void>;
  await act(async () => { movimento = drag.current!.onDragEnd!({ active: { id: cardBoard.id }, over: { id: "destino" } } as import("@dnd-kit/core").DragEndEvent); });
  expect(totais()).toEqual(["0", "1"]);
  await act(async () => { liberar({ success: sucesso, ...(!sucesso ? { error: "Recusado" } : {}) }); await movimento; });
  expect(totais()).toEqual(sucesso ? ["0", "1"] : ["1", "0"]);
});

it("recepção pendente no Kanban não apresenta o responsável herdado como dono do novo setor", async () => {
  await board(false, { tarefas: 0, anexos: 0 }, false, true);
  expect(host.textContent).toContain("Aguardando assumir");
  expect(host.querySelector("[data-membros]")).toBeNull();
  expect(host.textContent).not.toContain("Responsável Sintético");
  await act(async () => root.render(null));
  await board();
  expect(host.textContent).not.toContain("Aguardando assumir");
  expect(host.querySelector("[data-membros]")?.textContent).toContain("Responsável Sintético");
});
