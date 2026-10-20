// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSaveProvider } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { AtualizarCardBpm } from "@/actions/bpm/Cards";

vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("@/actions/parceiros", () => ({ listarParceirosSimples: vi.fn().mockResolvedValue([
  { id: 10, nome: "Parceiro antigo", nomeFantasia: null, nivel: "OURO", representantes: [] },
  { id: 42, nome: "Parceiro novo", nomeFantasia: null, nivel: "OURO", representantes: [] },
]) }));
// Pesquisa/normalização têm cobertura própria no teste do seletor compartilhado.
vi.mock("@/components/comercial/SeletorParceiroPesquisavel", () => ({ SeletorParceiroPesquisavel: (props: {
  parceiros: { id: number; nome: string }[]; value: number | null; onChange: (id: number | null) => void; disabled: boolean;
}) => h("select", { "aria-label": "Parceiro", value: props.value ?? "", disabled: props.disabled,
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => props.onChange(Number(event.target.value) || null) },
  h("option", { value: "" }, "Selecione"), ...props.parceiros.map((p) => h("option", { key: p.id, value: p.id }, p.nome))) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));

let root: Root;
let container: HTMLDivElement;
const campo = { id: "origem", nome: "Origem do cliente", tipo: "selecao", valor: "Indicação Parceiro", parceiroOrigemId: 10,
  editavel: true, obrigatorio: false, pipelineId: "pipeline", etapaId: "etapa", ordem: 0, opcoesJson: '["Direto","Parceiro","Outro"]' };
const card = { id: "card", updatedAt: "2026-10-20T10:00:00Z", etapa: { id: "etapa", nome: "Etapa", chave: "etapa" },
  camposEtapa: [campo] } as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];
async function render(podeEditar = true) {
  await act(async () => root.render(h(CardSaveProvider, null, h(PainelCamposEtapaAtual, {
    card, campoIds: [campo.id], instanceKey: "form", accent: "1,2,3", podeEditar, realtimeRevision: 0, onAtualizado: vi.fn(),
  }))));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
}
async function selecionar(selector: string, value: string) {
  await act(async () => { const select = container.querySelector<HTMLSelectElement>(selector)!;
    select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
function salvar() { return [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Salvar alterações"))!; }
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  vi.mocked(AtualizarCardBpm).mockImplementation(async (dados) => ({ success: true, data: {
    updatedAt: new Date("2026-10-20T10:01:00Z"), camposValores: (dados as { camposValores: Record<string, string> }).camposValores,
  } }));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it("hidrata parceiro sem marcar alteração e salva troca somente do parceiro no mesmo payload", async () => {
  await render();
  expect(container.querySelector<HTMLSelectElement>('[aria-label="Parceiro"]')?.value).toBe("10");
  expect(salvar().disabled).toBe(true);
  await selecionar('[aria-label="Parceiro"]', "42");
  expect(AtualizarCardBpm).not.toHaveBeenCalled();
  await act(async () => salvar().click());
  expect(AtualizarCardBpm).toHaveBeenCalledWith(expect.objectContaining({ camposValores: { origem: "Indicação Parceiro" },
    parceiroOrigem: { campoId: "origem", parceiroId: 42 } }));
  expect(salvar().disabled).toBe(true);
  expect(container.querySelector<HTMLSelectElement>('[aria-label="Parceiro"]')?.value).toBe("42");
});
it("trocar origem oculta seletor e envia remoção do vínculo; voltar exige nova seleção", async () => {
  await render(); await selecionar("#campo-bpm-origem", "Evento");
  expect(container.querySelector('[aria-label="Parceiro"]')).toBeNull();
  await act(async () => salvar().click());
  expect(AtualizarCardBpm).toHaveBeenCalledWith(expect.objectContaining({ camposValores: { origem: "Evento" }, parceiroOrigem: { campoId: "origem", parceiroId: null } }));
  await selecionar("#campo-bpm-origem", "Indicação Parceiro");
  await act(async () => salvar().click());
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("Selecione o parceiro que indicou");
});
it("bloqueia origem e parceiro quando usuário não pode editar", async () => {
  await render(false);
  expect(container.querySelector<HTMLSelectElement>("#campo-bpm-origem")?.disabled).toBe(true);
  expect(container.querySelector<HTMLSelectElement>('[aria-label="Parceiro"]')?.disabled).toBe(true);
});
