import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  usuarios: { findMany: vi.fn() },
  comercialPerformance: { findMany: vi.fn(), upsert: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  getDiasComLancamento,
  getPerformanceAcumulada,
  getPerformanceDiaria,
  getPerformanceMarketing,
  listarClosersAlphaLeads,
  upsertPerformance,
} from "@/actions/ComercialControle";

const SESSION_LIDER = {
  user: { nome: "GESTORA COMERCIAL", usuario: "gestora", role: "Lider Comercial" },
};
const SESSION_CLOSER = {
  user: { nome: "CLOSER ALFA", usuario: "closer", role: "COMERCIAL" },
};

describe("visibilidade dos lançamentos por closer no Alpha Leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.comercialPerformance.findMany.mockResolvedValue([]);
  });

  it("lista somente as quatro closers autorizadas na ordem definida para a UI", async () => {
    authMock.mockResolvedValue(SESSION_LIDER);
    prismaMock.usuarios.findMany.mockResolvedValue([
      { id: 36, nome: "DOUGLAS WESLEI RIBEIRO MACEDO" },
      { id: 22, nome: "GISELLE GLEYCE SOUZA SANTOS" },
      { id: 24, nome: "NATHALIA FERNANDA FORTES" },
      { id: 16, nome: "SHEILA ANGELICA BAHRI" },
    ]);

    await expect(listarClosersAlphaLeads()).resolves.toEqual([
      { id: 22, nome: "GISELLE GLEYCE SOUZA SANTOS" },
      { id: 16, nome: "SHEILA ANGELICA BAHRI" },
      { id: 24, nome: "NATHALIA FERNANDA FORTES" },
      { id: 36, nome: "DOUGLAS WESLEI RIBEIRO MACEDO" },
    ]);
    expect(prismaMock.usuarios.findMany).toHaveBeenCalledWith({
      where: {
        status: "ATIVO",
        role: { in: ["COMERCIAL", "Lider Comercial"] },
        nome: {
          in: [
            "GISELLE GLEYCE SOUZA SANTOS",
            "SHEILA ANGELICA BAHRI",
            "NATHALIA FERNANDA FORTES",
            "DOUGLAS WESLEI RIBEIRO MACEDO",
          ],
        },
      },
      select: { id: true, nome: true },
    });
  });

  it("não revela a lista da equipe para uma closer comum", async () => {
    authMock.mockResolvedValue(SESSION_CLOSER);

    await expect(listarClosersAlphaLeads()).rejects.toThrow("Acesso negado");
    expect(prismaMock.usuarios.findMany).not.toHaveBeenCalled();
  });

  it("gestor consulta o acumulado da closer selecionada", async () => {
    authMock.mockResolvedValue(SESSION_LIDER);

    await getPerformanceAcumulada("GISELLE GLEYCE SOUZA SANTOS", 8, 2026);

    expect(
      prismaMock.comercialPerformance.findMany.mock.calls[0][0].where
        .colaboradoraId,
    ).toBe("GISELLE GLEYCE SOUZA SANTOS");
  });

  it("gestor consulta o registro diário da closer e do canal selecionados", async () => {
    authMock.mockResolvedValue(SESSION_LIDER);

    await getPerformanceDiaria(
      "GISELLE GLEYCE SOUZA SANTOS",
      new Date("2026-09-03T12:00:00.000Z"),
      "CALLIX",
    );

    const where = prismaMock.comercialPerformance.findMany.mock.calls[0][0].where;
    expect(where.colaboradoraId).toBe("GISELLE GLEYCE SOUZA SANTOS");
    expect(where.canal).toBe("CALLIX");
  });

  it("monta o checklist a partir dos dias com lançamentos reais, sem tabela paralela", async () => {
    authMock.mockResolvedValue(SESSION_LIDER);
    prismaMock.comercialPerformance.findMany.mockResolvedValue([
      { dataRegistro: new Date("2026-09-01T00:00:00.000Z") },
      { dataRegistro: new Date("2026-09-01T00:00:00.000Z") },
      { dataRegistro: new Date("2026-09-03T00:00:00.000Z") },
    ]);

    await expect(getDiasComLancamento("GISELLE GLEYCE SOUZA SANTOS", 8, 2026)).resolves.toEqual([
      "2026-09-01",
      "2026-09-03",
    ]);
    expect(prismaMock.comercialPerformance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ colaboradoraId: "GISELLE GLEYCE SOUZA SANTOS" }),
      select: { dataRegistro: true },
    }));
  });

  it("bloqueia uma closer comum tentando consultar os dados de outra closer", async () => {
    authMock.mockResolvedValue(SESSION_CLOSER);

    await expect(
      getPerformanceDiaria(
        "GISELLE GLEYCE SOUZA SANTOS",
        new Date("2026-09-03T12:00:00.000Z"),
        "TRAFEGO_PAGO",
      ),
    ).rejects.toThrow("Acesso negado");
    expect(prismaMock.comercialPerformance.findMany).not.toHaveBeenCalled();
  });

  it("uma gravação continua vinculada à sessão, ignorando closer enviada no payload", async () => {
    authMock.mockResolvedValue(SESSION_LIDER);
    prismaMock.comercialPerformance.upsert.mockResolvedValue({ id: 1 });

    const resultado = await upsertPerformance({
      colaboradoraId: "CLOSER ALFA",
      dataRegistro: new Date("2026-09-03T12:00:00.000Z"),
      canal: "TRAFEGO_PAGO",
      servico: "REVISAO",
      leadsRecebidos: 3,
      noShow: -2,
    });

    expect(resultado.success).toBe(true);
    const chamada = prismaMock.comercialPerformance.upsert.mock.calls[0][0];
    expect(chamada.create.colaboradoraId).toBe("GESTORA COMERCIAL");
    expect(chamada.where.performance_pk.colaboradoraId).toBe("GESTORA COMERCIAL");
    expect(chamada.create.noShow).toBe(0);
    expect(chamada.update.noShow).toBe(0);
  });

  it("bloqueia gravação sem identidade autenticada", async () => {
    authMock.mockResolvedValue(null);

    await expect(
      upsertPerformance({
        dataRegistro: new Date("2026-09-03T12:00:00.000Z"),
        canal: "TRAFEGO_PAGO",
        servico: "REVISAO",
      }),
    ).resolves.toMatchObject({ success: false, error: "Usuário não autenticado." });
    expect(prismaMock.comercialPerformance.upsert).not.toHaveBeenCalled();
  });

  it("mantém o Alpha Marketing agregado, sem filtro por colaboradora", async () => {
    authMock.mockResolvedValue(SESSION_LIDER);

    await getPerformanceMarketing(8, 2026);

    const where = prismaMock.comercialPerformance.findMany.mock.calls[0][0].where;
    expect(where).toHaveProperty("dataRegistro");
    expect(where).not.toHaveProperty("colaboradoraId");
  });

  it("inclui leads desqualificados no consolidado exibido pelo Marketing", async () => {
    authMock.mockResolvedValue(SESSION_LIDER);
    prismaMock.comercialPerformance.findMany.mockResolvedValue([
      {
        colaboradoraId: "CLOSER ALFA", canal: "TRAFEGO_PAGO",
        leadsRecebidos: 10, leadsDesqualificados: 4,
        reunioesAgendadas: 3, reunioesRealizadas: 2, noShow: 1,
        contratosHabilitacao: 1, contratosRevisao: 1,
        HotLeadsHabilitacao: 1, HotLeadsRevisao: 0,
      },
      {
        colaboradoraId: "CLOSER ALFA", canal: "CALLIX",
        leadsRecebidos: 5, leadsDesqualificados: 2,
        reunioesAgendadas: 1, reunioesRealizadas: 1, noShow: -3,
        contratosHabilitacao: 0, contratosRevisao: 1,
        HotLeadsHabilitacao: 0, HotLeadsRevisao: 1,
      },
    ]);

    const resultado = await getPerformanceMarketing(8, 2026) as Array<Record<string, number | string>>;

    expect(resultado[0]).toMatchObject({
      leads: 15,
      leadsDesqualificados: 6,
      TRAFEGO_PAGO: 10,
      CALLIX: 5,
      habilitacao: 1,
      revisao: 2,
      noShow: 1,
    });
  });

  it("mantém filtros e seleção ao alternar closer, data, mês e canal", () => {
    const pagina = readFileSync(
      resolve(process.cwd(), "src/app/PainelAlpha/ControleLeads/PaginaControle.tsx"),
      "utf8",
    );
    const lancamentos = readFileSync(
      resolve(process.cwd(), "src/app/PainelAlpha/ControleLeads/Lançamentos.tsx"),
      "utf8",
    );

    expect(pagina).toContain("key={`${canalAtual}:${colaboradoraSelecionada}`}");
    expect(pagina).toContain("setResumoLateral(null)");
    expect(lancamentos.match(/new URLSearchParams\(searchParams\.toString\(\)\)/g)).toHaveLength(3);
    expect(lancamentos).toContain("params.set('canal', novoCanal)");
  });

  it("expõe consulta de terceiro somente leitura e fallback vazio", () => {
    const pagina = readFileSync(
      resolve(process.cwd(), "src/app/PainelAlpha/ControleLeads/PaginaControle.tsx"),
      "utf8",
    );
    const lancamentos = readFileSync(
      resolve(process.cwd(), "src/app/PainelAlpha/ControleLeads/Lançamentos.tsx"),
      "utf8",
    );

    expect(pagina).toContain("Consulta somente leitura");
    expect(lancamentos).toContain("disabled={status === 'saving' || somenteLeitura}");
    expect(lancamentos).toContain("if (somenteLeitura) return");
    expect(lancamentos).toContain("setResumoLateral(RESUMO_VAZIO)");
    expect(lancamentos).toContain("resumoLateral?.canais || RESUMO_VAZIO.canais");
  });

  it("faz o calendário acompanhar a closer e abrir o dia selecionado", () => {
    const calendario = readFileSync(
      resolve(process.cwd(), "src/app/PainelAlpha/ControleLeads/CalendarioCheckIn.tsx"),
      "utf8",
    );
    const lancamentos = readFileSync(
      resolve(process.cwd(), "src/app/PainelAlpha/ControleLeads/Lançamentos.tsx"),
      "utf8",
    );

    expect(lancamentos).toContain("<CalendarioCheckIn colaboradoraId={usuarioNome}");
    expect(calendario).toContain("getDiasComLancamento(colaboradoraId, mes, ano)");
    expect(calendario).toContain('params.set("data", iso)');
    expect(calendario).not.toContain("RegistrarCheckLeadsDia");
  });
});
