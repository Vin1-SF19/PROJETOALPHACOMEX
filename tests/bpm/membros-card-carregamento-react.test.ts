// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { SeletorMembrosCard } from "@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard";

const mocks = vi.hoisted(() => ({ listar: vi.fn(), atualizar: vi.fn(), erro: vi.fn() }));
vi.mock("@/actions/bpm/Membros", () => ({
  ListarUsuariosVinculaveisCardBpm: mocks.listar,
  AtualizarMembrosCardBpm: mocks.atualizar,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.erro } }));

afterEach(() => vi.resetAllMocks());

it("libera o carregamento após falha e permite reabrir e vincular pessoa ao card RD", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const cardId = `rdcard_${"a".repeat(28)}`;
  const usuario = { id: 9, nome: "Pessoa disponível", imagemUrl: null };
  const membros = [{ userId: 9, role: "PARTICIPANTE", usuario }];
  mocks.listar.mockRejectedValueOnce(new Error("Falha de rede"))
    .mockResolvedValueOnce({ success: true, data: [usuario] });
  mocks.atualizar.mockResolvedValue({ success: true, data: membros });
  const onMembrosAtualizados = vi.fn();
  const onAtualizado = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(h(SeletorMembrosCard, {
      cardId, membros: [], podeGerenciar: true, accent: "1,2,3", onMembrosAtualizados, onAtualizado,
    })));
    const abrir = () => (container.querySelector('[aria-label="Gerenciar pessoas vinculadas ao card"]') as HTMLButtonElement).click();
    await act(async () => abrir());
    expect(mocks.erro).toHaveBeenCalledWith(expect.stringContaining("Feche e abra"));
    expect(container.textContent).not.toContain("Carregando pessoas");
    await act(async () => abrir());
    await act(async () => abrir());
    expect(mocks.listar).toHaveBeenLastCalledWith({ cardId });
    const option = container.querySelector('[role="option"]') as HTMLButtonElement;
    expect(option.textContent).toContain(usuario.nome);
    await act(async () => option.click());
    expect(mocks.atualizar).toHaveBeenCalledExactlyOnceWith({ cardId, userIds: [9] });
    expect(onMembrosAtualizados).toHaveBeenCalledWith(membros);
    expect(onAtualizado).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
