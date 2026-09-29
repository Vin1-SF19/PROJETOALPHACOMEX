import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const acessoMock = vi.hoisted(() => vi.fn());
const historicoMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const camposMock = vi.hoisted(() => vi.fn());
const automacoesMock = vi.hoisted(() => vi.fn());
const reciboMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarCamposAplicaveisCardEtapa: camposMock }));
vi.mock("@/lib/bpm/automacoes/orquestrador", () => ({ executarAutomacoesCentraisDoCardAgora: automacoesMock }));
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn() },
  bpmCardCampoValor: { upsert: vi.fn() },
  bpmCardAnexo: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  bpmTarefa: { findFirst: vi.fn(), update: vi.fn() },
  bpmEventoDominio: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: acessoMock }));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: historicoMock }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: notificarMock }));
vi.mock("@/lib/bpm/anexos-storage", () => ({
  criarReferenciaAnexoBpm: (pathname: string) => `bpm-blob:${pathname}`,
  validarReciboUploadAnexoBpm: reciboMock,
}));

import { RegistrarAnexoBpm } from "@/actions/bpm/Anexos";

const CARD_ID = "clw0000000000000card";
const RECIBO = "recibo-assinado-comprido-o-suficiente";

beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    acessoMock.mockResolvedValue({ isAdminGlobal: false, role: "MEMBRO" });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ pipelineId: "clw0000000000000pipe", etapaId: "etapa" });
    prismaMock.bpmCardAnexo.findFirst.mockResolvedValue(null);
    reciboMock.mockReturnValue({ cardId: CARD_ID, pathname: "bpm/recibo-concorrente.pdf",
      nome: "recibo.pdf", tipo: "application/pdf", tamanho: 100 });
    prismaMock.bpmEventoDominio.create.mockResolvedValue({ id: "evento" });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  });

describe("RegistrarAnexoBpm: idempotência concorrente", () => {
  it("recupera P2002 com nova autorização e devolve o anexo vencedor sem efeitos duplicados", async () => {
    const anexoExistente = {
      id: "clw0000000000000anex",
      cardId: CARD_ID,
      url: "bpm-blob:bpm/recibo-concorrente.pdf",
      nome: "recibo.pdf",
      tipo: "application/pdf",
      tamanho: 100,
      enviadoPorId: 7,
    };
    prismaMock.bpmCardAnexo.create.mockRejectedValue({ code: "P2002" });
    prismaMock.bpmCardAnexo.findUnique.mockResolvedValue(anexoExistente);

    await expect(RegistrarAnexoBpm({ cardId: CARD_ID, recibo: RECIBO })).resolves.toEqual({
      success: true,
      data: { ...anexoExistente, url: `/api/bpm/anexos/${anexoExistente.id}` },
    });

    expect(acessoMock).toHaveBeenCalledWith(CARD_ID, 7, "COMERCIAL", "enviarArquivo");
    expect(acessoMock).toHaveBeenCalledTimes(3);
    expect(prismaMock.bpmCardAnexo.findUnique).toHaveBeenCalledWith({
      where: {
        cardId_url: {
          cardId: CARD_ID,
          url: "bpm-blob:bpm/recibo-concorrente.pdf",
        },
      },
    });
    expect(historicoMock).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("recupera P2002 no mesmo campo de arquivo sem recriar anexo ou sobrescrever valor", async () => {
    camposMock.mockResolvedValue([{ id: CAMPO_ID, nome: "Contrato", tipo: "arquivo", editavel: true }]);
    prismaMock.bpmCardAnexo.create.mockRejectedValue({ code: "P2002" });
    prismaMock.bpmCardAnexo.findUnique.mockResolvedValue({ id: "anexo-vencedor", cardId: CARD_ID,
      campoId: CAMPO_ID, url: "bpm-blob:bpm/recibo-concorrente.pdf" });

    const resultado = await RegistrarAnexoBpm({ cardId: CARD_ID, campoId: CAMPO_ID, recibo: RECIBO });
    expect(resultado).toMatchObject({ success: true, data: { id: "anexo-vencedor", url: "/api/bpm/anexos/anexo-vencedor" } });
    expect(prismaMock.bpmCardAnexo.create).toHaveBeenCalledOnce();
    expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(historicoMock).not.toHaveBeenCalled();
  });

  it("recusa P2002 quando o recibo vencedor pertence a outro campo", async () => {
    camposMock.mockResolvedValue([{ id: CAMPO_ID, nome: "Contrato", tipo: "arquivo", editavel: true }]);
    prismaMock.bpmCardAnexo.create.mockRejectedValue({ code: "P2002" });
    prismaMock.bpmCardAnexo.findUnique.mockResolvedValue({ id: "anexo-de-outro-campo", cardId: CARD_ID,
      campoId: "clw000000000000outro", url: "bpm-blob:bpm/recibo-concorrente.pdf" });

    const resultado = await RegistrarAnexoBpm({ cardId: CARD_ID, campoId: CAMPO_ID, recibo: RECIBO });
    expect(resultado).toEqual({ success: false, error: "Campo de arquivo inválido para este card" });
    expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(historicoMock).not.toHaveBeenCalled();
  });
});

it("só conclui a tarefa do checklist quando uma planilha Excel válida foi vinculada", async () => {
  const { CAMPO_CHECKLIST_EXCEL, PIPELINE_OPERACIONAL_CHECKLIST_ID } = await import("@/lib/bpm/checklist-envio-operacional");
  camposMock.mockResolvedValue([{ id: CAMPO_ID, chave: CAMPO_CHECKLIST_EXCEL,
    nome: "Checklist atualizado (Excel)", tipo: "arquivo", editavel: true }]);
  prismaMock.bpmCard.findUnique.mockResolvedValue({ pipelineId: PIPELINE_OPERACIONAL_CHECKLIST_ID,
    etapaId: "etapa", dataReuniao: new Date("2026-09-29T14:00:00Z") });
  reciboMock.mockReturnValue({ cardId: CARD_ID, pathname: "bpm/checklist.xlsx", nome: "checklist.xlsx",
    tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", tamanho: 100 });
  prismaMock.bpmTarefa.findFirst.mockResolvedValue({ id: "tarefa-checklist" });
  prismaMock.bpmCardAnexo.create.mockResolvedValue({ id: "anexo-checklist", cardId: CARD_ID,
    campoId: CAMPO_ID, createdAt: new Date("2026-09-29T17:00:00Z") });

  const resultado = await RegistrarAnexoBpm({ cardId: CARD_ID, campoId: CAMPO_ID, recibo: RECIBO });
  expect(resultado).toMatchObject({ success: true, data: { id: "anexo-checklist" } });
  expect(prismaMock.bpmTarefa.update).toHaveBeenCalledWith({ where: { id: "tarefa-checklist" },
    data: { status: "CONCLUIDA", concluidaEm: new Date("2026-09-29T17:00:00Z") } });
  expect(historicoMock).toHaveBeenCalledWith(expect.objectContaining({
    acao: "CHECKLIST_ATUALIZADO_DISPONIBILIZADO",
    valorNovoJson: expect.stringContaining('"noDiaDaReuniao":true'),
  }), prismaMock);

  reciboMock.mockReturnValue({ cardId: CARD_ID, pathname: "bpm/checklist.pdf", nome: "checklist.pdf",
    tipo: "application/pdf", tamanho: 100 });
  const invalido = await RegistrarAnexoBpm({ cardId: CARD_ID, campoId: CAMPO_ID, recibo: RECIBO });
  expect(invalido).toMatchObject({ success: false, error: expect.stringContaining("planilha Excel") });
  expect(prismaMock.bpmCardAnexo.create).toHaveBeenCalledTimes(1);
});

const CAMPO_ID = "clw000000000000campo";
it.each([
  ["oculto ou fora da etapa", []],
  ["somente leitura", [{ id: CAMPO_ID, nome: "Arquivo", tipo: "arquivo", somenteLeitura: true }]],
  ["edição bloqueada", [{ id: CAMPO_ID, nome: "Arquivo", tipo: "arquivo", editavel: false }]],
])("nega arquivo em campo %s sem nenhuma gravação", async (_nome, campos) => {
  vi.clearAllMocks();
  camposMock.mockResolvedValue(campos);
  const resultado = await RegistrarAnexoBpm({ cardId: CARD_ID, campoId: CAMPO_ID, recibo: RECIBO });
  expect(resultado.success).toBe(false);
  expect(camposMock).toHaveBeenCalledWith(CARD_ID, "clw0000000000000pipe", "etapa", prismaMock, "MEMBRO");
  expect(prismaMock.bpmCardAnexo.create).not.toHaveBeenCalled();
  expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
});
it("campo autorizado vincula o arquivo e oferece download protegido", async () => {
  vi.clearAllMocks();
  camposMock.mockResolvedValue([{ id: CAMPO_ID, nome: "Arquivo", tipo: "arquivo", editavel: true }]);
  prismaMock.bpmCardAnexo.create.mockResolvedValue({ id: "anexo", campoId: CAMPO_ID });
  const resultado = await RegistrarAnexoBpm({ cardId: CARD_ID, campoId: CAMPO_ID, recibo: RECIBO });
  expect(resultado).toMatchObject({ success: true, data: { url: "/api/bpm/anexos/anexo" } });
  expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { valor: "anexo" } }));
});

it("mantém sucesso após o commit se a notificação de anexo falhar", async () => {
  vi.clearAllMocks();
  camposMock.mockResolvedValue([{ id: CAMPO_ID, nome: "Arquivo", tipo: "arquivo", editavel: true }]);
  prismaMock.bpmCardAnexo.findFirst.mockResolvedValue(null);
  prismaMock.bpmCardAnexo.create.mockResolvedValue({ id: "anexo", cardId: CARD_ID, campoId: CAMPO_ID });
  notificarMock.mockRejectedValueOnce(new Error("notificação indisponível"));
  const resultado = await RegistrarAnexoBpm({ cardId: CARD_ID, campoId: CAMPO_ID, recibo: RECIBO });
  expect(resultado).toMatchObject({ success: true, data: { id: "anexo" } });
});

it("registra contrato assinado com correlationId válido e confirma o anexo", async () => {
  camposMock.mockResolvedValue([{
    id: CAMPO_ID,
    chave: "alpha.contrato.assinado.anexo",
    nome: "Contrato assinado/anexo",
    tipo: "arquivo",
    editavel: true,
  }]);
  prismaMock.bpmCardAnexo.create.mockResolvedValue({ id: "anexo-assinado", cardId: CARD_ID, campoId: CAMPO_ID });

  const resultado = await RegistrarAnexoBpm({ cardId: CARD_ID, campoId: CAMPO_ID, recibo: RECIBO });

  expect(resultado).toMatchObject({ success: true, data: { id: "anexo-assinado" } });
  expect(prismaMock.bpmEventoDominio.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      tipo: "CARD_ATUALIZADO",
      cardId: CARD_ID,
      correlationId: expect.any(String),
      causationId: "anexo-assinado",
      idempotencyKey: "contrato-assinado-anexo:anexo-assinado",
    }),
  }));
  expect(prismaMock.bpmEventoDominio.create.mock.calls[0][0].data.correlationId).not.toBe("");
  expect(automacoesMock).toHaveBeenCalledWith(CARD_ID);
});
