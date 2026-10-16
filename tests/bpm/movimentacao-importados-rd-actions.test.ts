import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), acesso: vi.fn(), avaliar: vi.fn(), executar: vi.fn(), campos: vi.fn(), publicados: vi.fn(), automacoes: vi.fn(),
  prisma: {
    bpmCard: { findUnique: vi.fn() }, bpmEtapa: { findUnique: vi.fn() },
    bpmTransicaoEtapa: { findUnique: vi.fn() }, bpmCardVinculo: { findMany: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.acesso }));
vi.mock("@/lib/bpm/transicao-command", () => ({ avaliarTransicaoBpm: mocks.avaliar, executarTransicaoBpm: mocks.executar }));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarCamposAplicaveisCardEtapa: mocks.campos }));
vi.mock("@/lib/bpm/campos-formulario-publicado", () => ({ camposPublicadosPorEtapa: mocks.publicados }));
vi.mock("@/lib/bpm/automacoes/orquestrador", () => ({ executarAutomacoesCentraisDoCardAgora: mocks.automacoes }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));

import { MoverCardBpm, ObterRequisitosTransicaoBpm, SalvarRequisitosEMoverCardBpm } from "@/actions/bpm/Cards";
import { atualizarCardSchema, bpmCardIdSchema, moverCardSchema, salvarRequisitosEMoverCardSchema } from "@/lib/validations/bpm";

const cardId = `rdcard_${"a".repeat(28)}`;
const origem = "draft-stage-11111111-1111-4111-8111-111111111111";
const destino = "draft-stage-22222222-2222-4222-8222-222222222222";
const campoId = "ccampotestes12345678901234";
const confirmacao = { avisosHash: "b".repeat(64), etapaOrigemEsperadaId: origem, versaoEsperada: 3, configVersion: 7 };
const aviso = { key: "campo:documento", kind: "MISSING_DATA", nome: "Documento necessário", campoId, fase: "EXIT_STAGE" };
const advertencia = {
  success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED", error: "Há informações pendentes.",
  pendencias: [aviso.nome], avisos: [aviso], confirmacao,
};

describe("identidades dos cards importados nos caminhos de movimentação e preenchimento", () => {
  it("aceita a identidade persistida do importador sem relaxar a identidade dos campos/etapas", () => {
    expect(bpmCardIdSchema.safeParse(cardId).success).toBe(true);
    expect(moverCardSchema.safeParse({ cardId, etapaDestinoId: destino }).success).toBe(true);
    expect(salvarRequisitosEMoverCardSchema.safeParse({ cardId, etapaDestinoId: destino }).success).toBe(true);
    expect(atualizarCardSchema.safeParse({ cardId, camposValores: { [campoId]: "Dado real" } }).success).toBe(true);
    expect(moverCardSchema.safeParse({ cardId, etapaDestinoId: "etapa-inexistente" }).success).toBe(false);
    expect(atualizarCardSchema.safeParse({ cardId, camposValores: { "campo-invalido": "Dado real" } }).success).toBe(false);
  });

  it.each(["rdcard_curto", `rdcard_${"z".repeat(28)}`, `rdcard_${"a".repeat(29)}`, "", "card-invalido"])("rejeita identidade malformada %s", (id) => {
    expect(bpmCardIdSchema.safeParse(id).success).toBe(false);
  });

  it("exige uma confirmação delimitada ao estado e não aceita um booleano de liberação", () => {
    expect(moverCardSchema.safeParse({ cardId, etapaDestinoId: destino, confirmacaoPendenciasRd: true }).success).toBe(false);
    expect(moverCardSchema.safeParse({ cardId, etapaDestinoId: destino, confirmacaoPendenciasRd: confirmacao }).success).toBe(true);
    expect(moverCardSchema.safeParse({ cardId, etapaDestinoId: destino, confirmacaoPendenciasRd: { ...confirmacao, versaoEsperada: -1 } }).success).toBe(false);
  });
});

describe("ações de movimentação RD preservam o contrato canônico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.acesso.mockResolvedValue({ isAdminGlobal: true, role: "ADMINISTRADOR" });
    mocks.prisma.bpmCard.findUnique.mockResolvedValue({
      id: cardId, pipelineId: "pipeline", etapaId: origem, versao: 3,
      origemExterna: { provider: "RD_STATION_CRM_V1" },
      etapa: { nome: "Etapa configurada", chave: "origem" }, pipeline: { nome: "Funil configurado" },
      proximoContatoEm: null,
    });
    mocks.prisma.bpmEtapa.findUnique.mockResolvedValue({ id: destino, pipelineId: "pipeline", nome: "Destino configurado", ativo: true });
    mocks.prisma.bpmTransicaoEtapa.findUnique.mockResolvedValue(null);
    mocks.prisma.bpmCardVinculo.findMany.mockResolvedValue([]);
    mocks.campos.mockResolvedValue([]);
    mocks.publicados.mockResolvedValue(new Map());
    mocks.avaliar.mockResolvedValue(advertencia);
    mocks.executar.mockResolvedValue(advertencia);
  });

  it("consulta a avaliação central mesmo sem aresta e devolve a confirmação com os nomes reais", async () => {
    const result = await ObterRequisitosTransicaoBpm(cardId, destino);
    expect(result).toMatchObject({ success: true, data: {
      importadoRd: true, podeMover: false, podeMoverComConfirmacao: true,
      confirmacao, avisos: [aviso], guardas: [],
    } });
    expect(mocks.avaliar).toHaveBeenCalledWith(expect.objectContaining({ cardId, etapaOrigemEsperadaId: origem, etapaDestinoId: destino,
      ator: { tipo: "MANUAL", userId: 7, userRole: "Admin" } }));
    expect(mocks.executar).not.toHaveBeenCalled();
  });

  it("não converte um bloqueio explícito de configuração em confirmação", async () => {
    mocks.prisma.bpmTransicaoEtapa.findUnique.mockResolvedValue({ permitida: false, origem: "AMBOS" });
    const result = await ObterRequisitosTransicaoBpm(cardId, destino);
    expect(result.success).toBe(false);
    expect(mocks.avaliar).not.toHaveBeenCalled();
  });

  it("não converte anexo inválido ou erro de permissão em aviso", async () => {
    mocks.avaliar.mockResolvedValue({ success: false, code: "INVALID_ATTACHMENT_REFERENCE", error: "Arquivo indevido" });
    const result = await ObterRequisitosTransicaoBpm(cardId, destino);
    expect(result).toMatchObject({ success: false, code: "INVALID_ATTACHMENT_REFERENCE" });
    expect(result).not.toHaveProperty("data.confirmacao");
  });

  it("preserva o aviso estruturado de MoverCardBpm em vez de reduzi-lo a uma string", async () => {
    const result = await MoverCardBpm({ cardId, etapaDestinoId: destino });
    expect(result).toEqual(advertencia);
  });

  it("encaminha confirmação e estado esperado, mantendo o ator da sessão", async () => {
    const result = await MoverCardBpm({ cardId, etapaDestinoId: destino,
      confirmacaoPendenciasRd: confirmacao, idempotencyKey: "intencao-unica-1234", userId: 999, importadoRd: true });
    expect(result).toEqual(advertencia);
    expect(mocks.executar).toHaveBeenCalledWith(expect.objectContaining({
      cardId, etapaOrigemEsperadaId: origem, etapaDestinoId: destino, versaoEsperada: 3,
      confirmacaoPendenciasRd: confirmacao, idempotencyKey: "intencao-unica-1234",
      ator: { tipo: "MANUAL", userId: 7, userRole: "Admin" }, camposValores: {},
    }));
  });

  it("o caminho salvar e mover preserva os avisos e não inventa valores ausentes", async () => {
    const result = await SalvarRequisitosEMoverCardBpm({ cardId, etapaDestinoId: destino, camposValores: {} });
    expect(result).toEqual(advertencia);
    expect(mocks.executar.mock.calls[0][0].camposValores).toEqual({});
  });

  it("retry idempotente não executa novamente as automações imediatas", async () => {
    const dados = { cardId, etapaDestinoId: destino, idempotencyKey: "intencao-unica-1234" };
    mocks.executar.mockResolvedValue({ success: true, data: { idempotente: false } });
    expect(await MoverCardBpm(dados)).toMatchObject({ success: true });
    expect(mocks.automacoes).toHaveBeenCalledTimes(1);
    mocks.executar.mockResolvedValue({ success: true, data: { idempotente: true } });
    expect(await MoverCardBpm(dados)).toMatchObject({ success: true });
    expect(mocks.automacoes).toHaveBeenCalledTimes(1);
  });

  it("não expõe prévia nem executa sem sessão", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await MoverCardBpm({ cardId, etapaDestinoId: destino })).success).toBe(false);
    expect((await ObterRequisitosTransicaoBpm(cardId, destino)).success).toBe(false);
    expect(mocks.avaliar).not.toHaveBeenCalled();
    expect(mocks.executar).not.toHaveBeenCalled();
  });
});
