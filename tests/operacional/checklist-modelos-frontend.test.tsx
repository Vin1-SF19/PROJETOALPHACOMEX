// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("@/actions/checklist-modelos", () => ({
  listarModelosChecklist: vi.fn(), publicarModeloChecklist: vi.fn(), desativarModeloChecklist: vi.fn(), ordenarModelosChecklist: vi.fn(),
}));
import * as api from "@/actions/checklist-modelos";
import { ModelosWorkspace } from "@/components/checklist/ModelosWorkspace";
import type { Modelo } from "@/components/checklist/ModelosDocumentoForm";
import { publicarModeloSchema } from "@/lib/checklist/schemas";
import { SECOES } from "@/lib/checklist/items";

const tipo = "DISPONIBILIDADE_FINANCEIRA";
const ok = <T,>(data: T) => ({ ok: true as const, data, requestId: "synthetic-model-request" });
const fail = { ok: false as const, error: { code: "CONFLICT" as const, message: "Falha sintética; tente novamente." }, requestId: "synthetic-model-request" };
const modelo: Modelo = {
  id: "synthetic-identity", revision: 4, escopo: tipo, codigo: "BAL_FIN",
  modelo: {
    id: "synthetic-version", identidadeId: "synthetic-identity", versao: 3, ativo: true, ordem: 8, autorId: 7,
    tipo, codigo: "BAL_FIN", nome: "Balancete confirmado", descricao: "Descrição confirmada", secao: SECOES.CAP_FINANCEIRA,
    obrigatorio: false, createdAt: new Date("2026-10-22T12:00:00Z"), updatedAt: new Date("2026-10-22T12:00:00Z"),
  },
};
const saved = { identidadeId: modelo.id, revision: 5, modeloId: "synthetic-next-version" };
let host: HTMLDivElement, root: Root, client: QueryClient;
const wait = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });
async function render(canManage = true, tipoInicial = tipo) {
  await act(async () => root.render(
    <QueryClientProvider client={client}><ModelosWorkspace canManage={canManage} tipoInicial={tipoInicial} /></QueryClientProvider>,
  ));
  await wait();
}
function button(text: string, scope: ParentNode = host) {
  const found = [...scope.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === text);
  if (!found) throw new Error(`Botão não encontrado: ${text}`);
  return found;
}
async function click(text: string, scope: ParentNode = host) {
  await act(async () => button(text, scope).click());
  await wait();
}
function field<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(label: string): T {
  const found = [...host.querySelectorAll("label")].find((l) => l.textContent?.trim().startsWith(label))?.querySelector<T>("input, select, textarea");
  if (!found) throw new Error(`Campo não encontrado: ${label}`);
  return found;
}
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait();
}
async function select(el: HTMLSelectElement, value: string) {
  await act(async () => { el.value = value; el.dispatchEvent(new Event("change", { bubbles: true })); });
  await wait();
}
async function submit() {
  await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await wait();
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.mocked(api.listarModelosChecklist).mockResolvedValue(ok({ items: [structuredClone(modelo)], totalCount: 21, page: 1, pageSize: 20 }));
  vi.mocked(api.publicarModeloChecklist).mockResolvedValue(ok(saved));
  vi.mocked(api.desativarModeloChecklist).mockResolvedValue(ok(saved));
  vi.mocked(api.ordenarModelosChecklist).mockResolvedValue(ok(saved));
});
afterEach(async () => {
  await act(async () => root.unmount()); client.clear(); host.remove(); document.body.innerHTML = "";
});

describe("Modelos CheckList — formulário inline e contratos atuais", () => {
  it("criação no detalhe mantém rascunho após erro, repete mutationId e refaz catálogo após sucesso", async () => {
    vi.mocked(api.publicarModeloChecklist).mockResolvedValueOnce(fail).mockResolvedValueOnce(ok(saved));
    await render();
    expect(host.querySelector("h1")?.textContent).toBe("Disponibilidade Financeira");
    expect(host.querySelector("form")).not.toBeNull();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(field<HTMLSelectElement>("Escopo").value).toBe(tipo);
    await type(field("Código do documento"), "NOVO_FIN");
    await type(field("Nome do documento"), "Novo balancete");
    await type(field("Descrição complementar"), "Primeira linha\nSegunda linha");
    await select(field("Seção"), SECOES.CAP_OPERACIONAL);
    await type(field("Ordem"), "100000");
    await act(async () => field<HTMLInputElement>("Documento obrigatório").click());
    await act(async () => field<HTMLInputElement>("Ativo para novos checklists").click());
    await submit();
    expect(host.textContent).toContain("Falha sintética");
    expect(field<HTMLTextAreaElement>("Descrição complementar").value).toBe("Primeira linha\nSegunda linha");
    const first = publicarModeloSchema.parse(vi.mocked(api.publicarModeloChecklist).mock.calls[0][0]);
    expect(first).toEqual(expect.objectContaining({ expectedRevision: 0, codigo: "NOVO_FIN", nome: "Novo balancete", descricao: "Primeira linha\nSegunda linha", secao: SECOES.CAP_OPERACIONAL, escopo: tipo, ordem: 100000, obrigatorio: false, ativo: false }));
    expect(api.listarModelosChecklist).toHaveBeenCalledOnce();
    await submit();
    expect(api.publicarModeloChecklist).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.publicarModeloChecklist).mock.calls[1][0]).toEqual(vi.mocked(api.publicarModeloChecklist).mock.calls[0][0]);
    expect(api.listarModelosChecklist).toHaveBeenCalledTimes(2);
    expect(field<HTMLInputElement>("Nome do documento").value).toBe("");
    expect(field<HTMLSelectElement>("Escopo").value).toBe(tipo);
  });
  it("home mantém quatro rotas, Todos/Global, paginação e criação global explícita", async () => {
    await render(true, "");
    const routes = host.querySelectorAll('section[aria-label="Embasamentos"] a');
    expect(routes).toHaveLength(4);
    expect([...routes].map((a) => a.getAttribute("href"))).toContain(`/PainelAlpha/CheckList/Embasamentos/${tipo}`);
    expect(field<HTMLSelectElement>("Escopo").value).toBe("GLOBAL");
    expect(api.listarModelosChecklist).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 });
    await click("Próxima");
    expect(api.listarModelosChecklist).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
    await select(field("Filtrar escopo"), "GLOBAL");
    expect(api.listarModelosChecklist).toHaveBeenLastCalledWith({ escopo: "GLOBAL", page: 1, pageSize: 20 });
    await type(field("Código do documento"), "GLOBAL_DOC"); await type(field("Nome do documento"), "Documento global");
    await submit();
    expect(api.publicarModeloChecklist).toHaveBeenCalledWith(expect.objectContaining({ escopo: "GLOBAL", descricao: null, expectedRevision: 0 }));
  });
  it("edição preserva identidade/código/escopo e revisão; ordenação e desativação conservam CAS", async () => {
    await render(); await click("Editar / publicar versão");
    expect(field<HTMLInputElement>("Código do documento").disabled).toBe(true);
    expect(field<HTMLSelectElement>("Escopo").disabled).toBe(true);
    expect(field<HTMLInputElement>("Ordem").value).toBe("8");
    await type(field("Nome do documento"), "Balancete revisado"); await submit();
    expect(publicarModeloSchema.parse(vi.mocked(api.publicarModeloChecklist).mock.calls[0][0])).toEqual(expect.objectContaining({
      identidadeId: modelo.id, expectedRevision: 4, codigo: modelo.codigo, escopo: tipo,
      nome: "Balancete revisado", descricao: "Descrição confirmada", secao: SECOES.CAP_FINANCEIRA, obrigatorio: false, ativo: true, ordem: 8,
    }));
    await click("↓ Ordem");
    expect(api.ordenarModelosChecklist).toHaveBeenCalledWith(expect.objectContaining({ identidadeId: modelo.id, expectedRevision: 4, ordem: 9, mutationId: expect.any(String) }));
    await click("Desativar");
    expect(api.desativarModeloChecklist).toHaveBeenCalledWith(expect.objectContaining({ identidadeId: modelo.id, expectedRevision: 4, mutationId: expect.any(String) }));
  });
  it("comando pendente bloqueia gestão concorrente e unload; trocar edição protege o rascunho", async () => {
    let finish!: (result: typeof fail) => void;
    vi.mocked(api.publicarModeloChecklist).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await render(); await type(field("Código do documento"), "PENDENTE"); await type(field("Nome do documento"), "Nome pendente");
    const dirtyUnload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(dirtyUnload);
    expect(dirtyUnload.defaultPrevented).toBe(true);
    await submit(); await submit();
    await click("Editar / publicar versão");
    expect(field<HTMLInputElement>("Nome do documento").value).toBe("Nome pendente");
    expect(field<HTMLInputElement>("Código do documento").value).toBe("PENDENTE");
    expect(host.textContent).toContain("Adicionar documento");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(api.publicarModeloChecklist).toHaveBeenCalledOnce();
    expect(button("Editar / publicar versão").disabled).toBe(true);
    expect(button("Desativar").disabled).toBe(true);
    expect(host.querySelector("fieldset")?.disabled).toBe(true);
    const unload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await act(async () => finish(fail)); await wait();
    expect(field<HTMLInputElement>("Nome do documento").value).toBe("Nome pendente");
    await click("Editar / publicar versão");
    expect(document.body.textContent).toContain("Há alterações pendentes");
    await click("Continuar editando", document);
    expect(field<HTMLInputElement>("Nome do documento").value).toBe("Nome pendente");
  });
  it("capability de consulta mantém catálogo navegável sem formulário ou controles de gestão", async () => {
    await render(false);
    expect(host.textContent).toContain("Balancete confirmado");
    expect(host.textContent).toContain("TI e Líder Operacional");
    expect(host.querySelector("form")).toBeNull();
    expect(host.textContent).not.toContain("Editar / publicar versão");
    expect(host.textContent).not.toContain("Desativar");
    await select(field("Filtrar escopo"), "GLOBAL");
    expect(api.listarModelosChecklist).toHaveBeenLastCalledWith({ escopo: "GLOBAL", page: 1, pageSize: 20 });
    expect(api.publicarModeloChecklist).not.toHaveBeenCalled();
    expect(api.ordenarModelosChecklist).not.toHaveBeenCalled();
    expect(api.desativarModeloChecklist).not.toHaveBeenCalled();
  });
});
