import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  exigirConfig: vi.fn(),
  notificar: vi.fn(),
  revalidatePath: vi.fn(),
  campoCreate: vi.fn(),
  campoUpdate: vi.fn(),
  campoFindUniqueOrThrow: vi.fn(),
  campoFindUnique: vi.fn(),
  campoFindMany: vi.fn(),
  campoDelete: vi.fn(),
  formComponentCount: vi.fn(),
  valorCardCount: vi.fn(),
  valorGlobalCount: vi.fn(),
  anexoCount: vi.fn(),
  anexoFindMany: vi.fn(),
  anexoDeleteMany: vi.fn(),
  campoEtapaConfigCount: vi.fn(),
  historicoCreate: vi.fn(),
  limparBlob: vi.fn(),
  etapaFindMany: vi.fn(),
  pipelineFindMany: vi.fn(),
  pipelineUpdate: vi.fn(),
  opcaoCreateMany: vi.fn(),
  campoPipelineCreateMany: vi.fn(),
  campoEtapaConfigCreateMany: vi.fn(),
  acessoCreateMany: vi.fn(),
  auditoriaCreate: vi.fn(),
  mapeamentoFindMany: vi.fn(),
  mapeamentoFindUnique: vi.fn(),
  mapeamentoUpsert: vi.fn(),
  mapeamentoUpdate: vi.fn(),
  mapeamentoDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: mocks.exigirConfig }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notificar }));
vi.mock("@/lib/bpm/anexos-storage", () => ({ extrairPathnamePrivadoAnexoBpm: (url: string) => url.startsWith("blob:") ? url : null }));
vi.mock("@/lib/bpm/anexos-lifecycle", () => ({ ACAO_LIMPEZA_ANEXO_PENDENTE: "ANEXO_BLOB_LIMPEZA_PENDENTE", limparBlobAnexoPendente: mocks.limparBlob }));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmCampo: { findUnique: mocks.campoFindUnique, findMany: mocks.campoFindMany },
    bpmCampoMapeamento: {
      findMany: mocks.mapeamentoFindMany,
      findUnique: mocks.mapeamentoFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  AtualizarCampoBpm,
  ObterUsoCamposBpm,
  ConfigurarMapeamentoCampoBpm,
  CriarCampoBpm,
  DesativarMapeamentoCampoBpm,
  ExcluirCampoBpm,
} from "@/actions/bpm/Campos";

const PIPELINE_ID = "clw0000000000000pipeline";
const OUTRO_PIPELINE_ID = "clw000000000000pipeline2";
const CAMPO_ORIGEM_ID = "clw00000000000000origem";
const CAMPO_DESTINO_ID = "clw0000000000000destino";
const ETAPA_ID = "clw000000000000000etapa1";

function clienteTx() {
  return {
    bpmPipeline: { findMany: mocks.pipelineFindMany, update: mocks.pipelineUpdate },
    bpmEtapa: { findMany: mocks.etapaFindMany },
    bpmCampo: { create: mocks.campoCreate, update: mocks.campoUpdate, delete: mocks.campoDelete, findUnique: mocks.campoFindUnique, findUniqueOrThrow: mocks.campoFindUniqueOrThrow },
    bpmCardCampoValor: { count: mocks.valorCardCount },
    bpmCampoValorGlobal: { count: mocks.valorGlobalCount },
    bpmCardAnexo: { count: mocks.anexoCount, findMany: mocks.anexoFindMany, deleteMany: mocks.anexoDeleteMany },
    bpmCardHistorico: { create: mocks.historicoCreate },
    bpmFormularioComponente: { count: mocks.formComponentCount },
    bpmCampoOpcao: { createMany: mocks.opcaoCreateMany },
    bpmCampoPipeline: { createMany: mocks.campoPipelineCreateMany },
    bpmCampoEtapaConfig: { createMany: mocks.campoEtapaConfigCreateMany, count: mocks.campoEtapaConfigCount },
    bpmCampoAcesso: { createMany: mocks.acessoCreateMany },
    bpmCampoMapeamento: {
      findMany: mocks.mapeamentoFindMany,
      upsert: mocks.mapeamentoUpsert,
      update: mocks.mapeamentoUpdate,
      deleteMany: mocks.mapeamentoDeleteMany,
    },
    bpmPipelineConfigAuditoria: { create: mocks.auditoriaCreate },
  };
}

describe("ações de gestão configurável de campos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7" } });
    mocks.exigirConfig.mockResolvedValue(undefined);
    mocks.notificar.mockResolvedValue(undefined);
    mocks.pipelineFindMany.mockResolvedValue([{ id: PIPELINE_ID }]);
    mocks.pipelineUpdate.mockResolvedValue({ configVersion: 2 });
    mocks.etapaFindMany.mockResolvedValue([{ id: ETAPA_ID, pipelineId: PIPELINE_ID }]);
    mocks.campoCreate.mockResolvedValue({ id: CAMPO_DESTINO_ID, pipelineId: PIPELINE_ID });
    mocks.campoFindUniqueOrThrow.mockResolvedValue({
      id: CAMPO_DESTINO_ID,
      pipelineId: PIPELINE_ID,
      opcoes: [],
      pipelinesAssociados: [{ pipelineId: PIPELINE_ID }],
      etapaConfiguracoes: [],
      acessos: [],
      mapeamentoDestino: null,
    });
    mocks.mapeamentoUpsert.mockResolvedValue({ id: "clw000000000000000mapa" });
    mocks.valorCardCount.mockResolvedValue(0);
    mocks.valorGlobalCount.mockResolvedValue(0);
    mocks.anexoCount.mockResolvedValue(0);
    mocks.anexoFindMany.mockResolvedValue([]);
    mocks.anexoDeleteMany.mockResolvedValue({ count: 0 });
    mocks.campoEtapaConfigCount.mockResolvedValue(0);
    mocks.historicoCreate.mockResolvedValue({ id: "history-1" });
    mocks.limparBlob.mockResolvedValue(true);
    mocks.formComponentCount.mockResolvedValue(0);
    mocks.campoDelete.mockResolvedValue({ id: CAMPO_DESTINO_ID });
    mocks.transaction.mockImplementation(async (callback: (tx: ReturnType<typeof clienteTx>) => unknown) => callback(clienteTx()));
  });

  it("exige sessão antes de consultar ou alterar configuração", async () => {
    mocks.auth.mockResolvedValue(null);
    const resultado = await ConfigurarMapeamentoCampoBpm({
      campoOrigemId: CAMPO_ORIGEM_ID,
      campoDestinoId: CAMPO_DESTINO_ID,
      modo: "COPIAR",
    });
    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(mocks.campoFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("persiste acesso explícito para todos os perfis quando o admin não customiza", async () => {
    const resultado = await CriarCampoBpm({
      pipelineId: PIPELINE_ID,
      nome: "E-mail principal",
      tipo: "email",
      obrigatorio: false,
      somenteLeitura: true,
      editavel: false,
    });
    expect(resultado.success).toBe(true);
    expect(mocks.acessoCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ campoId: CAMPO_DESTINO_ID, perfil: "ADMIN", somenteLeitura: true, editavel: false, obrigatorio: false }),
        expect.objectContaining({ campoId: CAMPO_DESTINO_ID, perfil: "RESPONSAVEL", somenteLeitura: true, editavel: false }),
        expect.objectContaining({ campoId: CAMPO_DESTINO_ID, perfil: "MEMBRO", somenteLeitura: true, editavel: false }),
      ]),
    });
  });

  it("cria campo novo já vinculado somente à etapa escolhida pela configuração canônica", async () => {
    mocks.campoFindUniqueOrThrow.mockResolvedValue({
      id: CAMPO_DESTINO_ID,
      pipelineId: PIPELINE_ID,
      nome: "Número do processo",
      tipo: "texto",
      ativo: true,
      opcoes: [],
      pipelinesAssociados: [],
      etapaConfiguracoes: [
        { etapaId: ETAPA_ID, visivel: true, editavel: true, obrigatorio: true },
      ],
      acessos: [],
      mapeamentoDestino: null,
    });

    const resultado = await CriarCampoBpm({
      pipelineId: PIPELINE_ID,
      nome: "Número do processo",
      tipo: "texto",
      etapaConfiguracoes: [
        {
          etapaId: ETAPA_ID,
          visivel: true,
          editavel: true,
          somenteLeitura: false,
          obrigatorio: true,
          obrigatorioEntrada: false,
          obrigatorioSaida: false,
          ordem: 2,
        },
      ],
    });

    expect(resultado).toMatchObject({
      success: true,
      data: {
        id: CAMPO_DESTINO_ID,
        etapaConfiguracoes: [{ etapaId: ETAPA_ID, obrigatorio: true }],
      },
    });
    expect(mocks.campoEtapaConfigCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          campoId: CAMPO_DESTINO_ID,
          etapaId: ETAPA_ID,
          visivel: true,
          obrigatorio: true,
        }),
      ],
    });
    expect(mocks.campoPipelineCreateMany).not.toHaveBeenCalled();
  });

  it("preserva o agregado completo em dois saves consecutivos sem reload", async () => {
    const agregado = {
      id: CAMPO_DESTINO_ID,
      pipelineId: PIPELINE_ID,
      nome: "Receita anual",
      tipo: "texto",
      ativo: true,
      escopo: "CARD",
      fonteEntidade: null,
      fonteAtributo: null,
      entidadeGlobal: null,
      valores: [],
      opcoes: [{ id: "opcao-1", chave: "alto", rotulo: "Alto", ordem: 0, ativo: true }],
      pipelinesAssociados: [{ pipelineId: PIPELINE_ID }],
      etapaConfiguracoes: [{ etapaId: ETAPA_ID, ordem: 0, obrigatorio: true }],
      acessos: [{ perfil: "ADMIN", visivel: true, editavel: true, somenteLeitura: false, obrigatorio: false }],
      mapeamentoDestino: null,
    };
    mocks.campoFindUnique.mockResolvedValue(agregado);
    mocks.campoUpdate.mockResolvedValue({ id: CAMPO_DESTINO_ID });
    mocks.campoFindUniqueOrThrow
      .mockResolvedValueOnce({ ...agregado, nome: "Receita 2026" })
      .mockResolvedValueOnce({ ...agregado, nome: "Receita confirmada" });

    const primeiro = await AtualizarCampoBpm({ campoId: CAMPO_DESTINO_ID, nome: "Receita 2026" });
    expect(primeiro).toMatchObject({ success: true, data: { opcoes: agregado.opcoes, etapaConfiguracoes: agregado.etapaConfiguracoes } });

    const segundo = await AtualizarCampoBpm({ campoId: CAMPO_DESTINO_ID, nome: "Receita confirmada" });
    expect(segundo).toMatchObject({
      success: true,
      data: {
        pipelinesAssociados: agregado.pipelinesAssociados,
        etapaConfiguracoes: agregado.etapaConfiguracoes,
        acessos: agregado.acessos,
        opcoes: agregado.opcoes,
      },
    });
  });

  it("resume uso do campo sem expor valores ou anexos", async () => {
    mocks.campoFindMany.mockResolvedValue([{
      id: CAMPO_DESTINO_ID,
      _count: { valores: 3, valoresGlobais: 1, anexos: 2, componentesFormulario: 2, etapaConfiguracoes: 4 },
    }]);
    expect(await ObterUsoCamposBpm(PIPELINE_ID)).toEqual({
      success: true,
      data: { [CAMPO_DESTINO_ID]: { valoresCard: 3, valoresGlobais: 1, anexos: 2, formularios: 2, etapas: 4 } },
    });
    expect(mocks.campoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ pipelineId: PIPELINE_ID }, { pipelinesAssociados: { some: { pipelineId: PIPELINE_ID } } }] },
    }));
  });

  it("impede mudar o tipo de campo com anexo ou valor global", async () => {
    mocks.campoFindUnique.mockResolvedValue({
      id: CAMPO_DESTINO_ID, pipelineId: PIPELINE_ID, tipo: "texto", escopo: "CARD",
      fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null,
      valores: [], opcoes: [], pipelinesAssociados: [], etapaConfiguracoes: [], acessos: [],
      _count: { valoresGlobais: 1, anexos: 1 },
    });
    expect(await AtualizarCampoBpm({ campoId: CAMPO_DESTINO_ID, tipo: "arquivo" })).toEqual({
      success: false, error: "Não é possível alterar o tipo de um campo com valores ou anexos",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("não remove opção usada por valor global", async () => {
    mocks.campoFindUnique.mockResolvedValue({
      id: CAMPO_DESTINO_ID, pipelineId: PIPELINE_ID, tipo: "selecao", escopo: "GLOBAL",
      fonteEntidade: null, fonteAtributo: null, entidadeGlobal: "CLIENTE", ativo: true,
      valores: [], valoresGlobais: [{ valor: "Remover" }],
      _count: { valoresGlobais: 1, anexos: 0 },
      opcoes: [
        { chave: "manter", rotulo: "Manter", ativo: true },
        { chave: "remover", rotulo: "Remover", ativo: true },
      ],
      pipelinesAssociados: [], etapaConfiguracoes: [], acessos: [],
    });
    expect(await AtualizarCampoBpm({ campoId: CAMPO_DESTINO_ID, opcoes: ["Manter"] })).toEqual({
      success: false, error: "Não é possível remover uma opção que já está em uso",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("não oculta campo enquanto formulário publicado ainda o referencia", async () => {
    mocks.campoFindUnique.mockResolvedValue({
      id: CAMPO_DESTINO_ID, pipelineId: PIPELINE_ID, tipo: "texto", escopo: "CARD",
      fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null, ativo: true,
      valores: [], valoresGlobais: [], _count: { valoresGlobais: 0, anexos: 0 },
      opcoes: [], pipelinesAssociados: [], acessos: [],
      etapaConfiguracoes: [{ etapaId: ETAPA_ID, visivel: true }],
    });
    mocks.formComponentCount.mockResolvedValue(1);
    const resultado = await AtualizarCampoBpm({ campoId: CAMPO_DESTINO_ID, etapaConfiguracoes: [{
      etapaId: ETAPA_ID, visivel: false, editavel: true, somenteLeitura: false,
      obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false, ordem: 0,
    }] });
    expect(resultado).toEqual({ success: false, error: "Retire o campo do formulário publicado antes de ocultá-lo nesta etapa" });
    expect(mocks.campoUpdate).not.toHaveBeenCalled();
  });

  it("não desativa campo enquanto formulário publicado ainda o referencia", async () => {
    mocks.campoFindUnique.mockResolvedValue({
      id: CAMPO_DESTINO_ID, pipelineId: PIPELINE_ID, tipo: "texto", escopo: "CARD",
      fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null, ativo: true,
      valores: [], valoresGlobais: [], _count: { valoresGlobais: 0, anexos: 0 },
      opcoes: [], pipelinesAssociados: [], acessos: [], etapaConfiguracoes: [],
    });
    mocks.formComponentCount.mockResolvedValue(1);
    const resultado = await AtualizarCampoBpm({ campoId: CAMPO_DESTINO_ID, ativo: false });
    expect(resultado).toEqual({ success: false, error: "Retire o campo dos formulários publicados antes de desativá-lo" });
    expect(mocks.campoUpdate).not.toHaveBeenCalled();
  });

  it("rejeita seleção customizada ativa sem opções e aceita fonte canônica", async () => {
    const invalido = await CriarCampoBpm({
      pipelineId: PIPELINE_ID,
      nome: "Status da sede",
      tipo: "selecao",
      obrigatorio: false,
      opcoes: [],
      escopo: "GLOBAL",
      fonteEntidade: null,
    });
    expect(invalido).toEqual({ success: false, error: "Campo de seleção customizado precisa ter ao menos uma opção ativa" });
    expect(mocks.transaction).not.toHaveBeenCalled();

    const canonico = await CriarCampoBpm({
      pipelineId: PIPELINE_ID,
      nome: "Regime tributário",
      tipo: "selecao",
      obrigatorio: false,
      opcoes: [],
      escopo: "GLOBAL",
      fonteEntidade: "CLIENTE",
      fonteAtributo: "regimeTributario",
      somenteLeitura: true,
      editavel: false,
    });
    expect(canonico.success).toBe(true);
  });

  it("exclui definitivamente campo sem dados, audita e avança a configuração", async () => {
    mocks.campoFindUnique.mockResolvedValue({
      id: CAMPO_DESTINO_ID,
      nome: "Campo descartável",
      pipelineId: PIPELINE_ID,
      pipelinesAssociados: [{ pipelineId: OUTRO_PIPELINE_ID }],
    });

    const resultado = await ExcluirCampoBpm({ campoId: CAMPO_DESTINO_ID });

    expect(resultado).toEqual({ success: true });
    expect(mocks.mapeamentoDeleteMany).toHaveBeenCalledWith({
      where: { OR: [{ campoOrigemId: CAMPO_DESTINO_ID }, { campoDestinoId: CAMPO_DESTINO_ID }] },
    });
    expect(mocks.campoDelete).toHaveBeenCalledWith({ where: { id: CAMPO_DESTINO_ID } });
    expect(mocks.auditoriaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ campoAlterado: "campo_excluido", pipelineId: PIPELINE_ID, adminId: 7 }),
    });
    expect(mocks.pipelineUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.notificar).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["valor de card", "valorCardCount"],
    ["valor global", "valorGlobalCount"],
  ] as const)("exige confirmação para descartar %s associado", async (_cenario, contador) => {
    mocks.campoFindUnique.mockResolvedValue({
      id: CAMPO_DESTINO_ID,
      nome: "Campo em uso",
      pipelineId: PIPELINE_ID,
      pipelinesAssociados: [],
    });
    mocks[contador].mockResolvedValue(1);

    const resultado = await ExcluirCampoBpm({ campoId: CAMPO_DESTINO_ID });

    expect(resultado).toEqual({
      success: false,
      error: "Confirme a exclusão dos dados relacionados",
    });
    expect(mocks.campoDelete).not.toHaveBeenCalled();
    expect(mocks.mapeamentoDeleteMany).not.toHaveBeenCalled();
  });

  it("descarta apenas dados e anexo do campo confirmado e agenda limpeza do blob", async () => {
    mocks.campoFindUnique.mockResolvedValue({
      id: CAMPO_DESTINO_ID, nome: "Campo em uso", pipelineId: PIPELINE_ID,
      pipelinesAssociados: [],
    });
    mocks.valorCardCount.mockResolvedValue(1);
    mocks.valorGlobalCount.mockResolvedValue(2);
    mocks.anexoFindMany.mockResolvedValue([{ id: "anexo-1", cardId: "card-1", nome: "arquivo.pdf", url: "blob:campo.pdf" }]);

    const resultado = await ExcluirCampoBpm({
      campoId: CAMPO_DESTINO_ID,
      confirmarDescarteDados: true,
      usoConfirmado: { valoresCard: 1, valoresGlobais: 2, anexos: 1, formularios: 0, etapas: 0 },
    });

    expect(resultado).toEqual({ success: true });
    expect(mocks.anexoDeleteMany).toHaveBeenCalledWith({ where: { campoId: CAMPO_DESTINO_ID } });
    expect(mocks.campoDelete).toHaveBeenCalledWith({ where: { id: CAMPO_DESTINO_ID } });
    expect(mocks.historicoCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ acao: "ANEXO_BLOB_LIMPEZA_PENDENTE", cardId: "card-1" }), select: { id: true } });
    expect(mocks.limparBlob).toHaveBeenCalledWith("history-1");
  });

  it("recusa impacto desatualizado antes de remover o campo", async () => {
    mocks.campoFindUnique.mockResolvedValue({ id: CAMPO_DESTINO_ID, nome: "Campo em uso", pipelineId: PIPELINE_ID, pipelinesAssociados: [] });
    mocks.valorCardCount.mockResolvedValue(2);
    const resultado = await ExcluirCampoBpm({
      campoId: CAMPO_DESTINO_ID,
      confirmarDescarteDados: true,
      usoConfirmado: { valoresCard: 1, valoresGlobais: 0, anexos: 0, formularios: 0, etapas: 0 },
    });
    expect(resultado).toEqual({ success: false, error: "O uso do campo mudou. Atualize a análise e confirme novamente" });
    expect(mocks.anexoDeleteMany).not.toHaveBeenCalled();
    expect(mocks.campoDelete).not.toHaveBeenCalled();
  });

  it("não limpa o blob quando a exclusão transacional do campo falha", async () => {
    mocks.campoFindUnique.mockResolvedValue({ id: CAMPO_DESTINO_ID, nome: "Campo em uso", pipelineId: PIPELINE_ID, pipelinesAssociados: [] });
    mocks.anexoFindMany.mockResolvedValue([{ id: "anexo-1", cardId: "card-1", nome: "arquivo.pdf", url: "blob:campo.pdf" }]);
    mocks.campoDelete.mockRejectedValue(new Error("FK_FAILURE"));
    const resultado = await ExcluirCampoBpm({
      campoId: CAMPO_DESTINO_ID,
      confirmarDescarteDados: true,
      usoConfirmado: { valoresCard: 0, valoresGlobais: 0, anexos: 1, formularios: 0, etapas: 0 },
    });
    expect(resultado.success).toBe(false);
    expect(mocks.limparBlob).not.toHaveBeenCalled();
    expect(mocks.notificar).not.toHaveBeenCalled();
  });

  it("rejeita mapeamento entre tipos diferentes antes da transação", async () => {
    mocks.campoFindUnique
      .mockResolvedValueOnce({ id: CAMPO_ORIGEM_ID, pipelineId: PIPELINE_ID, tipo: "texto" })
      .mockResolvedValueOnce({ id: CAMPO_DESTINO_ID, pipelineId: OUTRO_PIPELINE_ID, tipo: "numero" });
    mocks.mapeamentoFindMany.mockResolvedValue([]);
    const resultado = await ConfigurarMapeamentoCampoBpm({
      campoOrigemId: CAMPO_ORIGEM_ID,
      campoDestinoId: CAMPO_DESTINO_ID,
      modo: "SINCRONIZAR",
    });
    expect(resultado).toEqual({ success: false, error: "Mapeamento exige campos do mesmo tipo" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("salva mapeamento válido, audita e notifica as duas pipelines", async () => {
    mocks.campoFindUnique
      .mockResolvedValueOnce({ id: CAMPO_ORIGEM_ID, pipelineId: PIPELINE_ID, tipo: "texto" })
      .mockResolvedValueOnce({ id: CAMPO_DESTINO_ID, pipelineId: OUTRO_PIPELINE_ID, tipo: "texto" });
    mocks.mapeamentoFindMany.mockResolvedValue([]);
    const resultado = await ConfigurarMapeamentoCampoBpm({
      campoOrigemId: CAMPO_ORIGEM_ID,
      campoDestinoId: CAMPO_DESTINO_ID,
      modo: "REFERENCIAR",
    });
    expect(resultado.success).toBe(true);
    expect(mocks.mapeamentoUpsert).toHaveBeenCalled();
    expect(mocks.auditoriaCreate).toHaveBeenCalled();
    expect(mocks.notificar).toHaveBeenCalledTimes(2);
  });

  it("desativa mapeamento de forma reversível e preserva o registro", async () => {
    mocks.mapeamentoFindUnique.mockResolvedValue({
      id: "clw000000000000000mapa",
      ativo: true,
      campoOrigem: { pipelineId: PIPELINE_ID },
      campoDestino: { pipelineId: OUTRO_PIPELINE_ID },
    });
    const resultado = await DesativarMapeamentoCampoBpm({ campoDestinoId: CAMPO_DESTINO_ID });
    expect(resultado.success).toBe(true);
    expect(mocks.mapeamentoUpdate).toHaveBeenCalledWith({
      where: { campoDestinoId: CAMPO_DESTINO_ID },
      data: { ativo: false },
    });
    expect(mocks.auditoriaCreate).toHaveBeenCalled();
  });
});
