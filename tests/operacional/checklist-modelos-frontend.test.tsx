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
    expect(vi.mocked(api.publicarModeloChecklist).mock.calls[0][0]).not.toHaveProperty("chaveInterna");
    expect(first).toEqual(expect.objectContaining({ expectedRevision: 0, codigo: "NOVO_FIN", nome: "Novo balancete", descricao: "Primeira linha\nSegunda linha", secao: SECOES.CAP_OPERACIONAL, escopo: tipo, ordem: 100000, obrigatorio: false, ativo: false }));
    expect(api.listarModelosChecklist).toHaveBeenCalledOnce();
    await submit();
    expect(api.publicarModeloChecklist).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.publicarModeloChecklist).mock.calls[1][0]).toEqual(vi.mocked(api.publicarModeloChecklist).mock.calls[0][0]);
    expect(api.listarModelosChecklist).toHaveBeenCalledTimes(2);
    expect(field<HTMLInputElement>("Nome do documento").value).toBe("");
    expect(field<HTMLSelectElement>("Escopo").value).toBe(tipo);
  });
  it.each(["CONFLICT", "VALIDATION", "FORBIDDEN"] as const)("repetição intencional conserva código composto, draft e chave da intenção após %s", async (code) => {
    vi.mocked(api.publicarModeloChecklist).mockResolvedValueOnce({ ...fail, error: { ...fail.error, code } }).mockResolvedValue(ok(saved));
    await render();
    const compound = "A10 e\nB20 i";
    const codigo = field<HTMLTextAreaElement>("Código do documento");
    expect(codigo.tagName).toBe("TEXTAREA");
    expect(codigo.getAttribute("aria-describedby")).toBeTruthy();
    await type(codigo, compound);
    await type(field("Nome do documento"), "Comprovante sintético independente");
    await act(async () => field<HTMLInputElement>("Usar este código em outro requisito").click());
    await submit();
    const first = vi.mocked(api.publicarModeloChecklist).mock.calls[0][0];
    const parsed = publicarModeloSchema.parse(first);
    expect(parsed.codigo).toBe(compound);
    expect(parsed.chaveInterna).toBe(`REQ_${parsed.mutationId.replaceAll("-", "").toUpperCase()}`);
    expect(field<HTMLTextAreaElement>("Código do documento").value).toBe(compound);
    expect(field<HTMLInputElement>("Usar este código em outro requisito").checked).toBe(true);
    expect(field<HTMLInputElement>("Nome do documento").value).toBe("Comprovante sintético independente");
    expect(host.textContent).not.toContain(parsed.chaveInterna);
    await submit();
    expect(vi.mocked(api.publicarModeloChecklist).mock.calls[1][0]).toEqual(first);
    expect(field<HTMLInputElement>("Usar este código em outro requisito").checked).toBe(false);
    expect(field<HTMLTextAreaElement>("Código do documento").value).toBe("");
    const cleanUnload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
    await type(field("Código do documento"), compound);
    await type(field("Nome do documento"), "Outro requisito sintético");
    await act(async () => field<HTMLInputElement>("Usar este código em outro requisito").click());
    await submit();
    const next = publicarModeloSchema.parse(vi.mocked(api.publicarModeloChecklist).mock.calls[2][0]);
    expect(next.mutationId).not.toBe(parsed.mutationId);
    expect(next.chaveInterna).not.toBe(parsed.chaveInterna);
  });
  it("edição usa identidade e código significativo da revisão sem mostrar chave técnica; repetidos mantêm nomes distintos", async () => {
    const compound = "A10 e\nB20 i";
    const existing = { ...modelo, codigo: compound, chaveInterna: "REQ_SYNTHETIC_ORIGINAL", modelo: { ...modelo.modelo!, codigo: compound, nome: "Contrato sintético" } };
    const other = { ...existing, id: "synthetic-other-identity", chaveInterna: "REQ_SYNTHETIC_OTHER", modelo: { ...existing.modelo, nome: "Recibo sintético" } };
    vi.mocked(api.listarModelosChecklist).mockResolvedValue(ok({ items: [existing, other], totalCount: 2, page: 1, pageSize: 20 }));
    await render();
    const articles = [...host.querySelectorAll("article")];
    expect(articles).toHaveLength(2);
    expect(articles.map((a) => a.querySelector("h2")?.textContent)).toEqual(["Contrato sintético", "Recibo sintético"]);
    for (const article of articles) {
      expect(article.querySelector("span")?.textContent).toBe(compound);
    }
    expect(host.textContent).not.toContain(existing.chaveInterna);
    expect(host.textContent).not.toContain(other.chaveInterna);
    await type(field("Código do documento"), compound);
    await type(field("Nome do documento"), "Terceiro requisito sintético");
    await select(field("Seção"), existing.modelo.secao);
    await act(async () => field<HTMLInputElement>("Usar este código em outro requisito").click());
    await submit();
    const created = publicarModeloSchema.parse(vi.mocked(api.publicarModeloChecklist).mock.calls[0][0]);
    expect(created).toEqual(expect.objectContaining({ codigo: compound, nome: "Terceiro requisito sintético", secao: existing.modelo.secao, escopo: existing.escopo }));
    expect(created.identidadeId).toBeUndefined();
    expect(created.chaveInterna).toBe(`REQ_${created.mutationId.replaceAll("-", "").toUpperCase()}`);
    expect(created.chaveInterna).not.toBe(existing.chaveInterna);
    await click("Editar / publicar versão");
    expect(field<HTMLTextAreaElement>("Código do documento").value).toBe(compound);
    expect(field<HTMLTextAreaElement>("Código do documento").disabled).toBe(true);
    expect(field<HTMLSelectElement>("Escopo").disabled).toBe(true);
    expect(host.textContent).not.toContain("Usar este código em outro requisito");
    await type(field("Nome do documento"), "Contrato sintético revisado"); await submit();
    expect(api.publicarModeloChecklist).toHaveBeenCalledWith(expect.objectContaining({
      identidadeId: existing.id, chaveInterna: existing.chaveInterna, codigo: compound, expectedRevision: 4,
      nome: "Contrato sintético revisado", secao: existing.modelo.secao,
    }));
    expect(host.textContent).not.toContain(existing.chaveInterna);
  });
  it("repetição é uma alteração protegida pelo guard; descartar restaura checkbox sem publicação", async () => {
    await render();
    await act(async () => field<HTMLInputElement>("Usar este código em outro requisito").click());
    await click("Editar / publicar versão");
    expect(document.body.textContent).toContain("Há alterações pendentes");
    await click("Continuar editando", document);
    expect(field<HTMLInputElement>("Usar este código em outro requisito").checked).toBe(true);
    await click("Editar / publicar versão");
    await click("Descartar e continuar", document);
    await click("Cancelar edição");
    expect(field<HTMLInputElement>("Usar este código em outro requisito").checked).toBe(false);
    expect(api.publicarModeloChecklist).not.toHaveBeenCalled();
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
    expect(vi.mocked(api.publicarModeloChecklist).mock.calls[0][0]).not.toHaveProperty("chaveInterna");
    await click("↓ Ordem");
    expect(api.ordenarModelosChecklist).toHaveBeenCalledWith(expect.objectContaining({ identidadeId: modelo.id, expectedRevision: 4, ordem: 9, mutationId: expect.any(String) }));
    await click("Desativar");
    expect(api.desativarModeloChecklist).toHaveBeenCalledWith(expect.objectContaining({ identidadeId: modelo.id, expectedRevision: 4, mutationId: expect.any(String) }));
  });
  it("comando pendente bloqueia gestão concorrente e unload; trocar edição protege o rascunho", async () => {
    let finish!: (result: typeof fail) => void;
    vi.mocked(api.publicarModeloChecklist).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await render(); await type(field("Código do documento"), "PENDENTE"); await type(field("Nome do documento"), "Nome pendente");
    await act(async () => field<HTMLInputElement>("Usar este código em outro requisito").click());
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
    expect(field<HTMLInputElement>("Usar este código em outro requisito").checked).toBe(true);
    const unload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await act(async () => finish(fail)); await wait();
    expect(field<HTMLInputElement>("Nome do documento").value).toBe("Nome pendente");
    await click("Editar / publicar versão");
    expect(document.body.textContent).toContain("Há alterações pendentes");
    await click("Continuar editando", document);
    expect(field<HTMLInputElement>("Nome do documento").value).toBe("Nome pendente");
    await submit();
    expect(vi.mocked(api.publicarModeloChecklist).mock.calls[1][0]).toEqual(vi.mocked(api.publicarModeloChecklist).mock.calls[0][0]);
  });
  it("capability de consulta mantém catálogo navegável sem formulário ou controles de gestão", async () => {
    await render(false);
    expect(host.textContent).toContain("Balancete confirmado");
    expect(host.textContent).toContain("Admin, TI e Líder Operacional");
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
