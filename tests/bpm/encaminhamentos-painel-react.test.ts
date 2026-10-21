// @vitest-environment happy-dom
import React, { act, createElement as h, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ obter: vi.fn(), enviar: vi.fn(), repetir: vi.fn(), card: vi.fn(), flush: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/actions/bpm/Encaminhamentos", () => ({ ObterEncaminhamentosCardBpm: api.obter, SolicitarEncaminhamentoCardBpm: api.enviar, RepetirEncaminhamentoCardBpm: api.repetir }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: api.card }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext", () => ({ useCardSave: () => ({ flushSaves: api.flush }) }));
vi.mock("sonner", () => ({ toast: { success: api.success, error: api.error } }));
import { PainelEncaminhamentos } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelEncaminhamentos";
const regra = { automacaoId: "regra", nome: "Encaminhar", destinoPipeline: { id: "ops", nome: "Operacional" }, destinoEtapa: { id: "boas", nome: "Boas-vindas" }, estado: "NAO_DISPARADO", motivo: "Reposicionamento administrativo não dispara envio.", solicitadoEm: null, enviadoEm: null, execucaoId: null, cardDestinoId: null, podeEnviar: true, podeRepetir: false, excecaoAdministrativa: true };
const card = { id: "origem", etapa: { id: "fechado" }, versao: 6 } as ComponentProps<typeof PainelEncaminhamentos>["card"];
let root: Root, host: HTMLDivElement;
const abrir = vi.fn(), atualizado = vi.fn();
const botao = (texto: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === texto)!;
async function montar() {
  await act(async () => root.render(h(PainelEncaminhamentos, { card, realtimeRevision: 0, onAtualizado: atualizado, onAbrirCard: abrir })));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  api.obter.mockResolvedValue({ success: true, data: { regras: [regra] } });
  api.card.mockResolvedValue({ success: true, data: { ...card, versao: 7 } });
  api.flush.mockResolvedValue(true); api.enviar.mockResolvedValue({ success: true, data: { existente: false, cardDestinoId: "destino" } });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it("explica exceção, espera salvamento e envia versão confirmada uma única vez", async () => {
  await montar();
  expect(host.textContent).toContain("Não enviado");
  await act(async () => botao("Encaminhar para Operacional").click());
  expect(document.body.textContent).toContain("não confirma assinatura, pagamento ou emissão de nota fiscal");
  let liberar!: (valor: boolean) => void;
  api.flush.mockImplementationOnce(() => new Promise<boolean>((resolve) => { liberar = resolve; }));
  await act(async () => { const confirmar = botao("Confirmar encaminhamento"); confirmar.click(); confirmar.click(); });
  expect(api.flush).toHaveBeenCalledTimes(1); expect(api.enviar).not.toHaveBeenCalled(); expect(api.success).not.toHaveBeenCalled();
  await act(async () => liberar(true));
  expect(api.enviar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ cardId: "origem", automacaoId: "regra", versaoEsperada: 7, etapaOrigemEsperadaId: "fechado", idempotencyKey: expect.any(String) }));
  expect(atualizado).toHaveBeenCalledTimes(1);
});
it("falha de persistência nunca apresenta enviado nem sucesso", async () => {
  api.enviar.mockResolvedValue({ success: false, error: "Destino indisponível" }); await montar();
  await act(async () => botao("Encaminhar para Operacional").click());
  await act(async () => botao("Confirmar encaminhamento").click());
  expect(api.success).not.toHaveBeenCalled(); expect(atualizado).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Destino indisponível");
});
it("retentativa aponta só para a execução falha; destino já enviado só abre card autorizado", async () => {
  api.obter.mockResolvedValue({ success: true, data: { regras: [{ ...regra, estado: "FALHOU", podeEnviar: false, podeRepetir: true, execucaoId: "execucao-1" }] } });
  api.repetir.mockResolvedValue({ success: true, data: { existente: true } }); await montar();
  await act(async () => botao("Tentar este envio novamente").click());
  await act(async () => botao("Confirmar encaminhamento").click());
  expect(api.repetir).toHaveBeenCalledExactlyOnceWith({ cardId: "origem", execucaoId: "execucao-1" }); expect(api.enviar).not.toHaveBeenCalled();
});
