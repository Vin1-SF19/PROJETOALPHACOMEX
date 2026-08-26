import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  parceiroLead: { count: vi.fn() },
  parceiro: { count: vi.fn(), findMany: vi.fn() },
  indicacao: { count: vi.fn(), findMany: vi.fn() },
  clienteServico: { findMany: vi.fn() },
  parceiroHistorico: { count: vi.fn() },
  parceiroConfig: { upsert: vi.fn() },
  preCadastroParceiro: { findMany: vi.fn() },
  parceiroTarefa: { findMany: vi.fn(), createMany: vi.fn() },
}));

const getCtxMock = vi.hoisted(() => vi.fn());
const calcularIndicadoresMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/actions/parceiros", () => ({ getCtx: getCtxMock }));
vi.mock("@/lib/parceiros/desenvolvimento", () => ({ calcularIndicadoresParceiro: calcularIndicadoresMock }));

import { ObterDashboardCanaisParcerias, ListarFilaFollowUpParceiros, ListarAlertasParceiros } from "@/actions/parceiros-dashboard";

const CTX = { userId: 7, role: "User", isAdmin: false, podeEditar: true, podeExcluir: false, podeAprovar: false };
const INDICADORES_VAZIOS = { jaIndicou: false, primeiraIndicacaoEm: null, ultimaIndicacaoEm: null, diasSemIndicacao: null, totalIndicacoes: 0, totalOportunidades: 0, contratosOriginados: 0, conversao: 0, receitaOriginada: 0 };

describe("ObterDashboardCanaisParcerias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX);
    prismaMock.parceiroConfig.upsert.mockResolvedValue({ diasAlertaSemIndicacao: null, diasInatividade: 60 });
    prismaMock.parceiroLead.count.mockResolvedValue(3);
    prismaMock.parceiro.count.mockResolvedValue(1);
    prismaMock.parceiro.findMany.mockResolvedValue([]);
    prismaMock.indicacao.count.mockResolvedValue(2);
    prismaMock.indicacao.findMany.mockResolvedValue([]);
    prismaMock.parceiroHistorico.count.mockResolvedValue(0);
  });

  it("rejeita sem permissão", async () => {
    getCtxMock.mockResolvedValue(null);
    const r = await ObterDashboardCanaisParcerias();
    expect(r.success).toBe(false);
  });

  it("retorna os indicadores com origem clara de dado (contagens diretas)", async () => {
    const r = await ObterDashboardCanaisParcerias(30);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.indicadores.parceirosNoFunilAquisicao).toBe(3);
      expect(r.indicadores.indicacoesNoPeriodo).toBe(2);
      expect(r.evolucao.aquisicao).toHaveLength(6);
    }
  });

  it("não calcula 'sem indicação acima do prazo' quando o alerta está desligado (diasAlertaSemIndicacao null)", async () => {
    const r = await ObterDashboardCanaisParcerias();
    expect(r.success).toBe(true);
    if (r.success) expect(r.indicadores.semIndicacaoAcimaDoPrazo).toBe(0);
    expect(calcularIndicadoresMock).not.toHaveBeenCalled();
  });
});

describe("ListarFilaFollowUpParceiros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX);
  });

  it("ordena por prioridade decrescente (quem mais precisa de atenção primeiro)", async () => {
    prismaMock.parceiro.findMany.mockResolvedValue([
      { id: 1, nome: "Baixa Prioridade", potencialRecorrencia: 0, estagioDesenvolvimento: "EM_ATIVACAO", proximaAcaoEm: null },
      { id: 2, nome: "Alta Prioridade", potencialRecorrencia: 5, estagioDesenvolvimento: "ATIVO", proximaAcaoEm: null },
    ]);
    calcularIndicadoresMock.mockImplementation(async (id: number) => ({
      ...INDICADORES_VAZIOS,
      diasSemIndicacao: id === 2 ? 90 : 1,
    }));

    const r = await ListarFilaFollowUpParceiros();
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.itens[0].parceiroId).toBe(2);
      expect(r.itens[0].prioridade).toBeGreaterThan(r.itens[1].prioridade);
    }
  });

  it("exclui parceiros INATIVOS da fila comercial (vão para alerta separado)", async () => {
    prismaMock.parceiro.findMany.mockResolvedValue([]);
    await ListarFilaFollowUpParceiros();
    expect(prismaMock.parceiro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ estagioDesenvolvimento: { not: "INATIVO" } }) }),
    );
  });

  // RM-2026-2C7A4B: proximaAcaoEm agora é lido do campo real de Parceiro (antes hardcode null).
  it("usa proximaAcaoEm real do parceiro (deixou de ser hardcode null)", async () => {
    const dataFutura = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    prismaMock.parceiro.findMany.mockResolvedValue([
      { id: 1, nome: "Fulano", potencialRecorrencia: 3, estagioDesenvolvimento: "ATIVO", proximaAcaoEm: dataFutura },
    ]);
    calcularIndicadoresMock.mockResolvedValue(INDICADORES_VAZIOS);
    const r = await ListarFilaFollowUpParceiros();
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.itens[0].proximaAcaoEm).toEqual(dataFutura);
      expect(r.itens[0].followUpVencido).toBe(false);
    }
  });
});

describe("ListarAlertasParceiros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX);
    prismaMock.preCadastroParceiro.findMany.mockResolvedValue([]);
  });

  it("gera alerta PARCEIRO_INATIVO usando o prazo configurado no detalhe", async () => {
    prismaMock.parceiroConfig.upsert.mockResolvedValue({ diasAlertaSemIndicacao: null, diasInatividade: 45 });
    prismaMock.parceiro.findMany.mockResolvedValueOnce([{ id: 1, nome: "Fulano" }]); // inativos
    const r = await ListarAlertasParceiros();
    expect(r.success).toBe(true);
    if (r.success) {
      const alerta = r.alertas.find((a) => a.tipo === "PARCEIRO_INATIVO");
      expect(alerta?.detalhe).toContain("45");
    }
  });

  it("não gera alerta SEM_INDICACAO quando a config está desligada (null)", async () => {
    prismaMock.parceiroConfig.upsert.mockResolvedValue({ diasAlertaSemIndicacao: null, diasInatividade: 60 });
    prismaMock.parceiro.findMany.mockResolvedValueOnce([]); // inativos
    const r = await ListarAlertasParceiros();
    expect(r.success).toBe(true);
    if (r.success) expect(r.alertas.some((a) => a.tipo === "SEM_INDICACAO")).toBe(false);
    expect(calcularIndicadoresMock).not.toHaveBeenCalled();
  });

  it("gera alerta CADASTRO_PENDENTE a partir de PreCadastroParceiro pendente", async () => {
    prismaMock.parceiroConfig.upsert.mockResolvedValue({ diasAlertaSemIndicacao: null, diasInatividade: 60 });
    prismaMock.parceiro.findMany.mockResolvedValueOnce([]); // inativos
    prismaMock.preCadastroParceiro.findMany.mockResolvedValue([{ id: 9, nomeCompleto: "Ciclano", createdAt: new Date() }]);
    const r = await ListarAlertasParceiros();
    expect(r.success).toBe(true);
    if (r.success) expect(r.alertas.some((a) => a.tipo === "CADASTRO_PENDENTE" && a.preCadastroId === 9)).toBe(true);
  });

  describe("geração automática de ParceiroTarefa (RM-2026-8B7DC7)", () => {
    it("NÃO gera tarefa quando gerarTarefaAutomaticaAlertas está desligado (default)", async () => {
      prismaMock.parceiroConfig.upsert.mockResolvedValue({ diasAlertaSemIndicacao: null, diasInatividade: 45, gerarTarefaAutomaticaAlertas: false });
      prismaMock.parceiro.findMany.mockResolvedValueOnce([{ id: 1, nome: "Fulano" }]); // inativos
      await ListarAlertasParceiros();
      expect(prismaMock.parceiroTarefa.findMany).not.toHaveBeenCalled();
      expect(prismaMock.parceiroTarefa.createMany).not.toHaveBeenCalled();
    });

    it("gera tarefa automática quando ligado e ainda não existe uma PENDENTE do mesmo tipo", async () => {
      prismaMock.parceiroConfig.upsert.mockResolvedValue({ diasAlertaSemIndicacao: null, diasInatividade: 45, gerarTarefaAutomaticaAlertas: true });
      prismaMock.parceiro.findMany.mockResolvedValueOnce([{ id: 1, nome: "Fulano" }]); // inativos
      prismaMock.parceiroTarefa.findMany.mockResolvedValue([]); // nenhuma tarefa automática existente ainda
      const r = await ListarAlertasParceiros();
      expect(r.success).toBe(true);
      expect(prismaMock.parceiroTarefa.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ parceiroId: 1, origemAutomatica: true, alertaOrigemTipo: "PARCEIRO_INATIVO" }),
          ]),
        }),
      );
    });

    it("é idempotente — NÃO duplica quando já existe tarefa automática PENDENTE do mesmo tipo/parceiro", async () => {
      prismaMock.parceiroConfig.upsert.mockResolvedValue({ diasAlertaSemIndicacao: null, diasInatividade: 45, gerarTarefaAutomaticaAlertas: true });
      prismaMock.parceiro.findMany.mockResolvedValueOnce([{ id: 1, nome: "Fulano" }]); // inativos
      prismaMock.parceiroTarefa.findMany.mockResolvedValue([{ parceiroId: 1, alertaOrigemTipo: "PARCEIRO_INATIVO" }]);
      await ListarAlertasParceiros();
      expect(prismaMock.parceiroTarefa.createMany).not.toHaveBeenCalled();
    });

    it("ignora alertas sem parceiroId (ex: CADASTRO_PENDENTE) — não há parceiro para vincular", async () => {
      prismaMock.parceiroConfig.upsert.mockResolvedValue({ diasAlertaSemIndicacao: null, diasInatividade: 60, gerarTarefaAutomaticaAlertas: true });
      prismaMock.parceiro.findMany.mockResolvedValueOnce([]); // inativos
      prismaMock.preCadastroParceiro.findMany.mockResolvedValue([{ id: 9, nomeCompleto: "Ciclano", createdAt: new Date() }]);
      prismaMock.parceiroTarefa.findMany.mockResolvedValue([]);
      await ListarAlertasParceiros();
      expect(prismaMock.parceiroTarefa.createMany).not.toHaveBeenCalled();
    });
  });
});
