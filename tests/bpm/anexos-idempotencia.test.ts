import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const acessoMock = vi.hoisted(() => vi.fn());
const historicoMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const camposMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarCamposAplicaveisCardEtapa: camposMock }));
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn() },
  bpmCardCampoValor: { upsert: vi.fn() },
  bpmCardAnexo: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
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
  validarReciboUploadAnexoBpm: () => ({
    cardId: "clw0000000000000card",
    pathname: "bpm/recibo-concorrente.pdf",
    nome: "recibo.pdf",
    tipo: "application/pdf",
    tamanho: 100,
  }),
}));

import { RegistrarAnexoBpm } from "@/actions/bpm/Anexos";

const CARD_ID = "clw0000000000000card";
const RECIBO = "recibo-assinado-comprido-o-suficiente";

beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    acessoMock.mockResolvedValue({ isAdminGlobal: false, role: "MEMBRO" });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ pipelineId: "pipeline", etapaId: "etapa" });
    prismaMock.bpmCardAnexo.findFirst.mockResolvedValue(null);
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
  expect(camposMock).toHaveBeenCalledWith(CARD_ID, "pipeline", "etapa", prismaMock, "MEMBRO");
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
