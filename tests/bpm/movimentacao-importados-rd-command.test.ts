import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => {
  const card = {
    id: "card", pipelineId: "pipeline", etapaId: "origem", versao: 3, status: "ATIVO", concluidoEm: null,
    responsavelId: 7, proximoContatoEm: null, dataReuniao: null, transcricaoReuniao: null, statusPosFechamento: null,
    pipeline: { id: "pipeline", nome: "Funil arbitrário", chave: "custom", configVersion: 2, ativo: true },
    etapa: { id: "origem", pipelineId: "pipeline", nome: "Etapa arbitrária", chave: "origem", ativo: true, ordem: 0, capabilitiesJson: null },
    empresa: { razaoSocial: "Empresa sintética" }, estadoOntologico: { outcome: null as string | null, subStatusId: null as string | null },
    origemExterna: { id: "origem-rd", sourceDealId: "rd-deal", provider: "RD_STATION_CRM_V1" } as { id: string; sourceDealId: string; provider: string } | null,
    servicoContexto: null, campoValores: [], anexos: [], indicacaoOrigem: null, vinculosDestino: [],
  };
  const campo = { id: "campo", chave: "documento", nome: "Documento", tipo: "texto", ativo: true, escopo: "CARD", fonteEntidade: null,
    fonteAtributo: null, entidadeGlobal: null, editavel: true, somenteLeitura: false, opcoesJson: null, opcoes: [], acessos: [],
    etapaConfiguracoes: [{ etapaId: "destino", visivel: true, obrigatorio: false, obrigatorioEntrada: true, obrigatorioSaida: false,
      editavel: true, somenteLeitura: false, condicaoObrigatoriedadeJson: null as string | null, condicaoVisibilidadeJson: null as string | null }] };
  const base = {
    autoridade: null as null | { tipo: "ADMIN" | "ADMIN_PIPELINE"; setor: null },
    podeEditar: true,
    card, campos: [campo], valores: [] as Array<{ campoId: string; valor: string }>,
    canonicos: {} as Record<string, string | null>,
    requisitos: [] as Array<{ id: string; chave: string; campoId: string | null; campo: typeof campo | null; alvoTipo: string; alvoChave: string | null;
      fase: string; etapaId: string | null; transicaoId: string | null; condicaoJson: string | null; mensagem: string; checklistTemplateId: string | null }>,
    destino: { id: "destino", pipelineId: "pipeline", ativo: true, nome: "Etapa destino", chave: "destino", visibilidades: [] },
    transicao: null as null | { id: string; permitida: boolean; origem: string; limparSubStatus: boolean; lifecycleDestino: string | null; outcomeDestino: string | null },
    eventos: [] as Array<{ id: string; cardId: string; tipo: string; atorTipo: string; atorUserId: number; valorAnteriorJson: string; valorNovoJson: string; idempotencyKey: string; causationId: string }>,
    historicos: [] as Array<{ id: string; valorNovoJson: string }>,
    execucoes: [] as Array<Record<string, unknown>>,
    blocos: [] as Array<{ id: string; tipo: string; capability: string; configJson: string | null; secao: { formulario: { etapaId: string } } }>,
    checklist: { itensObrigatoriosPendentes: [] as Array<{ id: string; nome: string; templateNome: string; templateId: string }> },
    erroRegra: null as string | null, falhaOutbox: false, casFalha: false, acesso: true, anexoValido: true,
  };
  const state = structuredClone(base);
  let active = state;
  const tx = {
    bpmCard: { findUnique: vi.fn(async () => structuredClone(active.card)), updateMany: vi.fn(async ({ data }: { data: { etapaId: string } }) => {
      if (active.casFalha) return { count: 0 };
      active.card.etapaId = data.etapaId; active.card.versao++; return { count: 1 };
    }) },
    bpmEtapa: { findFirst: vi.fn(async ({ where }: { where: { id: string } }) => active.destino.ativo && where.id === active.destino.id ? active.destino : null), findMany: vi.fn(async () => [{ id: "origem" }, { id: "destino" }]) },
    bpmTransicaoEtapa: { findUnique: vi.fn(async () => active.transicao) },
    bpmTransicaoExecucao: { findUnique: vi.fn(async () => null), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { active.execucoes.push(data); return data; }) },
    bpmEventoDominio: { findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) => active.eventos.find(e => e.idempotencyKey === where.idempotencyKey) ?? null) },
    bpmRequisito: { findMany: vi.fn(async () => active.requisitos) },
    bpmCampo: { findMany: vi.fn(async () => active.campos) },
    bpmFormularioComponente: { findMany: vi.fn(async ({ select }: { select?: { campoId?: boolean } }) => select?.campoId ? active.campos.map(c => ({ campoId: c.id })) : active.blocos) },
    bpmCardCampoValor: { findMany: vi.fn(async () => active.valores), upsert: vi.fn(async ({ create }: { create: { campoId: string; valor: string } }) => { active.valores.push(create); return create; }) },
    bpmCardAnexo: { findMany: vi.fn(async () => active.anexoValido ? [{ id: "cmuijhi6i00000agmrwfktmht", campoId: "campo" }] : []) },
    bpmCardEstado: { upsert: vi.fn(async () => ({})) }, bpmSubStatus: { findFirst: vi.fn(async () => null) },
    bpmCardHistorico: { create: vi.fn(async ({ data }: { data: { valorNovoJson: string } }) => { const row = { id: "history", ...data }; active.historicos.push(row); return row; }) },
  };
  return { base, state, tx, active: () => active,
    transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
      active = structuredClone(state);
      try { const result = await fn(tx); Object.assign(state, active); return result; } finally { active = state; }
    }),
    publish: vi.fn(async (input: { cardId: string; tipo: string; atorTipo: string; atorUserId: number; valorAnterior: unknown; valorNovo: unknown; idempotencyKey: string; causationId: string }) => {
      if (active.falhaOutbox) throw Error("Falha outbox sintética");
      const row = { id: "event", ...input, valorAnteriorJson: JSON.stringify(input.valorAnterior), valorNovoJson: JSON.stringify(input.valorNovo) };
      active.eventos.push(row); return row;
    }),
  };
});

vi.mock("@/lib/prisma", () => ({ default: { $transaction: f.transaction } }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: vi.fn(async (_card, _user, _role, acao) => {
  if (!f.active().acesso || (acao === "editarCard" && !f.active().podeEditar)) throw Error("Sem acesso");
  return { isAdminGlobal: true, role: "ADMINISTRADOR", perfilGlobal: "ADMINISTRADOR", autoridadeMovimentoLivre: f.active().autoridade };
}), usuarioElegivelResponsavelBpm: vi.fn(async () => true) }));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({ carregarValoresCanonicosCampos: vi.fn(async () => f.active().canonicos), salvarValoresGlobaisPersonalizadosCampos: vi.fn(async () => new Set()) }));
vi.mock("@/lib/bpm/campos-formulario-publicado", () => ({ camposPublicadosPorEtapa: vi.fn(async () => new Map([["destino", new Set(f.active().campos.map(c => c.id))], ["origem", new Set(f.active().campos.map(c => c.id))]])), capacidadesObrigatoriasPorEtapa: vi.fn(async () => new Map()), capacidadeObrigatoriaEntrada: vi.fn(async () => false) }));
vi.mock("@/lib/bpm/regras/contexto", () => ({ montarContextoAvaliacaoDoCard: vi.fn(async () => ({ card: {}, camposDinamicos: {} })) }));
vi.mock("@/lib/bpm/regras/guarda-movimento", () => ({ obterErroRegrasParaMovimento: vi.fn(async () => f.active().erroRegra) }));
vi.mock("@/lib/bpm/checklists/integracao", () => ({ obterErroChecklistParaMovimento: vi.fn(async () => null), carregarResumoChecklistAplicavelCard: vi.fn(async () => f.active().checklist) }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: f.publish }));
vi.mock("@/lib/bpm/automacoes/fila", () => ({ enfileirarAutomacoesMovimentoBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/sla", () => ({ sincronizarSlaMovimentoBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/cadencias/executor", () => ({ processarCadenciasImediatasDoCardBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/financeiro-assinatura-server", () => ({ registrarConclusaoContratoFinanceiro: vi.fn() }));
vi.mock("@/lib/bpm/financeiro-nota-fiscal-server", () => ({ sincronizarNotaFiscalCard: vi.fn() }));
vi.mock("@/lib/bpm/proximo-contato-agenda", () => ({ sincronizarProximoContatoAgenda: vi.fn() }));
vi.mock("@/lib/bpm/validacao-salvamento-configurado", () => ({ prepararSalvamentoConfigurado: vi.fn() }));

import { avaliarTransicaoBpm, executarTransicaoBpm, type ComandoTransicaoBpm } from "@/lib/bpm/transicao-command";
import { possuiOrigemImportadaRd } from "@/lib/bpm/movimento-importado-rd";
const input = (): ComandoTransicaoBpm => ({ cardId: "card", etapaOrigemEsperadaId: "origem", etapaDestinoId: "destino", versaoEsperada: 3,
  idempotencyKey: "solicitacao-unica", ator: { tipo: "MANUAL", userId: 7, userRole: "ADMINISTRADOR" } });
const confirmation = async () => {
  const result = await avaliarTransicaoBpm(input());
  expect(result).toMatchObject({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED" });
  if (result.success || !result.confirmacao) throw Error("Prévia sem confirmação");
  return result.confirmacao;
};
beforeEach(() => { vi.clearAllMocks(); Object.assign(f.state, structuredClone(f.base)); });

describe("comando transacional de movimento manual RD", () => {
  it("primeira tentativa e cancelamento não persistem etapa, formulário, histórico ou efeitos", async () => {
    const before = structuredClone(f.state);
    const result = await executarTransicaoBpm(input());
    expect(result).toMatchObject({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED", pendencias: ["Documento"], avisos: [{ campoId: "campo", kind: "MISSING_DATA" }] });
    expect(f.state).toEqual(before);
    expect(f.tx.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(f.tx.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(f.publish).not.toHaveBeenCalled();
  });
  it("confirma uma vez sem aresta, preserva lacuna e usa outbox para retry autorizado sem duplicar", async () => {
    const token = await confirmation();
    const command = { ...input(), confirmacaoPendenciasRd: token };
    const result = await executarTransicaoBpm(command);
    expect(result).toMatchObject({ success: true, data: { transicaoId: null, versao: 4, idempotente: false } });
    expect(f.state.valores).toEqual([]);
    expect(f.state.card.etapaId).toBe("destino");
    expect(f.state.execucoes).toEqual([]);
    expect(f.state.historicos).toHaveLength(1);
    expect(JSON.parse(f.state.historicos[0].valorNovoJson)).toMatchObject({ confirmacaoPendenciasRd: token, pendenciasConfirmadas: [{ nome: "Documento" }] });
    expect(await executarTransicaoBpm(command)).toMatchObject({ success: true, data: { idempotente: true, transicaoId: null } });
    expect(f.state.historicos).toHaveLength(1); expect(f.state.eventos).toHaveLength(1);
    expect(f.tx.bpmCard.updateMany).toHaveBeenCalledTimes(1);
    expect(await executarTransicaoBpm({ ...command, ator: { ...command.ator, userId: 8 } })).toMatchObject({ success: false, code: "IDEMPOTENCY_CONFLICT" });
  });
  it("sem pendências move normalmente sem token", async () => {
    f.state.valores = [{ campoId: "campo", valor: "Dado real" }];
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: true });
    expect(JSON.parse(f.state.historicos[0].valorNovoJson)).not.toHaveProperty("confirmacaoPendenciasRd");
  });
  it("confirmação não contorna transição negada ou exclusiva de automação", async () => {
    const token = await confirmation();
    f.state.transicao = { id: "edge", permitida: false, origem: "AMBOS", limparSubStatus: true, lifecycleDestino: null, outcomeDestino: null };
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "TRANSITION_DISABLED" });
    f.state.transicao.permitida = true; f.state.transicao.origem = "AUTOMACAO";
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "REQUESTER_NOT_ALLOWED" });
    expect(f.state.card.etapaId).toBe("origem");
  });
  it("nativo e automação não recebem exceção manual mesmo com token RD", async () => {
    const token = await confirmation();
    f.state.card.origemExterna = null;
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "TRANSITION_NOT_DEFINED" });
    f.state.card.origemExterna = { id: "origem-rd", sourceDealId: "rd-deal", provider: "RD_STATION_CRM_V1" };
    expect(await executarTransicaoBpm({ ...input(), ator: { tipo: "AUTOMACAO" }, confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "TRANSITION_NOT_DEFINED" });
    expect(possuiOrigemImportadaRd({ provider: "RD_STATION_CRM_V2" })).toBe(false);
  });
  it("não reaproveita confirmação para ator, valores ou configuração alterados", async () => {
    const token = await confirmation();
    expect(await executarTransicaoBpm({ ...input(), ator: { tipo: "MANUAL", userId: 8 }, confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED" });
    f.state.campos[0].nome = "Documento atualizado";
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED", pendencias: ["Documento atualizado"] });
    f.state.campos[0].nome = "Documento"; f.state.card.pipeline.configVersion++;
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED" });
    expect(f.state.historicos).toHaveLength(0);
  });
  it("vincula confirmação à identidade da proveniência RD e estabiliza a ordem dos campos", async () => {
    const outro = structuredClone(f.state.campos[0]);
    outro.id = "campo-extra"; outro.nome = "Complemento"; outro.etapaConfiguracoes[0].obrigatorioEntrada = false;
    f.state.campos.push(outro);
    const token = await confirmation();
    f.state.campos.reverse();
    expect(await confirmation()).toEqual(token);
    f.state.card.origemExterna!.sourceDealId = "rd-deal-reassociado";
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED" });
    expect(f.state.historicos).toHaveLength(0);
  });
  it("confirmação obsoleta não move quando configuração ou dado canônico eliminou todas as faltas", async () => {
    const token = await confirmation();
    f.state.campos[0].etapaConfiguracoes[0].obrigatorioEntrada = false;
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "STALE_CONFIRMATION" });
    expect(f.tx.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(f.state.historicos).toHaveLength(0);
    Object.assign(f.state, structuredClone(f.base));
    f.state.campos[0].escopo = "GLOBAL";
    const canonicoToken = await confirmation();
    f.state.canonicos = { campo: "Dado preenchido depois da prévia" };
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: canonicoToken })).toMatchObject({ success: false, code: "STALE_CONFIRMATION" });
    expect(f.tx.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(f.state.card.etapaId).toBe("origem");
    expect(f.state.historicos).toHaveLength(0);
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: true });
  });
  it("mantém CAS e autorização, inclusive durante retry", async () => {
    const token = await confirmation();
    f.state.card.versao++;
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "STALE_VERSION" });
    f.state.card.versao = 3; f.state.casFalha = true;
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "CONCURRENT_TRANSITION" });
    expect(f.state.historicos).toHaveLength(0);
    f.state.casFalha = false;
    expect(await executarTransicaoBpm({ ...input(), ator: { tipo: "MANUAL" }, confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "UNAUTHORIZED" });
    f.state.acesso = false;
    expect((await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).success).toBe(false);
  });
  it("não dispensa configuração JSON inválida, valores presentes inválidos ou regra impeditiva", async () => {
    f.state.campos[0].etapaConfiguracoes[0].condicaoVisibilidadeJson = "{";
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "INVALID_FIELD_CONFIG" });
    f.state.campos[0].etapaConfiguracoes[0].condicaoVisibilidadeJson = null;
    f.state.campos[0].tipo = "cnpj"; f.state.valores = [{ campoId: "campo", valor: "inválido" }];
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "FORMAT_INVALID" });
    f.state.valores = []; f.state.erroRegra = "Regra explícita bloqueia";
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "BUSINESS_RULE_BLOCKED" });
  });
  it("valor legado inválido e anexo de outra etapa não exigida só compõem o contexto", async () => {
    const antigo = structuredClone(f.state.campos[0]);
    antigo.id = "campo-antigo"; antigo.nome = "Documento da etapa anterior"; antigo.tipo = "url_ou_arquivo";
    antigo.etapaConfiguracoes[0].etapaId = "etapa-antiga";
    f.state.campos.push(antigo);
    f.state.valores = [{ campoId: "campo", valor: "Dado atual válido" }, { campoId: "campo-antigo", valor: "arquivo-legado-inválido" }];
    f.state.anexoValido = false;
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: true });
    expect(f.tx.bpmCardAnexo.findMany).not.toHaveBeenCalled();
    Object.assign(f.state, structuredClone(f.base));
    f.state.campos[0].tipo = "cnpj"; f.state.valores = [{ campoId: "campo", valor: "CNPJ inválido no requisito vigente" }];
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "FORMAT_INVALID" });
  });
  it("não permite anexo de outro card, destino inativo ou de pipeline diferente", async () => {
    f.state.campos[0].tipo = "url_ou_arquivo"; f.state.valores = [{ campoId: "campo", valor: "cmuijhi6i00000agmrwfktmht" }]; f.state.anexoValido = false;
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "INVALID_ATTACHMENT_REFERENCE" });
    f.state.destino.ativo = false;
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "INVALID_DESTINATION" });
    expect(await executarTransicaoBpm({ ...input(), etapaDestinoId: "outro-funil" })).toMatchObject({ success: false, code: "INVALID_DESTINATION" });
  });
  it("falha de efeito dentro da transação desfaz movimento e dados submetidos", async () => {
    f.state.falhaOutbox = true;
    const result = await executarTransicaoBpm({ ...input(), camposValores: { campo: "Valor legítimo" } });
    expect(result.success).toBe(false);
    expect(f.state.card.etapaId).toBe("origem"); expect(f.state.valores).toEqual([]); expect(f.state.historicos).toEqual([]);
  });
  it("capacidade publicada e checklist configurado informam pendências reais", async () => {
    f.state.campos = [];
    f.state.blocos = [{ id: "check", tipo: "CHECKLIST", capability: "STAGE_CHECKLIST", configJson: null, secao: { formulario: { etapaId: "origem" } } },
      { id: "meeting", tipo: "CAPABILITY", capability: "MEETING_SCHEDULER", configJson: null, secao: { formulario: { etapaId: "origem" } } }];
    f.state.checklist.itensObrigatoriosPendentes = [{ id: "doc", nome: "Documento societário", templateId: "template", templateNome: "Documentação" }];
    const result = await executarTransicaoBpm(input());
    expect(result).toMatchObject({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED", pendencias: ["Documentação: Documento societário", "Data da reunião"] });
    f.state.blocos[0].configJson = "{";
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "INVALID_FIELD_CONFIG" });
  });
  it("fontes canônicas e requisitos de entrada/saída são avaliados sem dados fictícios", async () => {
    f.state.campos[0].escopo = "GLOBAL";
    f.state.canonicos = { campo: "Valor canônico" };
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: true });
    expect(f.state.valores).toEqual([]);
  });
  it("requisito REGRA com falta real permite confirmar; valor preenchido contraditório continua bloqueado", async () => {
    const campoId = "cmuijhi6i00000agmrwfktmht";
    f.state.campos[0].id = campoId;
    f.state.requisitos = [{ id: "rule", chave: "confirmacao", campoId: null, campo: null, alvoTipo: "REGRA", alvoChave: null,
      fase: "EXIT_STAGE", etapaId: "origem", transicaoId: null, mensagem: "Confirmação contratual pendente", checklistTemplateId: null,
      condicaoJson: JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: campoId }, operador: "diferente", valor: "Sim" }] }) }];
    const token = await confirmation();
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: true });
    Object.assign(f.state, structuredClone(f.base));
    f.state.campos[0].id = campoId;
    f.state.requisitos = [{ id: "rule", chave: "confirmacao", campoId: null, campo: null, alvoTipo: "REGRA", alvoChave: null,
      fase: "EXIT_STAGE", etapaId: "origem", transicaoId: null, mensagem: "Confirmação contratual pendente", checklistTemplateId: null,
      condicaoJson: JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: campoId }, operador: "diferente", valor: "Sim" }] }) }];
    f.state.valores = [{ campoId, valor: "Não" }];
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: false, code: "BUSINESS_RULE_BLOCKED" });
  });
  it("requisito de campo identifica fase e fonte sem dispensar a validação de valores", async () => {
    f.state.campos[0].etapaConfiguracoes[0].obrigatorioEntrada = false;
    f.state.requisitos = [{ id: "req", chave: "documento", campoId: "campo", campo: f.state.campos[0], alvoTipo: "CAMPO", alvoChave: null,
      fase: "EXIT_STAGE", etapaId: "origem", transicaoId: null, condicaoJson: null, mensagem: "Documento necessário", checklistTemplateId: null }];
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED",
      avisos: [{ requisitoId: "req", campoId: "campo", fase: "EXIT_STAGE" }] });
  });
  it("nativo com aresta mantém REQUIREMENTS_PENDING e RD respeita efeitos configurados", async () => {
    f.state.transicao = { id: "edge", permitida: true, origem: "AMBOS", limparSubStatus: true, lifecycleDestino: "CONCLUIDO", outcomeDestino: "GANHO" };
    f.state.card.origemExterna = null;
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "REQUIREMENTS_PENDING" });
    f.state.card.origemExterna = { id: "origem-rd", sourceDealId: "rd-deal", provider: "RD_STATION_CRM_V1" };
    const token = await confirmation();
    expect(await executarTransicaoBpm({ ...input(), confirmacaoPendenciasRd: token })).toMatchObject({ success: true, data: { transicaoId: "edge", lifecycle: "CONCLUIDO", outcome: "GANHO" } });
    expect(f.state.execucoes).toHaveLength(1);
  });
  it("nomes legados não impõem atribuição ou restrição de destino em movimento manual RD", async () => {
    f.state.card.pipeline.nome = "Revisão de Radar"; f.state.card.etapa.nome = "Em tratativas";
    f.state.destino.nome = "Outra etapa configurada"; f.state.valores = [{ campoId: "campo", valor: "Presente" }];
    f.state.card.estadoOntologico.outcome = "PRESERVADO";
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: true, data: { outcome: "PRESERVADO" } });
    expect(f.state.execucoes).toEqual([]);
  });
});

describe("movimentação livre por administração do funil", () => {
  beforeEach(() => { f.state.autoridade = { tipo: "ADMIN_PIPELINE", setor: null }; });

  it.each([null, { id: "origem-rd", sourceDealId: "rd-deal", provider: "RD_STATION_CRM_V1" }])("move card nativo/RD sem preencher pendências nem confirmar: %j", async (origem) => {
    f.state.card.origemExterna = origem;
    f.state.transicao = { id: "bloqueada", permitida: false, origem: "AUTOMACAO", limparSubStatus: false, lifecycleDestino: "CONCLUIDO", outcomeDestino: "GANHO" };
    f.state.erroRegra = "Checklist obrigatório";
    const result = await executarTransicaoBpm(input());
    expect(result).toMatchObject({ success: true, data: { movimentoLivre: true, lifecycle: "ATIVO", outcome: null } });
    expect(f.state.card.etapaId).toBe("destino");
    expect(f.state.valores).toEqual([]);
    expect(JSON.parse(f.state.historicos[0].valorNovoJson)).toMatchObject({ movimentoLivre: { tipo: "ADMIN_PIPELINE", setor: null } });
    expect(JSON.parse(f.state.eventos[0].valorNovoJson)).toMatchObject({ automacoesSuprimidas: true });
    const { enfileirarAutomacoesMovimentoBpm } = await import("@/lib/bpm/automacoes/fila");
    const { ativarCadenciasNaEntradaBpm } = await import("@/lib/bpm/cadencias/ativacao-automatica");
    expect(enfileirarAutomacoesMovimentoBpm).not.toHaveBeenCalled();
    expect(ativarCadenciasNaEntradaBpm).not.toHaveBeenCalled();
    const retry = await executarTransicaoBpm(input());
    expect(retry).toMatchObject({ success: true, data: { idempotente: true } });
    expect(f.state.eventos).toHaveLength(1);
  });

  it("autoridade de movimento isolada não substitui o guard de edição do payload", async () => {
    f.state.podeEditar = false;
    const result = await executarTransicaoBpm({ ...input(), camposValores: { campo: "Texto forjado" } });
    expect(result.success).toBe(false);
    expect(f.state.card.etapaId).toBe("origem");
    expect(f.state.valores).toEqual([]);
  });

  it.each(["destino", "versao", "concorrencia", "auditoria"])("preserva integridade e rollback: %s", async (falha) => {
    if (falha === "destino") f.state.destino.ativo = false;
    if (falha === "versao") f.state.card.versao = 4;
    if (falha === "concorrencia") f.state.casFalha = true;
    if (falha === "auditoria") f.state.falhaOutbox = true;
    expect((await executarTransicaoBpm(input())).success).toBe(false);
    expect(f.state.card.etapaId).toBe("origem");
    expect(f.state.historicos).toHaveLength(0);
  });

  it("automação não herda a administração do ator nem aceita flag forjada", async () => {
    f.state.card.origemExterna = null;
    const result = await executarTransicaoBpm({ ...input(), ator: { tipo: "AUTOMACAO", userId: 7 }, movimentoLivre: true } as ComandoTransicaoBpm);
    expect(result).toMatchObject({ success: false, code: "TRANSITION_NOT_DEFINED" });
  });

  it("revogação da administração entre prévia e execução volta a exigir regras", async () => {
    f.state.card.origemExterna = null;
    expect((await avaliarTransicaoBpm(input())).success).toBe(true);
    f.state.autoridade = null;
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "TRANSITION_NOT_DEFINED" });
  });
});
