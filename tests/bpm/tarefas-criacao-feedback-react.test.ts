// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const criarTarefa = vi.hoisted(() => vi.fn());
vi.mock("@/actions/bpm/Tarefas", () => ({ CriarTarefaBpm: criarTarefa, ConcluirTarefaBpm: vi.fn() }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/BpmDateTimeField", async () => {
  const ReactModule = await import("react");
  return { BpmDateTimeField: ({ label, onChange, error }: { label: string; onChange: (value: string) => void; error?: string }) =>
    ReactModule.createElement("div", null,
      ReactModule.createElement("button", { type: "button", onClick: () => onChange(label === "Prazo" ? "2026-09-25T12:00" : "2026-09-25T11:00") }, label),
      error && ReactModule.createElement("span", { role: "alert" }, error),
    ) };
});

import { PainelTarefasPorTipo } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo";

describe("criação de tarefa no card", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  async function abrirEPreencherDatas() {
    await act(async () => root.render(h(PainelTarefasPorTipo, {
      cardId: "cmubiy7zm00010agmru1wbspt", responsavelId: 37, tarefas: [],
      accent: "1,2,3", podeTrabalharTarefas: true, onAtualizado: vi.fn(),
    })));
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    for (const label of ["Prazo", "Alerta"]) {
      const button = [...host.querySelectorAll("button")].find((item) => item.textContent === label)!;
      await act(async () => button.click());
    }
  }

  async function salvar() {
    const button = [...host.querySelectorAll("button")].find((item) => item.textContent === "Criar Tarefa")!;
    await act(async () => button.click());
  }

  it("mostra título obrigatório no campo antes de chamar o servidor", async () => {
    await abrirEPreencherDatas();
    await salvar();
    expect(host.textContent).toContain("Título é obrigatório.");
    expect(host.querySelector('input[aria-invalid="true"]')).toBeTruthy();
    expect(criarTarefa).not.toHaveBeenCalled();
  });

  it("exibe o motivo específico retornado pela validação do servidor", async () => {
    criarTarefa.mockResolvedValue({ success: false, error: { formErrors: [], fieldErrors: { titulo: ["Título excede o limite permitido."] } } });
    await abrirEPreencherDatas();
    const input = host.querySelector<HTMLInputElement>('input[aria-required="true"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Retornar contato");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await salvar();
    expect(criarTarefa).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Título excede o limite permitido.");
    expect(host.textContent).not.toContain("Não foi possível criar a tarefa.");
  });
});
