import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const authMock = vi.hoisted(() => vi.fn());
const acessoMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn(), updateMany: vi.fn() },
  bpmCardHistorico: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: acessoMock }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: notificarMock }));

import { InterromperStandbyFollowUpBpm } from "@/actions/bpm/StandbyFollowUp";
import {
  calcularProximoFollowUpStandby,
  followUpStandbyEstaVencido,
} from "@/lib/bpm/novos-leads";

const CARD_ID = "clw0000000000000card";
const UPDATED_AT = new Date("2026-08-13T12:00:00.000Z");

function instalarTransaction() {
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
}

function cardStandby() {
  return {
    pipelineId: "clw0000000000000pipe",
    etapaId: "clw0000000000000stan",
    status: "ATIVO",
    updatedAt: UPDATED_AT,
    standbyFollowUpInterrompidoEm: null,
    etapa: { nome: "Standby - Follow Up" },
  };
}

describe("Standby - Follow Up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    acessoMock.mockResolvedValue({ autorizado: true });
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardStandby());
    prismaMock.bpmCard.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
    notificarMock.mockResolvedValue(undefined);
    instalarTransaction();
  });

  it("calcula a primeira e as próximas execuções em intervalos de sete dias corridos", () => {
    const entrada = new Date("2026-08-01T12:00:00.000Z");
    expect(calcularProximoFollowUpStandby(entrada, null)).toEqual(new Date("2026-08-08T12:00:00.000Z"));
    expect(followUpStandbyEstaVencido({ entradaEmStandby: entrada, ultimoFollowUpEm: null, agora: new Date("2026-08-07T23:59:59.999Z") })).toBe(false);
    expect(followUpStandbyEstaVencido({ entradaEmStandby: entrada, ultimoFollowUpEm: null, agora: new Date("2026-08-08T12:00:00.000Z") })).toBe(true);
    expect(calcularProximoFollowUpStandby(entrada, new Date("2026-08-08T12:00:00.000Z"))).toEqual(new Date("2026-08-15T12:00:00.000Z"));
  });

  it("reinicia a primeira janela quando o card reentra em Standby", () => {
    const ultimoDaPassagemAnterior = new Date("2026-08-01T12:00:00.000Z");
    const reentrada = new Date("2026-08-10T12:00:00.000Z");

    expect(calcularProximoFollowUpStandby(reentrada, ultimoDaPassagemAnterior)).toEqual(
      new Date("2026-08-17T12:00:00.000Z"),
    );
    expect(followUpStandbyEstaVencido({
      entradaEmStandby: reentrada,
      ultimoFollowUpEm: ultimoDaPassagemAnterior,
      agora: new Date("2026-08-16T23:59:59.999Z"),
    })).toBe(false);
  });

  it("exige autenticação e permissão de edição antes de registrar o opt-out", async () => {
    authMock.mockResolvedValueOnce(null);
    expect(await InterromperStandbyFollowUpBpm({ cardId: CARD_ID, motivo: "Pediu para não receber contatos" })).toEqual({ success: false, error: "Não autorizado" });

    const resultado = await InterromperStandbyFollowUpBpm({ cardId: CARD_ID, motivo: "Pediu para não receber contatos" });
    expect(resultado).toEqual({ success: true });
    expect(acessoMock).toHaveBeenCalledWith(CARD_ID, 7, "COMERCIAL", "editarCard");
    expect(acessoMock).toHaveBeenCalledWith(CARD_ID, 7, "COMERCIAL", "editarCard", prismaMock);
  });

  it("persiste opt-out com CAS, histórico, e realtime somente depois do commit", async () => {
    const resultado = await InterromperStandbyFollowUpBpm({ cardId: CARD_ID, motivo: "Lead solicitou não receber novos contatos." });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: CARD_ID,
        etapaId: "clw0000000000000stan",
        status: "ATIVO",
        updatedAt: UPDATED_AT,
        standbyFollowUpInterrompidoEm: null,
      }),
      data: expect.objectContaining({ standbyFollowUpInterrompidoEm: expect.any(Date) }),
    });
    expect(prismaMock.bpmCardHistorico.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: CARD_ID,
        acao: "STANDBY_FOLLOW_UP_INTERROMPIDO",
        usuarioId: 7,
      }),
    });
    expect(notificarMock).toHaveBeenCalledAfter(prismaMock.bpmCardHistorico.create);
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/AlphaCRM/card/clw0000000000000card");
  });

  it("recusa bypass fora de Standby, opt-out prévio e CAS perdedor", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValueOnce({ ...cardStandby(), etapa: { nome: "Em Tratativa" } });
    expect(await InterromperStandbyFollowUpBpm({ cardId: CARD_ID, motivo: "Pediu bloqueio" })).toEqual({
      success: false,
      error: "O follow-up semanal só pode ser interrompido em Standby - Follow Up.",
    });

    prismaMock.bpmCard.findUnique.mockResolvedValueOnce({ ...cardStandby(), standbyFollowUpInterrompidoEm: new Date() });
    expect(await InterromperStandbyFollowUpBpm({ cardId: CARD_ID, motivo: "Pediu bloqueio" })).toEqual({
      success: false,
      error: "O follow-up deste card já foi interrompido permanentemente.",
    });

    prismaMock.bpmCard.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await InterromperStandbyFollowUpBpm({ cardId: CARD_ID, motivo: "Pediu bloqueio" })).toEqual({
      success: false,
      error: "O card mudou enquanto era atualizado. Recarregue e tente novamente.",
    });
  });

  it("mantém o controle somente no formulário central da etapa Standby", () => {
    const registrar = readFileSync(resolve("src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx"), "utf8");
    const painel = readFileSync(resolve("src/app/PainelAlpha/AlphaCRM/CardModal/PainelStandbyFollowUp.tsx"), "utf8");
    const modal = readFileSync(resolve("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx"), "utf8");

    expect(registrar).toContain("<PainelStandbyFollowUp");
    expect(registrar).toContain("etapaEhStandbyFollowUp(card.etapa.nome)");
    expect(painel).toContain("InterromperStandbyFollowUpBpm");
    expect(painel).toContain("NoLoss");
    expect(modal).not.toContain("PainelStandbyFollowUp");
  });
});
