import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => {
  const card = {
    id: "card", empresaId: 51, pipelineId: "pipeline", etapaId: "origem", versao: 3, status: "ATIVO", concluidoEm: null,
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
    autoridade: null as null | { tipo: "ADMIN" | "LIDER_SETOR"; setor: string | null },
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

const ficha = vi.hoisted(() => ({ registrar: vi.fn(), resolverAtor: vi.fn(), processar: vi.fn() }));

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
vi.mock("@/lib/bpm/automacoes/orquestrador", () => ({ executarMinutaMovimentoLivreAgora: vi.fn(async () => ({})), executarFinanceiroMovimentoLivreAgora: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/automacoes/fila", () => ({ enfileirarAutomacoesMovimentoBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/sla", () => ({ sincronizarSlaMovimentoBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/cadencias/executor", () => ({ processarCadenciasImediatasDoCardBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/financeiro-assinatura-server", () => ({ registrarConclusaoContratoFinanceiro: vi.fn() }));
vi.mock("@/lib/bpm/financeiro-nota-fiscal-server", () => ({ sincronizarNotaFiscalCard: vi.fn() }));
vi.mock("@/lib/bpm/proximo-contato-agenda", () => ({ sincronizarProximoContatoAgenda: vi.fn() }));
vi.mock("@/lib/bpm/validacao-salvamento-configurado", () => ({ prepararSalvamentoConfigurado: vi.fn() }));
vi.mock("@/lib/bpm/ficha-viabilidade-automatica-server", () => ({
  registrarIntencaoFichaViabilidade: ficha.registrar,
  resolverAtorFichaViabilidade: ficha.resolverAtor,
  processarIntencaoFichaViabilidade: ficha.processar,
}));

import { avaliarTransicaoBpm, executarTransicaoBpm, type ComandoTransicaoBpm } from "@/lib/bpm/transicao-command";
const input = (): ComandoTransicaoBpm => ({ cardId: "card", etapaOrigemEsperadaId: "origem", etapaDestinoId: "destino", versaoEsperada: 3,
  idempotencyKey: "solicitacao-unica", ator: { tipo: "MANUAL", userId: 7, userRole: "ADMINISTRADOR" } });
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(f.state, structuredClone(f.base));
  ficha.resolverAtor.mockResolvedValue(7);
  ficha.registrar.mockImplementation(async (_tx, dados) => {
    f.active().historicos.push({ id: "intencao-ficha", valorNovoJson: JSON.stringify(dados) });
    return "intencao-ficha";
  });
  ficha.processar.mockImplementation(async () => {
    expect(f.state.card.etapaId).toBe("destino"); // O efeito só começa depois do commit.
    return { estado: "PRONTA", data: { anexoId: "ficha-pdf", empresaId: 51, empresaNome: "Empresa sintética", revision: 1, dados: {}, userLogado: "Admin" }, gerada: true, solicitacaoId: "intencao-ficha" };
  });
});

describe("movimentação livre administrativa e de liderança", () => {
  beforeEach(() => { f.state.autoridade = { tipo: "LIDER_SETOR", setor: "OPERACIONAL" }; });

  it("entrada Admin em Reunião Agendada registra intenção atômica e gera após commit sem ligar outras automações", async () => {
    f.state.card.pipeline.nome = "Revisão de Radar";
    f.state.card.pipeline.chave = "comercial";
    f.state.destino.nome = "Reunião Agendada";
    f.state.destino.chave = "reuniao_agendada";
    const result = await executarTransicaoBpm(input());
    expect(result).toMatchObject({ success: true, data: { movimentoLivre: true, fichaViabilidadeGerada: true, fichaViabilidade: { anexoId: "ficha-pdf" } } });
    expect(ficha.registrar).toHaveBeenCalledWith(f.tx, expect.objectContaining({ cardId: "card", empresaId: 51, actorUserId: 7, idempotencyKey: "solicitacao-unica" }));
    expect(ficha.processar).toHaveBeenCalledOnce();
    const fila = await import("@/lib/bpm/automacoes/fila");
    expect(fila.enfileirarAutomacoesMovimentoBpm).not.toHaveBeenCalled();
    expect((await executarTransicaoBpm(input()))).toMatchObject({ success: true, data: { idempotente: true } });
    expect(ficha.registrar).toHaveBeenCalledOnce();
    expect(ficha.processar).toHaveBeenCalledOnce();
  });

  it("falha ao persistir intenção desfaz entrada e não executa upload; outro destino não solicita ficha", async () => {
    f.state.card.pipeline.nome = "Revisão de Radar";
    f.state.card.pipeline.chave = "comercial";
    f.state.destino.nome = "Reunião Agendada";
    f.state.destino.chave = "reuniao_agendada";
    ficha.registrar.mockRejectedValueOnce(new Error("Intenção indisponível"));
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false });
    expect(f.state.card.etapaId).toBe("origem");
    expect(f.state.historicos).toEqual([]);
    expect(ficha.processar).not.toHaveBeenCalled();
    f.state.destino.nome = "Outro destino";
    f.state.destino.chave = "outra_etapa";
    ficha.registrar.mockClear();
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: true });
    expect(ficha.registrar).not.toHaveBeenCalled();
  });

  it.each([null, { id: "origem-rd", sourceDealId: "rd-deal", provider: "RD_STATION_CRM_V1" }])("move card nativo/RD sem preencher pendências nem confirmar: %j", async (origem) => {
    f.state.card.origemExterna = origem;
    f.state.transicao = { id: "bloqueada", permitida: false, origem: "AUTOMACAO", limparSubStatus: false, lifecycleDestino: "CONCLUIDO", outcomeDestino: "GANHO" };
    f.state.erroRegra = "Checklist obrigatório";
    const result = await executarTransicaoBpm(input());
    expect(result).toMatchObject({ success: true, data: { movimentoLivre: true, lifecycle: "ATIVO", outcome: null } });
    expect(f.state.card.etapaId).toBe("destino");
    expect(f.state.valores).toEqual([]);
    expect(JSON.parse(f.state.historicos[0].valorNovoJson)).toMatchObject({ movimentoLivre: { tipo: "LIDER_SETOR", setor: "OPERACIONAL" } });
    expect(JSON.parse(f.state.eventos[0].valorNovoJson)).toMatchObject({ automacoesSuprimidas: true, permitirMinutaConfigurada: true });
    const { executarMinutaMovimentoLivreAgora } = await import("@/lib/bpm/automacoes/orquestrador");
    expect(executarMinutaMovimentoLivreAgora).toHaveBeenCalledWith("card", "event");
    const { enfileirarAutomacoesMovimentoBpm } = await import("@/lib/bpm/automacoes/fila");
    const { ativarCadenciasNaEntradaBpm } = await import("@/lib/bpm/cadencias/ativacao-automatica");
    expect(enfileirarAutomacoesMovimentoBpm).not.toHaveBeenCalled();
    expect(ativarCadenciasNaEntradaBpm).not.toHaveBeenCalled();
    const retry = await executarTransicaoBpm(input());
    expect(retry).toMatchObject({ success: true, data: { idempotente: true } });
    expect(f.state.eventos).toHaveLength(1);
    expect(executarMinutaMovimentoLivreAgora).toHaveBeenCalledTimes(1);
  });

  it("liderança de movimento não autoriza edição por payload", async () => {
    f.state.podeEditar = false;
    const result = await executarTransicaoBpm({ ...input(), camposValores: { campo: "Texto forjado" } });
    expect(result.success).toBe(false);
    expect(f.state.card.etapaId).toBe("origem");
    expect(f.state.valores).toEqual([]);
  });

  it("falha documental pós-commit preserva o sucesso e a auditoria do movimento", async () => {
    const { executarMinutaMovimentoLivreAgora } = await import("@/lib/bpm/automacoes/orquestrador");
    vi.mocked(executarMinutaMovimentoLivreAgora).mockRejectedValueOnce(new Error("Gerador indisponível"));
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: true, data: { movimentoLivre: true } });
    expect(f.state.card.etapaId).toBe("destino");
    expect(f.state.eventos).toHaveLength(1);
    expect(f.state.historicos).toHaveLength(1);
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

  it("automação não herda a liderança nem aceita flag forjada", async () => {
    f.state.card.origemExterna = null;
    const result = await executarTransicaoBpm({ ...input(), ator: { tipo: "AUTOMACAO", userId: 7 }, movimentoLivre: true } as ComandoTransicaoBpm);
    expect(result).toMatchObject({ success: false, code: "TRANSITION_NOT_DEFINED" });
  });

  it("revogação de liderança entre prévia e execução volta a exigir regras", async () => {
    f.state.card.origemExterna = null;
    expect((await avaliarTransicaoBpm(input())).success).toBe(true);
    f.state.autoridade = null;
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "TRANSITION_NOT_DEFINED" });
  });
  it("ADMIN também move sem aresta e preserva lifecycle de card concluído", async () => {
    f.state.autoridade = { tipo: "ADMIN", setor: null };
    f.state.card.status = "CONCLUIDO";
    f.state.card.estadoOntologico.outcome = "GANHO";
    f.state.card.estadoOntologico.subStatusId = "substatus-da-origem";
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: true, data: {
      movimentoLivre: true, transicaoId: null, lifecycle: "CONCLUIDO", outcome: "GANHO",
    } });
    expect(f.tx.bpmCardEstado.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ subStatusId: null, outcome: "GANHO" }) }));
    expect(f.state.execucoes).toEqual([]);
  });

  it.each(["pipeline", "etapa", "vinculo"])("recusa origem inválida: %s", async (origem) => {
    if (origem === "pipeline") f.state.card.pipeline.ativo = false;
    if (origem === "etapa") f.state.card.etapa.ativo = false;
    if (origem === "vinculo") f.state.card.etapa.pipelineId = "outro";
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "INVALID_ORIGIN" });
    expect(f.state.historicos).toHaveLength(0);
  });

  it("retry não aceita outro ator ou permissão revogada", async () => {
    expect((await executarTransicaoBpm(input())).success).toBe(true);
    expect(await executarTransicaoBpm({ ...input(), ator: { ...input().ator, userId: 8 } })).toMatchObject({ success: false, code: "IDEMPOTENCY_CONFLICT" });
    f.state.acesso = false;
    expect((await executarTransicaoBpm(input())).success).toBe(false);
    expect(f.state.eventos).toHaveLength(1);
  });

  it("valida dados submetidos e vínculo de anexos mesmo em movimento livre", async () => {
    f.state.campos[0].tipo = "cnpj";
    expect(await executarTransicaoBpm({ ...input(), camposValores: { campo: "inválido" } })).toMatchObject({ success: false, code: "FORMAT_INVALID" });
    f.state.campos[0].tipo = "url_ou_arquivo";
    f.state.anexoValido = false;
    expect(await executarTransicaoBpm({ ...input(), camposValores: { campo: "cmuijhi6i00000agmrwfktmht" } })).toMatchObject({ success: false, code: "INVALID_ATTACHMENT_REFERENCE" });
    expect(f.state.valores).toEqual([]);
  });

  it("não confirma finanças ou dispara cadências com dados financeiros enviados", async () => {
    f.state.card.pipeline.chave = "financeiro";
    f.state.card.etapa.chave = "confirmacao_pagamento";
    expect(await executarTransicaoBpm({ ...input(), camposValores: { campo: "Dado válido" } })).toMatchObject({ success: true });
    const { registrarConclusaoContratoFinanceiro } = await import("@/lib/bpm/financeiro-assinatura-server");
    const { sincronizarNotaFiscalCard } = await import("@/lib/bpm/financeiro-nota-fiscal-server");
    const { processarCadenciasImediatasDoCardBpm } = await import("@/lib/bpm/cadencias/executor");
    expect(registrarConclusaoContratoFinanceiro).not.toHaveBeenCalled();
    expect(sincronizarNotaFiscalCard).not.toHaveBeenCalled();
    expect(processarCadenciasImediatasDoCardBpm).not.toHaveBeenCalled();
  });

});


it("marca no evento e histórico somente fechamento comercial livre e chama flush restrito", async () => {
  f.state.autoridade = { tipo: "ADMIN", setor: null };
  f.state.card.pipeline.nome = "Revisão de Radar";
  f.state.destino.nome = "Contrato fechado"; f.state.destino.chave = "fechado";
  expect(await executarTransicaoBpm(input())).toMatchObject({ success: true });
  expect(JSON.parse(f.state.eventos[0].valorNovoJson)).toMatchObject({ permitirEncaminhamentoFinanceiroConfigurado: true, automacoesSuprimidas: true });
  expect(JSON.parse(f.state.historicos[0].valorNovoJson)).toMatchObject({ permitirEncaminhamentoFinanceiroConfigurado: true });
  const { executarFinanceiroMovimentoLivreAgora } = await import("@/lib/bpm/automacoes/orquestrador");
  expect(executarFinanceiroMovimentoLivreAgora).toHaveBeenCalledWith("card", "event");
});
