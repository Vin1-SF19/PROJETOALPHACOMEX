import { beforeEach, expect, it, vi } from "vitest";

const camposRegistradosMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bpm/campos-registrados-sem-formulario-server", () => ({ carregarCamposRegistradosSemFormulario: camposRegistradosMock }));
const authMock = vi.hoisted(() => vi.fn());
const acessoMock = vi.hoisted(() => vi.fn());
const historicoMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const camposMock = vi.hoisted(() => vi.fn());
const automacoesMock = vi.hoisted(() => vi.fn());
const reciboMock = vi.hoisted(() => vi.fn());
const retornoComercialMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bpm/contratacao-comercial-server", () => ({ disponibilizarContratoComercial: retornoComercialMock }));
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
    camposRegistradosMock.mockResolvedValue([{id:CAMPO_ID,nome:"Arquivo já registrado",tipo:"arquivo",editavel:true}]);
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    acessoMock.mockResolvedValue({ isAdminGlobal: false, role: "MEMBRO" });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ pipelineId: "clw0000000000000pipe", etapaId: "etapa", etapa: {formulario:null,campoConfiguracoes:[]} });
    prismaMock.bpmCardAnexo.findFirst.mockResolvedValue(null);
    reciboMock.mockReturnValue({ cardId: CARD_ID, pathname: "bpm/recibo-concorrente.pdf",
      nome: "recibo.pdf", tipo: "application/pdf", tamanho: 100 });
    prismaMock.bpmEventoDominio.create.mockResolvedValue({ id: "evento" });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  });


const CAMPO_ID="clw000000000000campo";
it("C01 - substitui arquivo de campo registrado, com a autorização transacional do fallback",async()=>{
  prismaMock.bpmCardAnexo.create.mockResolvedValue({id:"anexo-confirmado",cardId:CARD_ID,campoId:CAMPO_ID});
  const result=await RegistrarAnexoBpm({cardId:CARD_ID,campoId:CAMPO_ID,recibo:RECIBO});
  expect(result).toMatchObject({success:true,data:{id:"anexo-confirmado"}});
  expect(camposRegistradosMock).toHaveBeenCalledWith(CARD_ID,"clw0000000000000pipe","etapa",prismaMock,"MEMBRO");
  expect(camposMock).not.toHaveBeenCalled();
});
it.each([{campos:[]},{campos:[{id:CAMPO_ID,nome:"Arquivo",tipo:"arquivo",somenteLeitura:true}]}])("C01 - campo inexistente/sem edição não autoriza arquivo",async({campos})=>{
  camposRegistradosMock.mockResolvedValue(campos);
  const result=await RegistrarAnexoBpm({cardId:CARD_ID,campoId:CAMPO_ID,recibo:RECIBO});
  expect(result.success).toBe(false);expect(prismaMock.bpmCardAnexo.create).not.toHaveBeenCalled();expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
});

it("C01 - configuração canônica de arquivo sem formulário preserva o registro original",async()=>{
  prismaMock.bpmCard.findUnique.mockResolvedValue({pipelineId:"clw0000000000000pipe",etapaId:"etapa",etapa:{formulario:null,campoConfiguracoes:[{id:"config-arquivo"}]}});
  camposMock.mockResolvedValue([{id:CAMPO_ID,nome:"Arquivo configurado",tipo:"arquivo",editavel:true}]);
  prismaMock.bpmCardAnexo.create.mockResolvedValue({id:"anexo-canonico",cardId:CARD_ID,campoId:CAMPO_ID});
  const result=await RegistrarAnexoBpm({cardId:CARD_ID,campoId:CAMPO_ID,recibo:RECIBO});
  expect(result).toMatchObject({success:true,data:{id:"anexo-canonico"}});
  expect(camposRegistradosMock).not.toHaveBeenCalled();expect(camposMock).toHaveBeenCalled();
});
