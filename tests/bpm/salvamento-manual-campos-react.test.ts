// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
import { toast } from "sonner";

vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));

const campos = ["primeiro", "segundo", "terceiro", "quarto"].map((id) => ({
  id, nome: id, tipo: "texto", valor: "", editavel: true, obrigatorio: false,
  pipelineId: "pipeline", etapaId: "etapa", ordem: 0, opcoesJson: null,
}));
const card = { id: "card", updatedAt: "2026-09-29T10:00:00Z", etapa: { id: "etapa", nome: "Confirmação de Pagamento", chave: "confirmacao_pagamento" }, camposEtapa: campos } as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];
let root: Root;
let container: HTMLDivElement;
let context: ReturnType<typeof useCardSave>;
function Probe() { const value = useCardSave(); React.useEffect(() => { context = value; }, [value]); return null; }
async function editar(id: string, valor: string) {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>(`#campo-bpm-${id}`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}
function botaoSalvar() { return [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Salvar alterações") || button.textContent?.includes("Salvando "))!; }

beforeEach(async () => {
  vi.resetAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: card } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await act(async () => root.render(h(CardSaveProvider, null, h(Probe), h(PainelCamposEtapaAtual, {
    card, campoIds: campos.map((campo) => campo.id), instanceKey: "form", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn(),
  }))));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it("não grava ao digitar, selecionar ou sair do campo; conta só os dois campos alterados", async () => {
  await editar("primeiro", "A");
  await editar("terceiro", "C");
  expect(AtualizarCardBpm).not.toHaveBeenCalled();
  expect(botaoSalvar().textContent).toContain("Salvar alterações (2)");
  expect(context.getPendingFields("card")).toEqual(["primeiro", "terceiro"]);
});

it("grava um campo por vez e mostra 1/2, 2/2 até confirmar", async () => {
  let resolverPrimeiro!: (value: Awaited<ReturnType<typeof AtualizarCardBpm>>) => void;
  let resolverSegundo!: (value: Awaited<ReturnType<typeof AtualizarCardBpm>>) => void;
  vi.mocked(AtualizarCardBpm)
    .mockImplementationOnce(() => new Promise((resolve) => { resolverPrimeiro = resolve; }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolverSegundo = resolve; }));
  await editar("primeiro", "A"); await editar("terceiro", "C");
  await act(async () => { botaoSalvar().click(); await Promise.resolve(); });
  expect(botaoSalvar().textContent).toContain("Salvando 1/2");
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(1);
  expect(AtualizarCardBpm).toHaveBeenNthCalledWith(1, expect.objectContaining({ camposValores: { primeiro: "A" } }));
  await act(async () => { resolverPrimeiro({ success: true, data: { updatedAt: new Date("2026-09-29T10:01:00Z"), camposValores: { primeiro: "A" } } }); await Promise.resolve(); });
  expect(botaoSalvar().textContent).toContain("Salvando 2/2");
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(2);
  expect(AtualizarCardBpm).toHaveBeenNthCalledWith(2, expect.objectContaining({ camposValores: { terceiro: "C" }, versaoEsperadaEm: "2026-09-29T10:01:00.000Z" }));
  await act(async () => { resolverSegundo({ success: true, data: { updatedAt: new Date("2026-09-29T10:02:00Z"), camposValores: { terceiro: "C" } } }); await Promise.resolve(); });
  expect(context.getPendingFields("card")).toEqual([]);
  expect(botaoSalvar().hasAttribute("disabled")).toBe(true);
});

it("para na falha, preserva os campos restantes e permite tentar de novo", async () => {
  vi.mocked(AtualizarCardBpm)
    .mockResolvedValueOnce({ success: false, error: "Falha de validação" })
    .mockResolvedValueOnce({ success: true, data: { updatedAt: new Date("2026-09-29T10:01:00Z"), camposValores: { primeiro: "A" } } })
    .mockResolvedValueOnce({ success: true, data: { updatedAt: new Date("2026-09-29T10:02:00Z"), camposValores: { terceiro: "C" } } });
  await editar("primeiro", "A"); await editar("terceiro", "C");
  await act(async () => { botaoSalvar().click(); });
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(1);
  expect(context.getPendingFields("card")).toEqual(["primeiro", "terceiro"]);
  expect(toast.error).toHaveBeenCalledTimes(1);
  await act(async () => { botaoSalvar().click(); });
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(3);
  expect(context.getPendingFields("card")).toEqual([]);
});

it("o comando de salvar do diálogo de saída usa o mesmo fluxo manual", async () => {
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true, data: { updatedAt: new Date("2026-09-29T10:01:00Z"), camposValores: { primeiro: "A" } } });
  await editar("primeiro", "A");
  expect(await context.flushSaves("card")).toBe(false);
  await act(async () => { expect(await context.retryFailedSaves("card")).toBe(true); });
  expect(AtualizarCardBpm).toHaveBeenCalledOnce();
  expect(context.getPendingFields("card")).toEqual([]);
});

const camposPagamento = [
  { id: "pagamento_confirmado", nome: "Pagamento confirmado", chave: "alpha.pagamento.confirmado", tipo: "selecao", opcoesJson: JSON.stringify(["Sim", "Não"]) },
  { id: "data_pagamento", nome: "Data do pagamento", chave: "alpha.data.do.pagamento", tipo: "data_hora", opcoesJson: null },
  { id: "valor_recebido", nome: "Valor recebido", chave: "alpha.valor.recebido", tipo: "moeda", opcoesJson: null },
  { id: "forma_utilizada", nome: "Forma de pagamento utilizada", chave: "alpha.financeiro.forma.pagamento.utilizada", tipo: "selecao", opcoesJson: JSON.stringify(["Pix", "Cartão de crédito"]) },
  { id: "pagamento_exito", nome: "Pagamento no êxito", chave: "alpha.pagamento.no.exito", tipo: "selecao", opcoesJson: JSON.stringify(["Sim", "Não"]) },
  { id: "status_financeiro", nome: "Status financeiro", chave: "alpha.status.financeiro", tipo: "selecao", opcoesJson: JSON.stringify(["Aguardando pagamento", "PAGAMENTO CONCLUÍDO"]), editavel: false, somenteLeitura: true },
  { id: "status_contratacao", nome: "Status da contratação", chave: "alpha.financeiro.status.contratacao", tipo: "selecao", opcoesJson: JSON.stringify(["Aguardando pagamento", "Contratação concluída"]), editavel: false, somenteLeitura: true },
].map((campo) => ({ valor: "", editavel: true, obrigatorio: false, pipelineId: "financeiro", etapaId: "etapa", ordem: 0, ...campo }));
const cardPagamento = { id: "card-pagamento", updatedAt: "2026-09-29T10:00:00Z",
  pipelineId: "cmuih4i54000209gmmyqrg557", pipeline: { chave: null }, etapa: { id: "etapa", nome: "Confirmação de Pagamento", chave: "confirmacao_pagamento" },
  camposEtapa: camposPagamento,
} as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];

async function montarPagamento() {
  await act(async () => root.unmount());
  root = createRoot(container);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: cardPagamento } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await act(async () => root.render(h(CardSaveProvider, null, h(Probe), h(PainelCamposEtapaAtual, {
    card: cardPagamento, campoIds: camposPagamento.map((campo) => campo.id), instanceKey: "pagamento",
    accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn(),
  }))));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
}

async function selecionar(id: string, valor: string) {
  await act(async () => {
    const input = container.querySelector<HTMLSelectElement>(`#campo-bpm-${id}`)!;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(input, valor);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function preencherPagamento() {
  await selecionar("pagamento_confirmado", "Sim");
  await editar("data_pagamento", "2026-09-29T18:00");
  await editar("valor_recebido", "22000");
  await selecionar("forma_utilizada", "Cartão de crédito");
  await selecionar("pagamento_exito", "Sim");
}

it("envia os cinco campos dependentes em um único salvamento e aguarda confirmação para concluir", async () => {
  await montarPagamento();
  let confirmar!: (value: Awaited<ReturnType<typeof AtualizarCardBpm>>) => void;
  vi.mocked(AtualizarCardBpm).mockImplementationOnce(() => new Promise((resolve) => { confirmar = resolve; }));
  await preencherPagamento();
  expect(botaoSalvar().textContent).toContain("Salvar alterações (5)");
  await act(async () => { botaoSalvar().click(); await Promise.resolve(); });
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(1);
  expect(AtualizarCardBpm).toHaveBeenCalledWith(expect.objectContaining({
    cardId: "card-pagamento", camposValores: {
      pagamento_confirmado: "Sim", data_pagamento: "2026-09-29T18:00:00.000Z",
      valor_recebido: "22000", forma_utilizada: "Cartão de crédito", pagamento_exito: "Sim",
    },
  }));
  expect(botaoSalvar().textContent).toContain("Salvando 1/5");
  expect(context.getPendingFields("card-pagamento")).toHaveLength(5);
  await act(async () => { confirmar({ success: true, data: {
    updatedAt: new Date("2026-09-29T10:01:00Z"), camposValores: {
      pagamento_confirmado: "Sim", data_pagamento: "2026-09-29T18:00:00.000Z",
      valor_recebido: "22000", forma_utilizada: "Cartão de crédito", pagamento_exito: "Sim",
    },
  } }); await Promise.resolve(); });
  expect(context.getPendingFields("card-pagamento")).toEqual([]);
  expect(botaoSalvar().hasAttribute("disabled")).toBe(true);
  expect(container.querySelector("#campo-bpm-status_financeiro")?.tagName).toBe("OUTPUT");
  expect(container.querySelector("#campo-bpm-status_contratacao")?.tagName).toBe("OUTPUT");
});

it("em falha de validação do pagamento mantém os cinco valores e mostra a pendência real", async () => {
  await montarPagamento();
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: false, error: "Valor esperado divergente do valor líquido calculado" });
  await preencherPagamento();
  await act(async () => { botaoSalvar().click(); });
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(1);
  expect(context.getPendingFields("card-pagamento")).toHaveLength(5);
  expect(container.textContent).toContain("Valor esperado divergente do valor líquido calculado");
  expect(container.querySelector<HTMLInputElement>("#campo-bpm-valor_recebido")?.value).toBe("22000");
  expect(botaoSalvar().textContent).toContain("Salvar alterações (5)");
});

it("descarta retry antigo após editar o lote financeiro que falhou", async () => {
  await montarPagamento();
  vi.mocked(AtualizarCardBpm)
    .mockResolvedValueOnce({ success: false, error: "Valor recebido diferente do esperado" })
    .mockResolvedValueOnce({ success: true, data: { updatedAt: new Date("2026-09-29T10:01:00Z"), camposValores: {
      pagamento_confirmado: "Sim", data_pagamento: "2026-09-29T18:00:00.000Z",
      valor_recebido: "23000", forma_utilizada: "Cartão de crédito",
    } } });
  await preencherPagamento();
  await act(async () => { botaoSalvar().click(); });
  expect(context.getFailedSaveKeys("card-pagamento")).toHaveLength(1);

  await editar("valor_recebido", "23000");
  await selecionar("pagamento_exito", "");
  expect(context.getPendingFields("card-pagamento")).toHaveLength(4);
  expect(context.getFailedSaveKeys("card-pagamento")).toEqual([]);
  await act(async () => { expect(await context.retryFailedSaves("card-pagamento")).toBe(true); });

  expect(AtualizarCardBpm).toHaveBeenCalledTimes(2);
  expect(AtualizarCardBpm).toHaveBeenNthCalledWith(2, expect.objectContaining({
    cardId: "card-pagamento", camposValores: {
      pagamento_confirmado: "Sim", data_pagamento: "2026-09-29T18:00:00.000Z",
      valor_recebido: "23000", forma_utilizada: "Cartão de crédito",
    },
  }));
  expect(context.getFailedSaveKeys("card-pagamento")).toEqual([]);
  expect(context.getPendingFields("card-pagamento")).toEqual([]);
  expect(botaoSalvar().hasAttribute("disabled")).toBe(true);
});

it("ignora retry de uma falha que chegou depois de nova edição", async () => {
  await montarPagamento();
  let falhar!: (value: Awaited<ReturnType<typeof AtualizarCardBpm>>) => void;
  vi.mocked(AtualizarCardBpm)
    .mockImplementationOnce(() => new Promise((resolve) => { falhar = resolve; }))
    .mockResolvedValueOnce({ success: true, data: { updatedAt: new Date("2026-09-29T10:01:00Z"), camposValores: {
      pagamento_confirmado: "Sim", data_pagamento: "2026-09-29T18:00:00.000Z",
      valor_recebido: "23000", forma_utilizada: "Cartão de crédito", pagamento_exito: "Sim",
    } } });
  await preencherPagamento();
  await act(async () => { botaoSalvar().click(); await Promise.resolve(); });
  await editar("valor_recebido", "23000");
  await act(async () => { falhar({ success: false, error: "Falha antiga" }); await Promise.resolve(); });

  expect(context.getFailedSaveKeys("card-pagamento")).toEqual([]);
  expect(toast.error).not.toHaveBeenCalled();
  expect(botaoSalvar().textContent).toContain("Salvar alterações (5)");
  await act(async () => { botaoSalvar().click(); });
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(2);
  expect(AtualizarCardBpm).toHaveBeenNthCalledWith(2, expect.objectContaining({
    camposValores: expect.objectContaining({ valor_recebido: "23000" }),
  }));
  expect(context.getPendingFields("card-pagamento")).toEqual([]);
});

it("falha tardia do lote A não apaga a recuperação mais recente do lote B", async () => {
  await montarPagamento();
  let falharA!: (value: Awaited<ReturnType<typeof AtualizarCardBpm>>) => void;
  vi.mocked(AtualizarCardBpm).mockImplementationOnce(() => new Promise((resolve) => { falharA = resolve; }));
  await preencherPagamento();
  await act(async () => { botaoSalvar().click(); await Promise.resolve(); });
  const recoveryKey = context.getFailedSaveKeys("card-pagamento")[0]
    ?? "card-pagamento:campo:card-pagamento-pagamento";
  // Outra edição registra uma nova tentativa para o mesmo formulário enquanto A aguarda a API.
  const executarB = vi.fn(async () => false);
  let tentativaB!: Promise<boolean>;
  await act(async () => {
    context.clearFailedSave(recoveryKey);
    tentativaB = context.registerSave(executarB, "card-pagamento", recoveryKey,
      { failureMessage: () => "Falha do lote B" }, false);
    falharA({ success: false, error: "Falha do lote A" });
    await tentativaB;
  });

  expect(executarB).toHaveBeenCalledTimes(1);
  expect(context.getFailedSaveKeys("card-pagamento")).toEqual([recoveryKey]);
  expect(toast.error).toHaveBeenLastCalledWith("Falha do lote B", expect.any(Object));

  const ultimoToast = vi.mocked(toast.error).mock.lastCall?.[1];
  expect(ultimoToast).toEqual(expect.objectContaining({ action: expect.objectContaining({ label: "Tentar novamente" }) }));
  await act(async () => {
    (ultimoToast as unknown as { action: { onClick: () => void } }).action.onClick();
    await context.flushSaves("card-pagamento");
  });
  expect(executarB).toHaveBeenCalledTimes(2);
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(1);
  expect(context.getFailedSaveKeys("card-pagamento")).toEqual([recoveryKey]);
});
