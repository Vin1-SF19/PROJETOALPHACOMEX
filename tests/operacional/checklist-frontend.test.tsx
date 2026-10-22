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
async function type(el: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, value);
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
