// @vitest-environment happy-dom
import React, { act, createElement as h, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ preflight: vi.fn(), move: vi.fn(), saveAndMove: vi.fn(), disponibilidade: vi.fn(), flush: vi.fn(), list: vi.fn(), error: vi.fn() }));
const drag = vi.hoisted(() => ({ current: null as null | ComponentProps<typeof import("@dnd-kit/core").DndContext> }));
vi.mock("@/actions/bpm/NotificacoesLeads", () => ({ ObterLeadPendenteNotificacaoBpm: vi.fn() }));
vi.mock("@dnd-kit/core", async (original) => {
  const actual = await original<typeof import("@dnd-kit/core")>();
  return { ...actual, DndContext: (props: ComponentProps<typeof actual.DndContext>) => { drag.current = props; return h(actual.DndContext, props); } };
});
vi.mock("next/navigation", () => { const router = { push: vi.fn(), refresh: vi.fn() }; return { useRouter: () => router }; });
vi.mock("sonner", () => ({ toast: { error: api.error, success: vi.fn() } }));
vi.mock("@/lib/pusher", () => ({ pusherClient: null }));
vi.mock("@/actions/bpm/Quadro", () => ({ SincronizarQuadroBpm: vi.fn() }));
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
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard", () => ({ GrupoAvataresMembrosCard: () => null }));
vi.mock("@/hooks/useLazyColumn", () => ({ useLazyColumn: () => [React.createRef(), true] }));

import PainelProximaEtapa from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa";
import PipelineBoardClient from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";

const confirmacao = { avisosHash: "hash-a", etapaOrigemEsperadaId: "origem", versaoEsperada: 2, configVersion: 4 };
const avisos = [{ key: "campo:email", kind: "MISSING_DATA", nome: "E-mail do contato", campoId: "email" }];
const warning = (hash = "hash-a", nome = "E-mail do contato") => ({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED", error: "Confirme as pendências", pendencias: [nome], avisos: [{ ...avisos[0], nome }], confirmacao: { ...confirmacao, avisosHash: hash } });
const preview = (hash = "hash-a", nome = "E-mail do contato") => ({ success: true, data: {
  etapaDestino: { id: "destino", nome: "Destino" }, campos: [], faltantes: [{ id: "email", nome }], guardas: [],
  importadoRd: true, podeMover: false, podeMoverComConfirmacao: true, confirmacao: { ...confirmacao, avisosHash: hash }, avisos: [{ ...avisos[0], nome }],
} });
const detalhe = {
  id: "card-rd", importadoRd: true, versao: 2, pipelineId: "pipeline", pipeline: { nome: "Funil Sintético" },
  etapa: { id: "origem", nome: "Origem", chave: null }, updatedAt: new Date("2026-10-16T12:00:00Z"),
} as unknown as ComponentProps<typeof PainelProximaEtapa>["card"];
const cardBoard = {
  id: "card-rd", importadoRd: true, etapaId: "origem", servico: null, status: "ATIVO", origem: "real", nolossLeadId: null,
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
async function board(importadoRd = true, podeMoverLivremente = false) {
  await act(async () => root.render(h(PipelineBoardClient, {
    pipeline: { id: "pipeline", nome: "Funil Sintético", etapas: [{ id: "origem", nome: "Origem", ordem: 0 }, { id: "destino", nome: "Destino", ordem: 1 }] },
    cardsIniciais: [{ ...cardBoard, importadoRd, podeMoverLivremente, podeAgirEtapa: !podeMoverLivremente }], visual: { accent: "1,2,3" } as ComponentProps<typeof PipelineBoardClient>["visual"], currentUserId: 1, currentUserRole: "ADMIN",
  })));
}
async function drop() {
  const active = { id: "card-rd" };
  await act(async () => drag.current!.onDragStart!({ active } as import("@dnd-kit/core").DragStartEvent));
  await act(async () => { await drag.current!.onDragEnd!({ active, over: { id: "destino" } } as import("@dnd-kit/core").DragEndEvent); });
}
const colunaDoCard = () => host.querySelector('[aria-label="Abrir card de Empresa Sintética"]')?.closest(".alpha-pipeline-column-shell")?.querySelector(".alpha-pipeline-column-header")?.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  api.flush.mockResolvedValue(true); api.preflight.mockResolvedValue(preview()); api.move.mockResolvedValue({ success: true });
  api.disponibilidade.mockResolvedValue({ success: true, data: [{ etapaId: "destino", oculta: false, pendencias: ["E-mail do contato"], podeConfirmarPendenciasRd: true }] });
  api.list.mockResolvedValue({ success: true, data: [{ ...cardBoard, etapaId: "destino" }] });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("alpha-pipeline-column") ? 800 : 240; });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(260);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

describe("painel de próxima etapa para importados RD", () => {
  it("habilita pendências confirmáveis, apresenta diálogo acessível e cancela sem salvar", async () => {
    await painel(); expect(button("Destino").disabled).toBe(false); await click("Destino");
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog.querySelector('ul[aria-label="Informações obrigatórias pendentes"]')?.textContent).toBe("E-mail do contato");
    expect(dialog.textContent).toContain("Mover para Destino?");
    expect(dialog.textContent).not.toContain("hash-a");
    expect(api.flush).not.toHaveBeenCalled(); expect(api.move).not.toHaveBeenCalled();
    await click("Cancelar para preencher");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(api.saveAndMove).not.toHaveBeenCalled(); expect(api.flush).not.toHaveBeenCalled(); expect(onMovido).not.toHaveBeenCalled();
  });

  it("confirma sem campos fictícios e mantém o mesmo UUID em uma confirmação atualizada", async () => {
    api.move.mockResolvedValueOnce(warning("hash-b", "Checklist de documentos")).mockResolvedValueOnce({ success: true });
    await painel(); await click("Destino"); await click("Mover mesmo assim");
    expect(onMovido).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Checklist de documentos");
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain("E-mail do contato");
    const primeira = api.move.mock.calls[0][0];
    expect(primeira).toMatchObject({ cardId: "card-rd", etapaDestinoId: "destino", confirmacaoPendenciasRd: confirmacao, etapaOrigemEsperadaId: "origem", versaoEsperada: 2 });
    expect(primeira.idempotencyKey).toMatch(/^[\da-f]{8}-[\da-f-]{27}$/i);
    expect(primeira).not.toHaveProperty("camposValores");
    await click("Mover mesmo assim");
    expect(api.move.mock.calls[1][0]).toMatchObject({ idempotencyKey: primeira.idempotencyKey, confirmacaoPendenciasRd: { ...confirmacao, avisosHash: "hash-b" } });
    expect(onMovido).toHaveBeenCalledOnce(); expect(api.saveAndMove).not.toHaveBeenCalled();
  });

  it("reconsulta após conflito de versão sem repetir o movimento automaticamente", async () => {
    api.move.mockResolvedValueOnce({ success: false, code: "STALE_VERSION", error: "Card atualizado" });
    api.preflight.mockResolvedValueOnce(preview()).mockResolvedValueOnce(preview("hash-c", "Radar pretendido"));
    await painel(); await click("Destino"); await click("Mover mesmo assim");
    expect(api.move).toHaveBeenCalledOnce(); expect(api.preflight).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Radar pretendido");
    expect(onMovido).not.toHaveBeenCalled();
    await click("Cancelar para preencher"); expect(api.saveAndMove).not.toHaveBeenCalled();
  });

  it("não ignora falha ao salvar alterações legítimas após a confirmação", async () => {
    api.flush.mockResolvedValue(false);
    await painel(); await click("Destino"); await click("Mover mesmo assim");
    expect(api.move).not.toHaveBeenCalled(); expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(api.error).toHaveBeenCalledWith("Não foi possível salvar os campos. O card não foi movido.");
  });

  it("RD sem pendência segue avaliação dinâmica sem atribuição especial por nome de etapa", async () => {
    api.preflight.mockResolvedValue({ success: true, data: { etapaDestino: { id: "destino", nome: "Agendar Reunião" }, campos: [], faltantes: [], guardas: [], importadoRd: true, podeMoverComConfirmacao: false } });
    await painel({ ...detalhe, pipeline: { nome: "Revisão de Radar" }, etapa: { ...detalhe.etapa, nome: "Novos Leads" } } as typeof detalhe, "Agendar Reunião");
    await click("Agendar Reunião");
    expect(api.move).toHaveBeenCalledOnce(); expect(onMovido).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain("Atribuição indevida"); expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe("arrastar importados RD", () => {
  it("solicita movimento sem aresta, mantém origem e cancela preservando posição", async () => {
    api.move.mockResolvedValue(warning()); await board(); expect(colunaDoCard()).toContain("Origem"); await drop();
    expect(api.move).toHaveBeenCalledOnce(); expect(colunaDoCard()).toContain("Origem");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("E-mail do contato");
    await click("Cancelar para preencher");
    expect(colunaDoCard()).toContain("Origem"); expect(api.move).toHaveBeenCalledOnce(); expect(api.list).not.toHaveBeenCalled();
  });

  it("repete a intenção com token e atualiza a coluna somente após sucesso", async () => {
    api.move.mockResolvedValueOnce(warning()).mockResolvedValueOnce({ success: true });
    await board(); await drop(); const primeira = api.move.mock.calls[0][0];
    expect(primeira).not.toHaveProperty("confirmacaoPendenciasRd");
    await click("Mover mesmo assim");
    expect(api.move.mock.calls[1][0]).toEqual({ cardId: "card-rd", etapaDestinoId: "destino", idempotencyKey: primeira.idempotencyKey, etapaOrigemEsperadaId: "origem", versaoEsperada: 2, confirmacaoPendenciasRd: confirmacao });
    expect(colunaDoCard()).toContain("Destino"); expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("reabre pendências atuais e fechar pelo botão do diálogo equivale a cancelar", async () => {
    api.move.mockResolvedValueOnce(warning()).mockResolvedValueOnce(warning("hash-d", "Dados da empresa"));
    await board(); await drop(); await click("Mover mesmo assim");
    expect(colunaDoCard()).toContain("Origem"); expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Dados da empresa");
    await click("Close"); expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(colunaDoCard()).toContain("Origem"); expect(api.move).toHaveBeenCalledTimes(2);
  });

  it("card nativo sem aresta mantém o bloqueio existente", async () => {
    await board(false); await drop(); expect(api.move).not.toHaveBeenCalled(); expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(colunaDoCard()).toContain("Origem");
  });
});

describe("movimento livre com autoridade calculada no servidor", () => {
  it.each([false, true])("modal move diretamente card RD=%s sem formulário ou confirmação", async (importadoRd) => {
    api.disponibilidade.mockResolvedValue({ success: true, data: [{ etapaId: "destino", oculta: false, pendencias: [] }] });
    await painel({ ...detalhe, importadoRd, podeMoverLivremente: true });
    await click("Destino");
    expect(api.move).toHaveBeenCalledWith(expect.objectContaining({ cardId: "card-rd", etapaDestinoId: "destino", idempotencyKey: expect.any(String) }));
    expect(api.preflight).not.toHaveBeenCalled();
    expect(api.saveAndMove).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onMovido).toHaveBeenCalled();
  });
  it("kanban permite salto sem aresta configurada e sem vínculo de edição", async () => {
    await board(false, true);
    await drop();
    expect(api.move).toHaveBeenCalledWith(expect.objectContaining({ cardId: "card-rd", etapaDestinoId: "destino", idempotencyKey: expect.any(String) }));
    expect(api.preflight).not.toHaveBeenCalled();
    expect(api.error).not.toHaveBeenCalled();
  });
});
