import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoMock = vi.hoisted(() => vi.fn());
const sincronizarMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: exigirAcessoMock }));
vi.mock("@/lib/bpm/transcricao-reuniao-server", () => ({
  sincronizarTranscricaoCardBpm: sincronizarMock,
}));

import { SincronizarTranscricaoReuniaoBpm } from "@/actions/bpm/TranscricaoMeet";

describe("SincronizarTranscricaoReuniaoBpm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloqueia antes de ownership e Google quando não há sessão", async () => {
    authMock.mockResolvedValue(null);

    await expect(SincronizarTranscricaoReuniaoBpm({ cardId: "card-1" }))
      .resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(exigirAcessoMock).not.toHaveBeenCalled();
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it("valida ownership antes de iniciar a sincronização", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    exigirAcessoMock.mockRejectedValue(new Error("Não autorizado"));

    await expect(SincronizarTranscricaoReuniaoBpm({ cardId: "card-1" }))
      .resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(exigirAcessoMock).toHaveBeenCalledWith("card-1", 42, "User", "editarCard");
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it("propaga o estado pendente sem simulá-lo como erro", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    exigirAcessoMock.mockResolvedValue({ autorizado: true });
    sincronizarMock.mockResolvedValue({
      status: "PENDENTE",
      motivo: "A transcrição ainda está sendo processada pelo Google Meet.",
    });

    const resultado = await SincronizarTranscricaoReuniaoBpm({ cardId: "card-1" });

    expect(resultado).toEqual({
      success: true,
      data: {
        status: "PENDENTE",
        motivo: "A transcrição ainda está sendo processada pelo Google Meet.",
      },
    });
    expect(sincronizarMock).toHaveBeenCalledWith("card-1", "manual", expect.any(Function));

    const revalidar = sincronizarMock.mock.calls[0][2] as (tx: object) => Promise<void>;
    const tx = { bpmCard: {} };
    await expect(revalidar(tx)).resolves.toBeUndefined();
    expect(exigirAcessoMock).toHaveBeenLastCalledWith("card-1", 42, "User", "editarCard", tx);
  });
});
