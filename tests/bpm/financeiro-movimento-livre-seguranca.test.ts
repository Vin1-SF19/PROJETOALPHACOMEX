import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));
import { objetoEventoMinuta } from "@/lib/bpm/automacoes/minuta-movimento-livre";
import { parametrosFinanceiroMovimentoLivre } from "@/lib/bpm/automacoes/financeiro-movimento-livre";
const grafoEhMinutaConfigurada = (input: unknown) => Boolean(parametrosFinanceiroMovimentoLivre(input));
import { motivoBloqueioFinanceiroMovimentoLivre } from "@/lib/bpm/automacoes/financeiro-movimento-livre-server";

const cardId = "c111111111111111111111111";
const pipelineId = "c222222222222222222222222";
const origemId = "c333333333333333333333333";
const destinoId = "c444444444444444444444444";
const templateId = "c555555555555555555555555";
const historicoId = "c666666666666666666666666";
const outroId = "c777777777777777777777777";
const acao = { id: "gerar", tipo: "ACAO", acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", parametros: { pipelineId: templateId, etapaId: outroId, vincularAoOriginal: true, somenteSeNaoExistirAtivo: true }, proximoId: "fim" };
const fim = { id: "fim", tipo: "FIM" };
const grafo = () => ({ inicioId: "gerar", nos: [structuredClone(acao), structuredClone(fim)] });

function fixture() {
  const usuario = { id: 7, role: "Admin", status: "ATIVO", permissoes: "crm" };
  const card = { id: cardId, empresaId: 5, pipelineId, etapaId: destinoId, versao: 2,
    status: "ATIVO", responsavelId: 7, servico: "Revisão Radar", tipoProcesso: null,
    createdAt: new Date("2026-10-21T20:00:00Z"), updatedAt: new Date("2026-10-21T20:01:00Z"),
    concluidoEm: null, primeiraVisualizacaoEm: null, proximoContatoEm: null, dataReuniao: null, statusPosFechamento: null,
    pipeline: { ativo: true, chave: null as string | null, nome: "Revisão de Radar", setores: [{ setor: { nome: "Financeiro", ativo: true } }], visualizacaoConfigJson: null },
    etapa: { ativo: true, pipelineId, nome: "Contrato fechado", chave: "fechado", ehFinal: false, visibilidades: [] }, vinculosOrigem: [] };
  const anterior = { etapaId: origemId, versao: 1 };
  const novo = { etapaId: destinoId, versao: 2, movimentoLivre: { tipo: "ADMIN", setor: null as string | null },
    automacoesSuprimidas: true, permitirEncaminhamentoFinanceiroConfigurado: true };
  const historico = { id: historicoId, cardId, usuarioId: 7, acao: "CARD_MOVIDO",
    valorAnteriorJson: JSON.stringify(anterior), valorNovoJson: JSON.stringify({ ...novo, obrigatoriedadesDispensadas: true }) };
  const evento = { tipo: "CARD_MOVIDO", entidadeTipo: "CARD", entidadeId: cardId, cardId, pipelineId,
    atorTipo: "USUARIO", atorUserId: 7, atorExecucaoId: null as string | null, profundidade: 0,
    causationId: historicoId as string | null, idempotencyKey: "transition:solicitacao-ficticia-1",
    valorAnteriorJson: JSON.stringify(anterior), valorNovoJson: JSON.stringify(novo) };
  const versao = { status: "ATIVA", gatilhoTipo: "ENTRAR_COLUNA",
    gatilhoConfigJson: JSON.stringify({ escopo: "ETAPAS", etapaId: destinoId }), grafoJson: JSON.stringify(grafo()),
    condicaoJson: null, automacao: { ativa: true, pipelineId, etapaId: destinoId } };
  const io = {
    usuarios: { findUnique: vi.fn(async ({ where }: { where: { id: number } }) => where.id === usuario.id ? usuario : null) },
    setorPermissao: { findMany: vi.fn().mockResolvedValue([]) }, usuarioPermissaoOverride: { findMany: vi.fn().mockResolvedValue([]) },
    bpmCard: { findUnique: vi.fn().mockResolvedValue(card), updateMany: vi.fn() },
    bpmEtapa: { findFirst: vi.fn().mockResolvedValue({ id: outroId }) },
    bpmCardMembro: { findUnique: vi.fn().mockResolvedValue(null) },
    bpmCardHistorico: { findFirst: vi.fn(async ({ where }: { where: { id: string; cardId: string; acao: string; usuarioId: number } }) =>
      where.id === historico.id && where.cardId === historico.cardId && where.acao === historico.acao && where.usuarioId === historico.usuarioId ? historico : null), create: vi.fn() },
    bpmAutomacaoExecucao: { create: vi.fn(), updateMany: vi.fn() },
  };
  const client = io as unknown as Prisma.TransactionClient;
  const validar = () => motivoBloqueioFinanceiroMovimentoLivre(evento, versao, client);
  return { usuario, card, anterior, novo, historico, evento, versao, io, validar };
}
beforeEach(() => vi.clearAllMocks());

describe("classificador documental recusa grafo inteiro estruturalmente adulterado", () => {
  it("aceita o contrato mínimo validado pelo schema sem alterar a configuração", () => {
    const input = grafo(); const antes = structuredClone(input);
    expect(grafoEhMinutaConfigurada(input)).toBe(true);
    expect(input).toEqual(antes);
  });
  it.each([
    ["null", null], ["string JSON em vez de grafo", JSON.stringify(grafo())],
    ["array", []], ["sem nós", { inicioId: "gerar", nos: [] }],
    ["início no fim", { inicioId: "fim", nos: [acao, fim] }],
    ["ID duplicado", { inicioId: "gerar", nos: [acao, { ...fim, id: "gerar" }] }],
    ["alvo inexistente", { inicioId: "gerar", nos: [{ ...acao, proximoId: "inexistente" }, fim] }],
    ["autociclo", { inicioId: "gerar", nos: [{ ...acao, proximoId: "gerar" }, fim] }],
    ["fim inacessível", { inicioId: "gerar", nos: [{ ...acao, proximoId: undefined }, fim] }],
    ["nó extra inacessível", { inicioId: "gerar", nos: [acao, fim, { id: "extra", tipo: "FIM" }] }],
    ["branch escondido no nó", { inicioId: "gerar", nos: [{ ...acao, senaoId: "fim" }, fim] }],
    ["comunicação adicional fora do fluxo", { ...grafo(), chamadaHttp: { url: "https://evil.test" } }],
    ["template inválido", { inicioId: "gerar", nos: [{ ...acao, parametros: { ...acao.parametros, pipelineId: "forjado" } }, fim] }],
    ["permissão de pendência não booleana", { inicioId: "gerar", nos: [{ ...acao, parametros: { ...acao.parametros, vincularAoOriginal: "true" } }, fim] }],
  ])("bloqueia %s sem extrair uma ação documental", (_nome, input) => {
    expect(grafoEhMinutaConfigurada(input)).toBe(false);
  });
  it.each([null, "null", "[]", '"string"', "{json-invalido}"])("payload não-objeto não concede marcadores: %s", (input) => {
    expect(objetoEventoMinuta(input)).toEqual({});
  });
});

describe("proveniência persistida: marcador não substitui o histórico do comando", () => {
  it("exige e permite prova causal concordante, usando ownership real e sem gravar", async () => {
    const f = fixture();
    expect(await f.validar()).toBeNull();
    expect(f.io.bpmCardHistorico.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: historicoId, cardId, acao: "CARD_MOVIDO", usuarioId: 7,
    } }));
    expect(f.io.usuarios.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7 } }));
    for (const write of [f.io.bpmCard.updateMany, f.io.bpmCardHistorico.create, f.io.bpmAutomacaoExecucao.create, f.io.bpmAutomacaoExecucao.updateMany])
      expect(write).not.toHaveBeenCalled();
  });
  it.each(["sem-causa", "causa-estrangeira", "card", "ator", "acao", "json-anterior", "json-novo"])("recusa histórico ausente/estrangeiro/adulterado: %s", async (caso) => {
    const f = fixture();
    if (caso === "sem-causa") f.evento.causationId = null;
    if (caso === "causa-estrangeira") f.evento.causationId = outroId;
    if (caso === "card") f.historico.cardId = outroId;
    if (caso === "ator") f.historico.usuarioId = 8;
    if (caso === "acao") f.historico.acao = "CARD_ATUALIZADO";
    if (caso === "json-anterior") f.historico.valorAnteriorJson = "{}";
    if (caso === "json-novo") f.historico.valorNovoJson = "[]";
    expect(await f.validar()).not.toBeNull();
    expect(f.io.bpmAutomacaoExecucao.create).not.toHaveBeenCalled();
  });
  it.each(["origem", "destino", "versao-anterior", "versao-resultante", "tipo-autoridade", "setor-autoridade"])("recusa discordância semântica histórico/evento: %s", async (caso) => {
    const f = fixture();
    if (caso === "origem") f.historico.valorAnteriorJson = JSON.stringify({ ...f.anterior, etapaId: outroId });
    if (caso === "destino") f.historico.valorNovoJson = JSON.stringify({ ...f.novo, etapaId: outroId });
    if (caso === "versao-anterior") f.historico.valorAnteriorJson = JSON.stringify({ ...f.anterior, versao: 0 });
    if (caso === "versao-resultante") f.historico.valorNovoJson = JSON.stringify({ ...f.novo, versao: 3 });
    if (caso === "tipo-autoridade") f.historico.valorNovoJson = JSON.stringify({ ...f.novo, movimentoLivre: { tipo: "LIDER_SETOR" } });
    if (caso === "setor-autoridade") f.historico.valorNovoJson = JSON.stringify({ ...f.novo, movimentoLivre: { tipo: "ADMIN", setor: "outro" } });
    expect(await f.validar()).not.toBeNull();
  });
  it.each(["", "webhook:movimento", "admin:movimento", "transition-fake:movimento"])("outra família de idempotência não produz movimento autorizado: %s", async (chave) => {
    const f = fixture(); f.evento.idempotencyKey = chave;
    expect(await f.validar()).not.toBeNull();
  });
  it.each(["antigo", "false", "string", "supressao-ausente", "assinatura-cliente"])("marcação antiga/forjada não habilita a exceção: %s", async (caso) => {
    const f = fixture();
    const novo: Record<string, unknown> = { ...f.novo };
    if (caso === "antigo") delete novo.permitirEncaminhamentoFinanceiroConfigurado;
    if (caso === "false") novo.permitirEncaminhamentoFinanceiroConfigurado = false;
    if (caso === "string") novo.permitirEncaminhamentoFinanceiroConfigurado = "true";
    if (caso === "supressao-ausente") delete novo.automacoesSuprimidas;
    if (caso === "assinatura-cliente") novo.movimentoLivre = { tipo: "ADMINISTRADOR", userId: 7 };
    f.evento.valorNovoJson = JSON.stringify(novo);
    expect(await f.validar()).not.toBeNull();
  });
});

describe("revalidação atual impede usar prova antiga após mudança do contexto", () => {
  it.each(["inativo", "crm-revogado", "autoridade-revogada"])("DB atual prevalece sobre o movimento Admin original: %s", async (caso) => {
    const f = fixture();
    if (caso === "inativo") f.usuario.status = "INATIVO";
    if (caso === "crm-revogado") { f.usuario.role = "Comercial"; f.usuario.permissoes = ""; }
    if (caso === "autoridade-revogada") f.usuario.role = "Financeiro";
    expect(await f.validar()).not.toBeNull();
  });
  it.each(["pipeline", "etapa", "arquivado", "cancelado", "pipeline-inativo", "etapa-inativa"])("card fora do contexto documental não é autorizado: %s", async (caso) => {
    const f = fixture();
    if (caso === "pipeline") f.card.pipelineId = outroId;
    if (caso === "etapa") f.card.etapaId = outroId;
    if (caso === "arquivado") f.card.status = "ARQUIVADO";
    if (caso === "cancelado") f.card.status = "CANCELADO";
    if (caso === "pipeline-inativo") f.card.pipeline.ativo = false;
    if (caso === "etapa-inativa") f.card.etapa.ativo = false;
    expect(await f.validar()).not.toBeNull();
  });
  it.each(["CARD_CRIADO", "CAMPO_ALTERADO"])("outro evento não herda a exceção: %s", async (tipo) => {
    const f = fixture(); f.evento.tipo = tipo;
    expect(await f.validar()).not.toBeNull();
  });
  it("evento derivado de automação não herda a autoridade humana", async () => {
    const f = fixture(); f.evento.atorExecucaoId = outroId;
    expect(await f.validar()).not.toBeNull();
  });
});


describe("limites do encaminhamento financeiro", () => {
  it("bloqueia evento novo cujo histórico não recebeu marcador do servidor", async () => {
    const f = fixture(); const semMarcador = { ...f.novo } as Record<string, unknown>;
    delete semMarcador.permitirEncaminhamentoFinanceiroConfigurado;
    f.historico.valorNovoJson = JSON.stringify(semMarcador);
    expect(await f.validar()).toBe("ORIGEM_FINANCEIRO_NAO_COMPROVADA");
  });
  it("bloqueia destino financeiro ausente/inativo ou de outro setor", async () => {
    const f = fixture(); f.io.bpmEtapa.findFirst.mockResolvedValueOnce(null as never);
    expect(await f.validar()).toBe("DESTINO_FINANCEIRO_INDISPONIVEL");
    expect(f.io.bpmEtapa.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: outroId, pipelineId: templateId, ativo: true, pipeline: { ativo: true, chave: "financeiro" },
    } }));
  });
  it.each(["origem", "fechamento"])("bloqueia outro contexto de %s", async caso => {
    const f = fixture();
    if (caso === "origem") f.card.pipeline.nome = "Operacional";
    else f.card.etapa.chave = "em_tratativa";
    expect(await f.validar()).toBe("CARD_FORA_DO_FECHAMENTO_COMERCIAL");
  });
  it.each(["vincularAoOriginal", "somenteSeNaoExistirAtivo"])("exige proteção %s explícita", parametro => {
    const input = grafo(); delete (input.nos[0] as typeof acao).parametros[parametro as keyof typeof acao.parametros];
    expect(parametrosFinanceiroMovimentoLivre(input)).toBeNull();
  });
});
