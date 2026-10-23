// @vitest-environment happy-dom
import React, { act, createElement as h, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { AtualizarCardBpm } from "@/actions/bpm/Cards";
import { CHAVE_CONDICAO_NEGOCIADA, CHAVE_TARIFARIO_PADRAO } from "@/lib/bpm/card-modal-ui";
vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));
const TARIFA = "cmutesttarifario0000000001";
const condicao = JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: TARIFA }, operador: "igual", valor: "Não" }] });
const campos = [
  { id: TARIFA, chave: CHAVE_TARIFARIO_PADRAO, nome: "Tarifário padrão?", tipo: "selecao", opcoesJson: '["Sim","Não"]', valor: "" },
  { id: "condicao", chave: CHAVE_CONDICAO_NEGOCIADA, nome: "Condição negociada", tipo: "texto", opcoesJson: null, valor: "", condicaoVisibilidadeJson: condicao },
  { id: "razao", chave: "alpha.razao.social", nome: "Razão social", tipo: "texto", valor: "Nome antigo", escopo: "GLOBAL", fonteEntidade: "CLIENTE" },
  { id: "obs", chave: "observacao", nome: "Observação", tipo: "texto", valor: "" },
].map(c => ({ obrigatorio: false, ordem: 0, pipelineId: "pipeline", etapaId: "etapa", editavel: true, ...c }));
type Card = React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];
const fixture = { id: "card", updatedAt: "2026-10-23T10:00:00Z", pipeline: { chave: "comercial" }, etapa: { id: "etapa", nome: "Em tratativa", chave: null }, camposEtapa: campos } as unknown as Card;
let root: Root, container: HTMLDivElement, ctx: ReturnType<typeof useCardSave>;
function Probe() { const context = useCardSave(); useEffect(() => { ctx = context; }, [context]); return null; }
async function montar(card = fixture, ids = card.camposEtapa.map(c => c.id)) {
  await act(async () => root.render(h(CardSaveProvider, null, h(Probe), h(PainelCamposEtapaAtual,
    { card, campoIds: ids, instanceKey: "form", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn() }))));
  await act(async () => { await new Promise(r => setTimeout(r, 5)); });
}
async function editar(id: string, value: string) {
  await act(async () => {
    const element = container.querySelector<HTMLInputElement | HTMLSelectElement>(`#campo-bpm-${id}`)!;
    const proto = element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}
beforeEach(() => { vi.resetAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it("alterna imediatamente vazio/Não/Sim sem salvar nem perder texto oculto", async () => {
  await montar(); expect(container.querySelector("#campo-bpm-condicao")).toBeNull();
  await editar(TARIFA, "Não"); await editar("condicao", "Texto manual preservado");
  await editar(TARIFA, "Sim"); expect(container.querySelector("#campo-bpm-condicao")).toBeNull();
  expect(ctx.getPendingFields("card")).toContain("Condição negociada");
  await editar(TARIFA, "Não"); expect(container.querySelector<HTMLInputElement>("#campo-bpm-condicao")?.value).toBe("Texto manual preservado");
  await editar(TARIFA, ""); expect(container.querySelector("#campo-bpm-condicao")).toBeNull();
  expect(AtualizarCardBpm).not.toHaveBeenCalled();
});
it("envia tarifário e condição alterados em uma única gravação", async () => {
  await montar(); await editar(TARIFA, "Não"); await editar("condicao", "Acordo manual");
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true, data: { updatedAt: new Date("2026-10-23T10:01:00Z"), camposValores: { [TARIFA]: "Não", condicao: "Acordo manual" } } });
  await act(async () => { const save = [...container.querySelectorAll("button")].find(b => b.textContent?.includes("Salvar alterações"))!; save.click(); });
  expect(AtualizarCardBpm).toHaveBeenCalledOnce();
  expect(AtualizarCardBpm).toHaveBeenCalledWith(expect.objectContaining({ camposValores: { [TARIFA]: "Não", condicao: "Acordo manual" } }));
  expect(ctx.getPendingFields("card")).toEqual([]);
});
it("retira parceiro automático somente no contexto com seletor de origem e deixa cadastro editável", async () => {
  const origem = { ...campos[3], id: "origem", chave: "alpha.canal.origem.do.cliente", nome: "Origem do cliente" };
  const parceiro = { ...campos[2], id: "parceiro", chave: "alpha.radar.contrato.parceiro_responsavel", nome: "Parceiro responsável", fonteEntidade: "PARCEIRO", editavel: false };
  await montar({ ...fixture, camposEtapa: [...campos, origem, parceiro] } as Card);
  expect(container.textContent).not.toContain("Parceiro responsável");
  expect(container.textContent).not.toContain("Razão social · automático");
  await editar("razao", "Nome manual"); expect(ctx.getPendingFields("card")).toContain("Razão social");
  await montar({ ...fixture, camposEtapa: [...campos, parceiro] } as Card);
  expect(container.textContent).toContain("Parceiro responsável");
});
it("recebe novo cadastro com a mesma versão de card mantendo outro rascunho humano", async () => {
  await montar(); await editar("obs", "Rascunho humano");
  await montar({ ...fixture, camposEtapa: campos.map(c => c.id === "razao" ? { ...c, valor: "Nome cadastral atualizado" } : c) } as Card);
  expect(container.querySelector<HTMLInputElement>("#campo-bpm-razao")?.value).toBe("Nome cadastral atualizado");
  expect(container.querySelector<HTMLInputElement>("#campo-bpm-obs")?.value).toBe("Rascunho humano");
  expect(ctx.getPendingFields("card")).toEqual(["Observação"]);
});
it("usa controlador autorizado do card quando o campo está em outra instância", async () => {
  await montar({ ...fixture, camposEtapa: campos.map(c => c.id === TARIFA ? { ...c, valor: "Não" } : c) } as Card, ["condicao"]);
  expect(container.querySelector("#campo-bpm-condicao")).not.toBeNull();
});
