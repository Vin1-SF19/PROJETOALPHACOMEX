// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ criar: vi.fn(), fechar: vi.fn() }));
vi.mock("../../auth", () => ({ auth: async () => ({ user: { id: "1", role: "Admin" } }) }));
vi.mock("@/lib/prisma", () => ({ default: {
  curso: { findMany: async () => [], create: m.criar },
} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/actions/GetVideos", () => ({ getModulos: async () => [] }));
vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import ModalCurso from "@/app/PainelAlpha/AlphaSkills/Gerenciamento/CriarCurso";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  m.criar.mockResolvedValue({ id: "curso-1" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it.each([
  ["Lider Comercial", false], ["Lider Comercial", true],
  ["Lider Operacional", false], ["Lider Operacional", true],
] as const)("seleciona %s e grava pelo fluxo real de cursos (lote: %s)", async (setorNome, lote) => {
  await act(async () => root.render(React.createElement(ModalCurso, { isOpen: true, onClose: m.fechar })));
  if (lote) {
    const modo = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Lote")!;
    await act(async () => modo.click());
  }
  const input = container.querySelector<HTMLInputElement>(lote ? 'input[placeholder="Nome do curso *"]' : 'input[placeholder="Nome do Curso *"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Formação liderança");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const setor = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === setorNome)!;
  expect(setor).toBeDefined();
  await act(async () => setor.click());
  const salvar = [...container.querySelectorAll("button")].find((b) => lote ? b.textContent?.includes("Criar 1 curso") : b.textContent?.includes("Criar Novo Curso"))!;
  await act(async () => salvar.click());
  expect(m.criar).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ nome: "Formação liderança", setores: { create: [{ setor: setorNome }] } }),
  }));
  expect(m.fechar).toHaveBeenCalledOnce();
});
