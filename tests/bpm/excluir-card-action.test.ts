import { mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
 auth: vi.fn(), notify: vi.fn(), revalidate: vi.fn(),
 db: {
  usuarios: { findUnique: vi.fn() }, setorPermissao: { findMany: vi.fn() }, usuarioPermissaoOverride: { findMany: vi.fn() },
  bpmCardMembro: { findUnique: vi.fn() }, bpmCard: { findUnique: vi.fn(), update: vi.fn() },
  bpmCardHistorico: { create: vi.fn() }, $transaction: vi.fn(),
 }
}));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/validations/bpm", () => ({ criarCardSchema: vi.fn(), atualizarCardSchema: vi.fn(), moverCardSchema: vi.fn(), salvarRequisitosEMoverCardSchema: vi.fn(), excluirCardSchema: { safeParse: (v: { cardId: string }) => ({ success: typeof v.cardId === "string" && v.cardId.trim().length > 0, data: v }) } }));
vi.mock("@/lib/format-cnpj", () => ({ formatCNPJ: vi.fn(), normalizarCNPJ: vi.fn() }));
vi.mock("@/lib/bpm/automacoes", () => ({ executarAutomacaoFechamentoComercial: vi.fn(), executarAutomacaoTarefaNotaFiscal: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/fila", () => ({ enfileirarAutomacoesCriacaoCardBpm: vi.fn(), enfileirarAutomacoesMovimentoBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/orquestrador", () => ({ executarAutomacoesCentraisDoCardAgora: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/migracao-hardcoded", () => ({ automacaoMigradaEstaAtiva: vi.fn(), NOMES_AUTOMACOES_MIGRADAS: vi.fn() }));
vi.mock("@/lib/bpm/campos-configuraveis-server", () => ({ salvarValoresGlobaisPersonalizadosCampos: vi.fn() }));
vi.mock("@/lib/bpm/card-kanban", () => ({ desserializarComposicaoCardKanban: vi.fn() }));
vi.mock("@/actions/Clientes", () => ({ buscarServicosContratados: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notify }));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarCamposAplicaveisCardEtapa: vi.fn(), carregarCamposAplicaveisEtapa: vi.fn(), carregarSnapshotsCopiaCamposCard: vi.fn(), verificarTransicaoPermitidaBpm: vi.fn() }));
vi.mock("@/lib/bpm/agendar-reuniao", () => ({ obterErroDataReuniaoParaMovimento: vi.fn() }));
vi.mock("@/lib/bpm/reuniao-agendada", () => ({ obterErroTranscricaoParaMovimento: vi.fn() }));
vi.mock("@/lib/bpm/proximo-contato", () => ({ obterErroProximoContatoParaMovimento: vi.fn(), pipelineEhRevisaoRadar: vi.fn() }));
vi.mock("@/lib/bpm/noloss-leads", () => ({ buscarNolossLeadsPendentes: vi.fn() }));
vi.mock("@/lib/validations/cs-nps", () => ({ paraExibicaoTelefone: vi.fn() }));
vi.mock("@/lib/callix/click-to-call", () => ({ iniciarLigacaoCallix: vi.fn(), normalizarTelefoneCallix: vi.fn() }));
vi.mock("@/lib/bpm/em-tratativa", () => ({ etapaEhEmTratativa: vi.fn(), obterErroChecklistParaSaidaEmTratativa: vi.fn(), obterErroProximoContatoParaEntrada: vi.fn() }));
vi.mock("@/lib/bpm/campos-dinamicos", () => ({ validarValoresCamposBpm: vi.fn() }));
vi.mock("@/lib/bpm/status-pos-fechamento", () => ({ configuracaoEntradaFechadoEhValida: vi.fn(), CONFIGURACAO_FECHADO_INVALIDA_MENSAGEM: vi.fn(), etapaEhFechado: vi.fn(), STATUS_POS_FECHAMENTO_INICIAL: vi.fn() }));
vi.mock("@/lib/bpm/lost", () => ({ CONFIGURACAO_LOST_INVALIDA_MENSAGEM: vi.fn(), campoEhMotivoLost: vi.fn(), campoEhMotivoLostOutro: vi.fn(), etapaEhLost: vi.fn(), resolverConfiguracaoLost: vi.fn(), validarMotivoLost: vi.fn() }));
vi.mock("@/lib/bpm/monitoramento", () => ({ obterErroTransicaoMonitoramento: vi.fn() }));
vi.mock("@/lib/bpm/regras/guarda-movimento", () => ({ obterErroRegrasParaMovimento: vi.fn() }));
vi.mock("@/lib/bpm/alinhamento-estrategico", () => ({ etapaEhAlinhamentoEstrategico: vi.fn(), obterErroCamposAlinhamentoParaSaida: vi.fn() }));
vi.mock("@/lib/bpm/pipeline-financeiro", () => ({ campoFinanceiroSomenteLeitura: vi.fn(), etapaFinanceiraValida: vi.fn(), validateFinancialTransition: vi.fn() }));
vi.mock("@/lib/bpm/transicao-command", () => ({ executarTransicaoBpm: vi.fn() }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn() }));
vi.mock("@/lib/bpm/checklists/integracao", () => ({ obterErroChecklistParaMovimento: vi.fn() }));
vi.mock("@/lib/bpm/email-reuniao", () => ({ selecionarEmailClienteReuniao: vi.fn() }));
vi.mock("@/lib/bpm/ontology", () => ({ BPM_CAPABILITIES: vi.fn(), BPM_STAGE_KEYS: vi.fn() }));
vi.mock("@/lib/bpm/formulario-renderer", () => ({ formularioPossuiTarget: vi.fn(), resolverFormularioEtapa: vi.fn() }));
vi.mock("@/lib/bpm/sla", () => ({ criarSlaInstancia: vi.fn(), obterStatusSlaCards: vi.fn(), prioridadeStatusSla: vi.fn(), sincronizarSlaMovimentoBpm: vi.fn() }));

import { ExcluirCardBpm } from "@/actions/bpm/Cards";
describe("arquivamento: action e guard reais", () => {
 beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "1", role: "COMERCIAL" } });
  mocks.db.usuarios.findUnique.mockResolvedValue({ id: 1, role: "COMERCIAL", status: "ATIVO", permissoes: "crm" });
  mocks.db.setorPermissao.findMany.mockResolvedValue([]);
  mocks.db.usuarioPermissaoOverride.findMany.mockResolvedValue([]);
  mocks.db.bpmCardMembro.findUnique.mockResolvedValue({ role: "RESPONSAVEL" });
  mocks.db.bpmCard.findUnique.mockResolvedValue({ status: "ATIVO", pipelineId: "pipeline", etapa: { nome: "Em tratativa", visibilidades: [] } });
  mocks.db.$transaction.mockImplementation((fn: (tx: typeof mocks.db) => Promise<unknown>) => fn(mocks.db));
 });
 it("exige sessão antes de consultar o banco", async () => {
  mocks.auth.mockResolvedValue(null);
  expect(await ExcluirCardBpm("card")).toMatchObject({ success: false, error: "NÃO_AUTORIZADO" });
  expect(mocks.db.usuarios.findUnique).not.toHaveBeenCalled();
 });
 it("rejeita identificador inválido", async () => {
  expect(await ExcluirCardBpm("  ")).toMatchObject({ success: false, error: "Card inválido" });
  expect(mocks.db.$transaction).not.toHaveBeenCalled();
 });
 it.each(["PARTICIPANTE", "sem vínculo", "revogado", "oculta"])("nega %s sem escrita", async (caso) => {
  if (caso === "PARTICIPANTE") mocks.db.bpmCardMembro.findUnique.mockResolvedValue({ role: caso });
  if (caso === "sem vínculo") mocks.db.bpmCardMembro.findUnique.mockResolvedValue(null);
  if (caso === "revogado") mocks.db.usuarioPermissaoOverride.findMany.mockResolvedValue([{ modulo: "crm", acao: "REMOVE" }]);
  if (caso === "oculta") mocks.db.bpmCard.findUnique.mockResolvedValue({ etapa: { nome: "Etapa", visibilidades: [{ perfil: "COMERCIAL", podeVer: false, podeAgir: false }] } });
  expect(await ExcluirCardBpm("card")).toMatchObject({ success: false });
  expect(mocks.db.bpmCard.update).not.toHaveBeenCalled();
 });
 it.each(["RESPONSAVEL", "ADMINISTRADOR"])("arquiva com auditoria para %s", async (role) => {
  mocks.db.bpmCardMembro.findUnique.mockResolvedValue({ role });
  expect(await ExcluirCardBpm("card")).toEqual({ success: true });
  expect(mocks.db.bpmCard.update).toHaveBeenCalledWith({ where: { id: "card" }, data: { status: "ARQUIVADO" } });
  expect(mocks.db.bpmCardHistorico.create).toHaveBeenCalledWith({ data: { cardId: "card", acao: "CARD_ARQUIVADO", usuarioId: 1, valorAnteriorJson: '{"status":"ATIVO"}', valorNovoJson: '{"status":"ARQUIVADO"}' } });
  expect(mocks.notify).toHaveBeenCalledWith({ pipelineId: "pipeline", cardId: "card", tipo: "CARD_EXCLUIDO" });
 });
 it("revalida vínculo dentro da transação", async () => {
  mocks.db.bpmCardMembro.findUnique.mockResolvedValueOnce({ role: "RESPONSAVEL" }).mockResolvedValue(null);
  expect(await ExcluirCardBpm("card")).toMatchObject({ success: false });
  expect(mocks.db.bpmCard.update).not.toHaveBeenCalled();
 });
 it("não duplica histórico ao repetir arquivamento", async () => {
  mocks.db.bpmCard.findUnique.mockResolvedValue({ status: "ARQUIVADO", pipelineId: "pipeline", etapa: { nome: "Em tratativa", visibilidades: [] } });
  expect(await ExcluirCardBpm("card")).toEqual({ success: true });
  expect(mocks.db.bpmCardHistorico.create).not.toHaveBeenCalled();
 });
 it("não anuncia sucesso quando a auditoria falha", async () => {
  mocks.db.bpmCardHistorico.create.mockRejectedValue(new Error("audit failure"));
  expect(await ExcluirCardBpm("card")).toMatchObject({ success: false, error: "FALHA_TECNICA" });
  expect(mocks.notify).not.toHaveBeenCalled();
 });
 it("diferencia uma restrição de dependência sem expor detalhes internos", async () => {
  mocks.db.bpmCard.update.mockRejectedValue(Object.assign(new Error("foreign key details"), { code: "P2003" }));
  const result = await ExcluirCardBpm("card");
  expect(result).toMatchObject({ success: false, error: "DEPENDENCIA_EXISTENTE" });
  expect(result.mensagem).not.toContain("foreign key details");
  expect(mocks.notify).not.toHaveBeenCalled();
 });
 // ── Resiliência: Pusher ──────────────────────────────────────────────────────
 it("persiste exclusão mesmo quando notificarPipelineBpm falha (falha de transporte)", async () => {
  mocks.notify.mockRejectedValue(new Error("network timeout"));
  expect(await ExcluirCardBpm("card")).toEqual({ success: true });
  expect(mocks.db.bpmCard.update).toHaveBeenCalledWith({ where: { id: "card" }, data: { status: "ARQUIVADO" } });
  expect(mocks.db.bpmCardHistorico.create).toHaveBeenCalledTimes(1);
 });
 it("persiste exclusão quando Pusher está indisponível (sem configuração)", async () => {
  mocks.notify.mockRejectedValue(new Error("Pusher not configured"));
  expect(await ExcluirCardBpm("card")).toEqual({ success: true });
  expect(mocks.db.bpmCard.update).toHaveBeenCalledWith({ where: { id: "card" }, data: { status: "ARQUIVADO" } });
  expect(mocks.revalidate).toHaveBeenCalled();
 });
 // ── Resiliência: concorrência ────────────────────────────────────────────────
 it("exclusão concorrente: segunda chamada é idempotente sem duplicar histórico", async () => {
  // Primeira chamada: card ATIVO → arquivado
  expect(await ExcluirCardBpm("card")).toEqual({ success: true });
  expect(mocks.db.bpmCard.update).toHaveBeenCalledTimes(1);
  expect(mocks.db.bpmCardHistorico.create).toHaveBeenCalledTimes(1);
  // Simula que a primeira chamada já commitou: card agora ARQUIVADO
  mocks.db.bpmCard.findUnique.mockResolvedValue({ status: "ARQUIVADO", pipelineId: "pipeline", etapa: { nome: "Em tratativa", visibilidades: [] } });
  // Segunda chamada: card já ARQUIVADO → idempotente
  expect(await ExcluirCardBpm("card")).toEqual({ success: true });
  // update NÃO é chamado novamente (early return na transação)
  expect(mocks.db.bpmCard.update).toHaveBeenCalledTimes(1);
  // histórico NÃO é duplicado
  expect(mocks.db.bpmCardHistorico.create).toHaveBeenCalledTimes(1);
 });
});

// Fixture relacional reduzida: reproduz as quatro FKs Restrict do schema,
// sem carregar credenciais ou conectar ao banco do aplicativo.
describe("arquivamento com SQLite descartável", () => {
 it.each([false, true])("preserva dependências e rollback (falha de auditoria: %s)", async (falharAuditoria) => {
  const fixtureDir = mkdtempSync(resolve(".cache/rm-1ffbaa-sqlite-"));
  const sqlite = createClient({ url: `file:${fixtureDir}/fixture.db` });
  const dependencias = ["BpmEventoDominio", "BpmAutomacaoAgenda", "BpmTransicaoExecucao", "BpmChecklistTemplate"];
  try {
   await sqlite.execute("PRAGMA foreign_keys = ON");
   await sqlite.execute("CREATE TABLE BpmCard (id TEXT PRIMARY KEY, status TEXT NOT NULL, dataReuniao TEXT, googleMeetLink TEXT, proximoContatoEm TEXT)");
   await sqlite.execute("INSERT INTO BpmCard VALUES ('card', 'ATIVO', '2026-09-24T15:00:00Z', 'https://meet.google.com/abc-defg-hij', '2026-09-25T15:00:00Z')");
   await sqlite.execute("CREATE TABLE BpmCardReuniao (cardId TEXT PRIMARY KEY REFERENCES BpmCard(id), agendadaEm TEXT, googleMeetLink TEXT)");
   await sqlite.execute("INSERT INTO BpmCardReuniao VALUES ('card', '2026-09-24T15:00:00Z', 'https://meet.google.com/abc-defg-hij')");
   await sqlite.execute("CREATE TABLE BpmCardFollowUpEstado (cardId TEXT PRIMARY KEY REFERENCES BpmCard(id), proximoContatoEm TEXT)");
   await sqlite.execute("INSERT INTO BpmCardFollowUpEstado VALUES ('card', '2026-09-25T15:00:00Z')");
   for (const tabela of dependencias) {
    await sqlite.execute(`CREATE TABLE ${tabela} (id TEXT PRIMARY KEY, cardId TEXT REFERENCES BpmCard(id) ON DELETE RESTRICT)`);
    await sqlite.execute(`INSERT INTO ${tabela} VALUES ('dep', 'card')`);
   }
   await sqlite.execute("CREATE TABLE Historico (acao TEXT NOT NULL)");
   await expect(sqlite.execute("DELETE FROM BpmCard WHERE id = 'card'")).rejects.toThrow();
   vi.resetAllMocks();
   mocks.auth.mockResolvedValue({ user: { id: "1", role: "COMERCIAL" } });
   mocks.db.usuarios.findUnique.mockResolvedValue({ id: 1, role: "COMERCIAL", status: "ATIVO", permissoes: "crm" });
   mocks.db.setorPermissao.findMany.mockResolvedValue([]);
   mocks.db.usuarioPermissaoOverride.findMany.mockResolvedValue([]);
   mocks.db.bpmCardMembro.findUnique.mockResolvedValue({ role: "RESPONSAVEL" });
   mocks.db.bpmCard.findUnique.mockResolvedValue({ status: "ATIVO", pipelineId: "pipeline", etapa: { nome: "Em tratativa", visibilidades: [] } });
   mocks.db.$transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => Promise<unknown>) => {
    const tx = await sqlite.transaction("write");
    mocks.db.bpmCard.update.mockImplementation(async ({ data }: { data: { status: string } }) => {
     await tx.execute({ sql: "UPDATE BpmCard SET status = ? WHERE id = 'card'", args: [data.status] });
    });
    mocks.db.bpmCardHistorico.create.mockImplementation(async ({ data }: { data: { acao: string } }) => {
     if (falharAuditoria) throw new Error("audit failure");
     await tx.execute({ sql: "INSERT INTO Historico VALUES (?)", args: [data.acao] });
    });
    try { const result = await fn(mocks.db); await tx.commit(); return result; }
    catch (error) { await tx.rollback(); throw error; }
    finally { tx.close(); }
   });
   expect(await ExcluirCardBpm("card")).toMatchObject({ success: !falharAuditoria });
   expect((await sqlite.execute("SELECT status FROM BpmCard")).rows[0].status).toBe(falharAuditoria ? "ATIVO" : "ARQUIVADO");
   const card = (await sqlite.execute("SELECT * FROM BpmCard")).rows[0];
   const reuniao = (await sqlite.execute("SELECT * FROM BpmCardReuniao")).rows[0];
   const followUp = (await sqlite.execute("SELECT * FROM BpmCardFollowUpEstado")).rows[0];
   expect(card.dataReuniao).toBe(reuniao.agendadaEm);
   expect(card.googleMeetLink).toBe(reuniao.googleMeetLink);
   expect(card.proximoContatoEm).toBe(followUp.proximoContatoEm);
   expect((await sqlite.execute("SELECT * FROM Historico")).rows).toHaveLength(falharAuditoria ? 0 : 1);
   for (const tabela of dependencias) expect((await sqlite.execute(`SELECT * FROM ${tabela}`)).rows).toHaveLength(1);
   expect((await sqlite.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
   if (falharAuditoria) expect(mocks.notify).not.toHaveBeenCalled();
  } finally { sqlite.close(); rmSync(fixtureDir, { recursive: true, force: true }); }
 });
});
