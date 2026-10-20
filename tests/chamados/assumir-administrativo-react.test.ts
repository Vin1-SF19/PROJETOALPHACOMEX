// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usuario: vi.fn(), chamados: vi.fn(), assumir: vi.fn(), erro: vi.fn(), sucesso: vi.fn(), chat: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: vi.fn(async () => ({ user: { id: "3", usuario: "ti" } })) }));
vi.mock("@/lib/prisma", () => ({ default: {
  usuarios: { findUnique: mocks.usuario },
  setor: { findMany: vi.fn(async () => [{ id: 14, nome: "TI" }, { id: 5, nome: "COMERCIAL" }, { id: 8, nome: "FINANCEIRO" }]) },
  chamados: { findMany: mocks.chamados },
} }));
vi.mock("@/actions/chamados", () => ({ assumirChamado: mocks.assumir }));
vi.mock("@/actions/protocolos", () => ({ listarTemplates: vi.fn(async () => []) }));
vi.mock("@/components/FiltroChamado", () => ({ FiltroChamadosCards: () => null }));
vi.mock("@/components/ChatChamado", () => ({ default: (props: unknown) => { mocks.chat(props); return null; } }));
vi.mock("@/components/Notas/Contexto/NotesContextButton", () => ({ NotesContextButton: () => null }));
vi.mock("@/components/ModalProtocolo", () => ({ default: () => h("div", { role: "dialog" }, "Protocolo aberto") }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => h("a", { href }, children) }));
vi.mock("sonner", () => ({ toast: { error: mocks.erro, success: mocks.sucesso } }));

import Chamados from "@/app/PainelAlpha/Chamados/page";

const aberto = {
  id: 265, usuarioId: 7, titulo: "Solicitação de teste", descricao: "Demanda para outro setor",
  categoria: "Outros", prioridade: "MEDIA", status: "ABERTO", tecnicoId: null, tecnicoSolicitadoId: null,
  tecnicoSolicitado: null, setorDestinoId: 5, setorDestino: { id: 5, nome: "COMERCIAL", ativo: true, isBase: false },
  solucao: null, createdAt: new Date("2026-10-19T10:00:00Z"),
  solicitante: { nome: "Solicitante", usuario: "solicitante" }, mensagens: [],
};
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.usuario.mockResolvedValue({ id: 3, nome: "Administrador TI", role: "TI", status: "ATIVO" });
  mocks.chamados.mockResolvedValue([aberto]);
  mocks.assumir.mockResolvedValue({ success: true, chamado: { id: 265, tecnicoId: 3, status: "EM_ATENDIMENTO" } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function renderizarPagina() {
  const pagina = await Chamados({ searchParams: Promise.resolve({ status: "ABERTO" }) });
  await act(async () => root.render(pagina));
}
function botao(texto: string) {
  return [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === texto);
}
async function clicar(texto: string) {
  const elemento = botao(texto);
  expect(elemento, texto).toBeDefined();
  await act(async () => elemento!.click());
}

describe("página e detalhe reais — administração atende outro setor", () => {
  it("TI vê Assumir e pode abrir protocolo imediatamente após assumir destino Comercial", async () => {
    await renderizarPagina();
    await clicar("Detalhes");
    expect(botao("Assumir Chamado")).toBeDefined();
    await clicar("Assumir Chamado");
    expect(mocks.assumir).toHaveBeenCalledWith(265);
    expect(botao("Assumir Chamado")).toBeUndefined();
    expect(botao("Finalizar com Protocolo")).toBeDefined();
    await clicar("Finalizar com Protocolo");
    expect(document.body.textContent).toContain("Protocolo aberto");
  });

  it("mantém ação e informa erro quando a assunção falha", async () => {
    mocks.assumir.mockResolvedValue({ success: false, error: "Chamado já foi assumido por outro técnico" });
    await renderizarPagina();
    await clicar("Detalhes");
    await clicar("Assumir Chamado");
    expect(mocks.erro).toHaveBeenCalledWith("Chamado já foi assumido por outro técnico");
    expect(botao("Assumir Chamado")).toBeDefined();
    expect(botao("Finalizar com Protocolo")).toBeUndefined();
  });

  it("não mostra assunção ao colaborador comum de outro setor", async () => {
    mocks.usuario.mockResolvedValue({ id: 3, nome: "Colaborador", role: "FINANCEIRO", status: "ATIVO" });
    mocks.chamados.mockResolvedValue([{ ...aberto, usuarioId: 3 }]);
    await renderizarPagina();
    await clicar("Detalhes");
    expect(botao("Assumir Chamado")).toBeUndefined();
  });

  it("não mostra assunção ao TI quando há reserva para outra pessoa", async () => {
    mocks.chamados.mockResolvedValue([{ ...aberto, tecnicoSolicitadoId: 9 }]);
    await renderizarPagina();
    await clicar("Detalhes");
    expect(botao("Assumir Chamado")).toBeUndefined();
  });

  it("preserva resposta e contador de mensagens do TI atribuído em outro setor", async () => {
    mocks.chamados.mockResolvedValue([{
      ...aberto, tecnicoId: 3, status: "EM_ATENDIMENTO",
      mensagens: [{ id: 1, autorId: 7, texto: "Mensagem", lida_usuario: true, lida_admin: false, createdAt: new Date(), autor: { id: 7, nome: "Solicitante", usuario: "solicitante" } }],
    }]);
    const pagina = await Chamados({ searchParams: Promise.resolve({}) });
    await act(async () => root.render(pagina));
    expect(mocks.chat).toHaveBeenCalledWith(expect.objectContaining({ podeResponder: true, contagem: 1 }));
    await clicar("Detalhes");
    expect(botao("Finalizar com Protocolo")).toBeDefined();
    expect(botao("Assumir Chamado")).toBeUndefined();
  });
});
