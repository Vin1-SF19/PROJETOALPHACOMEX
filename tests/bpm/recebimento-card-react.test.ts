// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ assumir: vi.fn(), reconciliar: vi.fn() }));
vi.mock("@/actions/bpm/Recebimentos", () => ({ AssumirRecebimentoPipelineBpm: mocks.assumir }));
vi.mock("@/lib/bpm/notificacoes-navegacao", () => ({ solicitarReconciliacaoLeadsBpm: mocks.reconciliar }));
import { PainelRecebimentoCard } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelRecebimentoCard";
import type { RecebimentoPipelineBpm } from "@/lib/bpm/notificacoes-leads";
const recebido: RecebimentoPipelineBpm = {
  recepcaoId: "recepcao", status: "PENDENTE", recebidoEm: "2026-10-22T12:00:00.000Z", podeAssumir: true,
  assumidoEm: null, assumidoPor: null, motivoImpedimentoAssuncao: null,
  responsaveisAnteriores: [{ pipelineId: "comercial", pipelineNome: "Revisão Radar", setor: "COMERCIAL", usuarioId: 2, nome: "Sheila" }],
};
describe("assunção explícita no setor de destino", () => {
  let host: HTMLDivElement; let root: ReturnType<typeof createRoot>; const atualizar = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    mocks.assumir.mockResolvedValue({ success: true });
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  const render = async (recebimento = recebido) => { await act(async () => root.render(h(PainelRecebimentoCard, { cardId: "card-f", versao: 3, pipelineNome: "Financeiro", recebimento, onAtualizado: atualizar }))); };
  it("abrir não assume e preserva nomes anteriores; só clique envia versão/recepção sem usuário arbitrário", async () => {
    await render(); expect(mocks.assumir).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Responsável no Comercial: Sheila"); expect(host.textContent).toContain("Financeiro: ninguém assumiu ainda");
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    expect(mocks.assumir).toHaveBeenCalledExactlyOnceWith({ cardId: "card-f", recepcaoId: "recepcao", versaoEsperada: 3 });
    expect(atualizar).toHaveBeenCalledOnce(); expect(mocks.reconciliar).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Assunção confirmada"); expect(host.querySelector("button")?.disabled).toBe(true);
    await render({ ...recebido, status: "ASSUMIDO", podeAssumir: false, assumidoEm: "2026-10-22T12:01:00.000Z",
      assumidoPor: { pipelineId: "f", pipelineNome: "Financeiro", setor: "FINANCEIRO", usuarioId: 4, nome: "Maria" } });
    expect(host.textContent).toContain("Responsável no Financeiro: Maria"); expect(host.textContent).toContain("Sheila"); expect(host.querySelector("button")).toBeNull();
  });
  it("bloqueia cliques repetidos enquanto a assunção confirma e mantém pendência no erro", async () => {
    let resolver!: (value: { success: boolean; error: string }) => void;
    mocks.assumir.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    await render(); const botao = host.querySelector<HTMLButtonElement>("button")!;
    await act(async () => { botao.click(); botao.click(); }); expect(mocks.assumir).toHaveBeenCalledOnce(); expect(botao.disabled).toBe(true);
    await act(async () => resolver({ success: false, error: "Outro integrante já assumiu. Atualize o card." }));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Outro integrante");
    expect(host.textContent).toContain("ninguém assumiu ainda"); expect(botao.disabled).toBe(false);
  });
  it("integrante com leitura vê a pendência e motivo, sem receber ação proibida em Boas-vindas", async () => {
    await render({ ...recebido, podeAssumir: false, motivoImpedimentoAssuncao: "Esta etapa só pode ser assumida pelo responsável de Boas-vindas." });
    expect(host.textContent).toContain("Sheila"); expect(host.textContent).toContain("só pode ser assumida");
    expect(host.querySelector("button")).toBeNull(); expect(mocks.assumir).not.toHaveBeenCalled();
  });
});
