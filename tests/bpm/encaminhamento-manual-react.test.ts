// @vitest-environment happy-dom
import React, { act, createElement as h, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ opcoes: vi.fn(), pessoas: vi.fn(), enviar: vi.fn(), card: vi.fn(), flush: vi.fn(), success: vi.fn() }));
vi.mock("@/actions/bpm/EncaminhamentoManual", () => ({ ObterOpcoesEncaminhamentoManualBpm: api.opcoes,
  ObterResponsaveisEncaminhamentoManualBpm: api.pessoas, EncaminharCardManualmenteBpm: api.enviar }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: api.card }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext", () => ({ useCardSave: () => ({ flushSaves: api.flush }) }));
vi.mock("sonner", () => ({ toast: { success: api.success } }));
import { EncaminhamentoManualDialog } from "@/app/PainelAlpha/AlphaCRM/CardModal/EncaminhamentoManualDialog";
const card = { id: "origem", pipelineId: "comercial", etapa: { id: "tratativa" }, versao: 6 } as ComponentProps<typeof EncaminhamentoManualDialog>["card"];
const pipelines = [{ id: "comercial", nome: "Comercial", etapas: [{ id: "tratativa", nome: "Em tratativa" }, { id: "fechado", nome: "Fechado" }] },
  { id: "financeiro", nome: "Financeiro", etapas: [{ id: "novo", nome: "Novo Contrato" }] },
  { id: "operacional", nome: "Operacional", etapas: [{ id: "boas", nome: "Boas-vindas" }] }];
let root: Root, host: HTMLDivElement;
const atualizado = vi.fn();
const botao = (texto: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim() === texto);
const select = (nome: string) => document.querySelector<HTMLSelectElement>(`select[aria-label="${nome}"]`)!;
async function mudar(nome: string, valor: string) {
  await act(async () => { const elemento = select(nome); elemento.value = valor; elemento.dispatchEvent(new Event("change", { bubbles: true })); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
}
async function montar() {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => root.render(h(QueryClientProvider, { client: query }, h(EncaminhamentoManualDialog, { card, realtimeRevision: 0, bloqueado: false, onAtualizado: atualizado }))));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
}
async function abrir() { await montar(); await act(async () => botao("Encaminhar manualmente")!.click()); }
beforeEach(() => {
  vi.resetAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  api.opcoes.mockResolvedValue({ success: true, data: { permitido: true, pipelines } });
  api.pessoas.mockResolvedValue({ success: true, data: [{ id: 5, nome: "Pessoa Financeiro" }] });
  api.card.mockResolvedValue({ success: true, data: { ...card, versao: 7 } });
  api.flush.mockResolvedValue(true); api.enviar.mockResolvedValue({ success: true, data: { mesmoPipeline: false } });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it("botão segue autoridade do servidor e aparece mesmo sem automação nesta etapa", async () => {
  await montar(); expect(botao("Encaminhar manualmente")).toBeDefined();
});
it("usuário comum não vê o botão", async () => {
  api.opcoes.mockResolvedValue({ success: true, data: { permitido: false, pipelines: [] } });
  await montar(); expect(botao("Encaminhar manualmente")).toBeUndefined();
});
it("mesmo pipeline oferece etapas e preserva o responsável", async () => {
  await abrir(); expect(select("Pipeline de destino").value).toBe("comercial");
  expect(document.querySelector('[aria-label="Responsável no pipeline de destino"]')).toBeNull();
  await mudar("Etapa de destino", "fechado");
  await act(async () => botao("Confirmar encaminhamento")!.click());
  expect(api.enviar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ pipelineDestinoId: "comercial", etapaDestinoId: "fechado", versaoEsperada: 7 }));
  expect(api.enviar.mock.calls[0][0]).not.toHaveProperty("responsavelDestinoId");
});
it("outro pipeline exige etapa própria e responsável; mudança limpa seleções anteriores", async () => {
  await abrir(); await mudar("Pipeline de destino", "financeiro");
  expect(select("Etapa de destino").value).toBe(""); expect(select("Etapa de destino").textContent).not.toContain("Fechado");
  expect(botao("Confirmar encaminhamento")!.disabled).toBe(true);
  await mudar("Etapa de destino", "novo"); await mudar("Responsável no pipeline de destino", "5");
  await mudar("Pipeline de destino", "operacional");
  expect(select("Etapa de destino").value).toBe(""); expect(select("Responsável no pipeline de destino").value).toBe("");
  expect(botao("Confirmar encaminhamento")!.disabled).toBe(true);
  await act(async () => botao("Cancelar")!.click()); expect(api.enviar).not.toHaveBeenCalled();
});
it("encaminha com atribuição e versão atualizadas uma única vez, mesmo em clique duplo", async () => {
  await abrir(); await mudar("Pipeline de destino", "financeiro"); await mudar("Etapa de destino", "novo"); await mudar("Responsável no pipeline de destino", "5");
  let liberar!: (resultado: unknown) => void; api.enviar.mockImplementationOnce(() => new Promise(resolve => { liberar = resolve; }));
  await act(async () => { botao("Confirmar encaminhamento")!.click(); botao("Confirmar encaminhamento")!.click(); });
  expect(api.enviar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ pipelineDestinoId: "financeiro", etapaDestinoId: "novo", responsavelDestinoId: 5, versaoEsperada: 7 }));
  expect(api.success).not.toHaveBeenCalled();
  await act(async () => liberar({ success: true, data: { mesmoPipeline: false } }));
  expect(api.success).toHaveBeenCalledTimes(1); expect(atualizado).toHaveBeenCalledTimes(1);
});
it("erro de envio mantém modal aberto e não apresenta sucesso", async () => {
  api.enviar.mockResolvedValue({ success: false, error: "O responsável não está disponível." });
  await abrir(); await mudar("Etapa de destino", "fechado"); await act(async () => botao("Confirmar encaminhamento")!.click());
  expect(document.body.textContent).toContain("O responsável não está disponível."); expect(api.success).not.toHaveBeenCalled();
  expect(botao("Confirmar encaminhamento")).toBeDefined();
});
it("resposta antiga de pessoas não aparece após escolher outro pipeline", async () => {
  let antiga!: (resultado: unknown) => void;
  api.pessoas.mockImplementationOnce(() => new Promise(resolve => { antiga = resolve; }));
  await abrir(); await mudar("Pipeline de destino", "financeiro"); await mudar("Etapa de destino", "novo");
  await mudar("Pipeline de destino", "operacional"); await mudar("Etapa de destino", "boas");
  await act(async () => antiga({ success: true, data: [{ id: 999, nome: "Resposta antiga" }] }));
  expect(select("Responsável no pipeline de destino").textContent).not.toContain("Resposta antiga");
});

it("resposta perdida após mover conserva envelope e recupera o recibo sem bloquear pela etapa nova", async () => {
  api.enviar.mockRejectedValueOnce(new Error("Conexão interrompida")).mockResolvedValueOnce({ success: true, data: { mesmoPipeline: true, idempotente: true } });
  api.card.mockResolvedValueOnce({ success: true, data: { ...card, versao: 7 } }).mockResolvedValue({ success: true, data: { ...card, etapa: { id: "fechado" }, versao: 8 } });
  await abrir(); await mudar("Etapa de destino", "fechado");
  await act(async () => botao("Confirmar encaminhamento")!.click());
  expect(api.success).not.toHaveBeenCalled();
  await act(async () => botao("Confirmar encaminhamento")!.click());
  expect(api.enviar).toHaveBeenCalledTimes(2); expect(api.enviar.mock.calls[1][0]).toEqual(api.enviar.mock.calls[0][0]);
  expect(api.card).toHaveBeenCalledTimes(1); expect(api.success).toHaveBeenCalledTimes(1);
});
