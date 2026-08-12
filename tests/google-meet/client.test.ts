import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { paginarGoogleMeet } from "@/lib/google-meet/client";

describe("paginação Google Meet", () => {
  it("percorre todas as páginas sem perder a ordem", async () => {
    const buscar = vi.fn(async (token?: string) => token
      ? { itens: [3], nextPageToken: null }
      : { itens: [1, 2], nextPageToken: "pagina-2" });

    await expect(paginarGoogleMeet(buscar)).resolves.toEqual([1, 2, 3]);
    expect(buscar).toHaveBeenNthCalledWith(1, undefined);
    expect(buscar).toHaveBeenNthCalledWith(2, "pagina-2");
  });

  it("interrompe token repetido para não entrar em loop", async () => {
    await expect(paginarGoogleMeet(async () => ({
      itens: [1],
      nextPageToken: "repetido",
    }))).rejects.toThrow("paginação inválida");
  });

  it("impõe teto de itens antes de consumir resposta ilimitada", async () => {
    await expect(paginarGoogleMeet(async () => ({
      itens: [1, 2, 3],
      nextPageToken: null,
    }), { maxItens: 2 })).rejects.toThrow("limite seguro de itens");
  });

  it("repete falha transitória de API com limite", async () => {
    const buscar = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("rate limit"), { code: 429 }))
      .mockResolvedValueOnce({ itens: [1], nextPageToken: null });

    await expect(paginarGoogleMeet(buscar)).resolves.toEqual([1]);
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});
