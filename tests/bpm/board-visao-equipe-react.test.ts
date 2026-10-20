// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import PipelineBoardClient from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";

const drag = vi.hoisted(() => ({ current: null as null | import("react").ComponentProps<typeof import("@dnd-kit/core").DndContext> }));
vi.mock("@dnd-kit/core", async (original) => {
  const actual = await original<typeof import("@dnd-kit/core")>();
  return { ...actual, DndContext: (props: import("react").ComponentProps<typeof actual.DndContext>) => {
    drag.current = props;
    return h(actual.DndContext, props);
  } };
});
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/pusher", () => ({ pusherClient: null }));
vi.mock("@/actions/bpm/Quadro", () => ({ SincronizarQuadroBpm: vi.fn() }));
vi.mock("@/actions/bpm/Cards", () => ({
  ListarCardsPipelineBpm: vi.fn(),
  MoverCardBpm: vi.fn(),
  CriarCardBpm: vi.fn(),
}));
vi.mock("@/actions/bpm/NolossLeads", () => ({ PromoverNolossLead: vi.fn() }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal", () => ({
  default: ({ cardId, onCardExcluido }: { cardId: string; onCardExcluido: (id: string) => void }) =>
    h("button", { onClick: () => onCardExcluido(cardId) }, "Confirmar exclusão"),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/AtribuirResponsavelPromocaoModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard", () => ({ GrupoAvataresMembrosCard: () => null }));
vi.mock("@/hooks/useLazyColumn", () => ({ useLazyColumn: () => [React.createRef(), true] }));

const card = {
  id: "card-excluido-em-outra-sessao",
  etapaId: "etapa-1",
  servico: null,
  status: "ATIVO",
  origem: "real",
  nolossLeadId: null,
  createdAt: new Date("2026-09-23T12:00:00Z"),
  empresa: { id: 1, razaoSocial: "Empresa", nomeFantasia: null, cnpj: null },
  responsavel: { id: 1, nome: "Responsável" },
  membros: [],
  _count: { tarefas: 0, anexos: 0 },
  tarefas: [],
  podeAgirEtapa: true,
} satisfies ComponentProps<typeof PipelineBoardClient>["cardsIniciais"][number];

function montarBoard() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const props: ComponentProps<typeof PipelineBoardClient> = {
    pipeline: { id: "pipeline-1", nome: "Pipeline", etapas: [{ id: "etapa-1", nome: "Em andamento", ordem: 0 }] },
    cardsIniciais: [card],
    visual: { accent: "1,2,3" } as ComponentProps<typeof PipelineBoardClient>["visual"],
    currentUserId: 1,
    currentUserRole: "ADMIN",
  };
  return { container, root, props };
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("alpha-pipeline-column") ? 800 : 240; });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(260);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.clearAllMocks();
});


vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: { value: string; onValueChange: (v: string) => void; disabled?: boolean; children: React.ReactNode }) => h("select", { value, disabled, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange(e.target.value) }, children),
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => h(React.Fragment, {}, children),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => h("option", { value }, children),
}));

const colega = { ...card, id: "colega", empresa: { ...card.empresa, razaoSocial: "Empresa da colega" }, responsavel: { id: 9, nome: "Ana Operacional" }, podeAgirEtapa: false };
const historico = { ...card, id: "historico", empresa: { ...card.empresa, razaoSocial: "Responsável histórico" }, responsavel: { id: 77, nome: "Pessoa de outro setor" }, podeAgirEtapa: false };
const pessoas = [{ id: 7, nome: "Usuária sem cards" }, card.responsavel, colega.responsavel];
function manifestoBoard(admin = false) {
  return {
    configVersion: 1,
    acesso: { userId: 1, admin, setores: [{ id: 3, nome: "Operacional", usuarioIds: [1, 7, 9] }], responsaveis: pessoas },
    entradas: [card, colega, historico].map((c) => ({ id: c.id, etapaId: c.etapaId, revision: "1", nome: c.empresa.razaoSocial, cnpj: null, servico: null, responsaveis: [c.responsavel] })),
  };
}
async function selecionar(container: HTMLElement, valor: string) {
  await act(async () => { const select = container.querySelector("select")!; select.value = valor; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}
async function atualizar(container: HTMLElement) {
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Atualizar pipeline"]')!.click(); });
}
const cardColega = '[aria-label="Abrir card de Empresa da colega"]';

it("troca pelo segundo select sem alterar o filtro; arrasto e detalhes impedem navegação", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();
  const { container, root, props } = montarBoard();
  props.pipelinesDisponiveis = [{ id: "pipeline-1", nome: "Pipeline" }, { id: "outro-funil", nome: "Outro funil" }];
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    const [responsaveis, funis] = container.querySelectorAll("select");
    expect(funis).toBeDefined();
    expect(funis.value).toBe("pipeline-1");
    expect([...funis.options].map((o) => o.textContent)).toEqual(["Pipeline", "Outro funil"]);
    const escolher = async (id: string) => act(async () => { funis.value = id; funis.dispatchEvent(new Event("change", { bubbles: true })); });
    await escolher("pipeline-1");
    await escolher("nao-autorizado");
    expect(router.push).not.toHaveBeenCalled();
    await escolher("outro-funil");
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/PainelAlpha/AlphaCRM/pipeline/outro-funil");
    expect(responsaveis.value).toBe("MEUS");
    router.push.mockClear();
    await act(async () => { drag.current?.onDragStart?.({ active: { id: card.id } } as never); });
    expect(funis.disabled).toBe(true);
    await escolher("outro-funil");
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => { drag.current?.onDragEnd?.({ active: { id: card.id }, over: null } as never); });
    expect(funis.disabled).toBe(false);
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Abrir card de Empresa"]')!.click(); });
    expect(funis.disabled).toBe(true);
    await escolher("outro-funil");
    expect(router.push).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("sem lista de funis mantém apenas o atual e não permite navegar", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();
  const { container, root, props } = montarBoard();
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    const funis = container.querySelectorAll("select")[1];
    expect(funis.disabled).toBe(true);
    expect([...funis.options].map((o) => o.value)).toEqual(["pipeline-1"]);
    expect(router.push).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it.each(["TI", "OPERACIONAL"])("%s usa a mesma lista setorial, inclui pessoa sem cards e consulta pessoa/Todos", async (role) => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();
  const { container, root, props } = montarBoard();
  const manifesto = manifestoBoard(role === "TI");
  props.currentUserRole = role; props.manifestoInicial = manifesto;
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto, cards: [card, colega, historico], ids: [card.id, colega.id, historico.id] } as never);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    const select = container.querySelector("select")!;
    expect(container.querySelectorAll("select")).toHaveLength(2);
    expect(select.value).toBe("MEUS");
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([
      ["MEUS", "Meus e sem vínculos"], ["9", "Ana Operacional"], ["1", "Responsável"], ["7", "Usuária sem cards"], ["todos", "Todos"],
    ]);
    expect(select.textContent).not.toContain("Pessoa de outro setor");
    expect(container.querySelector(cardColega)).toBeNull();
    await selecionar(container, "todos");
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ visao: "TODOS", responsavelId: null, setorId: null }));
    expect(container.querySelector(cardColega)).not.toBeNull();
    expect(container.querySelector('[aria-label="Abrir card de Responsável histórico"]')).not.toBeNull();
    expect(container.textContent).toContain("Somente leitura");
    await selecionar(container, "9");
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ visao: "TODOS", responsavelId: 9, setorId: null }));
    expect(container.querySelector('[aria-label="Abrir card de Empresa"]')).toBeNull();
    await act(async () => { container.querySelector<HTMLButtonElement>(cardColega)!.click(); });
    expect(container.textContent).toContain("Confirmar exclusão");
    await selecionar(container, "MEUS");
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ visao: "MEUS", responsavelId: null, setorId: null }));
    expect(container.querySelector(cardColega)).toBeNull();
    expect(container.textContent).not.toContain("Confirmar exclusão");
    vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto, cards: [], ids: [] } as never);
    await selecionar(container, "7");
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ visao: "TODOS", responsavelId: 7 }));
    expect(select.value).toBe("7"); expect(select.textContent).toContain("Usuária sem cards");
    expect(container.querySelector('[aria-label="Abrir card de Empresa"]')).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("opção removida na reconciliação fecha detalhes, limpa cards e retorna à consulta padrão", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();
  const { container, root, props } = montarBoard(); const manifesto = manifestoBoard(); props.manifestoInicial = manifesto;
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto, cards: [colega], ids: [colega.id] } as never);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await selecionar(container, "9");
    await act(async () => { container.querySelector<HTMLButtonElement>(cardColega)!.click(); });
    expect(container.textContent).toContain("Confirmar exclusão");
    const revogado = { ...manifesto, acesso: { ...manifesto.acesso, responsaveis: pessoas.filter((p) => p.id !== 9) } };
    vi.mocked(SincronizarQuadroBpm).mockResolvedValueOnce({ success: true, manifesto: revogado, cards: [colega], ids: [colega.id] } as never);
    vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto: revogado, cards: [card], ids: [card.id] } as never);
    await atualizar(container);
    expect(container.querySelector("select")?.value).toBe("MEUS");
    expect([...container.querySelector("select")!.options].map((o) => o.value)).not.toContain("9");
    expect(container.querySelector(cardColega)).toBeNull();
    expect(container.textContent).not.toContain("Confirmar exclusão");
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ visao: "MEUS", responsavelId: null }));
    expect(container.querySelector('[aria-label="Abrir card de Empresa"]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("revogação de acesso remove cards, opções e detalhes antes de reconsultar Meus", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();
  const { container, root, props } = montarBoard(); const manifesto = manifestoBoard(); props.manifestoInicial = manifesto;
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto, cards: [colega], ids: [colega.id] } as never);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await selecionar(container, "todos");
    await act(async () => { container.querySelector<HTMLButtonElement>(cardColega)!.click(); });
    vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: false, acessoNegado: true, visaoRevogada: true, error: "Acesso revogado" });
    await atualizar(container);
    expect(container.querySelector("select")?.value).toBe("MEUS");
    expect([...container.querySelector("select")!.options].map((o) => o.value)).toEqual(["MEUS", "todos"]);
    expect(container.querySelector(cardColega)).toBeNull(); expect(container.textContent).not.toContain("Confirmar exclusão");
    expect(container.textContent).toContain("Acesso revogado");
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ visao: "MEUS", responsavelId: null }));
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("ignora resposta de pessoa anterior após voltar ao padrão", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();
  const { container, root, props } = montarBoard(); const manifesto = manifestoBoard(); props.manifestoInicial = manifesto;
  type Resultado = Awaited<ReturnType<typeof SincronizarQuadroBpm>>;
  let concluir: ((result: Resultado) => void) | undefined;
  const pendente = new Promise<Resultado>((resolve) => { concluir = resolve; });
  vi.mocked(SincronizarQuadroBpm).mockReturnValueOnce(pendente);
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto, cards: [card], ids: [card.id] } as never);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await selecionar(container, "9");
    await selecionar(container, "MEUS");
    await act(async () => { concluir?.({ success: true, manifesto, cards: [colega], ids: [colega.id] } as never); });
    expect(container.querySelector("select")?.value).toBe("MEUS");
    expect(container.querySelector('[aria-label="Abrir card de Empresa"]')).not.toBeNull();
    expect(container.querySelector(cardColega)).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); }
});
