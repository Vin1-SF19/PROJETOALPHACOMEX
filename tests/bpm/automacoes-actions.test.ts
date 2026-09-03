import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  exigirConfig: vi.fn(),
  revalidatePath: vi.fn(),
  etapaFindFirst: vi.fn(),
  templateFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  automacaoFindUnique: vi.fn(),
  automacaoCreate: vi.fn(),
  auditoriaCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoConfigPipeline: mocks.exigirConfig,
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmPipeline: { findMany: vi.fn() },
    bpmEtapa: { findFirst: mocks.etapaFindFirst },
    documentoTemplate: {
      findFirst: mocks.templateFindFirst,
      findMany: mocks.templateFindMany,
    },
    bpmAutomacao: { findUnique: mocks.automacaoFindUnique },
    $transaction: mocks.transaction,
  },
}));

import {
  CriarAutomacaoBpm,
  DuplicarAutomacaoBpm,
  ListarTemplatesAutomacoesBpm,
} from "@/actions/bpm/Automacoes";

const PIPELINE_ID = "clw0000000000000pipeline";
const ETAPA_ID = "clw000000000000000etapa";
const DESTINO_ID = "clw0000000000000destino";
const AUTOMACAO_ID = "clw000000000000000auto";

describe("actions da aba Automações", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.exigirConfig.mockResolvedValue(undefined);
    mocks.etapaFindFirst.mockResolvedValue({ id: ETAPA_ID });
    mocks.automacaoCreate.mockResolvedValue({ id: AUTOMACAO_ID });
    mocks.auditoriaCreate.mockResolvedValue({ id: "auditoria-1" });
    mocks.transaction.mockImplementation(async (operacao) => {
      if (typeof operacao === "function") {
        return operacao({
          bpmAutomacao: { create: mocks.automacaoCreate },
          bpmPipelineConfigAuditoria: { create: mocks.auditoriaCreate },
        });
      }
      return Promise.all(operacao);
    });
  });

  it("bloqueia o CRUD sem sessão antes de consultar a coluna", async () => {
    mocks.auth.mockResolvedValue(null);
    const resultado = await CriarAutomacaoBpm({});
    expect(resultado).toMatchObject({ success: false, error: "Não autorizado" });
    expect(mocks.etapaFindFirst).not.toHaveBeenCalled();
    expect(mocks.automacaoCreate).not.toHaveBeenCalled();
  });

  it("cria e audita uma automação válida", async () => {
    const resultado = await CriarAutomacaoBpm({
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      nome: "Enviar boas-vindas",
      descricao: "Contato inicial",
      gatilhoTipo: "ENTRAR_COLUNA",
      tempoMinutos: null,
      acaoTipo: "ENVIAR_EMAIL",
      parametros: {
        para: "cliente@example.com",
        assunto: "Bem-vindo",
        corpo: "Olá, {{empresa.razaoSocial}}",
        cc: [],
      },
      ativa: true,
    });
    expect(mocks.exigirConfig).toHaveBeenCalledWith(7, "configurarEtapas");
    expect(mocks.etapaFindFirst).toHaveBeenCalledWith({
      where: { id: ETAPA_ID, pipelineId: PIPELINE_ID },
      select: { id: true },
    });
    expect(mocks.automacaoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nome: "Enviar boas-vindas",
        pipelineId: PIPELINE_ID,
        etapaId: ETAPA_ID,
        parametrosJson: expect.stringContaining("cliente@example.com"),
        criadoPorId: 7,
      }),
    });
    expect(mocks.auditoriaCreate).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/PainelAlpha/AlphaCRM/automacoes");
    expect(resultado).toEqual({ success: true, data: { id: AUTOMACAO_ID } });
  });

  it("duplica para outra coluna como inativa", async () => {
    mocks.etapaFindFirst.mockResolvedValue({ id: DESTINO_ID });
    mocks.automacaoFindUnique.mockResolvedValue({
      id: AUTOMACAO_ID,
      nome: "Contrato",
      descricao: null,
      gatilhoTipo: "SAIR_COLUNA",
      tempoMinutos: null,
      acaoTipo: "GERAR_FICHA",
      parametrosJson: "{}",
    });
    const resultado = await DuplicarAutomacaoBpm({
      automacaoId: AUTOMACAO_ID,
      pipelineId: PIPELINE_ID,
      etapaId: DESTINO_ID,
    });
    expect(mocks.automacaoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nome: "Contrato (cópia)",
        etapaId: DESTINO_ID,
        ativa: false,
      }),
    });
    expect(resultado.success).toBe(true);
  });

  it("lê variáveis de template persistidas como JSON serializado", async () => {
    mocks.templateFindMany.mockResolvedValue([{
      id: "template-1",
      titulo: "Contrato padrão",
      categoria: "Contrato",
      variaveisJson: JSON.stringify([{
        nome: "cliente",
        label: "Cliente",
        tipo: "texto",
        obrigatorio: true,
        placeholder: "Razão social",
      }]),
    }]);
    const resultado = await ListarTemplatesAutomacoesBpm();
    expect(resultado).toMatchObject({
      success: true,
      data: [{ variaveis: [{ nome: "cliente", label: "Cliente" }] }],
    });
  });
});
