// @vitest-environment happy-dom
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn() }));
import React, { act, createElement as h, Suspense, use, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SeletorPipelineBoard } from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/SeletorPipelineBoard";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, disabled, onValueChange, children }: { value: string; disabled?: boolean; onValueChange: (v: string) => void; children: React.ReactNode }) =>
    h("select", { value, disabled, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange(e.target.value) }, children),
  SelectTrigger: ({ children, ...props }: React.ComponentProps<"span">) => h("span", props, children),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => h(React.Fragment, {}, children),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => h("option", { value }, children),
}));

it("mantém navegação pendente, anuncia carregamento e ignora nova seleção até o destino resolver", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  let resolver!: () => void;
  const resposta = new Promise<void>((resolve) => { resolver = resolve; });
  function Destino({ abrir }: { abrir: boolean }) {
    if (abrir) use(resposta);
    return null;
  }
  function Harness() {
    const [abrir, setAbrir] = useState(false);
    router.push.mockImplementation(() => setAbrir(true));
    return h(React.Fragment, {},
      h(SeletorPipelineBoard, { atual: { id: "atual", nome: "Atual" }, pipelines: [{ id: "atual", nome: "Atual" }, { id: "destino", nome: "Destino" }] }),
      h(Destino, { abrir }));
  }
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(h(Suspense, { fallback: "Carregando rota" }, h(Harness))));
    const select = container.querySelector("select")!;
    const selecionar = () => { select.value = "destino"; select.dispatchEvent(new Event("change", { bubbles: true })); };
    await act(async () => selecionar());
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/PainelAlpha/AlphaCRM/pipeline/destino");
    expect(select.disabled).toBe(true);
    expect(container.querySelector('[aria-label="Trocar funil"]')?.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Alterando funil…");
    await act(async () => selecionar());
    expect(router.push).toHaveBeenCalledTimes(1);
    await act(async () => { resolver(); await resposta; });
    expect(select.disabled).toBe(false);
    expect(container.querySelector('[aria-label="Trocar funil"]')?.getAttribute("aria-busy")).toBe("false");
    expect(container.querySelector('[role="status"]')).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); router.push.mockReset(); }
});
