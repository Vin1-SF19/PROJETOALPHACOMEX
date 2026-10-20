// @vitest-environment happy-dom
import { act, createElement as h, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ concluir: vi.fn(), erro: vi.fn() }));
vi.mock("@/actions/bpm/Tarefas", () => ({ ConcluirTarefaBpm: mocks.concluir, CriarTarefaBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.erro, success: vi.fn() } }));
import { PainelTarefasPorTipo } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo";
const base = {
  id: "cm12345678901234567890123", titulo: "Retornar Green Coast", tipo: "TAREFA", status: "PENDENTE",
  concluidaEm: null, descricao: null, prazo: new Date("2026-10-20T15:00:00Z"),
  alertaEm: new Date("2026-10-20T14:00:00Z"), alertaDisparadoEm: null, prioridade: "NORMAL",
  cardChecklistId: null, responsavel: { id: 7, nome: "Maria" },
} as ComponentProps<typeof PainelTarefasPorTipo>["tarefas"][number];
function deferred() {
  let resolve!: (value: { success: boolean; error?: string }) => void;
  const promise = new Promise<{ success: boolean; error?: string }>((r) => { resolve = r; });
  return { promise, resolve };
}
describe("conclusão instantânea de tarefas no card", () => {
  let host: HTMLDivElement; let root: Root;
  const atualizar = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  async function render(tarefas = [base], podeTrabalharTarefas = true) {
    await act(async () => root.render(h(PainelTarefasPorTipo, {
      cardId: "cm12345678901234567890125", responsavelId: 7, tarefas, accent: "1,2,3",
      podeTrabalharTarefas, onAtualizado: atualizar,
    })));
  }
  const concluir = () => host.querySelector<HTMLButtonElement>('button[aria-label="Concluir tarefa"]')!;

  it("marca antes da resposta, trava cliques repetidos e conserva o estado diante de snapshot antigo", async () => {
    const request = deferred(); mocks.concluir.mockReturnValue(request.promise);
    await render(); const botao = concluir();
    await act(async () => { botao.click(); botao.click(); botao.click(); });
    expect(mocks.concluir).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Salvando...");
    expect(host.textContent).toContain("Concluída");
    expect(botao.disabled).toBe(true);
    expect(atualizar).not.toHaveBeenCalled();
    await render([{ ...base }]);
    expect(host.textContent).toContain("Concluída");
    await act(async () => request.resolve({ success: true }));
    expect(atualizar).toHaveBeenCalledOnce();
    expect(host.textContent).not.toContain("Salvando...");
    await render([{ ...base }]);
    expect(host.textContent).toContain("Concluída");
  });

  it("desfaz somente a tarefa que falhou e permite tentar novamente", async () => {
    const a = deferred(); const b = deferred();
    mocks.concluir.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockResolvedValue({ success: true });
    await render([base, { ...base, id: "cm12345678901234567890126", titulo: "Enviar proposta" }]);
    const botoes = host.querySelectorAll<HTMLButtonElement>('button[aria-label="Concluir tarefa"]');
    await act(async () => { botoes[0].click(); botoes[1].click(); });
    await act(async () => { a.resolve({ success: false, error: "Não autorizado" }); b.resolve({ success: true }); });
    expect(mocks.erro).toHaveBeenCalledWith("Não autorizado");
    expect(host.textContent).toContain("Pendente");
    expect(host.textContent).toContain("Concluída");
    await act(async () => concluir().click());
    expect(mocks.concluir).toHaveBeenCalledTimes(3);
  });

  it("preserva permissões e a conclusão por procedimento", async () => {
    await render([base], false);
    expect(concluir().disabled).toBe(true);
    await act(async () => concluir().click());
    expect(mocks.concluir).not.toHaveBeenCalled();
    const abrir = vi.fn(); window.addEventListener("bpm:abrir-pendencias-checklist", abrir);
    await render([{ ...base, cardChecklistId: "procedimento-1" }]);
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Abrir procedimento para concluir"]')!.click());
    expect(abrir).toHaveBeenCalledOnce(); expect(mocks.concluir).not.toHaveBeenCalled();
    window.removeEventListener("bpm:abrir-pendencias-checklist", abrir);
  });
});
