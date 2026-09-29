import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/campos-formulario-publicado", () => ({ camposPublicadosPorEtapa: vi.fn() }));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({ carregarValoresCanonicosCampos: vi.fn() }));
vi.mock("@/lib/bpm/regras/contexto", () => ({ montarContextoAvaliacaoDoCard: vi.fn() }));

import { prepararSalvamentoConfigurado } from "@/lib/bpm/validacao-salvamento-configurado";
import { camposPublicadosPorEtapa } from "@/lib/bpm/campos-formulario-publicado";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import { FINANCIAL_FIELD_KEYS as K } from "@/lib/bpm/pipeline-financeiro";
import { CHAVES_CAMPOS as C } from "@/lib/bpm/financeiro-config.client";

const etapaId = "cmt36ivq0001dkw0ax7jkz33c";
const elaboradoId = "cmt36ivq9001fkw0aw172i84z";
const dataId = "cmt36ivqg001hkw0aebtrscl4";
const enviadoId = "cmt36ivqq001jkw0a3xk98usr";
const linkId = "cmt36ivqw001lkw0adgv97zab";
const quandoElaborado = JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: elaboradoId }, operador: "igual", valor: "Sim" }] });
const quandoEnviado = JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: enviadoId }, operador: "igual", valor: "Sim" }] });

function cliente(requisitos: unknown[] = []) {
  return {
    bpmEtapa: { findMany: vi.fn().mockResolvedValue([{ id: etapaId }]) },
    bpmRequisito: { findMany: vi.fn().mockResolvedValue(requisitos) },
    bpmCampoEtapaConfig: { findMany: vi.fn().mockResolvedValue([{
      campoId: dataId, valorPadrao: "{{agora.data}}", condicaoObrigatoriedadeJson: quandoElaborado,
      campo: { id: dataId, nome: "Data de elaboração", tipo: "data", opcoesJson: null },
    }]) },
    bpmCampo: { findMany: vi.fn().mockResolvedValue([
      { id: elaboradoId, nome: "Contrato elaborado", escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null },
      { id: dataId, nome: "Data de elaboração", escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null },
      { id: enviadoId, nome: "Contrato enviado", escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null },
      { id: linkId, nome: "Link/arquivo do contrato", escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null },
    ]) },
  };
}

const card = { id: "card", pipelineId: "pipeline", etapaId };

beforeEach(() => {
  vi.mocked(camposPublicadosPorEtapa).mockResolvedValue(new Map([[etapaId, new Set([elaboradoId, dataId, enviadoId, linkId])]]));
  vi.mocked(carregarValoresCanonicosCampos).mockResolvedValue({});
  vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: {} });
});

describe("salvamento governado por configuração", () => {
  it("preenche a data configurada só ao marcar Sim e preserva a anterior", async () => {
    const agora = new Date("2026-09-25T15:00:00.000Z");
    const primeiro = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [elaboradoId]: "Sim" }, client: cliente() as never, agora });
    expect(primeiro[dataId]).toBe("2026-09-25");
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: { [dataId]: "2026-09-20" } });
    const segundo = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [elaboradoId]: "Sim" }, client: cliente() as never, agora });
    expect(segundo[dataId]).toBeUndefined();
  });

  it("aceita o autosave parcial do indicador; documento continua obrigatório no avanço", async () => {
    const requisito = { chave: "contrato-link", alvoTipo: "CAMPO", campoId: linkId, campo: { id: linkId, nome: "Link/arquivo do contrato", ativo: true }, condicaoJson: quandoEnviado };
    await expect(prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [enviadoId]: "Sim" }, client: cliente([requisito]) as never }))
      .resolves.toEqual({ [enviadoId]: "Sim" });
  });
});

const dados = [
  [K.CNPJ, "CNPJ", "90000001000129", "cnpj"], [K.RAZAO_SOCIAL, "Razão Social", "Empresa Teste", "texto"],
  [K.RUA, "Rua", "Rua Teste", "texto"], [K.NUMERO, "Número", "123", "texto"],
  [K.BAIRRO, "Bairro", "Centro", "texto"], [K.CEP, "CEP", "01001000", "texto"],
  [K.MUNICIPIO, "Município", "São Paulo", "texto"], [K.ESTADO, "Estado", "SP", "texto"],
  [K.EMAIL, "E-mail", "teste@example.com", "email"], [K.REGIME_CLIENTE, "Regime do cliente", "Simples Nacional", "texto"],
  [K.SERVICO, "Serviço", "Assessoria", "texto"], [K.VALOR_BRUTO, "Valor bruto", "100.00", "moeda"],
  [K.FORMA_PAGAMENTO, "Forma de pagamento", "Pix", "texto"], [K.CONDICAO, "Condição negociada", "À vista", "texto"],
] as const;
const camposContrato = [
  [C.CONTRATO_ELABORADO, "Contrato elaborado", "booleano"],
  [C.DATA_ELABORACAO, "Data de elaboração", "data"],
  [C.CONTRATO_ENVIADO, "Contrato enviado para assinatura", "booleano"],
  [C.DATA_ENVIO, "Data do envio", "data_hora"],
  [C.LINK_CONTRATO, "Link/arquivo do contrato", "url_ou_arquivo"],
] as const;

const chaves = [...dados.map(([chave]) => chave), ...camposContrato.map(([chave]) => chave)];
const ids = new Map<string, string>(chaves.map((chave, indice) => [chave, `cmt36ivq${String(indice).padStart(4, "0")}kw0ax7jkz33c`]));
const id = (chave: string) => ids.get(chave)!;

function clienteNovoContrato() {
  return {
    bpmEtapa: { findMany: vi.fn().mockResolvedValue([{ id: etapaId }]) },
    bpmCardAnexo: { findFirst: vi.fn().mockResolvedValue(null) },
    bpmCampoEtapaConfig: { findMany: vi.fn().mockResolvedValue([
      ...camposContrato.map(([chave, nome, tipo]) => ({
        campoId: id(chave), valorPadrao: chave === C.DATA_ELABORACAO ? "{{agora.data}}" : chave === C.DATA_ENVIO ? "{{agora.instante}}" : null,
        condicaoObrigatoriedadeJson: chave === C.DATA_ELABORACAO ? JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: id(C.CONTRATO_ELABORADO) }, operador: "igual", valor: "Sim" }] })
          : chave === C.DATA_ENVIO ? JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: id(C.CONTRATO_ENVIADO) }, operador: "igual", valor: "Sim" }] }) : null,
        campo: { id: id(chave), chave, nome, tipo, opcoesJson: null },
      })),
    ]) },
    bpmCampo: { findMany: vi.fn().mockResolvedValue([
      ...dados.map(([chave, nome, , tipo]) => ({ id: id(chave), chave, nome, tipo, opcoesJson: null, escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null })),
      ...camposContrato.map(([chave, nome, tipo]) => ({ id: id(chave), chave, nome, tipo, opcoesJson: null, escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null })),
    ]) },
  };
}

function valoresValidos() { return Object.fromEntries(dados.map(([chave, , valor]) => [id(chave), valor])); }

describe("Elaboração de Contrato ativa", () => {
  beforeEach(() => {
    const todos = [...dados.map(([chave]) => chave), ...camposContrato.map(([chave]) => chave)];
    vi.mocked(camposPublicadosPorEtapa).mockResolvedValue(new Map([[etapaId, new Set(todos.map(id))]]));
    vi.mocked(carregarValoresCanonicosCampos).mockResolvedValue({});
  });

  it("lista dados ausentes e inválidos pelo rótulo publicado antes de elaborar", async () => {
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: { ...valoresValidos(), [id(K.CNPJ)]: "00000000000000", [id(K.CEP)]: "123", [id(K.VALOR_BRUTO)]: "0", [id(K.EMAIL)]: "ruim", [id(K.SERVICO)]: "" } });
    await expect(prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [id(C.CONTRATO_ELABORADO)]: "Sim" }, client: clienteNovoContrato() as never }))
      .rejects.toThrow(/REQUISITOS_PENDENTES:.*CNPJ.*E-mail.*Serviço.*Valor bruto.*CEP/);
  });

  it("registra a data de elaboração uma vez, preservando data anterior", async () => {
    const agora = new Date("2026-09-28T12:34:56.000Z");
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: valoresValidos() });
    const primeiro = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [id(C.CONTRATO_ELABORADO)]: "Sim" }, client: clienteNovoContrato() as never, agora });
    expect(primeiro[id(C.DATA_ELABORACAO)]).toBe("2026-09-28");
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: { ...valoresValidos(), [id(C.CONTRATO_ELABORADO)]: "Sim", [id(C.DATA_ELABORACAO)]: "2026-09-20" } });
    const segundo = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [id(C.CONTRATO_ELABORADO)]: "Sim" }, client: clienteNovoContrato() as never, agora });
    expect(segundo[id(C.DATA_ELABORACAO)]).toBeUndefined();
    const tentativaAlterar = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [id(C.DATA_ELABORACAO)]: "2026-09-29" }, client: clienteNovoContrato() as never, agora });
    expect(tentativaAlterar[id(C.DATA_ELABORACAO)]).toBe("2026-09-20");
  });

  it("bloqueia elaboração quando a data exigida não tem automação ativa", async () => {
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: valoresValidos() });
    const client = clienteNovoContrato();
    const configs = await client.bpmCampoEtapaConfig.findMany();
    client.bpmCampoEtapaConfig.findMany.mockResolvedValue(configs.map((config: { campo: { chave: string }; valorPadrao: string | null }) => ({
      ...config, valorPadrao: config.campo.chave === C.DATA_ELABORACAO ? null : config.valorPadrao,
    })));
    await expect(prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [id(C.CONTRATO_ELABORADO)]: "Sim" }, client: client as never }))
      .rejects.toThrow("REQUISITOS_PENDENTES:Data de elaboração");
  });

  it("bloqueia envio sem elaboração e documento; grava instante único com documento válido", async () => {
    const agora = new Date("2026-09-28T12:34:56.000Z");
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: valoresValidos() });
    await expect(prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [id(C.CONTRATO_ENVIADO)]: "Sim" }, client: clienteNovoContrato() as never, agora }))
      .rejects.toThrow(/Contrato elaborado, Link\/arquivo do contrato/);
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: { ...valoresValidos(), [id(C.CONTRATO_ELABORADO)]: "Sim", [id(C.DATA_ELABORACAO)]: "2026-09-28" } });
    const primeiro = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [id(C.CONTRATO_ENVIADO)]: "Sim", [id(C.LINK_CONTRATO)]: "https://example.com/contrato" }, client: clienteNovoContrato() as never, agora });
    expect(primeiro[id(C.DATA_ENVIO)]).toBe(agora.toISOString());
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: { ...valoresValidos(), [id(C.CONTRATO_ELABORADO)]: "Sim", [id(C.CONTRATO_ENVIADO)]: "Sim", [id(C.DATA_ENVIO)]: primeiro[id(C.DATA_ENVIO)], [id(C.LINK_CONTRATO)]: "https://example.com/contrato" } });
    const segundo = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [id(C.CONTRATO_ENVIADO)]: "Sim" }, client: clienteNovoContrato() as never, agora: new Date("2026-09-29T12:00:00.000Z") });
    expect(segundo[id(C.DATA_ENVIO)]).toBeUndefined();
    const tentativaAlterar = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos: { [id(C.DATA_ENVIO)]: "2026-09-29T12:00:00.000Z" }, client: clienteNovoContrato() as never, agora: new Date("2026-09-29T12:00:00.000Z") });
    expect(tentativaAlterar[id(C.DATA_ENVIO)]).toBe(agora.toISOString());
  });

  it("só aceita arquivo de contrato vinculado a este card e campo", async () => {
    const arquivoId = "cmt36ivqg001hkw0aebtrscl4";
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: {
      ...valoresValidos(), [id(C.CONTRATO_ELABORADO)]: "Sim", [id(C.DATA_ELABORACAO)]: "2026-09-28",
    } });
    const client = clienteNovoContrato();
    const valoresSubmetidos = { [id(C.CONTRATO_ENVIADO)]: "Sim", [id(C.LINK_CONTRATO)]: arquivoId };
    await expect(prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos, client: client as never }))
      .rejects.toThrow("REQUISITOS_PENDENTES:Link/arquivo do contrato");
    expect(client.bpmCardAnexo.findFirst).toHaveBeenCalledWith({
      where: { id: arquivoId, cardId: card.id, campoId: id(C.LINK_CONTRATO) }, select: { id: true },
    });
    client.bpmCardAnexo.findFirst.mockResolvedValue({ id: arquivoId });
    const salvo = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos, client: client as never,
      agora: new Date("2026-09-28T12:34:56.000Z") });
    expect(salvo[id(C.DATA_ENVIO)]).toBe("2026-09-28T12:34:56.000Z");
  });
});

const formalizacaoIds = {
  status: "cmt36ivq0002fkw0ax7jkz33c",
  contrato: "cmt36ivq0002gkw0ax7jkz33c",
  data: "cmt36ivq0002hkw0ax7jkz33c",
  anexo: "cmt36ivq0002ikw0ax7jkz33c",
};
const quandoAssinado = JSON.stringify({ operador: "AND", condicoes: [{
  tipo: "condicao", campo: { fonte: "campo_dinamico", campo: formalizacaoIds.status }, operador: "igual", valor: "Assinado",
}] });

function clienteFormalizacao() {
  const definicoes = [
    [C.STATUS_ASSINATURA, formalizacaoIds.status, "Status da assinatura", "selecao", JSON.stringify(["Aguardando assinatura", "Assinado"])],
    [C.STATUS_CONTRATO, formalizacaoIds.contrato, "Status do contrato", "selecao", JSON.stringify(["Pendente", "CONTRATO CONCLUÍDO"])],
    [C.DATA_ASSINATURA, formalizacaoIds.data, "Data da assinatura", "data", null],
    [C.ANEXO_ASSINADO, formalizacaoIds.anexo, "Contrato assinado/anexo", "arquivo", null],
  ] as const;
  return {
    bpmEtapa: { findMany: vi.fn().mockResolvedValue([{ id: etapaId }]) },
    bpmCampoEtapaConfig: { findMany: vi.fn().mockResolvedValue(definicoes.map(([chave, id, nome, tipo, opcoesJson]) => ({
      campoId: id, valorPadrao: chave === C.DATA_ASSINATURA ? "{{agora.data}}" : null,
      condicaoObrigatoriedadeJson: chave === C.DATA_ASSINATURA || chave === C.ANEXO_ASSINADO ? quandoAssinado : null,
      campo: { id, chave, nome, tipo, opcoesJson },
    }))) },
    bpmCampo: { findMany: vi.fn().mockResolvedValue(definicoes.map(([chave, id, nome, tipo, opcoesJson]) => ({
      id, chave, nome, tipo, opcoesJson, escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null,
    }))) },
    bpmCardAnexo: { findFirst: vi.fn().mockResolvedValue(null) },
    bpmCardHistorico: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}

describe("Formalização ativa", () => {
  beforeEach(() => {
    vi.mocked(camposPublicadosPorEtapa).mockResolvedValue(new Map([[etapaId, new Set(Object.values(formalizacaoIds))]]));
    vi.mocked(carregarValoresCanonicosCampos).mockResolvedValue({});
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: {} });
  });

  it("não confirma assinatura sem anexo próprio e preenche data ao confirmar", async () => {
    const client = clienteFormalizacao();
    const anexoId = "cmt36ivq0002jkw0ax7jkz33c";
    const valoresSubmetidos = { [formalizacaoIds.status]: "Assinado", [formalizacaoIds.anexo]: anexoId };
    await expect(prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos, client: client as never,
      agora: new Date("2026-09-29T12:00:00.000Z") }))
      .rejects.toThrow("REQUISITOS_PENDENTES:Contrato assinado/anexo");
    expect(client.bpmCardAnexo.findFirst).toHaveBeenCalledWith({
      where: { id: anexoId, cardId: card.id, campoId: formalizacaoIds.anexo }, select: { url: true },
    });
    client.bpmCardAnexo.findFirst.mockResolvedValue({ url: "bpm-blob:bpm/contratos/assinado.pdf" });
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: {} });
    const salvo = await prepararSalvamentoConfigurado({ card: card as never, valoresSubmetidos, client: client as never,
      agora: new Date("2026-09-29T12:00:00.000Z") });
    expect(salvo[formalizacaoIds.data]).toBe("2026-09-29");
  });

  it("não aceita status de contrato concluído sem assinatura e protege confirmação anterior", async () => {
    const client = clienteFormalizacao();
    await expect(prepararSalvamentoConfigurado({ card: card as never,
      valoresSubmetidos: { [formalizacaoIds.contrato]: "CONTRATO CONCLUÍDO" }, client: client as never }))
      .rejects.toThrow(/Status da assinatura.*Data da assinatura.*Contrato assinado\/anexo/);
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: {
      [formalizacaoIds.status]: "Assinado", [formalizacaoIds.data]: "2026-09-29",
      [formalizacaoIds.anexo]: "cmt36ivq0002jkw0ax7jkz33c",
    } });
    client.bpmCardAnexo.findFirst.mockResolvedValue({ url: "bpm-blob:bpm/contratos/assinado.pdf" });
    client.bpmCardHistorico.findFirst.mockResolvedValue({ id: "historico" });
    await expect(prepararSalvamentoConfigurado({ card: card as never,
      valoresSubmetidos: { [formalizacaoIds.status]: "Aguardando assinatura" }, client: client as never }))
      .rejects.toThrow("Assinatura já confirmada");
    vi.mocked(montarContextoAvaliacaoDoCard).mockResolvedValue({ card: {}, camposDinamicos: {
      [formalizacaoIds.status]: "Assinado", [formalizacaoIds.data]: "2026-09-29",
      [formalizacaoIds.anexo]: "cmt36ivq0002jkw0ax7jkz33c",
    } });
    await expect(prepararSalvamentoConfigurado({ card: card as never,
      valoresSubmetidos: { [formalizacaoIds.contrato]: "Pendente" }, client: client as never }))
      .rejects.toThrow("REQUISITOS_PENDENTES:Status do contrato");
  });
});
