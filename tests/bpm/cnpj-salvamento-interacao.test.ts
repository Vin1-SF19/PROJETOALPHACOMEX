// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DadosEmpresaEditor } from "@/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaEditor";
import { PreencherCnpjNoloss } from "@/app/PainelAlpha/AlphaCRM/CardModal/PreencherCnpjNoloss";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { SalvarCadastroEmpresaCardBpm } from "@/actions/bpm/EmpresaCadastro";
import { PreencherCnpjCardNoloss } from "@/actions/bpm/NolossLeads";
import { ConfirmarVinculoEmpresaCardBpm } from "@/actions/bpm/CnpjEmpresaVinculo";
import type { PropostaVinculoEmpresa } from "@/lib/bpm/cnpj-empresa-vinculo";
import { normalizarDadosEmpresaBpm } from "@/lib/bpm/dados-empresa";
import { cadastroDosDadosEmpresa } from "@/lib/bpm/dados-empresa-edicao";

vi.mock("@/actions/bpm/EmpresaCadastro", () => ({ SalvarCadastroEmpresaCardBpm: vi.fn(), ConsultarCnpjEdicaoEmpresaCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/NolossLeads", () => ({ PreencherCnpjCardNoloss: vi.fn() }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/CnpjEmpresaVinculo", () => ({ ConfirmarVinculoEmpresaCardBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));

const CRU = "11222333000181", MASCARADO = "11.222.333/0001-81";
const base = normalizarDadosEmpresaBpm({ empresaPrincipal: { id: 1, cnpj: "", razaoSocial: "Empresa fictícia", status: "ATIVO", socios: [] },
  registrosCs: [], pessoasVinculadas: [], preAnalise: null, radarFiscal: null, responsaveisBpm: [] });
const dados = { ...base, edicao: { empresaId: 1, versaoEsperada: "2026-10-23T12:00:00.000Z", snapshotEsperado: "a".repeat(64), cadastro: cadastroDosDadosEmpresa(base) } };
let root: Root, container: HTMLDivElement;
let contexto: ReturnType<typeof useCardSave>;
function Probe() { const value = useCardSave(); React.useEffect(() => { contexto = value; }, [value]); return null; }
const atualizado = vi.fn();
type Fluxo = "cadastro" | "aviso NoLoss";
async function montar(fluxo: Fluxo) {
  await act(async () => root.render(h(CardSaveProvider, null, h(Probe), fluxo === "cadastro"
    ? h(DadosEmpresaEditor, { cardId: "card", dados, onSalvo: atualizado, onCancelar: vi.fn(), onFechar: vi.fn() })
    : h(PreencherCnpjNoloss, { cardId: "card", onAtualizado: atualizado }))));
}
function input() { return container.querySelector<HTMLInputElement>('input[aria-label="CNPJ"], input[aria-label="CNPJ do lead NoLoss"]')!; }
async function preencher(valor: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), valor);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function salvar(fluxo: Fluxo) {
  const label = fluxo === "cadastro" ? "Salvar" : "Salvar CNPJ";
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;
}
beforeEach(() => {
  vi.resetAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(SalvarCadastroEmpresaCardBpm).mockResolvedValue({ success: false, error: "Falha de persistência simulada; request observado." });
  vi.mocked(PreencherCnpjCardNoloss).mockResolvedValue({ success: false, error: "Falha de persistência simulada; request observado." });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it.each(["cadastro", "aviso NoLoss"] as const)("%s: colar CNPJ cru ou mascarado exibe 18 caracteres e envia exatamente 14 dígitos à action", async fluxo => {
  await montar(fluxo);
  for (const valor of [CRU, MASCARADO]) {
    await preencher(valor);
    expect(input().value).toBe(MASCARADO); expect(input().value).toHaveLength(18);
    await act(async () => salvar(fluxo).click());
  }
  if (fluxo === "cadastro") {
    expect(SalvarCadastroEmpresaCardBpm).toHaveBeenCalledTimes(2);
    for (const [request] of vi.mocked(SalvarCadastroEmpresaCardBpm).mock.calls) {
      expect(request).toMatchObject({ cardId: "card", cadastro: { empresa: { cnpj: CRU } } });
    }
  } else {
    expect(PreencherCnpjCardNoloss).toHaveBeenCalledTimes(2);
    for (const request of vi.mocked(PreencherCnpjCardNoloss).mock.calls) expect(request).toEqual(["card", CRU]);
  }
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Falha de persistência simulada");
  expect(input().value).toBe(MASCARADO); expect(atualizado).not.toHaveBeenCalled();
});
it.each(["cadastro", "aviso NoLoss"] as const)("%s: aplica máscara progressiva durante a digitação", async fluxo => {
  await montar(fluxo); await preencher("11222"); expect(input().value).toBe("11.222");
  expect(SalvarCadastroEmpresaCardBpm).not.toHaveBeenCalled(); expect(PreencherCnpjCardNoloss).not.toHaveBeenCalled();
});
it.each(["cadastro", "aviso NoLoss"] as const)("%s: CNPJ inválido não inicia request e permanece corrigível", async fluxo => {
  await montar(fluxo); await preencher("11.111.111/1111-11"); await act(async () => salvar(fluxo).click());
  expect(SalvarCadastroEmpresaCardBpm).not.toHaveBeenCalled(); expect(PreencherCnpjCardNoloss).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/CNPJ (inválido|válido)/);
  expect(input().value).toBe("11.111.111/1111-11");
});
it("aviso NoLoss: clique duplo síncrono envia uma única solicitação", async () => {
  await montar("aviso NoLoss"); await preencher(CRU);
  await act(async () => { const botao = salvar("aviso NoLoss"); botao.click(); botao.click(); });
  expect(PreencherCnpjCardNoloss).toHaveBeenCalledExactlyOnceWith("card", CRU);
});

function proposta(fluxo: Fluxo): PropostaVinculoEmpresa {
  return { versao: 1, modo: fluxo === "cadastro" ? "EDITOR" : "NOLOSS", cardId: "card", empresaOrigemId: 1, empresaDestinoId: 2,
    cnpj: CRU, empresaOrigemNome: "Empresa fictícia", empresaDestinoNome: "Empresa existente fictícia", versaoCardEsperada: 3,
    atualizadoCardEsperado: "2026-10-23T12:00:00.000Z", atualizadoOrigemEsperado: "2026-10-23T12:00:00.000Z",
    atualizadoDestinoEsperado: "2026-10-23T12:00:00.000Z", snapshot: "b".repeat(64) };
}
async function oferecer(fluxo: Fluxo) {
  const propostaVinculo = proposta(fluxo);
  const oferta = { success: false as const, error: "Este CNPJ já pertence a uma empresa cadastrada.", code: "CNPJ_EMPRESA_EXISTENTE" as const, propostaVinculo };
  if (fluxo === "cadastro") vi.mocked(SalvarCadastroEmpresaCardBpm).mockResolvedValue(oferta);
  else vi.mocked(PreencherCnpjCardNoloss).mockResolvedValue(oferta);
  await montar(fluxo); await preencher(MASCARADO); await act(async () => salvar(fluxo).click());
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("Vincular à empresa já cadastrada?");
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(MASCARADO);
  return propostaVinculo;
}
function botaoDialogo(label: string) { return [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find(b => b.textContent === label)!; }

it.each(["cadastro", "aviso NoLoss"] as const)("%s: CNPJ existente somente oferece vínculo; cancelar preserva entrada e não chama confirmação", async fluxo => {
  await oferecer(fluxo); expect(ConfirmarVinculoEmpresaCardBpm).not.toHaveBeenCalled();
  await act(async () => botaoDialogo("Manter vínculo atual").click());
  expect(document.querySelector('[role="alertdialog"]')).toBeNull(); expect(input().value).toBe(MASCARADO);
  expect(ConfirmarVinculoEmpresaCardBpm).not.toHaveBeenCalled(); expect(atualizado).not.toHaveBeenCalled();
  if (fluxo === "cadastro") expect(contexto.getDraft("card:dados-empresa")).toBeDefined();
});
it.each(["cadastro", "aviso NoLoss"] as const)("%s: confirmação pendente bloqueia cancelar e clique duplo; sucesso usa apenas a proposta confirmada", async fluxo => {
  const oferta = await oferecer(fluxo);
  let resolver!: (value: Awaited<ReturnType<typeof ConfirmarVinculoEmpresaCardBpm>>) => void;
  vi.mocked(ConfirmarVinculoEmpresaCardBpm).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
  await act(async () => { const confirmar = botaoDialogo("Confirmar vínculo"); confirmar.click(); confirmar.click(); });
  expect(ConfirmarVinculoEmpresaCardBpm).toHaveBeenCalledExactlyOnceWith({ proposta: oferta, confirmar: true });
  expect(botaoDialogo("Vinculando…").disabled).toBe(true); expect(botaoDialogo("Vinculando…").getAttribute("aria-busy")).toBe("true");
  expect(botaoDialogo("Manter vínculo atual").disabled).toBe(true); expect(atualizado).not.toHaveBeenCalled();
  await act(async () => { botaoDialogo("Manter vínculo atual").click(); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(); expect(input().value).toBe(MASCARADO);
  if (fluxo === "cadastro") expect(contexto.getDraft("card:dados-empresa")).toBeDefined();
  const destino = { ...dados, empresa: { ...dados.empresa, id: 2, cnpj: CRU }, edicao: { ...dados.edicao, empresaId: 2 } };
  await act(async () => resolver({ success: true, data: destino }));
  expect(document.querySelector('[role="alertdialog"]')).toBeNull(); expect(atualizado).toHaveBeenCalledTimes(1);
  if (fluxo === "cadastro") expect(contexto.getDraft("card:dados-empresa")).toBeUndefined();
});
it.each(["cadastro", "aviso NoLoss"] as const)("%s: conflito na confirmação mantém diálogo e entrada sem sucesso falso", async fluxo => {
  await oferecer(fluxo);
  vi.mocked(ConfirmarVinculoEmpresaCardBpm).mockResolvedValue({ success: false, error: "O card mudou. Reabra a proposta." });
  await act(async () => botaoDialogo("Confirmar vínculo").click());
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("O card mudou. Reabra a proposta.");
  expect(input().value).toBe(MASCARADO); expect(atualizado).not.toHaveBeenCalled();
  expect(ConfirmarVinculoEmpresaCardBpm).toHaveBeenCalledTimes(1);
  if (fluxo === "cadastro") expect(contexto.getDraft("card:dados-empresa")).toBeDefined();
});
