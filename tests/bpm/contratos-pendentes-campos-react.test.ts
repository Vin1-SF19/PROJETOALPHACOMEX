// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DocumentosContratacaoComercial } from "@/lib/bpm/contratos-comerciais";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { AtualizarCardBpm } from "@/actions/bpm/Cards";
import { RegistrarAnexoBpm } from "@/actions/bpm/Anexos";
vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
type Card = React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];
const pendentes: DocumentosContratacaoComercial = { paraEnvio: { estado: "PENDENTE", documento: null }, assinado: { estado: "PENDENTE", documento: null } };
const pronto: DocumentosContratacaoComercial = { ...pendentes, paraEnvio: { estado: "DISPONIVEL", documento: { id: "contratacao:comercial:para_envio", nome: "Contrato final.pdf", tipo: "application/pdf", urlAcesso: "/api/bpm/cards/comercial/contrato?tipo=para_envio", origem: "CONTRATACAO", somenteLeitura: true } } };
const campos = [
  { id: "envio", chave: "alpha.radar.fechado.contrato_para_envio", nome: "Contrato para envio", tipo: "arquivo" },
  { id: "assinado", chave: "alpha.radar.fechado.contrato_assinado", nome: "Contrato assinado", tipo: "arquivo" },
  { id: "obs", chave: "observacao", nome: "Observações", tipo: "texto" },
].map((campo) => ({ ...campo, valor: "", opcoesJson: null, obrigatorio: false, editavel: true }));
let root: Root, host: HTMLDivElement, saves: ReturnType<typeof useCardSave>;
function Probe() { const context = useCardSave(); React.useEffect(() => { saves = context; }, [context]); return null; }
async function montar(docs: DocumentosContratacaoComercial | null = pendentes, revision = 0, anexos: Card["anexos"] = [], valores: Record<string, string> = {}) {
  const card = { id: "comercial", pipelineId: "pipeline-comercial", pipeline: { id: "pipeline-comercial", chave: "comercial", nome: "Revisão de Radar" }, etapa: { id: "fechado", chave: "fechado", nome: "Contrato fechado" }, updatedAt: new Date(`2026-10-21T10:0${revision}:00Z`), documentosContratacao: docs, anexos, camposEtapa: campos.map((campo) => ({ ...campo, valor: valores[campo.id] ?? "" })) } as unknown as Card;
  await act(async () => root.render(h(CardSaveProvider, null, h(Probe), h(PainelCamposEtapaAtual, { card, campoIds: campos.map((campo) => campo.id), instanceKey: "contratos", accent: "1,2,3", podeEditar: true, realtimeRevision: revision, onAtualizado: vi.fn() }))));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
}
beforeEach(() => { vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it("mostra pendências independentes com pulsação apenas decorativa e redução de movimento", async () => {
  await montar();
  expect(host.textContent).toContain("Sendo preparado pelo Financeiro"); expect(host.textContent).toContain("Aguardando contrato assinado");
  const pulsos = host.querySelectorAll('[data-documento-pendente="true"]'); expect(pulsos).toHaveLength(2);
  for (const pulso of pulsos) { expect(pulso.getAttribute("aria-hidden")).toBe("true"); expect(pulso.className).toContain("motion-safe:animate-pulse"); expect(pulso.className).toContain("motion-reduce:animate-none"); }
  for (const status of host.querySelectorAll('[role="status"]')) expect(status.className).not.toContain("animate-pulse");
  expect(AtualizarCardBpm).not.toHaveBeenCalled(); expect(RegistrarAnexoBpm).not.toHaveBeenCalled();
});
it("finalização atualiza só envio, preserva rascunho local e não grava IDs financeiros", async () => {
  await montar();
  await act(async () => { const input = host.querySelector<HTMLInputElement>("#campo-bpm-obs")!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Meu rascunho"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await montar(pronto, 1);
  expect(host.querySelector('[aria-label="Contrato para envio: disponível"]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Contrato assinado: pendente"]')).toBeTruthy();
  expect(host.textContent).toContain("Contrato final.pdf"); expect(host.querySelector<HTMLInputElement>("#campo-bpm-obs")!.value).toBe("Meu rascunho");
  expect(saves.getPendingFields("comercial")).toEqual(["Observações"]);
  expect(AtualizarCardBpm).not.toHaveBeenCalled(); expect(RegistrarAnexoBpm).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Os campos receberam uma atualização externa");
});
it("nome, URL ou ID sem documento confirmado não tornam a minuta pronta", async () => {
  await montar(pendentes, 0, [], { envio: "id-minuta-gerada", assinado: "https://exemplo.test/arquivo.pdf" });
  expect(host.querySelector('[aria-label="Contrato para envio: disponível"]')).toBeNull();
  expect(host.querySelector('[aria-label="Contrato assinado: disponível"]')).toBeNull();
  expect(host.querySelector('a[href="https://exemplo.test/arquivo.pdf"]')).toBeNull();
});
it("preserva upload manual próprio, sem tratar arquivo de outro campo como contrato", async () => {
  const anexo = { id: "manual", nome: "Assinado manual.jpg", tipo: "image/jpeg", campoId: "assinado", url: "/api/bpm/anexos/manual" } as Card["anexos"][number];
  await montar(pendentes, 0, [anexo], { assinado: "manual", envio: "manual" });
  expect(host.querySelector('[aria-label="Contrato assinado: disponível"]')?.textContent).toContain("Anexado no Comercial");
  expect(host.querySelector('[aria-label="Contrato para envio: pendente"]')).toBeTruthy();
  const input = host.querySelector<HTMLInputElement>('#campo-bpm-envio[type="file"]')!;
  Object.defineProperty(input, "files", { value: [new File(["%PDF-1.7"], "Novo manual.pdf", { type: "application/pdf" })] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(host.textContent).toContain("Novo manual.pdf"); expect(RegistrarAnexoBpm).not.toHaveBeenCalled(); expect(AtualizarCardBpm).not.toHaveBeenCalled();
});
it("não aplica pendência a outros campos nem fora do DTO comercial", async () => {
  await montar(null);
  expect(host.querySelector('[data-documento-pendente]')).toBeNull();
  expect(host.querySelector('#campo-bpm-obs')).toBeTruthy();
});

it("assinatura disponibilizada é independente e o documento financeiro prevalece sobre upload local", async () => {
  const documento = { ...pronto.paraEnvio.documento!, id: "contratacao:comercial:assinado", nome: "Assinado Financeiro.png", tipo: "image/png", urlAcesso: "/api/bpm/cards/comercial/contrato?tipo=assinado" };
  const docs: DocumentosContratacaoComercial = { ...pendentes, assinado: { estado: "DISPONIVEL", documento } };
  const local = { id: "assinado-antigo", nome: "Assinado Comercial antigo.pdf", tipo: "application/pdf", campoId: "assinado", url: "/api/bpm/anexos/assinado-antigo" } as Card["anexos"][number];
  await montar(docs, 0, [local], { assinado: local.id });
  expect(host.querySelector('[aria-label="Contrato para envio: pendente"]')).toBeTruthy();
  const assinado = host.querySelector('[aria-label="Contrato assinado: disponível"]');
  expect(assinado?.textContent).toContain("Disponível pelo Financeiro");
  expect(assinado?.textContent).toContain("Assinado Financeiro.png");
  expect(assinado?.textContent).not.toContain(local.nome);
  expect(AtualizarCardBpm).not.toHaveBeenCalled();
});
