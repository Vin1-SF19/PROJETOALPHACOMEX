import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  comercialCheckInDiario: { upsert: vi.fn(), findMany: vi.fn() },
  usuarios: { findMany: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  RegistrarCheckLeadsDia,
  ListarChecksCalendario,
  ListarUsuariosParaCheckIn,
} from "@/actions/ComercialCheckIn";

const SESSION_CLOSER = { user: { id: "7", role: "COMERCIAL" } };
const SESSION_LIDER = { user: { id: "1", role: "Lider Comercial" } };

describe("RegistrarCheckLeadsDia — idempotência (RM-2026-DA0B7D, Fase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(SESSION_CLOSER);
  });

  it("bloqueia sem sessão autenticada", async () => {
    authMock.mockResolvedValue(null);
    await expect(RegistrarCheckLeadsDia()).rejects.toThrow("Não autenticado");
    expect(prismaMock.comercialCheckInDiario.upsert).not.toHaveBeenCalled();
  });

  it("usa upsert pela chave única (usuarioId, data) — segunda chamada no mesmo dia não duplica", async () => {
    const registroExistente = { id: 1, usuarioId: 7, data: new Date(2026, 8, 3) };
    prismaMock.comercialCheckInDiario.upsert.mockResolvedValue(registroExistente);

    const primeira = await RegistrarCheckLeadsDia(new Date(2026, 8, 3));
    const segunda = await RegistrarCheckLeadsDia(new Date(2026, 8, 3));

    expect(primeira.success).toBe(true);
    expect(segunda.success).toBe(true);
    expect(prismaMock.comercialCheckInDiario.upsert).toHaveBeenCalledTimes(2);
    const chamadas = prismaMock.comercialCheckInDiario.upsert.mock.calls;
    expect(chamadas[0][0].where.checkin_dia_pk).toEqual(chamadas[1][0].where.checkin_dia_pk);
    expect(chamadas[0][0].update).toEqual({});
  });

  it("retorna erro tratado (sem lançar) quando a tabela ainda não existe", async () => {
    prismaMock.comercialCheckInDiario.upsert.mockRejectedValue(new Error("no such table"));

    const resultado = await RegistrarCheckLeadsDia();

    expect(resultado.success).toBe(false);
    expect(resultado.error).toMatch(/migration/i);
  });
});

describe("ListarChecksCalendario — gate de auditoria (RM-2026-DA0B7D, Fase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.comercialCheckInDiario.findMany.mockResolvedValue([]);
  });

  it("closer comum não consegue consultar calendário de outro usuário", async () => {
    authMock.mockResolvedValue(SESSION_CLOSER);
    await expect(ListarChecksCalendario(8, 2026, 99)).rejects.toThrow("Acesso negado");
    expect(prismaMock.comercialCheckInDiario.findMany).not.toHaveBeenCalled();
  });

  it("closer comum consegue consultar o próprio calendário", async () => {
    authMock.mockResolvedValue(SESSION_CLOSER);
    await ListarChecksCalendario(8, 2026, 7);
    expect(prismaMock.comercialCheckInDiario.findMany).toHaveBeenCalledTimes(1);
  });

  it("Lider Comercial consegue consultar calendário de outro closer (auditoria)", async () => {
    authMock.mockResolvedValue(SESSION_LIDER);
    await ListarChecksCalendario(8, 2026, 99);
    const where = prismaMock.comercialCheckInDiario.findMany.mock.calls[0][0].where;
    expect(where.usuarioId).toBe(99);
  });

  it("propaga falha de leitura para a UI exibir o estado de erro", async () => {
    authMock.mockResolvedValue(SESSION_CLOSER);
    prismaMock.comercialCheckInDiario.findMany.mockRejectedValue(new Error("no such table"));

    await expect(ListarChecksCalendario(8, 2026, 7)).rejects.toThrow(
      "Falha ao carregar o calendário de check-in."
    );
  });
});

describe("ListarUsuariosParaCheckIn — gate de role (RM-2026-DA0B7D, Fase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usuarios.findMany.mockResolvedValue([]);
  });

  it("rejeita closer comum (sem role autorizada)", async () => {
    authMock.mockResolvedValue(SESSION_CLOSER);
    await expect(ListarUsuariosParaCheckIn()).rejects.toThrow("Acesso negado");
    expect(prismaMock.usuarios.findMany).not.toHaveBeenCalled();
  });

  it("permite Lider Comercial", async () => {
    authMock.mockResolvedValue(SESSION_LIDER);
    await ListarUsuariosParaCheckIn();
    expect(prismaMock.usuarios.findMany).toHaveBeenCalledTimes(1);
  });
});
