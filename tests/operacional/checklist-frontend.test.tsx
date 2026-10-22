// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { empresaUi, analistasUi, empresaResumoUi } from "./fixtures/checklist-ui";
vi.mock("framer-motion", () => ({ motion: { article: ({ children }: React.PropsWithChildren) => <article>{children}</article> } }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a {...props} href={href}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/actions/checklist", () => ({
  listarAnalistasChecklist: vi.fn(),
  listarEmpresasChecklist: vi.fn(),
  obterEmpresaChecklist: vi.fn(),
  selecionarTipoChecklist: vi.fn(),
  atualizarItemChecklist: vi.fn(),
  listarDocumentosChecklist: vi.fn(),
  registrarDocumentoChecklist: vi.fn(),
  excluirDocumentoChecklist: vi.fn(),
  restaurarDocumentoChecklist: vi.fn(),
  atualizarObservacaoDocumento: vi.fn(),
  atualizarEmpresaChecklist: vi.fn(),
  atribuirAnalistaChecklist: vi.fn(),
  obterHistoricoChecklist: vi.fn(),
  criarAtendimentoChecklist: vi.fn(),
}));
vi.mock("@/actions/ClientesOperacional", () => ({
  buscarClienteParaVincularOperacional: vi.fn(),
  listarContasPortalChecklist: vi.fn(),
  emitirResetAcessoPortal: vi.fn(),
}));
vi.mock("@/actions/checklist/eventos", () => ({ marcarEventoChecklistLido: vi.fn(), listarEventosChecklist: vi.fn() }));
vi.mock("@vercel/blob/client", () => ({ put: vi.fn() }));
import * as api from "@/actions/checklist";
import * as accounts from "@/actions/ClientesOperacional";
import * as events from "@/actions/checklist/eventos";
import ListaChecklist from "@/app/PainelAlpha/CheckList/ListaChecklist";
import ChecklistView from "@/app/PainelAlpha/CheckList/ChecklistView";
import { NovoAtendimentoDialog } from "@/components/checklist/NovoAtendimentoDialog";
import { useChecklistNotificacoes } from "@/store/useChecklistNotificacoes";
import { validarArquivoChecklist } from "@/lib/checklist/client/upload";
const ok = <T,>(data: T) => ({ ok: true as const, data, requestId: "fixture-request" });
const fail = { ok: false as const, error: { code: "CONFLICT" as const, message: "Revisão mudou; recarregue." }, requestId: "fixture-request" };
let host: HTMLDivElement, root: Root, client: QueryClient;
const wait = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
async function render(node: React.ReactNode) {
  await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
  await wait();
}
async function click(text: string) {
  const el = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text || b.textContent?.includes(text));
  if (!el) throw new Error(`Botão não encontrado: ${text}`);
  await act(async () => el.click());
  await wait();
}
async function select(el: HTMLSelectElement, value: string) {
  await act(async () => {
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait();
}
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set?.call(
      el,
      value,
    );
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait();
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  vi.mocked(api.listarAnalistasChecklist).mockResolvedValue(ok(analistasUi));
  vi.mocked(api.listarEmpresasChecklist).mockResolvedValue(ok({ items: [empresaResumoUi], totalCount: 1, page: 1, pageSize: 12 }));
  vi.mocked(api.obterEmpresaChecklist).mockResolvedValue(ok(structuredClone(empresaUi)));
  vi.mocked(api.listarDocumentosChecklist).mockResolvedValue(ok({ items: [], totalCount: 0, page: 1, pageSize: 10 }));
  vi.mocked(accounts.listarContasPortalChecklist).mockResolvedValue(ok({ items: [], totalCount: 0, page: 1, pageSize: 15 }));
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  document.body.innerHTML = "";
});
describe("Checklist frontend — comportamento causal", () => {
  it("Todos é primeira opção e analista com zero empresas permanece consultável", async () => {
    await render(<ListaChecklist canCreate canAssign />);
    const nav = host.querySelector('nav[aria-label="Analistas"]')!;
    expect(nav.querySelector("button")?.textContent).toContain("Todos os analistas");
    expect(nav.textContent).toContain("Pedro Santos");
    await click("Pedro Santos");
    expect(api.listarEmpresasChecklist).toHaveBeenLastCalledWith(expect.objectContaining({ analistaId: 8, page: 1 }));
  });
  it("falha de consulta é erro explícito, não lista vazia", async () => {
    vi.mocked(api.listarEmpresasChecklist).mockResolvedValue(fail);
    await render(<ListaChecklist canCreate={false} canAssign={false} />);
    expect(host.textContent).toContain("Revisão mudou");
    expect(host.textContent).not.toContain("Nenhuma empresa nesta");
    expect(host.textContent).not.toContain("Novo atendimento");
  });
  it("usuário autorizado cria mesmo sem empresa na página", async () => {
    vi.mocked(api.listarEmpresasChecklist).mockResolvedValue(ok({ items: [], totalCount: 0, page: 1, pageSize: 12 }));
    await render(<ListaChecklist canCreate canAssign={false} />);
    expect(host.textContent).toContain("Novo atendimento");
    expect(host.textContent).toContain("Nenhuma empresa nesta");
  });
  it("troca confirmada substitui itens e revisão, sem editar checklist anterior", async () => {
    const next = structuredClone(empresaUi);
    next.revision = 2;
    next.tipoAtivo = "DISPONIBILIDADE_FINANCEIRA";
    next.checklistAtivoId = "tipo-b";
    next.checklist = {
      ...empresaUi.checklist!,
      id: "tipo-b",
      tipo: "DISPONIBILIDADE_FINANCEIRA",
      itens: [{ ...empresaUi.checklist!.itens[0], id: "item-b", descricao: "Balancete atualizado" }],
    };
    vi.mocked(api.selecionarTipoChecklist).mockResolvedValue(ok(next));
    await render(<ChecklistView empresaId={empresaUi.id} initial={empresaUi} />);
    const tipo = [...host.querySelectorAll("select")].find((s) => s.querySelector('option[value=""]')?.textContent === "Selecione o tipo")!;
    await select(tipo, "DISPONIBILIDADE_FINANCEIRA");
    await click("Aplicar");
    expect(host.textContent).toContain("Balancete atualizado");
    expect(host.textContent).not.toContain("Contrato social");
    vi.mocked(api.atualizarItemChecklist).mockResolvedValue(ok(next));
    await select(host.querySelector('select[aria-label^="Status de"]')!, "OK");
    expect(api.atualizarItemChecklist).toHaveBeenCalledWith(expect.objectContaining({ itemId: "item-b", expectedRevision: 2, patch: { status: "OK" } }));
  });
  it("erro resolvido ao salvar status mantém último valor confirmado", async () => {
    vi.mocked(api.atualizarItemChecklist).mockResolvedValue(fail);
    await render(<ChecklistView empresaId={empresaUi.id} initial={empresaUi} />);
    const status = host.querySelector<HTMLSelectElement>('select[aria-label^="Status de"]')!;
    await select(status, "OK");
    expect(status.value).toBe("PENDENTE");
    expect(host.textContent).toContain("Revisão mudou");
    expect(api.atualizarItemChecklist).toHaveBeenCalledWith(expect.objectContaining({ patch: { status: "OK" } }));
  });
  it("somente leitura não permite status ou troca", async () => {
    const data = structuredClone(empresaUi);
    data.capabilities.canEdit = false;
    vi.mocked(api.obterEmpresaChecklist).mockResolvedValue(ok(data));
    await render(<ChecklistView empresaId={data.id} initial={data} />);
    expect(host.querySelector<HTMLSelectElement>('select[aria-label^="Status de"]')?.disabled).toBe(true);
    expect(host.textContent).not.toContain("Criar ou trocar embasamento");
  });
  it("histórico consulta ID sem chamar seleção do tipo ativo", async () => {
    await render(<ChecklistView empresaId={empresaUi.id} initial={empresaUi} />);
    await select(host.querySelectorAll("select")[0], "tipo-b");
    expect(api.obterEmpresaChecklist).toHaveBeenLastCalledWith(empresaUi.id, { checklistId: "tipo-b" });
    expect(api.selecionarTipoChecklist).not.toHaveBeenCalled();
  });
  it("CNPJ editado invalida confirmação master e bloqueia criação", async () => {
    vi.mocked(accounts.buscarClienteParaVincularOperacional).mockResolvedValue(
      ok({ id: 99, cnpj: "00000000000000", razaoSocial: "Fixture A", nomeFantasia: null }),
    );
    await render(<NovoAtendimentoDialog onClose={() => {}} analistas={analistasUi} canAssign={false} onCreated={() => {}} />);
    const input = document.querySelector<HTMLInputElement>('input[name="cnpj"]')!;
    await type(input, "00000000000000");
    const consultar = [...document.querySelectorAll("button")].find((b) => b.textContent === "Consultar")!;
    await act(async () => consultar.click());
    await wait();
    expect(document.body.textContent).toContain("Fixture A");
    await type(input, "11111111111111");
    expect(document.body.textContent).not.toContain("Empresa confirmada no CRM");
    const salvar = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Confirmar atendimento")!;
    expect(salvar.disabled).toBe(true);
    expect(api.criarAtendimentoChecklist).not.toHaveBeenCalled();
  });
  it("arquivo acima de8MiB ou MIME não permitido é recusado antes de upload", () => {
    expect(() => validarArquivoChecklist({ size: 8 * 1024 * 1024 + 1, type: "application/pdf" })).toThrow("8 MiB");
    expect(() => validarArquivoChecklist({ size: 12, type: "text/html" })).toThrow("PDF");
    expect(() => validarArquivoChecklist({ size: 1024, type: "image/png" })).not.toThrow();
  });
});
describe("rascunhos integrais e conta retida", () => {
  async function dialogClick(text: string) {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
    if (!el) throw new Error(text);
    await act(async () => el.click());
    await wait();
  }
  const doc = {
    id: "doc-fixture",
    nome: "Contrato.pdf",
    url: "/api/checklist/documentos/doc-fixture/download",
    uploadedByCliente: true,
    observacao: "Observação original",
    criadoEm: new Date(),
    deletadoEm: null,
    deletadoPorCliente: false,
    uploadedByUsuarioId: null,
    uploadedByContaId: "conta-fixture",
    deletadoPorUsuarioId: null,
    deletadoPorContaId: null,
  };
  it("salva item e documento sequencialmente após outro CAS sem perder os dois rascunhos", async () => {
    let server = structuredClone(empresaUi);
    const revisions: number[] = [];
    vi.mocked(api.obterEmpresaChecklist).mockImplementation(async () => ok(structuredClone(server)));
    vi.mocked(api.listarDocumentosChecklist).mockResolvedValue(ok({ items: [doc], totalCount: 1, page: 1, pageSize: 10 }));
    vi.mocked(api.atualizarItemChecklist).mockImplementation(async (input) => {
      const c = (await import("@/lib/checklist/schemas")).patchItemSchema.parse(input);
      expect(c.expectedRevision).toBe(server.revision);
      if (c.patch.observacao !== undefined) revisions.push(c.expectedRevision);
      server = {
        ...server,
        revision: server.revision + 1,
        checklist: { ...server.checklist!, itens: server.checklist!.itens.map((i) => (i.id === c.itemId ? { ...i, ...c.patch } : i)) },
      };
      return ok(structuredClone(server));
    });
    vi.mocked(api.atualizarObservacaoDocumento).mockImplementation(async (input) => {
      const c = (await import("@/lib/checklist/schemas")).observacaoDocumentoSchema.parse(input);
      expect(c.expectedRevision).toBe(server.revision);
      revisions.push(c.expectedRevision);
      server = { ...server, revision: server.revision + 1 };
      return ok({ ...doc, observacao: c.observacao });
    });
    vi.mocked(api.selecionarTipoChecklist).mockImplementation(async (input) => {
      const c = (await import("@/lib/checklist/schemas")).selecionarTipoSchema.parse(input);
      expect(c.expectedRevision).toBe(4);
      server = {
        ...server,
        revision: 5,
        tipoAtivo: c.tipo,
        checklistAtivoId: "tipo-b",
        checklist: {
          ...server.checklist!,
          id: "tipo-b",
          tipo: c.tipo,
          itens: [{ ...server.checklist!.itens[0], id: "item-b", descricao: "Novo tipo confirmado" }],
        },
      };
      return ok(server);
    });
    await render(<ChecklistView empresaId={empresaUi.id} initial={empresaUi} />);
    await click("Ver documentos");
    const texts = host.querySelectorAll("textarea");
    await type(texts[0], "Rascunho do item");
    await type(texts[1], "Rascunho documental");
    await select(host.querySelector('select[aria-label^="Status de"]')!, "OK");
    expect(host.querySelectorAll("textarea")[0].value).toBe("Rascunho do item");
    expect(host.querySelectorAll("textarea")[1].value).toBe("Rascunho documental");
    const tipo = [...host.querySelectorAll("select")].find((e) => e.querySelector('option[value=""]')?.textContent === "Selecione o tipo")!;
    await select(tipo, "DISPONIBILIDADE_FINANCEIRA");
    await click("Aplicar");
    expect(api.selecionarTipoChecklist).not.toHaveBeenCalled();
    await dialogClick("Salvar e continuar");
    expect(revisions).toEqual([2, 3]);
    expect(host.textContent).toContain("Novo tipo confirmado");
  });
  it("erro Result e rejected preservam metadados e bloqueiam navegação até descarte explícito", async () => {
    await render(<ChecklistView empresaId={empresaUi.id} initial={empresaUi} />);
    await click("Dados e acesso");
    const mes = [...host.querySelectorAll("label")].find((l) => l.textContent?.trim() === "Mês de protocolo")!.querySelector("input")!;
    await type(mes, "Janeiro/2027");
    await click("Histórico real");
    vi.mocked(api.atualizarEmpresaChecklist).mockResolvedValueOnce(fail).mockRejectedValueOnce(new Error("Rede indisponível"));
    await dialogClick("Salvar e continuar");
    expect(document.body.textContent).toContain("Há alterações pendentes");
    expect(mes.value).toBe("Janeiro/2027");
    await dialogClick("Salvar e continuar");
    expect(mes.value).toBe("Janeiro/2027");
    expect(document.body.textContent).toContain("Rede indisponível");
    expect(api.obterHistoricoChecklist).not.toHaveBeenCalled();
    vi.mocked(api.obterHistoricoChecklist).mockResolvedValue(ok({ items: [], totalCount: 0, page: 1, pageSize: 20 }));
    await dialogClick("Descartar e continuar");
    expect(host.textContent).toContain("Histórico do atendimento");
  });
  it("não navega nem permite descarte enquanto um salvamento está pendente", async () => {
    let resolve: (value: typeof fail) => void = () => {};
    vi.mocked(api.atualizarEmpresaChecklist).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    await render(<ChecklistView empresaId={empresaUi.id} initial={empresaUi} />);
    await click("Dados e acesso");
    const mes = [...host.querySelectorAll("label")].find((l) => l.textContent?.trim() === "Mês de protocolo")!.querySelector("input")!;
    await type(mes, "Pendente");
    await click("Histórico real");
    await dialogClick("Salvar e continuar");
    const discard = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Descartar e continuar")!;
    expect(discard.disabled).toBe(true);
    expect(mes.disabled).toBe(true);
    await click("Histórico real");
    expect(api.obterHistoricoChecklist).not.toHaveBeenCalled();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await act(async () => resolve(fail));
    await wait();
    expect(mes.value).toBe("Pendente");
    expect(discard.disabled).toBe(false);
    expect(document.body.textContent).toContain("Há alterações pendentes");
  });
  it("documento sujo protege histórico e fechamento da aba/browser; falha mantém texto", async () => {
    vi.mocked(api.listarDocumentosChecklist).mockResolvedValue(ok({ items: [doc], totalCount: 1, page: 1, pageSize: 10 }));
    vi.mocked(api.atualizarObservacaoDocumento).mockResolvedValue(fail);
    await render(<ChecklistView empresaId={empresaUi.id} initial={empresaUi} />);
    await click("Ver documentos");
    await type(host.querySelectorAll("textarea")[1], "Documento pendente");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    const post = vi.spyOn(window, "postMessage");
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: window.location.origin,
          source: window,
          data: { type: "ALPHA_CHECKLIST_REQUEST_LEAVE", requestId: "close-fixture" },
        }),
      );
    });
    await wait();
    await dialogClick("Salvar e continuar");
    expect(host.querySelectorAll("textarea")[1].value).toBe("Documento pendente");
    expect(post.mock.calls.some(([value]) => typeof value === "object" && value.type === "ALPHA_CHECKLIST_LEAVE_ALLOWED")).toBe(false);
    await dialogClick("Descartar e continuar");
    expect(post).toHaveBeenCalledWith({ type: "ALPHA_CHECKLIST_LEAVE_ALLOWED", requestId: "close-fixture" }, window.location.origin);
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    post.mockRestore();
  });
  it("conta escolhida permanece fora da página/busca e nova montagem reinicia seleção", async () => {
    vi.mocked(accounts.buscarClienteParaVincularOperacional).mockResolvedValue(
      ok({ id: 99, cnpj: "00000000000000", razaoSocial: "Fixture", nomeFantasia: null }),
    );
    vi.mocked(accounts.listarContasPortalChecklist).mockImplementation(async (input) => {
      const f = (input ?? {}) as { page?: number; busca?: string };
      return ok({
        items:
          f.page === 2 || f.busca
            ? [{ id: "conta-b", nome: "Contato B", email: "b@example.invalid" }]
            : [{ id: "conta-a", nome: "Contato A", email: "a@example.invalid" }],
        totalCount: 30,
        page: f.page ?? 1,
        pageSize: 15,
      });
    });
    vi.mocked(api.criarAtendimentoChecklist).mockResolvedValue(ok({ atendimento: empresaUi, replayed: false }));
    const props = { onClose: () => {}, analistas: analistasUi, canAssign: false, onCreated: () => {} };
    await render(<NovoAtendimentoDialog key="primeiro" {...props} />);
    const cnpj = document.querySelector<HTMLInputElement>('input[name="cnpj"]')!;
    await type(cnpj, "00000000000000");
    await dialogClick("Consultar");
    const conta = document.querySelector<HTMLSelectElement>('select[name="conta"]')!;
    await select(conta, "conta-a");
    await dialogClick("Próxima");
    expect(conta.value).toBe("conta-a");
    expect(conta.selectedOptions[0].textContent).toContain("Contato A");
    const busca = [...document.querySelectorAll("label")].find((l) => l.textContent?.trim().startsWith("Buscar conta existente"))!.querySelector("input")!;
    await type(busca, "Contato B");
    expect(conta.value).toBe("conta-a");
    const form = conta.closest("form")!;
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await wait();
    expect(api.criarAtendimentoChecklist).toHaveBeenCalledWith(expect.objectContaining({ clienteId: 99, clienteOperacionalId: "conta-a" }));
    expect(api.criarAtendimentoChecklist).toHaveBeenCalledTimes(1);
    await render(<NovoAtendimentoDialog key="segundo" {...props} />);
    expect(document.querySelector<HTMLSelectElement>('select[name="conta"]')?.value).toBe("NOVA");
    expect(document.querySelector<HTMLInputElement>('input[name="cnpj"]')?.value).toBe("");
    expect([...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Confirmar atendimento")?.disabled).toBe(true);
  });
});

describe("falhas documentais e respostas invertidas do wizard", () => {
  it("resposta A atrasada não substitui confirmação B e criação usa somente masterB", async () => {
    type LookupResult = Awaited<ReturnType<typeof accounts.buscarClienteParaVincularOperacional>>;
    let finishA!: (result: LookupResult) => void, finishB!: (result: LookupResult) => void;
    vi.mocked(accounts.buscarClienteParaVincularOperacional)
      .mockImplementationOnce(() => new Promise((resolve) => { finishA = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishB = resolve; }));
    vi.mocked(api.criarAtendimentoChecklist).mockResolvedValue(ok({ atendimento: empresaUi, replayed: false }));
    await render(<NovoAtendimentoDialog onClose={() => {}} analistas={analistasUi} canAssign={false} onCreated={() => {}} />);
    const input = document.querySelector<HTMLInputElement>('input[name="cnpj"]')!;
    const consult = () => [...document.querySelectorAll("button")].find((b) => b.textContent === "Consultar")!;
    await type(input, "11111111111111"); await act(async () => consult().click());
    await type(input, "22222222222222"); await act(async () => consult().click());
    await act(async () => finishB(ok({ id: 202, cnpj: "22222222222222", razaoSocial: "Master B confirmado", nomeFantasia: null })));
    await act(async () => finishA(ok({ id: 101, cnpj: "11111111111111", razaoSocial: "Master A atrasado", nomeFantasia: null })));
    await wait();
    expect(document.body.textContent).toContain("Master B confirmado");
    expect(document.body.textContent).not.toContain("Master A atrasado");
    await type(document.querySelector<HTMLInputElement>('input[name="nome"]')!, "Synthetic account");
    await type(document.querySelector<HTMLInputElement>('input[name="email"]')!, "synthetic@example.invalid");
    const form = input.closest("form")!;
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await wait();
    expect(api.criarAtendimentoChecklist).toHaveBeenCalledOnce();
    expect(api.criarAtendimentoChecklist).toHaveBeenCalledWith(expect.objectContaining({ clienteId: 202 }));
    expect(api.criarAtendimentoChecklist).not.toHaveBeenCalledWith(expect.objectContaining({ clienteId: 101 }));
  });
  it.each(["Result", "rejected"])("exclusão %s falha conserva documento e permite retry sem novo desaparecimento", async (kind) => {
    const doc = { id: "failed-delete", nome: "Documento preservado.pdf", url: "/api/checklist/documentos/failed-delete/download", uploadedByCliente: true, observacao: null, criadoEm: new Date(), deletadoEm: null, deletadoPorCliente: false, uploadedByUsuarioId: null, uploadedByContaId: "fixture-account", deletadoPorUsuarioId: null, deletadoPorContaId: null };
    vi.mocked(api.listarDocumentosChecklist).mockResolvedValue(ok({ items: [doc], totalCount: 1, page: 1, pageSize: 10 }));
    if (kind === "Result") vi.mocked(api.excluirDocumentoChecklist).mockResolvedValue(fail);
    else vi.mocked(api.excluirDocumentoChecklist).mockRejectedValue(new Error("Falha de rede sintética"));
    await render(<ChecklistView empresaId={empresaUi.id} initial={empresaUi} />);
    await click("Ver documentos"); await click("Remover");
    const confirm = [...document.querySelectorAll("button")].find((button) => button.textContent === "Confirmar")!;
    await act(async () => confirm.click()); await wait();
    expect(host.querySelector('a[href="/api/checklist/documentos/failed-delete/download"]')?.textContent).toBe("Documento preservado.pdf");
    expect(document.body.textContent).toContain(kind === "Result" ? "Revisão mudou" : "Falha de rede sintética");
    expect(confirm.disabled).toBe(false);
    expect(api.excluirDocumentoChecklist).toHaveBeenCalledOnce();
    expect(api.listarDocumentosChecklist).toHaveBeenCalledOnce();
  });
});

describe("alertas duráveis de Checklist", () => {
  const event = (n: number) => ({
    eventId: `evento-${n}`,
    revision: n,
    tipo: "ITEM_ATUALIZADO",
    empresaId: "fixture",
    createdAt: new Date(2026, 9, 22, 10, 0, n).toISOString(),
    lidoEm: null,
    dados: null,
  });
  beforeEach(() => useChecklistNotificacoes.getState().iniciar(Math.random()));
  it("replay deduplica e o51º mantém ID de toast novo com apresentação limitada50", () => {
    const store = useChecklistNotificacoes.getState();
    store.iniciar(7);
    store.receber(
      7,
      Array.from({ length: 50 }, (_, i) => event(i)),
    );
    store.receber(7, [event(49)]);
    expect(useChecklistNotificacoes.getState().notificacoes).toHaveLength(50);
    store.receber(7, [event(50)]);
    expect(useChecklistNotificacoes.getState().notificacoes).toHaveLength(50);
    expect(useChecklistNotificacoes.getState().ultimoEventoId).toBe("evento-50");
  });
  it("erro de leitura mantém alerta não lido; confirmação durável fecha estado", async () => {
    const store = useChecklistNotificacoes.getState();
    store.iniciar(7);
    store.receber(7, [event(1)]);
    vi.mocked(events.marcarEventoChecklistLido).mockResolvedValue(fail);
    expect(await store.marcarLida("evento-1")).toBe(false);
    expect(useChecklistNotificacoes.getState().notificacoes[0].lida).toBe(false);
    vi.mocked(events.marcarEventoChecklistLido).mockResolvedValue(ok({ eventoId: "evento-1", lidoEm: new Date() }));
    expect(await store.marcarLida("evento-1")).toBe(true);
    expect(useChecklistNotificacoes.getState().notificacoes[0].lida).toBe(true);
  });
  it("troca de ator limpa coleção e ignora resposta atrasada do ator anterior", () => {
    const store = useChecklistNotificacoes.getState();
    store.iniciar(7);
    store.receber(7, [event(1)]);
    store.iniciar(8);
    store.receber(7, [event(2)]);
    expect(useChecklistNotificacoes.getState().notificacoes).toEqual([]);
    expect(useChecklistNotificacoes.getState().ultimoEventoId).toBeNull();
  });
});
