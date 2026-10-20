import { beforeEach, describe, expect, it, vi } from "vitest";

// Only persistence and unrelated domain effects are substituted. The transition
// command, event publisher, input schema and payload sanitizer execute normally.
const fixture = vi.hoisted(() => {
  const ids = {
    card: "rdcard_0123456789abcdef0123456789ab",
    pipeline: "cmuih4i54000209gmmyqrg557",
    origem: "cmuih4i54000309gmmyqrg557",
    destino: "cmuih4i54000409gmmyqrg557",
    campo: "cmuih4i54000509gmmyqrg557",
  };
  const base = {
    card: {
      id: ids.card, pipelineId: ids.pipeline, etapaId: ids.origem, versao: 3, status: "ATIVO", concluidoEm: null,
      responsavelId: 7, proximoContatoEm: null, dataReuniao: null, transcricaoReuniao: null, statusPosFechamento: null,
      pipeline: { id: ids.pipeline, nome: "Funil sintético", chave: "custom", configVersion: 2, ativo: true },
      etapa: { id: ids.origem, pipelineId: ids.pipeline, nome: "Origem", chave: "origem", ativo: true, ordem: 0, capabilitiesJson: null },
      empresa: { razaoSocial: "Empresa sintética" }, estadoOntologico: { outcome: null, subStatusId: null },
      origemExterna: { id: "rdorigin_0123456789abcdef0123456789ab", sourceDealId: "rd-deal-sintetico", provider: "RD_STATION_CRM_V1" },
      servicoContexto: null, campoValores: [], anexos: [], indicacaoOrigem: null, vinculosDestino: [],
    },
    destino: { id: ids.destino, pipelineId: ids.pipeline, ativo: true, nome: "Destino", chave: "destino", visibilidades: [] },
    campos: [{ id: ids.campo, chave: "documento", nome: "Documento", tipo: "texto", ativo: true, escopo: "CARD", fonteEntidade: null,
      fonteAtributo: null, entidadeGlobal: null, editavel: true, somenteLeitura: false, opcoesJson: null, opcoes: [], acessos: [],
      etapaConfiguracoes: [{ etapaId: ids.destino, visivel: true, obrigatorio: false, obrigatorioEntrada: true, obrigatorioSaida: false,
        editavel: true, somenteLeitura: false, condicaoObrigatoriedadeJson: null, condicaoVisibilidadeJson: null }] }],
    valores: [] as Array<{ cardId: string; campoId: string; valor: string }>,
    historicos: [] as Array<{ id: string; cardId: string; acao: string; valorNovoJson: string }>,
    eventos: [] as Array<{ id: string; cardId: string; pipelineId: string; tipo: string; entidadeTipo: string; entidadeId: string;
      atorTipo: string; atorUserId?: number; valorAnteriorJson: string | null; valorNovoJson: string | null;
      idempotencyKey: string; causationId?: string | null }>,
    falharPersistenciaEvento: false,
  };
  const state = structuredClone(base);
  let active = state;
  const tx = {
    bpmCard: { findUnique: vi.fn(async () => structuredClone(active.card)), updateMany: vi.fn(async ({ where, data }: {
      where: { etapaId: string; versao: number }; data: { etapaId: string };
    }) => {
      if (active.card.etapaId !== where.etapaId || active.card.versao !== where.versao) return { count: 0 };
      active.card.etapaId = data.etapaId; active.card.versao++; return { count: 1 };
    }) },
    bpmEtapa: { findFirst: vi.fn(async ({ where }: { where: { id: string; pipelineId: string } }) =>
      where.id === ids.destino && where.pipelineId === ids.pipeline ? active.destino : null) },
    bpmTransicaoEtapa: { findUnique: vi.fn(async () => null) },
    bpmTransicaoExecucao: { findUnique: vi.fn(async () => null), create: vi.fn() },
    bpmRequisito: { findMany: vi.fn(async () => []) },
    bpmCampo: { findMany: vi.fn(async () => active.campos) },
    bpmFormularioComponente: { findMany: vi.fn(async () => []) },
    bpmCardCampoValor: { findMany: vi.fn(async () => active.valores), upsert: vi.fn() },
    bpmCardEstado: { upsert: vi.fn(async () => ({})) },
    bpmCardHistorico: { create: vi.fn(async ({ data }: { data: Omit<typeof base.historicos[number], "id"> }) => {
      const row = { id: `cmuih4i54000609gmmyqrg55${active.historicos.length}`, ...data };
      active.historicos.push(row); return row;
    }) },
    bpmEventoDominio: {
      findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) => active.eventos.find(row => row.idempotencyKey === where.idempotencyKey) ?? null),
      create: vi.fn(async ({ data }: { data: Omit<typeof base.eventos[number], "id"> }) => {
        if (active.falharPersistenciaEvento) throw Error("Falha sintética ao persistir evento");
        if (active.eventos.some(row => row.idempotencyKey === data.idempotencyKey)) throw Object.assign(Error("Unique constraint"), { code: "P2002" });
        const row = { id: `cmuih4i54000709gmmyqrg55${active.eventos.length}`, ...data };
        active.eventos.push(row); return row;
      }),
    },
  };
  return { ids, base, state, tx,
    transaction: vi.fn(async (execute: (client: typeof tx) => Promise<unknown>) => {
      active = structuredClone(state);
      try { const result = await execute(tx); Object.assign(state, active); return result; }
      finally { active = state; }
    }),
  };
});

vi.mock("@/lib/prisma", () => ({ default: { $transaction: fixture.transaction } }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: vi.fn(async () => ({ isAdminGlobal: true, role: "ADMINISTRADOR", perfilGlobal: "ADMINISTRADOR" })), usuarioElegivelResponsavelBpm: vi.fn() }));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({ carregarValoresCanonicosCampos: vi.fn(async () => ({})), salvarValoresGlobaisPersonalizadosCampos: vi.fn(async () => new Set()) }));
vi.mock("@/lib/bpm/campos-formulario-publicado", () => ({ camposPublicadosPorEtapa: vi.fn(async () => new Map([[fixture.ids.destino, new Set([fixture.ids.campo])]])), capacidadesObrigatoriasPorEtapa: vi.fn(async () => new Map()), capacidadeObrigatoriaEntrada: vi.fn(async () => false) }));
vi.mock("@/lib/bpm/regras/contexto", () => ({ montarContextoAvaliacaoDoCard: vi.fn(async () => ({ card: {}, camposDinamicos: {} })) }));
vi.mock("@/lib/bpm/regras/guarda-movimento", () => ({ obterErroRegrasParaMovimento: vi.fn(async () => null) }));
vi.mock("@/lib/bpm/checklists/integracao", () => ({ obterErroChecklistParaMovimento: vi.fn(async () => null), carregarResumoChecklistAplicavelCard: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/fila", () => ({ enfileirarAutomacoesMovimentoBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/sla", () => ({ sincronizarSlaMovimentoBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/cadencias/executor", () => ({ processarCadenciasImediatasDoCardBpm: vi.fn(async () => ({})) }));
vi.mock("@/lib/bpm/financeiro-assinatura-server", () => ({ registrarConclusaoContratoFinanceiro: vi.fn() }));
vi.mock("@/lib/bpm/financeiro-nota-fiscal-server", () => ({ sincronizarNotaFiscalCard: vi.fn() }));
vi.mock("@/lib/bpm/proximo-contato-agenda", () => ({ sincronizarProximoContatoAgenda: vi.fn() }));
vi.mock("@/lib/bpm/validacao-salvamento-configurado", () => ({ prepararSalvamentoConfigurado: vi.fn() }));

import { avaliarTransicaoBpm, executarTransicaoBpm, type ComandoTransicaoBpm } from "@/lib/bpm/transicao-command";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { eventoDominioInputSchema } from "@/lib/bpm/automacoes/central-schemas";

const input = (): ComandoTransicaoBpm => ({
  cardId: fixture.ids.card, etapaOrigemEsperadaId: fixture.ids.origem, etapaDestinoId: fixture.ids.destino,
  versaoEsperada: 3, idempotencyKey: "movimento-rd-sintetico", ator: { tipo: "MANUAL", userId: 7, userRole: "ADMINISTRADOR" },
});
const eventClient = fixture.tx as unknown as Parameters<typeof publicarEventoBpm>[1];
const payload = (tipo = "CARD_MOVIDO", key = "evento-rd-sintetico") => ({
  tipo, entidadeTipo: "CARD", entidadeId: fixture.ids.card, cardId: fixture.ids.card, pipelineId: fixture.ids.pipeline,
  atorTipo: "USUARIO", atorUserId: 7, correlationId: "correlacao-sintetica", idempotencyKey: key,
  valorAnterior: { etapaId: fixture.ids.origem }, valorNovo: { etapaId: fixture.ids.destino },
});

beforeEach(() => { vi.clearAllMocks(); Object.assign(fixture.state, structuredClone(fixture.base)); });

describe("movimento RD integrado ao publicador e schema de eventos reais", () => {
  it("prévia, primeira tentativa e cancelamento deixam etapa, dados, histórico e outbox intactos", async () => {
    const initial = structuredClone(fixture.state);
    expect(await avaliarTransicaoBpm(input())).toMatchObject({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED", pendencias: ["Documento"] });
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "RD_MOVE_CONFIRMATION_REQUIRED" });
    // Closing the confirmation sends no second command; the initial state is retained.
    expect(fixture.state).toEqual(initial);
    expect(fixture.tx.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(fixture.tx.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(fixture.tx.bpmEventoDominio.create).not.toHaveBeenCalled();
  });

  it("confirma RD real, publica CARD_MOVIDO válido e repete sem segundo movimento ou efeito", async () => {
    const preview = await avaliarTransicaoBpm(input());
    if (preview.success || !preview.confirmacao) throw Error("Confirmação ausente");
    const command = { ...input(), confirmacaoPendenciasRd: preview.confirmacao };
    expect(await executarTransicaoBpm(command)).toMatchObject({ success: true, data: { cardId: fixture.ids.card, transicaoId: null, versao: 4, idempotente: false } });
    expect(fixture.state.card.etapaId).toBe(fixture.ids.destino);
    expect(fixture.state.valores).toEqual([]);
    expect(fixture.state.historicos).toHaveLength(1);
    expect(JSON.parse(fixture.state.historicos[0].valorNovoJson)).toMatchObject({ pendenciasConfirmadas: [{ nome: "Documento" }] });
    expect(fixture.state.eventos).toHaveLength(1);
    expect(fixture.state.eventos[0]).toMatchObject({ tipo: "CARD_MOVIDO", cardId: fixture.ids.card, atorUserId: 7, idempotencyKey: "transition:movimento-rd-sintetico" });
    expect(JSON.parse(fixture.state.eventos[0].valorNovoJson!)).toMatchObject({ etapaId: fixture.ids.destino, versao: 4, transicaoId: null });
    expect(await executarTransicaoBpm(command)).toMatchObject({ success: true, data: { idempotente: true } });
    expect(fixture.state.historicos).toHaveLength(1);
    expect(fixture.state.eventos).toHaveLength(1);
    expect(fixture.tx.bpmCard.updateMany).toHaveBeenCalledTimes(1);
    expect(fixture.tx.bpmEventoDominio.create).toHaveBeenCalledTimes(1);
    expect(fixture.tx.bpmTransicaoExecucao.create).not.toHaveBeenCalled();
  });

  it("falha real de persistência do outbox reverte movimento e histórico juntos", async () => {
    fixture.state.valores = [{ cardId: fixture.ids.card, campoId: fixture.ids.campo, valor: "Dado real" }];
    fixture.state.falharPersistenciaEvento = true;
    expect(await executarTransicaoBpm(input())).toMatchObject({ success: false, code: "TRANSITION_FAILED" });
    expect(fixture.tx.bpmEventoDominio.create).toHaveBeenCalledTimes(1);
    expect(fixture.state.card.etapaId).toBe(fixture.ids.origem);
    expect(fixture.state.card.versao).toBe(3);
    expect(fixture.state.historicos).toEqual([]);
    expect(fixture.state.eventos).toEqual([]);
  });

  it.each(["CARD_MOVIDO", "SLA_STATUS_ALTERADO", "CADENCIA_INICIADA"])("publicador real aceita identidade RD em %s e conserva unicidade", async tipo => {
    const event = payload(tipo);
    expect(eventoDominioInputSchema.safeParse(event).success).toBe(true);
    const first = await publicarEventoBpm(event, eventClient);
    expect(first).toMatchObject({ cardId: fixture.ids.card, tipo });
    expect(await publicarEventoBpm(event, eventClient)).toEqual(first);
    expect(fixture.state.eventos).toHaveLength(1);
  });

  it("schema mantém formatos de identidade restritos antes de chamar a persistência", async () => {
    for (const invalid of ["rdcard_naohexadecimal", `rdcard_${"a".repeat(27)}`, `rdcard_${"a".repeat(29)}`, "qualquer-card"] ) {
      expect(eventoDominioInputSchema.safeParse({ ...payload(), cardId: invalid }).success).toBe(false);
      await expect(publicarEventoBpm({ ...payload(), cardId: invalid }, eventClient)).rejects.toThrow();
    }
    expect(fixture.tx.bpmEventoDominio.create).not.toHaveBeenCalled();
    expect(fixture.state.eventos).toEqual([]);
  });

  it("publicador mantém suporte ao card nativo CUID", async () => {
    const event = { ...payload(), cardId: "cmuih4i54000809gmmyqrg557", entidadeId: "cmuih4i54000809gmmyqrg557" };
    expect(await publicarEventoBpm(event, eventClient)).toMatchObject({ cardId: event.cardId });
  });
});
