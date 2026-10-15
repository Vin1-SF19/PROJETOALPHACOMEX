// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setores: vi.fn(), erro: vi.fn(), cancelar: vi.fn(), atualizar: undefined as (() => void) | undefined }));
vi.mock("@/actions/PopAcessos", () => ({ getSetoresParaUploadPop: mocks.setores }));
vi.mock("@/actions/UploadDocs", () => ({ uploadDocumento: vi.fn() }));
vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { user: { nome: "Teste" } } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.erro, success: vi.fn() } }));
vi.mock("@/lib/gestao-setores-sync", () => ({
  assinarAtualizacaoSetores: (callback: () => void) => { mocks.atualizar = callback; return mocks.cancelar; },
}));

import AdminUploadDocs from "@/app/PainelAlpha/GerenciamentoArquivos/page";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => [] }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("mostra setores reais, atualiza o select e preserva apenas escolhas ainda disponíveis", async () => {
  mocks.setores.mockResolvedValue({ success: true, setores: ["Diretrizes", "Sucesso do Cliente", "TI"] });
  await act(async () => root.render(React.createElement(AdminUploadDocs)));
  const select = container.querySelector<HTMLSelectElement>('select[name="setor"]')!;
  expect([...select.options].map((o) => o.value)).toEqual(["", "Diretrizes", "Sucesso do Cliente", "TI"]);

  await act(async () => {
    select.value = "TI";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  mocks.setores.mockResolvedValue({ success: true, setores: ["Diretrizes", "TI", "Marketing"] });
  await act(async () => mocks.atualizar?.());
  expect(select.value).toBe("TI");
  expect([...select.options].map((o) => o.value)).toContain("Marketing");
  // O nome cadastrado TI continua oferecendo as pastas legadas de T.I.
  await act(async () => {
    const pasta = [...container.querySelectorAll("span")].find((span) => span.textContent === "SELECIONAR OU CRIAR PASTA...")!;
    pasta.parentElement!.parentElement!.click();
  });
  expect([...container.querySelectorAll("button")].some((button) => button.textContent?.includes("CODIGOS LIVRES"))).toBe(true);

  mocks.setores.mockResolvedValue({ success: true, setores: ["Diretrizes", "Marketing"] });
  await act(async () => mocks.atualizar?.());
  expect(select.value).toBe("");
  expect([...select.options].map((o) => o.value)).not.toContain("TI");
});

it("desabilita o seletor durante a consulta e apresenta falha sem lista fixa de fallback", async () => {
  let rejeitar!: (error: Error) => void;
  mocks.setores.mockReturnValue(new Promise((_resolve, reject) => { rejeitar = reject; }));
  await act(async () => root.render(React.createElement(AdminUploadDocs)));
  const select = container.querySelector<HTMLSelectElement>('select[name="setor"]')!;
  expect(select.disabled).toBe(true);
  expect(select.textContent).toContain("CARREGANDO SETORES");
  await act(async () => rejeitar(new Error("Indisponível")));
  expect(select.disabled).toBe(true);
  expect(select.options).toHaveLength(1);
  expect(mocks.erro).toHaveBeenCalledOnce();
});
