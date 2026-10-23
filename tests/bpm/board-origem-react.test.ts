// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import PipelineBoardClient from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";

const drag = vi.hoisted(() => ({ current: null as null | import("react").ComponentProps<typeof import("@dnd-kit/core").DndContext> }));
vi.mock("@/actions/bpm/NotificacoesLeads", () => ({ ObterLeadPendenteNotificacaoBpm: vi.fn() }));
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
vi.mock("@/actions/bpm/InstagramLeads", () => ({ AssumirLeadInstagram: vi.fn() }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal", () => ({
  default: ({ cardId, onCardExcluido }: { cardId: string; onCardExcluido: (id: string) => void }) =>
    h("button", { onClick: () => onCardExcluido(cardId) }, "Confirmar exclusão"),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/AtribuirResponsavelPromocaoModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard", () => ({ GrupoAvataresMembrosCard: () => null }));
vi.mock("@/hooks/useLazyColumn", () => ({ useLazyColumn: () => [React.createRef(), true] }));


import { selecionarPaginaQuadro, type ManifestoQuadro } from "@/lib/bpm/quadro-paginado";
import { TODAS_ORIGENS_QUADRO, valorSelectOrigemQuadro } from "@/lib/bpm/origem-quadro";

function textoOpcao(node: React.ReactNode): string {
  if (Array.isArray(node)) return node.map(textoOpcao).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textoOpcao(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) =>
    h("select", { value, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onValueChange(event.target.value) }, children),
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => h(React.Fragment, {}, children),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => h("option", { value }, textoOpcao(children)),
}));

type Card = ComponentProps<typeof PipelineBoardClient>["cardsIniciais"][number];
function card(id: string, origem: string | null, responsavelId = 1, nome = id): Card {
  return { id, etapaId: "etapa-1", servico: "Radar", status: "ATIVO", origem: "real", nolossLeadId: null,
    createdAt: "2026-10-23T10:00:00Z", empresa: { id: 1, razaoSocial: nome, nomeFantasia: null, cnpj: null },
    responsavel: { id: responsavelId, nome: responsavelId === 1 ? "Usuário" : "Colega" }, membros: [],
    _count: { tarefas: 0, anexos: 0 }, tarefas: [], podeAgirEtapa: true,
    campoValores: [{ valor: origem, campo: { nome: "Canal de origem" } }] };
}
function manifesto(cards: Card[], extra: ManifestoQuadro["entradas"] = []): ManifestoQuadro {
  return { configVersion: 1,
    acesso: { userId: 1, admin: true, setores: [], responsaveis: [{ id: 1, nome: "Usuário" }, { id: 9, nome: "Colega" }] },
    entradas: [...cards.map((item) => ({ id: item.id, etapaId: item.etapaId, revision: "v1", nome: item.empresa.razaoSocial,
      cnpj: item.empresa.cnpj, servico: item.servico, origem: item.campoValores?.[0].valor ?? null, responsaveis: [item.responsavel] })), ...extra] };
}
function montar(cards: Card[], snapshot: ManifestoQuadro) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const props: ComponentProps<typeof PipelineBoardClient> = {
    pipeline: { id: "pipeline-1", nome: "Funil", etapas: [{ id: "etapa-1", nome: "Em andamento", ordem: 0 }] },
    cardsIniciais: cards, manifestoInicial: snapshot, visual: { accent: "1,2,3" } as ComponentProps<typeof PipelineBoardClient>["visual"],
    currentUserId: 1, currentUserRole: "Admin",
  };
  return { container, root, props };
}
function origemSelect(container: HTMLElement) {
  const result = [...container.querySelectorAll("select")].find((item) => [...item.options].some((option) => option.value === TODAS_ORIGENS_QUADRO));
  if (!result) throw new Error("Filtro de origem ausente"); return result;
}
function responsavelSelect(container: HTMLElement) {
  const result = [...container.querySelectorAll("select")].find((item) => [...item.options].some((option) => option.value === "MEUS"));
  if (!result) throw new Error("Filtro de responsáveis ausente"); return result;
}
function avisosStatus(container: HTMLElement) {
  return [...container.querySelectorAll('[role="status"]')].map((item) => item.textContent?.trim()).filter(Boolean);
}
async function escolher(select: HTMLSelectElement, value: string) {
  await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}
async function buscar(container: HTMLElement, value: string) {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}
beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("alpha-pipeline-column") ? 800 : 240; });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(260);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.clearAllMocks(); });

it("mostra origens fora da página carregada e transporta a seleção para hidratar o card correto", async () => {
  const cards = [card("carregado", "Site")];
  const distante = card("fora-da-primeira-pagina", "Callix", 1, "Lead Callix distante");
  const snapshot = manifesto(cards, manifesto([distante]).entradas);
  vi.mocked(SincronizarQuadroBpm).mockImplementation(async (_id, filtros) => {
    if (typeof filtros !== "object" || filtros === null || Array.isArray(filtros)) throw new Error("Filtros do quadro devem ser um objeto");
    const ids = selecionarPaginaQuadro(snapshot.entradas, { ...filtros, acesso: snapshot.acesso }).ids;
    return { success: true, manifesto: snapshot, ids, cards: [...cards, distante].filter((item) => ids.includes(item.id)) } as never;
  });
  const { container, root, props } = montar(cards, snapshot);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    const select = origemSelect(container);
    expect([...select.options].map((item) => item.textContent)).toEqual(["Todas as origens", "Callix", "Site"]);
    expect(select.textContent).not.toContain("China");
    const search = container.querySelector('input[type="search"]')!;
    expect(search.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(select.compareDocumentPosition(responsavelSelect(container)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(search.parentElement?.className).toContain("sm:w-[320px]");
    expect(search.parentElement?.className).toContain("lg:w-[360px]");
    await escolher(select, valorSelectOrigemQuadro("Callix"));
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ origem: "Callix", limites: {} }));
    expect(container.querySelector('[aria-label="Abrir card de carregado"]')).toBeNull();
    expect(container.querySelector('[aria-label="Abrir card de Lead Callix distante"]')).not.toBeNull();
    expect([...select.options].map((item) => item.textContent)).toEqual(["Todas as origens", "Callix", "Site"]);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("combina origem com busca e responsável sem diminuir o catálogo ao filtro atual", async () => {
  const cards = [card("meu", "Instagram", 1, "Alvo próprio"), card("colega", "Instagram", 9, "Alvo colega"), card("site", "Site", 9, "Alvo site")];
  const snapshot = manifesto(cards);
  vi.mocked(SincronizarQuadroBpm).mockImplementation(async (_id, filtros) => {
    if (typeof filtros !== "object" || filtros === null || Array.isArray(filtros)) throw new Error("Filtros do quadro devem ser um objeto");
    const ids = selecionarPaginaQuadro(snapshot.entradas, { ...filtros, acesso: snapshot.acesso }).ids;
    return { success: true, manifesto: snapshot, ids, cards: cards.filter((item) => ids.includes(item.id)) } as never;
  });
  const { container, root, props } = montar(cards, snapshot);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await escolher(origemSelect(container), valorSelectOrigemQuadro("Instagram"));
    await escolher(responsavelSelect(container), "9");
    await buscar(container, "colega");
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ origem: "Instagram", responsavelId: 9, busca: "colega" }));
    expect(container.querySelector('[aria-label="Abrir card de Alvo colega"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Abrir card de Alvo site"]')).toBeNull();
    expect(container.querySelector('[aria-label="Abrir card de Alvo próprio"]')).toBeNull();
    expect([...origemSelect(container).options].map((item) => item.textContent)).toEqual(["Todas as origens", "Instagram", "Site"]);
    await escolher(origemSelect(container), TODAS_ORIGENS_QUADRO);
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ origem: undefined, responsavelId: 9, busca: "colega" }));
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("recupera Todas quando a origem desaparece no polling e rejeita resposta antiga de filtro", async () => {
  const insta = card("insta", "Instagram"), site = card("site", "Site"); const snapshot = manifesto([insta, site]);
  let current = snapshot;
  vi.mocked(SincronizarQuadroBpm).mockImplementation(async (_id, filtros) => {
    if (typeof filtros !== "object" || filtros === null || Array.isArray(filtros)) throw new Error("Filtros do quadro devem ser um objeto");
    const ids = selecionarPaginaQuadro(current.entradas, { ...filtros, acesso: current.acesso }).ids;
    return { success: true, manifesto: current, ids, cards: [insta, site].filter((item) => ids.includes(item.id)) } as never;
  });
  const { container, root, props } = montar([insta, site], snapshot);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await escolher(origemSelect(container), valorSelectOrigemQuadro("Instagram"));
    current = manifesto([site]);
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Atualizar pipeline"]')!.click(); });
    expect(origemSelect(container).value).toBe(TODAS_ORIGENS_QUADRO);
    expect(origemSelect(container).textContent).not.toContain("Instagram");
    expect(container.querySelector('[aria-label="Abrir card de site"]')).not.toBeNull();
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ origem: undefined, limites: {} }));
    type Resultado = Awaited<ReturnType<typeof SincronizarQuadroBpm>>;
    let resolve!: (result: Resultado) => void;
    vi.mocked(SincronizarQuadroBpm).mockImplementationOnce(() => new Promise<Resultado>((done) => { resolve = done; }));
    await escolher(origemSelect(container), valorSelectOrigemQuadro("Site"));
    await escolher(origemSelect(container), TODAS_ORIGENS_QUADRO);
    await act(async () => { resolve({ success: true, manifesto: snapshot, ids: [insta.id], cards: [insta] } as never); });
    expect(origemSelect(container).value).toBe(TODAS_ORIGENS_QUADRO);
    expect(container.querySelector('[aria-label="Abrir card de insta"]')).toBeNull();
    expect(origemSelect(container).textContent).not.toContain("Instagram");
  } finally { await act(async () => root.unmount()); container.remove(); }
});


it.each([false, true])("distingue quadro vazio de erro com ausência de etapas = %s", async (semEtapas) => {
  const { container, root, props } = montar([], manifesto([]));
  if (semEtapas) props.pipeline.etapas = [];
  const mensagem = semEtapas
    ? "Nenhuma etapa configurada neste pipeline. Configure a primeira etapa para começar."
    : "Nenhum card neste pipeline. Crie um card na etapa inicial para começar.";
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    expect(avisosStatus(container)).toEqual([mensagem]);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: false, error: "Falha de sincronização de teste", acessoNegado: false });
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Atualizar pipeline"]')!.click(); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Falha de sincronização de teste");
    expect(avisosStatus(container)).toEqual([]);
    expect(container.textContent).not.toContain(mensagem);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("remove o último card localmente e apresenta o pipeline vazio sem depender do Pusher", async () => {
  const ultimo = card("ultimo", "Site", 1, "Último card");
  const { container, root, props } = montar([ultimo], manifesto([ultimo]));
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    expect(avisosStatus(container)).toEqual([]);
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Abrir card de Último card"]')!.click(); });
    await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirmar exclusão")!.click(); });
    expect(container.querySelector('[aria-label="Abrir card de Último card"]')).toBeNull();
    expect(avisosStatus(container)).toEqual(["Nenhum card neste pipeline. Crie um card na etapa inicial para começar."]);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(SincronizarQuadroBpm).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("explica que a busca não encontrou cards sem apresentar o pipeline como vazio", async () => {
  const cards = [card("existente", "Site", 1, "Empresa existente")], snapshot = manifesto(cards);
  vi.mocked(SincronizarQuadroBpm).mockImplementation(async (_id, filtros) => {
    if (typeof filtros !== "object" || filtros === null || Array.isArray(filtros)) throw new Error("Filtros do quadro devem ser um objeto");
    const ids = selecionarPaginaQuadro(snapshot.entradas, { ...filtros, acesso: snapshot.acesso }).ids;
    return { success: true, manifesto: snapshot, ids, cards: cards.filter((item) => ids.includes(item.id)) } as never;
  });
  const { container, root, props } = montar(cards, snapshot);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await buscar(container, "sem correspondência");
    expect(avisosStatus(container)).toEqual(["Nenhum card corresponde aos filtros selecionados."]);
    expect(container.textContent).not.toContain("Nenhum card neste pipeline.");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await buscar(container, "");
    expect(avisosStatus(container)).toEqual([]);
    expect(container.querySelector('[aria-label="Abrir card de Empresa existente"]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); }
});
