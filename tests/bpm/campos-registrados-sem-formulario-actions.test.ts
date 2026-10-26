import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const camposRegistradosMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/bpm/campos-registrados-sem-formulario-server", () => ({ carregarCamposRegistradosSemFormulario: camposRegistradosMock }));
const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmCardMock = vi.hoisted(() => vi.fn());
const carregarCamposAplicaveisCardEtapaMock = vi.hoisted(() => vi.fn());
const carregarCamposAplicaveisEtapaMock = vi.hoisted(() => vi.fn());
const notificarPipelineBpmMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn(), updateMany: vi.fn() },
  usuarios: { findMany: vi.fn() },
  bpmCardFollowUpEstado: { upsert: vi.fn() },
  checklistCrmVinculo: { findUnique: vi.fn() },
  bpmCardCampoValor: { upsert: vi.fn(), findMany: vi.fn() },
  bpmCampo: { findMany: vi.fn() },
  bpmCardAnexo: { findMany: vi.fn() },
  bpmCardHistorico: { create: vi.fn() },
  bpmCardMembro: { updateMany: vi.fn(), upsert: vi.fn() },
  parceiro: { findUnique: vi.fn() },
  indicacao: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/validacao-salvamento-configurado", () => ({
  prepararSalvamentoConfigurado: vi.fn(async ({ valoresSubmetidos }) => valoresSubmetidos),
}));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({
  carregarValoresCanonicosCampos: vi.fn().mockResolvedValue({}),
  salvarValoresGlobaisPersonalizadosCampos: vi.fn().mockResolvedValue(new Set()),
}));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/bpm/realtime-server", () => ({
  notificarPipelineBpm: notificarPipelineBpmMock,
}));
vi.mock("@/lib/bpm/automacoes", () => ({
  executarAutomacaoFechamentoComercial: vi.fn(),
}));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: exigirAcessoBpmCardMock,
  exigirAcessoBpmPipeline: vi.fn(),
  exigirAcessoModuloBpm: vi.fn(),
  isAdminRole: vi.fn().mockReturnValue(false),
  usuarioElegivelResponsavelBpm: vi.fn(),
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({
  carregarCamposAplicaveisCardEtapa: carregarCamposAplicaveisCardEtapaMock,
  carregarSnapshotsCopiaCamposCard: vi.fn().mockResolvedValue({}),
  carregarCamposAplicaveisEtapa: carregarCamposAplicaveisEtapaMock,
  carregarCamposObrigatoriosEtapa: vi.fn(),
}));

import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
import { prepararSalvamentoConfigurado } from "@/lib/bpm/validacao-salvamento-configurado";
import { carregarSnapshotsCopiaCamposCard } from "@/lib/bpm/requisitos-etapa-server";

const CARD_ID = "clw0000000000000card";
const PIPELINE_ID = "clw0000000000000pipe";
const ETAPA_ID = "clw0000000000000etap";
const CAMPO_ID = "clw0000000000000camp";
const CAMPO_FORA_ID = "clw0000000000000fora";
const UPDATED_AT = new Date("2026-08-13T12:00:00.000Z");

const campoNulo = {
  id: CAMPO_ID,
  pipelineId: PIPELINE_ID,
  etapaId: ETAPA_ID,
  nome: "Necessidade atual",
  tipo: "texto",
  opcoesJson: null,
  obrigatorio: true,
  ordem: 1,
  valor: null,
};

function cardNaEtapaAtual(updatedAt = UPDATED_AT) {
  return {
    id: CARD_ID,
    pipelineId: PIPELINE_ID,
    etapaId: ETAPA_ID,
    status: "ATIVO",
    updatedAt,
    responsavelId: 7,
    servico: null,
    statusPosFechamento: null,
    proximoContatoEm: null,
    vinculosDestino: [],
    etapa: { nome: "Novos Leads" },
    pipeline: { nome: "Outro pipeline", chave: null },
  };
}

describe("C01 - persistência de campos já registrados sem formulário", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    vi.clearAllMocks();
    camposRegistradosMock.mockResolvedValue([{ ...campoNulo, editavel: true }]);
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    exigirAcessoBpmCardMock.mockResolvedValue({ autorizado: true });
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([campoNulo]);
    carregarCamposAplicaveisEtapaMock.mockResolvedValue([]);
    prismaMock.usuarios.findMany.mockResolvedValue([{ id: 7, nome: "Vendedor canônico", status: "ATIVO" }]);
    prismaMock.bpmCard.findUnique.mockResolvedValue({ ...cardNaEtapaAtual(), etapa: { nome: "Sem viabilidade", formulario: null, campoConfiguracoes: [] } });
    prismaMock.bpmCard.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.checklistCrmVinculo.findUnique.mockResolvedValue(null);
    prismaMock.bpmCardCampoValor.upsert.mockResolvedValue({});
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([]);
    prismaMock.bpmCampo.findMany.mockResolvedValue([]);
    prismaMock.bpmCardAnexo.findMany.mockResolvedValue([{ id: "clw0000000000000anex", campoId: CAMPO_ID }]);
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
    notificarPipelineBpmMock.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });


  it("salva apenas dados retornados pelo fallback revalidado na transação", async () => {
    const result = await AtualizarCardBpm({cardId:CARD_ID,camposValores:{[CAMPO_ID]:"Atualizado"},versaoEsperadaEm:UPDATED_AT});
    expect(result.success).toBe(true);
    expect(carregarSnapshotsCopiaCamposCard).not.toHaveBeenCalled();
    expect(camposRegistradosMock).toHaveBeenCalledWith(CARD_ID,PIPELINE_ID,ETAPA_ID,prismaMock,"MEMBRO");
    expect(carregarCamposAplicaveisCardEtapaMock).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledOnce();
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{cardId_campoId:{cardId:CARD_ID,campoId:CAMPO_ID}},update:{valor:"Atualizado"}}));
  });
  it("preserva Vendedor canônico sem row própria em etapa sem formulário já configurada", async () => {
    const configuracoes = [{ id: "config-vendedor" }];
    const vendedor = { ...campoNulo, nome: "Vendedor", tipo: "usuario", chave: "alpha.vendedor.a", escopo: "GLOBAL", fonteEntidade: "CARD", fonteAtributo: "responsavelId", visivel: true, editavel: false, somenteLeitura: true };
    carregarCamposAplicaveisEtapaMock.mockResolvedValue([vendedor]);
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([{ ...vendedor, valor: "7" }]);
    prismaMock.bpmCard.findUnique.mockResolvedValue({ ...cardNaEtapaAtual(),
      etapa: { nome: "Etapa configurada", formulario: null, campoConfiguracoes: configuracoes },
      primeiraVisualizacaoEm: UPDATED_AT, empresa: { id: 1, razaoSocial: "Empresa" },
      origemExterna: null, campoValores: [], membros: [], tarefas: [], anexos: [], reunioes: [],
      historico: [], vinculosOrigem: [], vinculosDestino: [],
    });
    const result = await ObterCardBpm(CARD_ID);
    expect(result.success, JSON.stringify(result)).toBe(true);
    expect(result.data?.camposRegistradosSemFormulario).toBe(false);
    expect(result.data?.camposEtapa).toEqual([expect.objectContaining({ id: CAMPO_ID, valor: "7", valorExibicao: "Vendedor canônico", somenteLeitura: true })]);
    expect(camposRegistradosMock).not.toHaveBeenCalled();
    expect(carregarCamposAplicaveisCardEtapaMock).toHaveBeenCalledWith(CARD_ID,PIPELINE_ID,ETAPA_ID,prismaMock,"MEMBRO",[vendedor],{ incluirCondicionaisEdicao: true });
  });
  it("preserva autorização canônica de salvamento em etapa configurada sem formulário", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue({ ...cardNaEtapaAtual(), etapa: { nome: "Configurada", formulario: null, campoConfiguracoes: [{ id: "config" }] } });
    const result = await AtualizarCardBpm({ cardId: CARD_ID, camposValores: { [CAMPO_ID]: "Canônico atualizado" } });
    expect(result.success, JSON.stringify(result)).toBe(true);
    expect(camposRegistradosMock).not.toHaveBeenCalled();
    expect(carregarCamposAplicaveisCardEtapaMock).toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledOnce();
  });
  it("recusa inserir campo não registrado sem gravar o card ou qualquer valor", async () => {
    const result=await AtualizarCardBpm({cardId:CARD_ID,camposValores:{[CAMPO_FORA_ID]:"Novo campo"}});
    expect(result.success).toBe(false);expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
  });
  it("permissão revogada dentro da transação impede acesso ao fallback", async () => {
    exigirAcessoBpmCardMock.mockResolvedValueOnce({isAdminGlobal:false,role:"PARTICIPANTE"}).mockRejectedValueOnce(new Error("Não autorizado"));
    const result=await AtualizarCardBpm({cardId:CARD_ID,camposValores:{[CAMPO_ID]:"Negado"}});
    expect(result.success).toBe(false);expect(camposRegistradosMock).not.toHaveBeenCalled();expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
  });
  it("revalidação que deixa de autorizar um campo não preserva autorização antiga", async () => {
    camposRegistradosMock.mockResolvedValue([]);
    expect((await AtualizarCardBpm({cardId:CARD_ID,camposValores:{[CAMPO_ID]:"Tentativa"}})).success).toBe(false);
    expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
  });
  it("recusa efeitos configurados que adicionariam outro campo nesta etapa", async () => {
    vi.mocked(prepararSalvamentoConfigurado).mockResolvedValueOnce({[CAMPO_ID]:"Atualizado",[CAMPO_FORA_ID]:"Novo dado calculado"});
    const result=await AtualizarCardBpm({cardId:CARD_ID,camposValores:{[CAMPO_ID]:"Atualizado"}});
    expect(result.success).toBe(false);expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
  });

});
