import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  upsert: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/pre-analise/access", () => ({ canAccessPreAnalise: mocks.access }));
vi.mock("@/lib/prisma", () => ({ default: { radar_fiscal: { upsert: mocks.upsert } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { protocolarNoRadarAction } from "@/actions/RadarFiscal";

const valido = {
  cnpj: "33000167000101",
  consultaStatus: "completa",
  qualificacao: "PREMIUM",
  regimeEA: "LUCRO REAL",
  razaoSocial: "BANCO DO BRASIL S.A.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "1", role: "ADMIN" } });
  mocks.access.mockResolvedValue(true);
  mocks.upsert.mockResolvedValue({});
});

describe("protocolo manual no RadarFiscal", () => {
  it.each<{ payload: unknown; reason: string }>([
    { payload: { ...valido, consultaStatus: "parcial" }, reason: "consulta parcial" },
    { payload: { ...valido, consultaStatus: undefined }, reason: "status ausente" },
    { payload: { ...valido, qualificacao: null }, reason: "qualificação ausente" },
    { payload: { ...valido, regimeEA: null }, reason: "regime ausente" },
  ])("não grava $reason", async ({ payload, reason }) => {
    const result = await protocolarNoRadarAction(payload);
    expect(result, reason).toMatchObject({ success: false });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("grava consulta completa e revalida listagem", async () => {
    const result = await protocolarNoRadarAction(valido);
    expect(result).toEqual({ success: true });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ where: { cnpj: valido.cnpj }, create: { qualificacao: "PREMIUM", regime_ea: "LUCRO REAL" } });
    expect(mocks.revalidate).toHaveBeenCalled();
  });

  it("nega acesso antes da gravação", async () => {
    mocks.access.mockResolvedValue(false);
    const result = await protocolarNoRadarAction(valido);
    expect(result).toMatchObject({ success: false, error: "Não autorizado" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("não expõe detalhes internos quando a gravação falha", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.upsert.mockRejectedValue(new Error("database secret: connection string"));
    try {
      const result = await protocolarNoRadarAction(valido);
      expect(result).toEqual({ success: false, error: "Não foi possível protocolar a consulta" });
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining("database secret: connection string"));
    } finally {
      log.mockRestore();
    }
  });
});
