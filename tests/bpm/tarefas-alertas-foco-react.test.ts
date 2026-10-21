// @vitest-environment happy-dom
import React, { act, createElement as h, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listarChecklists = vi.hoisted(() => vi.fn());
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelEncaminhamentos", () => ({ PainelEncaminhamentos: () => null }));
vi.mock("@/actions/bpm/Checklists", () => ({ ListarChecklistsCardBpm: listarChecklists }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn(), ExcluirCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/Tarefas", () => ({ ConcluirTarefaBpm: vi.fn(), CriarTarefaBpm: vi.fn() }));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn(), ExcluirAnexoBpm: vi.fn() }));
vi.mock("@/actions/bpm/Interacoes", () => ({ ListarInteracoesCardBpm: vi.fn() }));
vi.mock("@/components/bpm/anexos/VisualizadorAnexoCard", () => ({ VisualizadorAnexoCard: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelTimelineCard", () => ({ default: () => null }));
vi.mock("@/actions/bpm/Pipelines", () => ({ ListarPipelinesBpm: async () => ({ success: true, data: [{ id: "outro", nome: "Outro funil" }] }) }));
vi.mock("@/components/PerfilEmpresaGlobal", () => ({ usePerfilEmpresa: () => ({ openPerfilEmpresa: vi.fn() }) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaDrawer", async () => {
  const ReactModule = await import("react");
  return {
    DadosEmpresaDrawer: () => ReactModule.createElement("div", { "data-dados-empresa": true }),
    DadosEmpresaToggle: ({ onToggle }: { onToggle: () => void }) => ReactModule.createElement("button", { onClick: onToggle }, "Dados da empresa"),
    useDadosEmpresaDrawer: () => {
      const [aberto, setAberto] = ReactModule.useState(false);
      return { aberto, alternar: () => setAberto((valor) => !valor), fechar: () => setAberto(false) };
    },
  };
});
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/TelefonesCardButton", () => ({ TelefonesCardButton: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard", () => ({ SeletorMembrosCard: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/ChatClienteCard", () => ({ ChatClienteCard: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelSlaCard", () => ({ PainelSlaCard: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoPipeline", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelResumoEtapas", () => ({ PainelResumoEtapas: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/EditorAnotacaoCard", () => ({ EditorAnotacaoCard: () => null }));
vi.mock("@/components/bpm/cadencias/PainelCadenciasCard", () => ({ PainelCadenciasCard: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoRd", () => ({
  default: () => null, EstadoHistoricoRd: () => null, EventoHistoricoRdItem: () => null,
  useHistoricoRd: () => ({ eventos: [], recarregar: vi.fn() }),
}));
import { CardAbertoLayout } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout";

const tarefa = { id: "task-1", tipo: "TAREFA", titulo: "Retornar contato", status: "PENDENTE", prioridade: "NORMAL", cardChecklistId: null as string | null };
const card = {
  id: "card-1", pipelineId: "pipeline-1", etapaId: "etapa-1", pipeline: { id: "pipeline-1", nome: "Comercial" },
  etapa: { id: "etapa-1", nome: "Em tratativa" }, empresa: { id: 1, razaoSocial: "Empresa de teste", cnpj: null },
  responsavel: { id: 7, nome: "Responsável" }, membros: [], tarefas: [tarefa], historico: [], campoValores: [], anexos: [],
};
const props = {
  card, etapas: [], interacoes: [], accent: "1,2,3", currentUserId: 7, currentUserRole: "ADMIN", realtimeRevision: 0,
  onClose: vi.fn(), onAtualizado: vi.fn(), onAbrirCard: vi.fn(), onInteracaoCriada: vi.fn(), children: null,
} as unknown as ComponentProps<typeof CardAbertoLayout>;

describe("destino visível de uma tarefa no card real", () => {
  let root: Root; let host: HTMLDivElement;
  beforeEach(() => {
    vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
    listarChecklists.mockResolvedValue({ success: true, data: [] });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  async function render(focoTarefa: { cardId: string; tarefaId: string } | null, cardAtual = card) {
    await act(async () => root.render(h(CardAbertoLayout, { ...props, card: cardAtual as unknown as typeof props.card, focoTarefa })));
  }
  async function escolherAba(texto: string) {
    const aba = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((elemento) => elemento.textContent?.trim() === texto)!;
    await act(async () => aba.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })));
  }
  it("abre Tarefas, foca a tarefa certa e volta do histórico de outro funil ao clicar novamente", async () => {
    await render({ cardId: card.id, tarefaId: tarefa.id });
    expect(document.activeElement?.id).toBe("bpm-tarefa-card-1-task-1");
    await escolherAba("Outro funil");
    expect(host.querySelector("#bpm-tarefa-card-1-task-1")).toBeNull();
    await render({ cardId: card.id, tarefaId: tarefa.id });
    expect(document.activeElement?.id).toBe("bpm-tarefa-card-1-task-1");
    expect(host.querySelector('[role="tab"][data-state="active"]')?.textContent).toBe("Comercial");
  });
  it("espera o procedimento carregar e foca o checklist vinculado à tarefa", async () => {
    let resolver!: (value: unknown) => void;
    listarChecklists.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    const cardChecklist = { ...card, tarefas: [{ ...tarefa, id: "task-procedimento", cardChecklistId: "checklist-1" }] };
    await render({ cardId: card.id, tarefaId: "task-procedimento" }, cardChecklist as typeof card);
    expect(host.querySelector('[role="tab"][data-state="active"][id*="checklist"]')).toBeTruthy();
    await act(async () => {
      resolver({ success: true, data: [{ id: "checklist-1", templateNome: "Procedimento teste", itens: [] }] });
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(document.activeElement?.id).toBe("bpm-checklist-card-1-checklist-1");
  });
  it("retorna à tarefa se Dados da empresa estiver aberto, permitindo abrir os dados depois", async () => {
    await render({ cardId: card.id, tarefaId: tarefa.id });
    const toggle = () => [...host.querySelectorAll<HTMLButtonElement>("button")].find((elemento) => elemento.textContent === "Dados da empresa")!;
    await act(async () => toggle().click());
    expect(host.querySelector("[data-dados-empresa]")).toBeTruthy();
    await render({ cardId: card.id, tarefaId: tarefa.id });
    expect(host.querySelector("[data-dados-empresa]")).toBeNull();
    expect(document.activeElement?.id).toBe("bpm-tarefa-card-1-task-1");
    await act(async () => toggle().click());
    expect(host.querySelector("[data-dados-empresa]")).toBeTruthy();
  });
});
