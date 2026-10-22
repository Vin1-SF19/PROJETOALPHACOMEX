// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { DadosEmpresaDrawer, useDadosEmpresaDrawer } from "@/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaDrawer";
import { ObterDadosEmpresaCardBpm } from "@/actions/bpm/Empresas";
import { ConsultarCnpjEdicaoEmpresaCardBpm, SalvarCadastroEmpresaCardBpm } from "@/actions/bpm/EmpresaCadastro";
import { normalizarDadosEmpresaBpm } from "@/lib/bpm/dados-empresa";
import { cadastroDosDadosEmpresa, aplicarPerfilCadastral } from "@/lib/bpm/dados-empresa-edicao";
import CardFullViewModal from "@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal";
import { ObterCardBpm } from "@/actions/bpm/Cards";

vi.mock("@/actions/bpm/Empresas", () => ({ ObterDadosEmpresaCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/EmpresaCadastro", () => ({ ConsultarCnpjEdicaoEmpresaCardBpm: vi.fn(), SalvarCadastroEmpresaCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn(async () => ({ success: false })) }));
vi.mock("@/actions/bpm/Pipelines", () => ({ ObterPipelineBpm: vi.fn(async () => ({ success: true, data: { etapas: [] } })) }));
vi.mock("@/actions/bpm/Interacoes", () => ({ ListarInteracoesCardBpm: vi.fn(async () => ({ data: [] })) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelNotaFiscalConcluida", () => ({ PainelNotaFiscalConcluida: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelBoasVindasOperacional", () => ({ PainelBoasVindasOperacional: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelAlinhamentoEstrategico", () => ({ PainelAlinhamentoEstrategico: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout", () => ({ CardAbertoLayout: () => h(Host) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), dismiss: vi.fn() } }));
// A animação é verificada no Chromium; happy-dom rejeita promises de animações canceladas.
vi.mock("framer-motion", () => ({ motion: { section: ({ children, id, className, "aria-label": label }: React.ComponentProps<"section">) => h("section", { id, className, "aria-label": label }, children) } }));
const dadosBase = normalizarDadosEmpresaBpm({ empresaPrincipal: { id: 1, cnpj: "", razaoSocial: "Empresa teste", status: "ATIVO", socios: [] },
  registrosCs: [], pessoasVinculadas: [], preAnalise: null, radarFiscal: null, responsaveisBpm: [] });
const dados = { ...dadosBase, edicao: { empresaId: 1, versaoEsperada: "2026-10-22T12:00:00.000Z", snapshotEsperado: "a".repeat(64), cadastro: cadastroDosDadosEmpresa(dadosBase) } };
let root: Root, host: HTMLDivElement, context: ReturnType<typeof useCardSave>;
let drawer: ReturnType<typeof useDadosEmpresaDrawer>;
function Host() {
  const value = useCardSave(); const d = useDadosEmpresaDrawer("card");
  React.useEffect(() => { context = value; drawer = d; }, [value, d]);
  return h(React.Fragment, null, h("button", { onClick: d.alternar }, "Alternar dados"), d.aberto && h(DadosEmpresaDrawer, {
    cardId: "card", accent: "1,2,3", dados: d.dados, carregando: d.carregando, erro: d.erro, podeEditar: true,
    onFechar: d.fechar, onRecarregar: d.recarregar, registrarGuard: d.registrarGuard, onSalvo: d.confirmarDados,
  }));
}
function btn(label: string) { const b = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label); if (!b) throw Error("Botão ausente: " + label); return b; }
async function click(label: string) { await act(async () => btn(label).click()); }
async function editar(label: string, value: string) {
  await act(async () => { const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
}
async function abrirEdicao() { await click("Alternar dados"); await click("Editar dados"); expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("Editar dados da empresa?"); await click("Confirmar edição"); }
beforeEach(async () => {
  vi.resetAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(ObterDadosEmpresaCardBpm).mockResolvedValue({ success: true, data: structuredClone(dados) });
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: { id: "card", updatedAt: "2026-10-22T12:00:00Z", versao: 0,
    pipeline: { id: "pipeline", nome: "Comercial" }, etapa: { id: "etapa", nome: "Revisão" }, membros: [], formularioEtapa: { secoes: [] },
  } } as unknown as Awaited<ReturnType<typeof ObterCardBpm>>);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(h(CardSaveProvider, null, h(Host))));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("só habilita formulário após confirmação e nunca salva por digitação, blur ou espera", async () => {
  await abrirEdicao(); await editar("Nome fantasia", "Nome novo");
  expect(SalvarCadastroEmpresaCardBpm).not.toHaveBeenCalled(); expect(context.getPendingFields("card")).toContain("Dados da empresa · Nome fantasia");
  expect(await context.flushSaves("card")).toBe(false);
  expect(document.querySelector('input[aria-label="Capital social"]')).not.toBeNull();
});
it("Cancelar descarta apenas a empresa e preserva rascunhos de outras seções", async () => {
  await abrirEdicao(); await editar("Nome fantasia", "Nome novo"); context.setPendingFields("card:outra", ["Outro campo"]);
  await click("Cancelar"); expect(context.getDraft("card:dados-empresa")).toBeUndefined();
  expect(context.getPendingFields("card")).toEqual(["Outro campo"]); expect(SalvarCadastroEmpresaCardBpm).not.toHaveBeenCalled();
});
it.each(["toggle", "X"])("impede fechar gaveta por %s e mantém edição até descartar explicitamente", async (via) => {
  await abrirEdicao(); await editar("Nome fantasia", "Nome novo");
  await act(async () => { if (via === "toggle") drawer.alternar(); else document.querySelector<HTMLButtonElement>('[aria-label="Fechar gaveta de dados da empresa"]')!.click(); });
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("Dados da empresa não salvos"); expect(drawer.aberto).toBe(true);
  await click("Continuar editando"); expect(document.querySelector<HTMLInputElement>('input[aria-label="Nome fantasia"]')?.value).toBe("Nome novo");
  await act(async () => drawer.fechar()); await click("Descartar alterações"); expect(drawer.aberto).toBe(false);
  expect(SalvarCadastroEmpresaCardBpm).not.toHaveBeenCalled();
});
it("consulta pura preenche rascunho, preserva campo manual e ignora resposta após Cancelar", async () => {
  await abrirEdicao(); await editar("Nome fantasia", "Nome manual"); await editar("CNPJ", "11222333000181");
  const consulta = structuredClone(dados.edicao.cadastro); consulta.empresa.cnpj = "11222333000181"; consulta.empresa.nomeFantasia = "Nome API"; consulta.empresa.capitalSocial = 12345;
  vi.mocked(ConsultarCnpjEdicaoEmpresaCardBpm).mockResolvedValueOnce({ success: true, cadastro: consulta, falhas: ["Radar"], fontes: { receita: true, fiscal: false, radar: false } });
  await click("Consultar"); expect(document.querySelector<HTMLInputElement>('input[aria-label="Nome fantasia"]')?.value).toBe("Nome manual");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Capital social"]')?.value).toBe("12345"); expect(SalvarCadastroEmpresaCardBpm).not.toHaveBeenCalled();
  let resolve!: (v: Awaited<ReturnType<typeof ConsultarCnpjEdicaoEmpresaCardBpm>>) => void;
  vi.mocked(ConsultarCnpjEdicaoEmpresaCardBpm).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  await click("Consultar"); await click("Cancelar");
  await act(async () => resolve({ success: true, cadastro: consulta, falhas: [], fontes: { receita: true, fiscal: true, radar: true } }));
  expect(context.getDraft("card:dados-empresa")).toBeUndefined(); expect(context.getPendingFields("card")).toEqual([]);
});
it("falha ao salvar mantém os dados e o comando de saída consegue salvar na tentativa seguinte", async () => {
  await abrirEdicao(); await editar("Nome fantasia", "Nome novo");
  vi.mocked(SalvarCadastroEmpresaCardBpm).mockResolvedValueOnce({ success: false, error: "Erro de teste" });
  await click("Salvar"); expect(document.querySelector('[role="alert"]')?.textContent).toBe("Erro de teste"); expect(await context.flushSaves("card")).toBe(false);
  const cadastro = { ...dados.edicao.cadastro, empresa: { ...dados.edicao.cadastro.empresa, nomeFantasia: "Nome novo" } };
  vi.mocked(SalvarCadastroEmpresaCardBpm).mockResolvedValueOnce({ success: true, data: { ...aplicarPerfilCadastral(dados, { versao: 1, cadastro }), edicao: { ...dados.edicao, cadastro } } });
  await act(async () => { expect(await context.retryFailedSaves("card")).toBe(true); });
  expect(context.getPendingFields("card")).toEqual([]); expect(SalvarCadastroEmpresaCardBpm).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[aria-label="Edição dos dados da empresa"]')).toBeNull();
});
it("navegação protegida mantém rascunho ao continuar e só descarta por escolha explícita", async () => {
  await abrirEdicao(); await editar("Nome fantasia", "Nome novo");
  let result: Promise<boolean>;
  await act(async () => { result = context.requestLeave(); });
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("Salvar alterações antes de sair?");
  await click("Continuar editando"); expect(await result!).toBe(false); expect(context.getDraft("card:dados-empresa")).toBeDefined();
  await act(async () => { result = context.requestLeave(); }); await click("Descartar e sair"); expect(await result!).toBe(true);
  expect(context.getPendingFields("card")).toEqual([]); expect(SalvarCadastroEmpresaCardBpm).not.toHaveBeenCalled();
});
it("beforeunload bloqueia somente com alterações ainda pendentes", async () => {
  const semDados = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(semDados); expect(semDados.defaultPrevented).toBe(false);
  await abrirEdicao(); await editar("Nome fantasia", "Nome novo");
  const comDados = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(comDados); expect(comDados.defaultPrevented).toBe(true);
  await click("Cancelar"); const cancelado = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(cancelado); expect(cancelado.defaultPrevented).toBe(false);
});
it("Sheet real mantém um diálogo por saída e X do card exige salvar ou descartar sem autosave", async () => {
  const onClose = vi.fn();
  await act(async () => root.render(h(CardSaveProvider, null, h(CardFullViewModal, {
    cardId: "card", accent: "1,2,3", currentUserId: 1, currentUserRole: "Admin", onClose, onAtualizado: vi.fn(), onAbrirCard: vi.fn(),
  }))));
  await abrirEdicao(); await editar("Nome fantasia", "Pendente");
  let sair!: Promise<boolean>; await act(async () => { sair = context.requestLeave(); });
  expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
  await click("Continuar editando"); expect(await sair).toBe(false);
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')!.click());
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("Revisar alterações");
  expect(onClose).not.toHaveBeenCalled(); expect(SalvarCadastroEmpresaCardBpm).not.toHaveBeenCalled();
  await click("Sair sem salvar"); expect(onClose).toHaveBeenCalledOnce(); expect(SalvarCadastroEmpresaCardBpm).not.toHaveBeenCalled();
});
it("descartar cancela debounces ainda não iniciados e aguarda a gravação que já estava em curso", async () => {
  context.setPendingFields("card:manual", ["Pendente"]);
  let resolver!: (v: boolean) => void;
  const first = context.registerSave(() => new Promise<boolean>((r) => { resolver = r; }), "card", "card:inflight");
  const outro = vi.fn(); context.scheduleSave("card:timer", outro, 50);
  let sair!: Promise<boolean>; await act(async () => { sair = context.requestLeave(); });
  await click("Descartar e sair"); await new Promise((r) => setTimeout(r, 70)); expect(outro).not.toHaveBeenCalled();
  let saiu = false; void sair.then(() => { saiu = true; }); expect(saiu).toBe(false);
  await act(async () => { resolver(true); await first; }); expect(await sair).toBe(true); expect(context.getPendingFields()).toEqual([]);
});
