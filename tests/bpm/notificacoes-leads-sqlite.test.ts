import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const estado = vi.hoisted(() => ({ db: null as PrismaClient | null, userId: 1, trigger: vi.fn(), falhaEvento: false }));
vi.mock("@/lib/prisma", () => ({ default: new Proxy({}, { get: (_target, chave) => {
  if (!estado.db) throw new Error("Fixture privada não inicializada");
  const valor = Reflect.get(estado.db, chave); return typeof valor === "function" ? valor.bind(estado.db) : valor;
} }) }));
vi.mock("../../auth", () => ({ auth: vi.fn(async () => ({ user: { id: String(estado.userId), role: "IGNORAR_ROLE_CLIENTE" } })) }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: estado.trigger } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/eventos", async (original) => {
  const real = await original<typeof import("@/lib/bpm/automacoes/eventos")>();
  return { ...real, publicarEventoBpm: async (...args: Parameters<typeof real.publicarEventoBpm>) => {
    if (estado.falhaEvento) throw new Error("Outbox sintética indisponível");
    return real.publicarEventoBpm(...args);
  } };
});
import { executarEncaminhamentoBpm } from "@/lib/bpm/automacoes/encaminhamento";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";
import { carregarResumoContratacao } from "@/lib/bpm/resumo-contratacao-server";
import { nomeUsuarioCampoBpm } from "@/lib/bpm/usuarios-campos";
import { carregarUsuariosCamposBpm } from "@/lib/bpm/usuarios-campos-server";
import { ObterCardBpm, ListarCardsPipelineBpm } from "@/actions/bpm/Cards";
import * as cardsActions from "@/actions/bpm/Cards";
import { SolicitarEncaminhamentoCardBpm } from "@/actions/bpm/Encaminhamentos";
import { ObterLeadPendenteNotificacaoBpm } from "@/actions/bpm/NotificacoesLeads";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import { PIPELINE_OPERACIONAL_ID } from "@/lib/bpm/financeiro-config.client";
import { listarAlertasLeadsBpm, obterAlertaLeadPendenteBpm, notificarPendenciasLeadsBpm } from "@/lib/bpm/notificacoes-leads-server";
import { assumirRecebimentoPipelineBpm, obterRecebimentoPipelineBpm, idRecepcaoPipeline } from "@/lib/bpm/recebimentos-card-server";
import { prepararLeadInstagram, INSTAGRAM_COLUNAS, INSTAGRAM_ENDPOINT_SLUG } from "@/lib/bpm/instagram-leads";
import { paginaAlertasLeadsBpmSchema, type AlertaLeadBpm } from "@/lib/bpm/notificacoes-leads";
import { GET } from "@/app/api/bpm/leads/alertas/route";
import { POST as ingest } from "@/app/api/bpm/noloss-leads/ingest/route";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (filename: string) => { exec(sql: string): void; close(): void };
};
const comercial = "c111111111111111111111111";
const financeiro = "c222222222222222222222222";
const operacional = PIPELINE_OPERACIONAL_ID;
const etapaCom = "c444444444444444444444444";
const etapaFin = "c555555555555555555555555";
const etapaOp = "c666666666666666666666666";
const origem = "c777777777777777777777777";
const vendedorId = "c888888888888888888888888";
let db: PrismaClient;
let dir: string;
const queries: string[] = [];
function schemaPrivado(sqlite: InstanceType<typeof DatabaseSync>) {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const enums = new Set([...schema.matchAll(/^enum (\w+) \{/gm)].map((item) => item[1]));
  const tipos: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "REAL", Boolean: "BOOLEAN", DateTime: "DATETIME", BigInt: "INTEGER", Decimal: "REAL", Bytes: "BLOB", Json: "TEXT" };
  for (const model of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const [, nome, corpo] = model;
    const colunas = corpo.split("\n").flatMap((linha) => {
      const item = linha.trim().match(/^(\w+)\s+(\w+)(\?)?\s*(.*)$/);
      if (!item) return [];
      const [, campo, tipo, opcional, attrs] = item;
      if (!(tipo in tipos) && !enums.has(tipo)) return [];
      const valor = attrs.match(/@default\(("[^"]*"|true|false|\d+|now\(\)|[A-Z_]+)\)/)?.[1];
      const padrao = valor === "now()" ? "CURRENT_TIMESTAMP" : valor === "true" ? "1" : valor === "false" ? "0"
        : valor && enums.has(tipo) ? `'${valor}'` : valor ?? (!opcional ? tipo === "DateTime" ? "CURRENT_TIMESTAMP" : ["Int", "Boolean", "Float", "Decimal", "BigInt"].includes(tipo) ? "0" : "''" : undefined);
      const coluna = attrs.match(/@map\("([^"]+)"\)/)?.[1] ?? campo;
      return [`"${coluna}" ${tipos[tipo] ?? "TEXT"}${attrs.includes("@id") ? " PRIMARY KEY" : ""}${attrs.includes("@unique") ? " UNIQUE" : ""}${!opcional ? " NOT NULL" : ""}${padrao ? ` DEFAULT ${padrao}` : ""}`];
    });
    for (const unica of corpo.matchAll(/@@(?:unique|id)\(\[([^\]]+)\]/g)) colunas.push(`UNIQUE(${unica[1]})`);
    const tabela = corpo.match(/@@map\("([^"]+)"\)/)?.[1] ?? nome;
    sqlite.exec(`CREATE TABLE "${tabela}" (${colunas.join(",")});`);
  }
}
async function todos(usuarioId: number) {
  const alertas: AlertaLeadBpm[] = []; let cursor: string | null = null; let snapshot: string | null = null;
  const cursores = new Set<string>();
  do {
    const pagina = paginaAlertasLeadsBpmSchema.parse(await listarAlertasLeadsBpm(usuarioId, cursor, db));
    snapshot ??= pagina.snapshotEm; expect(pagina.snapshotEm).toBe(snapshot);
    alertas.push(...pagina.alertas); cursor = pagina.proximoCursor;
    if (cursor) { expect(cursores.has(cursor)).toBe(false); cursores.add(cursor); }
  } while (cursor);
  return alertas;
}
async function handoff(cardId: string, pipelineId = financeiro, etapaId = etapaFin, numero = "f") {
  const card = await db.bpmCard.findUniqueOrThrow({ where: { id: cardId } });
  const auto = await db.bpmAutomacao.upsert({ where: { id: `regra-${numero}` },
    create: { id: `regra-${numero}`, nome: "Envio autorizado", pipelineId: card.pipelineId, etapaId: card.etapaId,
      gatilhoTipo: "ENTRAR_COLUNA", acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", criadoPorId: 1 }, update: {} });
  const exec = await db.bpmAutomacaoExecucao.upsert({ where: { id: `cexec000${numero}` },
    create: { id: `cexec000${numero}`, automacaoId: auto.id, cardId, eventoChave: numero, gatilhoTipo: "ENTRAR_COLUNA" }, update: {} });
  return executarEncaminhamentoBpm({ cardId, automacaoId: auto.id, execucaoId: exec.id,
    parametros: { pipelineId, etapaId, vincularAoOriginal: true, somenteSeNaoExistirAtivo: true } });
}
async function claim(cardId: string, usuarioId: number) {
  return assumirRecebimentoPipelineBpm({ cardId, recepcaoId: idRecepcaoPipeline(cardId),
    versaoEsperada: (await db.bpmCard.findUniqueOrThrow({ where: { id: cardId } })).versao }, usuarioId, db);
}
async function fonteParaClique(origemLead: "instagram" | "noloss") {
  if (origemLead === "noloss") {
    const lead = await db.nolossLead.create({ data: { nolossContactId: "clique-site", nome: "Pessoa sintética", utmSource: "site" } });
    return { tipo: "LEAD_VIRTUAL" as const, pipelineId: comercial, origemLead, leadId: lead.id };
  }
  const dados = prepararLeadInstagram({ id: "clique-instagram", full_name: "Pessoa sintética", created_time: "2026-10-21T10:00:00Z" });
  const lead = await db.bpmWebhookEntrada.create({ data: { endpointId: "fixture-instagram", idempotencyKey: "instagram:clique",
    statusRecebimento: "AUTENTICADO", payloadSanitizadoJson: JSON.stringify(dados) } });
  return { tipo: "LEAD_VIRTUAL" as const, pipelineId: comercial, origemLead, leadId: lead.id };
}
async function registrarPromocaoFixture(destino: Awaited<ReturnType<typeof fonteParaClique>>) {
  if (destino.origemLead === "noloss") {
    await db.nolossLead.update({ where: { id: destino.leadId }, data: {
      status: "promoted", promotedCardId: origem, promotedClienteId: 100, promotedByUserId: 1, promotedAt: new Date(),
    } });
  } else {
    const evento = await db.bpmEventoDominio.create({ data: { tipo: "CARD_CRIADO", entidadeTipo: "CARD", entidadeId: origem,
      cardId: origem, pipelineId: comercial, atorTipo: "USUARIO", atorUserId: 1, correlationId: "fixture-clique",
      idempotencyKey: `instagram-assumido:${destino.leadId}`, valorNovoJson: JSON.stringify({ origem: "INSTAGRAM" }) } });
    await db.bpmWebhookEntrada.update({ where: { id: destino.leadId }, data: { statusRecebimento: "PROCESSADO", eventoId: evento.id } });
  }
}
beforeEach(async () => {
  estado.falhaEvento = false; estado.userId = 1; vi.clearAllMocks();
  vi.stubEnv("INSTAGRAM_LEADS_ENDPOINT_ID", "fixture-instagram"); vi.stubEnv("NOLOSS_WEBHOOK_SECRET", "segredo-sintetico");
  dir = mkdtempSync(join(tmpdir(), "alpha-leads-")); const filename = join(dir, "privado.sqlite");
  const sqlite = new DatabaseSync(filename); try { sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = OFF;"); schemaPrivado(sqlite); } finally { sqlite.close(); }
  const recorded = new PrismaClient({ adapter: new PrismaLibSQL({ url: `file:${filename}` }), log: [{ emit: "event", level: "query" }] });
  recorded.$on("query", (event) => queries.push(event.query)); db = recorded; estado.db = db;
  for (const [id, nome, role] of [[1, "Closer A", "Comercial"], [2, "Financeiro B", "Financeiro"], [3, "Operacional C", "Operacional"],
    [4, "Outro Financeiro", "Financeiro"], [5, "Outro Closer", "Comercial"], [6, "Admin fora setor", "Admin"],
    [7, "TI observador", "T.I"], [8, "CEO fora setor", "CEO"]] as const) {
    await db.$executeRaw`INSERT INTO usuarios(id,nome,usuario,email,role,status,permissoes) VALUES(${id},${nome},${`usuario${id}`},${`usuario${id}@example.test`},${role},'ATIVO','crm')`;
  }
  for (const [id, nome, chave, etapaId, etapaNome] of [[comercial, "Revisão de Radar", "comercial", etapaCom, "Novos leads"],
    [financeiro, "Financeiro", "financeiro", etapaFin, "Recebimento financeiro"], [operacional, "Operacional", "operacional", etapaOp, "Execução"]]) {
    await db.bpmPipeline.create({ data: { id, nome, chave: id === operacional ? null : chave } });
    await db.bpmEtapa.create({ data: { id: etapaId, pipelineId: id, nome: etapaNome, ordem: 1, ehInicial: true } });
  }
  await db.cliente.create({ data: { id: 100, razaoSocial: "Empresa fictícia" } });
  await db.bpmCard.create({ data: { id: origem, pipelineId: comercial, etapaId: etapaCom, empresaId: 100,
    responsavelId: 1, primeiraVisualizacaoEm: new Date() } });
  await db.bpmCardMembro.create({ data: { cardId: origem, userId: 1, role: "RESPONSAVEL" } });
  await db.bpmWebhookEndpoint.create({ data: { id: "fixture-instagram", nome: "Instagram sintético", caminhoSlug: INSTAGRAM_ENDPOINT_SLUG,
    segredoHash: "sem-credencial", pipelineId: comercial, criadoPorId: 1 } });
  await db.bpmCampo.create({ data: { id: vendedorId, pipelineId: comercial, chave: "alpha.vendedor.a", nome: "Vendedor responsável", tipo: "usuario",
    escopo: "GLOBAL", fonteEntidade: "CARD", fonteAtributo: "responsavelId" } });
  for (const [pipelineId, etapaId] of [[financeiro, etapaFin], [operacional, etapaOp]]) {
    await db.bpmCampoPipeline.create({ data: { campoId: vendedorId, pipelineId } });
    await db.bpmCampoEtapaConfig.create({ data: { campoId: vendedorId, etapaId, visivel: true, editavel: false, somenteLeitura: true } });
  }
  queries.length = 0;
});
afterEach(async () => { vi.restoreAllMocks(); await db?.$disconnect(); estado.db = null; if (dir) rmSync(dir, { recursive: true, force: true }); vi.unstubAllEnvs(); });

describe("pendências compartilhadas com Prisma/SQLite privado", () => {
  it("IG/site/desconhecida usam proveniência canônica; recuperação e API não escrevem", async () => {
    const ig = prepararLeadInstagram({ id: "lead-sintetico", full_name: "Contato IG", created_time: "2026-10-21T10:00:00Z",
      [INSTAGRAM_COLUNAS.radar]: "ilimitado" });
    await db.bpmWebhookEntrada.create({ data: { endpointId: "fixture-instagram", idempotencyKey: "instagram:teste", statusRecebimento: "AUTENTICADO", payloadSanitizadoJson: JSON.stringify(ig) } });
    await db.nolossLead.createMany({ data: [{ nolossContactId: "site", nome: "Lead site", utmSource: "website" }, { nolossContactId: "desconhecido", nome: "Origem ausente" }] });
    queries.length = 0;
    const a = await todos(1); const b = await todos(5);
    expect(a).toEqual(b); expect(a).toHaveLength(3);
    expect(a.map((item) => item.origem).sort()).toEqual(["INSTAGRAM", "OUTRA", "SITE"]);
    expect(a.every((item) => item.cnpj === null)).toBe(true);
    expect(await todos(2)).toEqual([]); expect(await todos(8)).toEqual([]);
    for (const usuarioId of [6, 7]) {
      expect(await todos(usuarioId)).toEqual(a);
      estado.userId = usuarioId;
      const response = await GET(new Request("http://localhost/api/bpm/leads/alertas"));
      expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect((await response.json()).alertas).toEqual(a.filter((alerta) => alerta.fonte === "INSTAGRAM"));
      for (const alerta of a) {
        expect(await ObterLeadPendenteNotificacaoBpm(alerta.destino)).toMatchObject({ success: true,
          data: { id: alerta.destino.tipo === "LEAD_VIRTUAL" ? alerta.destino.leadId : "", origem: alerta.destino.tipo === "LEAD_VIRTUAL" ? alerta.destino.origemLead : "" } });
      }
    }
    expect(queries.filter((query) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(query))).toEqual([]);
    expect(JSON.stringify(a)).not.toContain("payloadSanitizadoJson");
  });

  it("mais de uma página mantém snapshot completo, consulta fora da página e resolução canônica", async () => {
    await db.nolossLead.createMany({ data: Array.from({ length: 121 }, (_, index) => ({ id: `c${String(index).padStart(24, "0")}`, nolossContactId: `pendente-${index}`, nome: `Lead ${index}` })) });
    expect(await todos(1)).toHaveLength(121);
    const destino = { tipo: "LEAD_VIRTUAL" as const, pipelineId: comercial, origemLead: "noloss" as const, leadId: `c${String(120).padStart(24, "0")}` };
    expect(await obterAlertaLeadPendenteBpm(1, destino, db)).toMatchObject({ nome: "Lead 120" });
    expect(await todos(7)).toHaveLength(121);
    estado.userId = 7;
    queries.length = 0;
    expect(await ObterLeadPendenteNotificacaoBpm(destino)).toMatchObject({ success: true, data: { id: destino.leadId, origem: "noloss" } });
    expect(queries.filter((query) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(query))).toEqual([]);
    await db.nolossLead.update({ where: { id: destino.leadId }, data: { status: "promoted", promotedCardId: origem, promotedByUserId: 1 } });
    expect(await obterAlertaLeadPendenteBpm(1, destino, db)).toBeNull();
    expect(await todos(1)).toHaveLength(120);
    expect(await ObterLeadPendenteNotificacaoBpm(destino)).toEqual({ success: true, tipo: "CARD", destino: { pipelineId: comercial, cardId: origem } });
    expect(await obterAlertaLeadPendenteBpm(1, { ...destino, pipelineId: financeiro }, db)).toBeNull();
  });

  it.each(["instagram", "noloss"] as const)("clique %s já promovido resolve somente card persistido e pipeline atual sem escrita", async (origemLead) => {
    const destino = await fonteParaClique(origemLead);
    await registrarPromocaoFixture(destino);
    await db.bpmCard.update({ where: { id: origem }, data: { pipelineId: financeiro, etapaId: etapaFin } });
    const antes = await db.bpmCard.findUniqueOrThrow({ where: { id: origem } });
    const eventosAntes = await db.bpmEventoDominio.count();
    estado.userId = 7;
    queries.length = 0;
    expect(await ObterLeadPendenteNotificacaoBpm(destino)).toEqual({ success: true, tipo: "CARD", destino: { pipelineId: financeiro, cardId: origem } });
    expect(queries.filter((query) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(query))).toEqual([]);
    expect(await db.bpmCard.findUniqueOrThrow({ where: { id: origem } })).toEqual(antes);
    expect(await db.bpmCard.count()).toBe(1);
    expect(await db.bpmEventoDominio.count()).toBe(eventosAntes);
    expect(await todos(7)).toEqual([]);
  });

  it.each(["instagram", "noloss"] as const)("promoção %s entre fonte e quadro é resolvida uma única vez sem nova assunção", async (origemLead) => {
    const destino = await fonteParaClique(origemLead);
    const listarReal = cardsActions.ListarCardsPipelineBpm;
    const projecao = vi.spyOn(cardsActions, "ListarCardsPipelineBpm").mockImplementationOnce(async (...args) => {
      expect(queries.filter((query) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(query))).toEqual([]);
      // Simula exclusivamente o commit concorrente de outra sessão, antes da projeção real.
      await registrarPromocaoFixture(destino);
      queries.length = 0;
      return listarReal(...args);
    });
    estado.userId = 7;
    queries.length = 0;
    expect(await ObterLeadPendenteNotificacaoBpm(destino)).toEqual({ success: true, tipo: "CARD", destino: { pipelineId: comercial, cardId: origem } });
    expect(projecao).toHaveBeenCalledTimes(1);
    expect(queries.filter((query) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(query))).toEqual([]);
    expect(await db.bpmCard.count()).toBe(1);
    expect((await db.bpmCard.findUniqueOrThrow({ where: { id: origem } })).responsavelId).toBe(1);
  });

  it.each(["resposta", "excecao"] as const)("falha técnica de projeção %s mantém fonte pendente e retorna erro honesto", async (falha) => {
    const destino = await fonteParaClique("instagram");
    const projecao = vi.spyOn(cardsActions, "ListarCardsPipelineBpm");
    if (falha === "resposta") projecao.mockResolvedValueOnce({ success: false, data: [], error: "Falha sintética" });
    else projecao.mockRejectedValueOnce(new Error("Falha técnica sintética"));
    estado.userId = 7;
    queries.length = 0;
    expect(await ObterLeadPendenteNotificacaoBpm(destino)).toMatchObject({ success: false, codigo: "FALHA_CARREGAMENTO" });
    expect(projecao).toHaveBeenCalledTimes(1);
    expect(queries.filter((query) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(query))).toEqual([]);
    expect(await db.bpmWebhookEntrada.findUniqueOrThrow({ where: { id: destino.leadId } })).toMatchObject({ statusRecebimento: "AUTENTICADO", eventoId: null });
  });

  it("ingresso NoLoss preserva UTM em retry omitido e jamais reabre lead promovido", async () => {
    const request = (body: unknown) => new NextRequest("http://localhost/api/bpm/noloss-leads/ingest", { method: "POST",
      headers: { "x-noloss-webhook-secret": "segredo-sintetico", "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await ingest(request({ id: "web-site", firstName: "Pessoa", utmSource: "site", utmMedium: "organic", utmCampaign: "campanha" }))).status).toBe(200);
    const lead = await db.nolossLead.findUniqueOrThrow({ where: { nolossContactId: "web-site" } });
    expect(lead.utmSource).toBe("site");
    await db.nolossLead.update({ where: { id: lead.id }, data: { status: "promoted", promotedCardId: origem } });
    expect((await ingest(request({ id: "web-site", firstName: "Pessoa atualizada" }))).status).toBe(200);
    expect(await db.nolossLead.findUniqueOrThrow({ where: { id: lead.id } })).toMatchObject({ status: "promoted", utmSource: "site", utmMedium: "organic", utmCampaign: "campanha", promotedCardId: origem });
    expect((await ingest(request({ id: "grande", utmSource: "x".repeat(201) }))).status).toBe(400);
  });

  it("notifica colegas e observadores TI/Admin por canal privado mínimo, sem CEO/outro setor", async () => {
    await notificarPendenciasLeadsBpm({ pipelineId: financeiro, etapaId: etapaFin });
    expect(estado.trigger.mock.calls.map(([canal]) => canal).sort()).toEqual(["private-bpm-tarefas-usuario-2", "private-bpm-tarefas-usuario-4",
      "private-bpm-tarefas-usuario-6", "private-bpm-tarefas-usuario-7"]);
    for (const [, event, payload] of estado.trigger.mock.calls) {
      expect(event).toBe("bpm-leads-atualizados"); expect(Object.keys(payload).sort()).toEqual(["pipelineId", "timestamp"]);
    }
    estado.trigger.mockRejectedValueOnce(new Error("Rede indisponível"));
    await expect(notificarPendenciasLeadsBpm({ pipelineId: financeiro, etapaId: etapaFin })).resolves.toBeUndefined();
  });

  it.each(["FINANCEIRO", "OPERACIONAL"] as const)("TI/Admin observa e abre recepção %s sem autoridade para claim", async (setor) => {
    const fin = await handoff(origem);
    let cardId = fin.cardId;
    if (setor === "OPERACIONAL") {
      await claim(fin.cardId, 2);
      await db.bpmCard.update({ where: { id: fin.cardId }, data: { status: "CONCLUIDO" } });
      cardId = (await handoff(fin.cardId, operacional, etapaOp, "o")).cardId;
    }
    const antes = await db.bpmCard.findUniqueOrThrow({ where: { id: cardId } });
    const membrosAntes = await db.bpmCardMembro.findMany({ where: { cardId }, orderBy: { id: "asc" } });
    for (const usuarioId of [6, 7]) {
      expect(await todos(usuarioId)).toMatchObject([{ destino: { tipo: "CARD", cardId }, fonte: "ENCAMINHAMENTO" }]);
      expect(await obterRecebimentoPipelineBpm(cardId, usuarioId, db)).toMatchObject({ status: "PENDENTE", podeAssumir: false,
        motivoImpedimentoAssuncao: expect.any(String) });
      const historicosAntes = await db.bpmCardHistorico.count();
      const eventosAntes = await db.bpmEventoDominio.count();
      queries.length = 0;
      await expect(claim(cardId, usuarioId)).rejects.toThrow("Não autorizado");
      expect(queries.filter((query) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(query))).toEqual([]);
      expect(await db.bpmCardHistorico.count()).toBe(historicosAntes);
      expect(await db.bpmEventoDominio.count()).toBe(eventosAntes);
      estado.userId = usuarioId;
      const aberto = await ObterCardBpm(cardId);
      expect(aberto.success, JSON.stringify(aberto)).toBe(true);
      if (aberto.success) expect(aberto.data?.recebimentoPipeline).toMatchObject({ status: "PENDENTE", podeAssumir: false });
    }
    expect(await db.bpmCard.findUniqueOrThrow({ where: { id: cardId } })).toMatchObject({ responsavelId: antes.responsavelId, versao: antes.versao });
    expect(await db.bpmCardMembro.findMany({ where: { cardId }, orderBy: { id: "asc" } })).toEqual(membrosAntes);
    expect(await db.bpmCardHistorico.count({ where: { acao: "RECEPCAO_PIPELINE_ASSUMIDA", cardId } })).toBe(0);
    await db.usuarios.update({ where: { id: 7 }, data: { status: "INATIVO" } });
    expect(await todos(7)).toEqual([]);
    expect(await todos(8)).toEqual([]);
    await db.usuarios.update({ where: { id: setor === "FINANCEIRO" ? 2 : 3 }, data: { permissoes: "" } });
    expect(await todos(setor === "FINANCEIRO" ? 2 : 3)).toEqual([]);
    await db.usuarios.update({ where: { id: setor === "FINANCEIRO" ? 2 : 3 }, data: { permissoes: "crm" } });
    await claim(cardId, setor === "FINANCEIRO" ? 2 : 3);
    expect(await todos(6)).toEqual([]);
  });

  it("handoff novo cria uma recepção, claim altera somente alvo e projeta vendedor A com financeiro B/operacional C", async () => {
    const fin = await handoff(origem);
    expect((await obterRecebimentoPipelineBpm(fin.cardId, 2, db))).toMatchObject({ status: "PENDENTE", podeAssumir: true,
      responsaveisAnteriores: [{ usuarioId: 1, nome: "Closer A", setor: "COMERCIAL" }] });
    estado.userId = 6;
    const quadroAntes = await ListarCardsPipelineBpm(financeiro);
    expect(quadroAntes.success, JSON.stringify(quadroAntes)).toBe(true);
    expect(quadroAntes.data.find((card) => card.id === fin.cardId)).toMatchObject({ recebimentoPendente: true });
    expect((await todos(2)).find((item) => item.destino.tipo === "CARD")).toMatchObject({ nome: "Empresa fictícia" });
    await claim(fin.cardId, 2);
    estado.userId = 2;
    expect((await ListarCardsPipelineBpm(financeiro)).data.find((card) => card.id === fin.cardId)).toMatchObject({ recebimentoPendente: false });
    expect(await todos(2)).toEqual([]); expect(await todos(4)).toEqual([]);
    expect((await db.bpmCard.findUniqueOrThrow({ where: { id: origem } })).responsavelId).toBe(1);
    expect((await db.bpmCard.findUniqueOrThrow({ where: { id: fin.cardId } })).responsavelId).toBe(2);
    estado.userId = 2;
    const financeiroAberto = await ObterCardBpm(fin.cardId);
    expect(financeiroAberto.success, JSON.stringify(financeiroAberto)).toBe(true);
    if (financeiroAberto.success && financeiroAberto.data) {
      expect(financeiroAberto.data.camposEtapa.find((campo) => campo.id === vendedorId)).toMatchObject({ valor: "1", valorExibicao: "Closer A" });
    }
    const campo = await db.bpmCampo.findUniqueOrThrow({ where: { id: vendedorId } });
    expect(await carregarValoresCanonicosCampos(fin.cardId, [campo], db)).toMatchObject({ [vendedorId]: "1" });
    expect(nomeUsuarioCampoBpm("1", await carregarUsuariosCamposBpm(["1"], false, db))).toBe("Closer A");
    expect((await carregarResumoContratacao(fin.cardId))?.campos.find((item) => item.nome === "Vendedor responsável")?.valor).toBe("Closer A");
    await db.bpmCard.update({ where: { id: fin.cardId }, data: { status: "CONCLUIDO" } });
    const op = await handoff(fin.cardId, operacional, etapaOp, "o");
    await claim(op.cardId, 3);
    const recebido = await obterRecebimentoPipelineBpm(op.cardId, 3, db);
    expect(recebido).toMatchObject({ status: "ASSUMIDO", assumidoPor: { usuarioId: 3, nome: "Operacional C" },
      responsaveisAnteriores: [{ usuarioId: 1, nome: "Closer A" }, { usuarioId: 2, nome: "Financeiro B" }] });
    expect(await carregarValoresCanonicosCampos(op.cardId, [campo], db)).toMatchObject({ [vendedorId]: "1" });
    estado.userId = 3;
    const card = await ObterCardBpm(op.cardId);
    expect(card.success, JSON.stringify(card)).toBe(true);
    if (card.success && card.data) {
      expect(card.data.recebimentoPipeline).toMatchObject({ assumidoPor: { nome: "Operacional C" } });
      expect(card.data.camposEtapa.find((campo) => campo.id === vendedorId)).toMatchObject({ valor: "1", valorExibicao: "Closer A" });
    }
    const repetido = await handoff(origem);
    expect(repetido.existente).toBe(true);
    expect(await db.bpmCardHistorico.count({ where: { acao: "RECEPCAO_PIPELINE_PENDENTE" } })).toBe(2);
    expect(await db.bpmCardHistorico.count({ where: { acao: "RECEPCAO_PIPELINE_ASSUMIDA" } })).toBe(2);
    expect(await db.bpmCardMembro.findMany({ where: { cardId: fin.cardId, role: "RESPONSAVEL" } })).toMatchObject([{ userId: 2 }]);
  });

  it("rollback do claim mantém pendência, concorrência tem único vencedor e retry não duplica evento", async () => {
    const fin = await handoff(origem);
    estado.falhaEvento = true;
    await expect(claim(fin.cardId, 2)).rejects.toThrow("Outbox");
    expect((await db.bpmCard.findUniqueOrThrow({ where: { id: fin.cardId } })).responsavelId).toBe(1);
    expect(await obterRecebimentoPipelineBpm(fin.cardId, 2, db)).toMatchObject({ status: "PENDENTE" });
    estado.falhaEvento = false;
    const versao = (await db.bpmCard.findUniqueOrThrow({ where: { id: fin.cardId } })).versao;
    const input = { cardId: fin.cardId, recepcaoId: idRecepcaoPipeline(fin.cardId), versaoEsperada: versao };
    const disputa = await Promise.allSettled([assumirRecebimentoPipelineBpm(input, 2, db), assumirRecebimentoPipelineBpm(input, 4, db)]);
    expect(disputa.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    const vencedor = (await db.bpmCard.findUniqueOrThrow({ where: { id: fin.cardId } })).responsavelId;
    expect(await assumirRecebimentoPipelineBpm(input, vencedor, db)).toMatchObject({ idempotente: true });
    expect(await db.bpmEventoDominio.count({ where: { tipo: "RESPONSAVEL_ATRIBUIDO" } })).toBe(1);
    expect(await db.bpmCardHistorico.count({ where: { acao: "RECEPCAO_PIPELINE_ASSUMIDA" } })).toBe(1);
    expect(await db.bpmCard.count()).toBe(2);
  });

  it("claim financeiro após envio administrativo não libera edição nem altera snapshot operacional anterior", async () => {
    const fin = await handoff(origem);
    await db.bpmEtapa.update({ where: { id: etapaFin }, data: { ehFinal: true } });
    const auto = await db.bpmAutomacao.create({ data: { nome: "Envio explícito de fixture", pipelineId: financeiro,
      etapaId: etapaFin, gatilhoTipo: "ENTRAR_COLUNA", acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", criadoPorId: 6,
      parametrosJson: JSON.stringify({ pipelineId: operacional, etapaId: etapaOp, vincularAoOriginal: true, somenteSeNaoExistirAtivo: true }) } });
    estado.userId = 6;
    const resultado = await SolicitarEncaminhamentoCardBpm({ cardId: fin.cardId, automacaoId: auto.id,
      etapaOrigemEsperadaId: etapaFin, versaoEsperada: (await db.bpmCard.findUniqueOrThrow({ where: { id: fin.cardId } })).versao,
      idempotencyKey: "envio-admin-local-sintetico" });
    expect(resultado.success, JSON.stringify(resultado)).toBe(true);
    if (!resultado.success || !resultado.data) throw new Error("Envio administrativo não confirmado");
    const opId = resultado.data.cardDestinoId;
    const antes = await db.bpmCardHistorico.findUniqueOrThrow({ where: { id: idRecepcaoPipeline(opId) } });
    expect((await obterRecebimentoPipelineBpm(opId, 3, db))?.responsaveisAnteriores)
      .toMatchObject([{ setor: "COMERCIAL", usuarioId: 1, nome: "Closer A" }]);
    await claim(fin.cardId, 2);
    expect(await checarAcessoBpmCard(fin.cardId, 2, null, "editarCard", db))
      .toMatchObject({ autorizado: false, bloqueadoPorEncaminhamento: true });
    expect((await db.bpmCard.findUniqueOrThrow({ where: { id: fin.cardId } })).status).toBe("ATIVO");
    expect((await db.bpmCardHistorico.findUniqueOrThrow({ where: { id: idRecepcaoPipeline(opId) } })).valorNovoJson).toBe(antes.valorNovoJson);
    expect((await obterRecebimentoPipelineBpm(opId, 3, db))?.responsaveisAnteriores).toHaveLength(1);
  });
});


it("administrador explícito de outro setor assume a recepção e revogação é rechecada na transação", async () => {
  const fin = await handoff(origem);
  const config = (regras: object[]) => JSON.stringify({ permissoesPipeline: { version: 2, regras } });
  const regras = [{ tipo: "USUARIO", id: 1, nivel: "ADMINISTRATIVO" }];
  await db.bpmPipeline.update({ where: { id: financeiro }, data: { visualizacaoConfigJson: config(regras) } });
  await db.bpmEtapaVisibilidade.create({ data: { etapaId: etapaFin, perfil: "Financeiro", podeVer: false, podeAgir: false } });
  expect(await obterRecebimentoPipelineBpm(fin.cardId, 1, db)).toMatchObject({ podeAssumir: true });
  await db.bpmPipeline.update({ where: { id: financeiro }, data: { visualizacaoConfigJson: config([]) } });
  expect(await obterRecebimentoPipelineBpm(fin.cardId, 1, db)).toMatchObject({ podeAssumir: false });
  await expect(claim(fin.cardId, 1)).rejects.toThrow("Não autorizado");
  await db.bpmPipeline.update({ where: { id: financeiro }, data: { visualizacaoConfigJson: config(regras) } });
  expect(await claim(fin.cardId, 1)).toMatchObject({ idempotente: false });
  expect(await db.bpmCard.findUnique({ where: { id: fin.cardId } })).toMatchObject({ responsavelId: 1 });
});
