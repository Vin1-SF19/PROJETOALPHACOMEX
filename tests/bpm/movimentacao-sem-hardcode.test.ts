import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const acessoMock = vi.hoisted(() => vi.fn());
const camposMock = vi.hoisted(() => vi.fn());
const publicadosMock = vi.hoisted(() => vi.fn());
const capacidadesMock = vi.hoisted(() => vi.fn());
const checklistMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn() },
  bpmEtapa: { findUnique: vi.fn() },
  bpmTransicaoEtapa: { findUnique: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: acessoMock }));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarCamposAplicaveisCardEtapa: camposMock }));
vi.mock("@/lib/bpm/campos-formulario-publicado", () => ({
  camposPublicadosPorEtapa: publicadosMock,
  capacidadesObrigatoriasPorEtapa: capacidadesMock,
}));
vi.mock("@/lib/bpm/checklists/integracao", () => ({ obterErroChecklistParaMovimento: checklistMock }));

import { ObterRequisitosTransicaoBpm } from "@/actions/bpm/Cards";

const origemId = "draft-stage-314cef39-2827-4d96-bc97-15e263066088";
const destinoId = "draft-stage-414cef39-2827-4d96-bc97-15e263066088";

describe("prévia de movimentação configurada pela UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "ADMINISTRADOR" } });
    acessoMock.mockResolvedValue({ isAdminGlobal: true, role: "ADMINISTRADOR" });
    prismaMock.bpmCard.findUnique.mockResolvedValue({
      id: "card", pipelineId: "pipeline", etapaId: origemId,
      etapa: { nome: "Novo Lead", chave: "NOVOS_LEADS" },
      pipeline: { nome: "Revisão de Radar" },
      proximoContatoEm: null, dataReuniao: null, transcricaoReuniao: null,
    });
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({ id: destinoId, pipelineId: "pipeline", nome: "Agendar Reunião" });
    prismaMock.bpmTransicaoEtapa.findUnique.mockResolvedValue({ permitida: true, origem: "AMBOS" });
    camposMock.mockResolvedValue([]);
    publicadosMock.mockResolvedValue(new Map());
    capacidadesMock.mockResolvedValue(new Map());
    checklistMock.mockResolvedValue(null);
  });

  it("libera Novo Lead → Agendar Reunião sem próximo contato ou formulário obrigatório", async () => {
    const resultado = await ObterRequisitosTransicaoBpm("card", destinoId);
    expect(resultado).toMatchObject({ success: true, data: { faltantes: [], guardas: [], podeMover: true } });
  });

  it("mantém a obrigatoriedade de entrada quando o campo foi publicado e configurado", async () => {
    camposMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      id: "campo-cnpj", nome: "CNPJ", valor: null, ordem: 1,
      obrigatorio: false, obrigatorioSaida: false, obrigatorioEntrada: true,
    }]);
    publicadosMock.mockResolvedValue(new Map([[destinoId, new Set(["campo-cnpj"])]]));

    const resultado = await ObterRequisitosTransicaoBpm("card", destinoId);
    expect(resultado).toMatchObject({
      success: true,
      data: { podeMover: false, guardas: [], faltantes: [{ id: "campo-cnpj", nome: "CNPJ" }] },
    });
  });

  it("mantém o checklist que o administrador configurou no formulário", async () => {
    capacidadesMock.mockResolvedValue(new Map([[origemId, new Set(["STAGE_CHECKLIST"])]]));
    checklistMock.mockResolvedValue("Conclua o checklist configurado.");

    const resultado = await ObterRequisitosTransicaoBpm("card", destinoId);
    expect(resultado).toMatchObject({ success: true, data: { podeMover: false, guardas: ["Conclua o checklist configurado."] } });
  });
});
