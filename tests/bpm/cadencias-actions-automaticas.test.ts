import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  exigirAcessoCard: vi.fn(),
  vinculoFindUnique: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: mocks.exigirAcessoCard,
  exigirAcessoConfigPipeline: vi.fn(),
}));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmCardCadencia: { findUnique: mocks.vinculoFindUnique },
    $transaction: mocks.transaction,
  },
}));

import {
  IniciarCadenciaCardBpm,
  PausarCadenciaCardBpm,
  ReativarCadenciaCardBpm,
} from "@/actions/bpm/Cadencias";
import { CADENCIA_MANUAL_DESABILITADA } from "@/lib/bpm/cadencias/ativacao-automatica";

const CARD_ID = "cm12345678901234567890123";
const CADENCIA_ID = "cm22345678901234567890123";
const VINCULO_ID = "cm32345678901234567890123";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "7", role: "ADMINISTRADOR" } });
  mocks.exigirAcessoCard.mockResolvedValue(undefined);
  mocks.vinculoFindUnique.mockResolvedValue({ cardId: CARD_ID });
});

describe("ações manuais de cadência", () => {
  it("recusa início manual depois de autenticar, validar e autorizar", async () => {
    const resposta = await IniciarCadenciaCardBpm({ cardId: CARD_ID, cadenciaId: CADENCIA_ID });

    expect(resposta).toEqual({ success: false, error: CADENCIA_MANUAL_DESABILITADA });
    expect(mocks.exigirAcessoCard).toHaveBeenCalledWith(CARD_ID, 7, "ADMINISTRADOR", "editarCard");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["pausa", PausarCadenciaCardBpm],
    ["reativação", ReativarCadenciaCardBpm],
  ])("recusa %s manual sem alterar o vínculo", async (_nome, acao) => {
    const resposta = await acao({ vinculoId: VINCULO_ID });

    expect(resposta).toEqual({ success: false, error: CADENCIA_MANUAL_DESABILITADA });
    expect(mocks.vinculoFindUnique).toHaveBeenCalledWith({ where: { id: VINCULO_ID }, select: { cardId: true } });
    expect(mocks.exigirAcessoCard).toHaveBeenCalledWith(CARD_ID, 7, "ADMINISTRADOR", "editarCard");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
