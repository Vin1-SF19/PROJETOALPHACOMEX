// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { KanbanCard, type CardBpm } from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
import { prepararLeadInstagram } from "@/lib/bpm/instagram-leads";

const drag = vi.hoisted(() => ({ current: null as null | import("react").ComponentProps<typeof import("@dnd-kit/core").DndContext> }));
vi.mock("@dnd-kit/core", async (original) => {
  const actual = await original<typeof import("@dnd-kit/core")>();
  return { ...actual, DndContext: (props: import("react").ComponentProps<typeof actual.DndContext>) => {
    drag.current = props;
    return h(actual.DndContext, props);
  } };
});
vi.mock("next/navigation", () => { const router = { refresh: vi.fn() }; return { useRouter: () => router }; });
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
  default: ({ cardId, onCardExcluido, realtimeRevision }: { cardId: string; onCardExcluido: (id: string) => void; realtimeRevision?: number }) =>
    h("button", { "data-modal-revision": realtimeRevision, onClick: () => onCardExcluido(cardId) }, "Confirmar exclusão"),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/AtribuirResponsavelPromocaoModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard", () => ({ GrupoAvataresMembrosCard: () => null }));
vi.mock("@/hooks/useLazyColumn", () => ({ useLazyColumn: () => [React.createRef(), true] }));

const card: CardBpm = {
  id: "card-teste", etapaId: "agendar", servico: "Revisão de Radar", status: "ATIVO", origem: "real", nolossLeadId: null,
  createdAt: "2026-10-21T12:00:00Z", primeiraVisualizacaoEm: "2026-10-21T12:00:00Z",
  empresa: { id: 1, razaoSocial: "Empresa de teste", nomeFantasia: null, cnpj: "11222333000181" },
  responsavel: { id: 1, nome: "Responsável" }, membros: [], _count: { tarefas: 0, anexos: 0 }, tarefas: [], podeAgirEtapa: true,
};
const mounts: { root: ReturnType<typeof createRoot>; container: HTMLDivElement }[] = [];
beforeEach(() => Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(async () => {
  for (const { root, container } of mounts.splice(0)) { await act(async () => root.unmount()); container.remove(); }
  vi.clearAllMocks();
});
async function montar(patch: Partial<CardBpm> = {}, etapaNome = "Agendar Reunião") {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); mounts.push({ root, container });
  const onAbrir = vi.fn(); const onAgendarReuniao = vi.fn();
  await act(async () => root.render(h(KanbanCard, { card: { ...card, ...patch }, etapaNome, accent: "37, 99, 235", novosLeads: false,
    arrastoDesabilitado: false, onAbrir, onAgendarReuniao })));
  return { container, onAbrir, onAgendarReuniao };
}
it("Agendar usa a mesma identidade de Reunião Agendada e mantém a ação isolada de abrir o card", async () => {
  const agendar = await montar(); const agendada = await montar({}, "Reunião Agendada");
  const seletor = 'button[aria-label="Abrir card de Empresa de teste"]';
  const identidade = agendar.container.querySelector<HTMLButtonElement>(seletor)!;
  expect(identidade.textContent).toBe("Empresa de teste");
  expect(identidade.className).toBe(agendada.container.querySelector(seletor)?.className);
  for (const item of [agendar, agendada]) {
    expect(item.container.textContent).toContain("11.222.333/0001-81");
    expect(item.container.textContent).toContain("Revisão de Radar");
    expect(item.container.textContent).toContain("Sem pendências");
  }
  const botao = agendar.container.querySelector<HTMLButtonElement>('button[aria-label="Agendar Google Meet para Empresa de teste"]')!;
  expect(botao).not.toBeNull();
  await act(async () => botao.click());
  expect(agendar.onAgendarReuniao).toHaveBeenCalledExactlyOnceWith("card-teste");
  expect(agendar.onAbrir).not.toHaveBeenCalled();
  expect(agendada.container.textContent).not.toContain("Agendar pelo Google Meet");
});
it("respeita a composição existente, mostra nome/CNPJ uma vez e preserva campos comerciais de Agendar", async () => {
  const { container } = await montar({
    cardViewComposicao: [{ kind: "NATIVE", key: "EMPRESA_NOME" }, { kind: "NATIVE", key: "CNPJ" }, { kind: "CAMPO", campoId: "radar" }],
    cardViewValores: { nativos: { EMPRESA_NOME: { status: "ok", valor: "Empresa de teste" }, CNPJ: { status: "ok", valor: "11.222.333/0001-81" } },
      campos: { radar: { status: "ok", valor: "Radar 150k" } }, camposLabel: { radar: "Radar pretendido" } },
  });
  expect(container.textContent?.match(/Empresa de teste/g)).toHaveLength(1);
  expect(container.textContent?.match(/11\.222\.333\/0001-81/g)).toHaveLength(1);
  expect(container.textContent).toContain("Radar 150k");
  expect(container.textContent).toContain("Data e hora");
  expect(container.textContent).not.toContain("Revisão de Radar"); // Serviço não selecionado na composição.
});
it("não inventa identidade quando a composição foi explicitamente esvaziada", async () => {
  const { container } = await montar({ cardViewComposicao: [] });
  expect(container.textContent).not.toContain("Empresa de teste");
  expect(container.textContent).toContain("Agendar pelo Google Meet");
});
it("abre Meet existente sem gerar outro agendamento e mantém a restrição da etapa seguinte", async () => {
  const { container, onAgendarReuniao } = await montar({ googleMeetLink: "https://meet.google.com/abc-defg-hij" });
  const link = container.querySelector<HTMLAnchorElement>('a[aria-label="Abrir Google Meet de Empresa de teste"]');
  expect(link?.href).toBe("https://meet.google.com/abc-defg-hij"); expect(link?.target).toBe("_blank");
  expect(container.textContent).not.toContain("Agendar pelo Google Meet"); expect(onAgendarReuniao).not.toHaveBeenCalled();
  const seguinte = await montar({ cardViewComposicao: [{ kind: "NATIVE", key: "AGENDAMENTO_REUNIAO" }] }, "Reunião Agendada");
  expect(seguinte.container.textContent).not.toContain("Agendar pelo Google Meet");
});
it("somente leitura não ganha ação de agendar ao compartilhar o corpo visual", async () => {
  const { container } = await montar({ podeAgirEtapa: false });
  expect(container.textContent).toContain("Somente leitura"); expect(container.textContent).toContain("Empresa de teste");
  expect(container.textContent).not.toContain("Agendar pelo Google Meet");
});
it.each([
  { origem: "Instagram", classe: "text-violet-200", patch: { campoValores: [{ campo: { nome: "Canal de origem" }, valor: "Instagram" }] } },
  { origem: "Site", classe: "text-sky-100", patch: { veioNoloss: true, campoValores: [{ campo: { nome: "Canal de origem" }, valor: "instagram" }] } },
  { origem: "Site", classe: "text-sky-100", patch: { campoValores: [{ campo: { nome: "Canal de origem" }, valor: "site" }] } },
])("origem $origem permanece no topo após assunção e mudança de etapa", async ({ origem, classe, patch }) => {
  for (const etapaNome of ["Agendar Reunião", "Reunião Agendada"]) {
    const { container } = await montar(patch, etapaNome);
    const badge = container.querySelector('[aria-label="Origem do lead"]')!;
    expect(badge.textContent).toBe("Origem do lead: " + origem);
    expect(badge.querySelector("span")?.className).toContain(classe);
    expect(badge.parentElement?.firstElementChild).toBe(badge);
  }
});
it("não atribui Instagram ou Site a um card sem informação de origem", async () => {
  const { container } = await montar(); expect(container.querySelector('[aria-label="Origem do lead"]')).toBeNull();
});
it("a captura original permanece visível no virtual e no nativo nas duas etapas", async () => {
  const captura = "2026-10-22T01:30:00Z";
  const instagramDados = prepararLeadInstagram({ id: "instagram-id", full_name: "Contato Instagram", created_time: captura });
  const virtual = await montar({ origem: "instagram", instagramDados });
  const agendar = await montar({ instagramCaptadoEm: captura });
  const agendada = await montar({ instagramCaptadoEm: captura }, "Reunião Agendada");
  for (const { container } of [virtual, agendar, agendada]) {
    expect(container.textContent).toContain("Preencheu formulário em: 21/10/2026");
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(captura);
    expect(container.textContent?.match(/Preencheu formulário em:/g)).toHaveLength(1);
  }
});
it.each([undefined, null, "inválida"])("não usa createdAt como captura quando a data original é %s", async (instagramCaptadoEm) => {
  const { container } = await montar({ instagramCaptadoEm });
  expect(container.textContent).not.toContain("Preencheu formulário em:");
});
