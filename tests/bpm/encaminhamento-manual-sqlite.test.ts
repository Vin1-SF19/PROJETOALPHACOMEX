import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const estado = vi.hoisted(() => ({ client: null as PrismaClient | null, falharOutbox: false, auth: vi.fn(), mover: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: new Proxy({}, { get: (_target, chave) => {
  if (!estado.client) throw new Error("Fixture privada não inicializada");
  const valor = Reflect.get(estado.client, chave);
  return typeof valor === "function" ? valor.bind(estado.client) : valor;
} }) }));
vi.mock("../../auth", () => ({ auth: estado.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/sla", () => ({ criarSlaInstancia: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/bpm/transicao-command", () => ({ executarTransicaoBpm: estado.mover }));
vi.mock("@/lib/bpm/automacoes/eventos", async original => {
  const real = await original<typeof import("@/lib/bpm/automacoes/eventos")>();
  return { ...real, publicarEventoBpm: async (...args: Parameters<typeof real.publicarEventoBpm>) => {
    if (estado.falharOutbox) throw new Error("Falha de outbox fictícia");
    return real.publicarEventoBpm(...args);
  } };
});
import { encaminharCardManualmente, obterCatalogoEncaminhamentoManual, obterResponsaveisEncaminhamentoManual } from "@/lib/bpm/encaminhamento-manual-server";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import { EncaminharCardManualmenteBpm, ObterOpcoesEncaminhamentoManualBpm } from "@/actions/bpm/EncaminhamentoManual";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (filename: string) => { exec(sql: string): void; close(): void } };
const origem = "c111111111111111111111111", etapaOrigem = "c222222222222222222222222", card = "c333333333333333333333333";
const financeiro = "c444444444444444444444444", etapaFinanceiro = "c555555555555555555555555";
let db: PrismaClient, diretorio: string;
const input = () => ({ cardId: card, pipelineDestinoId: financeiro, etapaDestinoId: etapaFinanceiro, responsavelDestinoId: 5,
  etapaOrigemEsperadaId: etapaOrigem, versaoEsperada: 0, idempotencyKey: "manual-ficticio-unico" });
function tabelas(sqlite: InstanceType<typeof DatabaseSync>) {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const modelos = ["Cliente", "usuarios", "Setor", "SetorPermissao", "UsuarioPermissaoOverride", "BpmPipelineSetor", "BpmEtapaVisibilidade", "BpmCard", "BpmPipeline", "BpmEtapa", "BpmCardMembro", "BpmCardVinculo", "BpmCardHistorico", "BpmCampo", "BpmCampoPipeline", "BpmCardCampoValor", "BpmCardAnexo", "BpmCardServicoContexto", "ClienteServico", "BpmTarefa", "BpmEventoDominio", "BpmAutomacao", "BpmAutomacaoVersao", "BpmAutomacaoExecucao", "BpmAutomacaoLease", "BpmAutomacaoPassoExecucao", "BpmCampoEtapaConfig", "BpmCampoMapeamento", "BpmFormularioComponente", "BpmFormularioSecao", "BpmEtapaFormulario"];
  for (const modelo of modelos) {
    const corpo = schema.match(new RegExp(`model ${modelo} \\{([\\s\\S]*?)\\n\\}`))?.[1];
    if (!corpo) throw new Error(`Modelo ausente: ${modelo}`);
    const colunas = corpo.split("\n").flatMap((linha) => {
      const item = linha.trim().match(/^(\w+)\s+(String|Int|Float|Boolean|DateTime|BigInt|Decimal|Bytes|Json)(\?)?\s*(.*)$/);
      if (!item) return [];
      const [, nome, tipo, opcional, atributos] = item;
      const tipos: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "REAL", Boolean: "BOOLEAN", DateTime: "DATETIME", BigInt: "INTEGER", Decimal: "REAL", Bytes: "BLOB", Json: "TEXT" };
      const valor = atributos.match(/@default\(("[^"]*"|true|false|\d+|now\(\))\)/)?.[1];
      const padrao = valor === "now()" ? "CURRENT_TIMESTAMP" : valor === "true" ? "1" : valor === "false" ? "0" : valor ?? (!opcional ? tipo === "DateTime" ? "CURRENT_TIMESTAMP" : ["Int", "Boolean", "Float", "Decimal", "BigInt"].includes(tipo) ? "0" : "''" : undefined);
      return [`"${nome}" ${tipos[tipo]}${atributos.includes("@id") ? " PRIMARY KEY" : ""}${atributos.includes("@unique") ? " UNIQUE" : ""}${!opcional ? " NOT NULL" : ""}${padrao ? ` DEFAULT ${padrao}` : ""}`];
    });
    for (const unica of corpo.matchAll(/@@unique\(\[([^\]]+)\]/g)) colunas.push(`UNIQUE(${unica[1]})`);
    const tabela = corpo.match(/@@map\("([^"\n]+)"\)/)?.[1] ?? modelo;
    sqlite.exec(`CREATE TABLE "${tabela}" (${colunas.join(",")});`);
  }
}

beforeEach(async () => {
  vi.clearAllMocks(); estado.falharOutbox = false; estado.auth.mockResolvedValue({ user: { id: "3" } });
  estado.mover.mockResolvedValue({ success: true, data: { idempotente: false } });
  diretorio = mkdtempSync("/dev/shm/alpha-manual-"); const filename = join(diretorio, "privado.sqlite");
  const sqlite = new DatabaseSync(filename); try { tabelas(sqlite); } finally { sqlite.close(); }
  db = new PrismaClient({ adapter: new PrismaLibSQL({ url: `file:${filename}` }) }); estado.client = db;
  for (const [id, role] of [[1, "Admin"], [2, "TI"], [3, "LIDER COMERCIAL"], [4, "COMERCIAL"], [5, "FINANCEIRO"], [6, "LIDER FINANCEIRO"]] as const) {
    await db.$executeRaw`INSERT INTO usuarios(id,nome,usuario,email,status,role,permissoes) VALUES(${id},${'Pessoa fictícia '+id},${'fixture-'+id},${'fixture-'+id+'@example.invalid'},'ATIVO',${role},'crm')`;
  }
  await db.cliente.create({ data: { id: 5, razaoSocial: "Empresa fictícia" } });
  await db.setor.create({ data: { id: 1, nome: "COMERCIAL" } }); await db.setor.create({ data: { id: 2, nome: "FINANCEIRO" } });
  await db.bpmPipeline.create({ data: { id: origem, nome: "Comercial fictício", chave: "comercial", setores: { create: { setorId: 1 } } } });
  await db.bpmEtapa.create({ data: { id: etapaOrigem, pipelineId: origem, nome: "Em tratativa", ordem: 1 } });
  await db.bpmPipeline.create({ data: { id: financeiro, nome: "Financeiro fictício", chave: "financeiro", setores: { create: { setorId: 2 } } } });
  await db.bpmEtapa.create({ data: { id: etapaFinanceiro, pipelineId: financeiro, nome: "Novo contrato", ordem: 0 } });
  await db.bpmCard.create({ data: { id: card, pipelineId: origem, etapaId: etapaOrigem, empresaId: 5, responsavelId: 4, membros: { create: { userId: 4, role: "RESPONSAVEL" } } } });
});
afterEach(async () => { await db?.$disconnect(); estado.client = null; if (diretorio) rmSync(diretorio, { recursive: true, force: true }); });

describe("encaminhamento manual canônico em SQLite privado", () => {
  it.each([1, 2, 3])("Admin/TI/líder autorizado %s envia de etapa não final com atribuição real", async ator => {
    const resultado = await encaminharCardManualmente(input(), ator);
    expect(resultado.mesmoPipeline).toBe(false);
    expect(await db.bpmCard.findUnique({ where: { id: resultado.cardId } })).toMatchObject({ pipelineId: financeiro, etapaId: etapaFinanceiro, responsavelId: 5 });
    expect(await db.bpmCard.findUnique({ where: { id: card } })).toMatchObject({ pipelineId: origem, etapaId: etapaOrigem, responsavelId: 4, status: "ATIVO" });
    expect(await db.bpmCardMembro.findMany({ where: { cardId: resultado.cardId } })).toMatchObject([{ userId: 5, role: "RESPONSAVEL" }]);
    expect(await db.bpmAutomacao.count()).toBe(0); expect(await db.bpmAutomacaoExecucao.count()).toBe(0);
    const evento = await db.bpmEventoDominio.findFirstOrThrow();
    expect(evento.atorUserId).toBe(ator); expect(evento.atorExecucaoId).toBeNull();
    expect(JSON.parse(evento.valorNovoJson!)).toMatchObject({ encaminhamentoManual: true, automacoesSuprimidas: true });
    expect(await db.bpmCardHistorico.count({ where: { acao: "RECEPCAO_PIPELINE_PENDENTE" } })).toBe(0);
    expect(await db.bpmCardHistorico.count({ where: { usuarioId: ator } })).toBe(2);
  });
  it.each([4, 5, 6])("nega participante/usuário comum/líder de outro setor %s", async ator => {
    await expect(encaminharCardManualmente(input(), ator)).rejects.toThrow("Você não pode encaminhar");
    expect(await db.bpmCard.count()).toBe(1);
  });
  it("catálogo para envio não concede leitura de cards no destino", async () => {
    const catalogo = await obterCatalogoEncaminhamentoManual(card, 3);
    expect(catalogo.map(x => x.id)).toContain(financeiro);
    expect(Object.keys(catalogo[0]).sort()).toEqual(["etapas", "id", "nome"]);
    const resultado = await EncaminharCardManualmenteBpm(input());
    expect(resultado).toMatchObject({ success: true, data: { mesmoPipeline: false } });
    expect(resultado.data).not.toHaveProperty("cardDestinoId");
    const criado = await db.bpmCard.findFirstOrThrow({ where: { pipelineId: financeiro } });
    expect((await checarAcessoBpmCard(criado.id, 3, null, "visualizar")).autorizado).toBe(false);
  });
  it("retorna somente pessoas elegíveis e ativas na etapa de destino", async () => {
    const candidatos = await obterResponsaveisEncaminhamentoManual(card, financeiro, etapaFinanceiro, 3);
    expect(candidatos.map(x => x.id)).toEqual([1, 2, 5, 6]);
    await db.usuarios.update({ where: { id: 5 }, data: { status: "INATIVO" } });
    expect((await obterResponsaveisEncaminhamentoManual(card, financeiro, etapaFinanceiro, 3)).map(x => x.id)).not.toContain(5);
  });
  it.each(["sem responsável", "responsável errado", "responsável inativo", "etapa estrangeira", "etapa inativa", "pipeline inativo", "versão", "autoridade revogada"])("revalida %s antes de criar", async caso => {
    const dados = input();
    if (caso === "sem responsável") delete (dados as { responsavelDestinoId?: number }).responsavelDestinoId;
    if (caso === "responsável errado") dados.responsavelDestinoId = 4;
    if (caso === "responsável inativo") await db.usuarios.update({ where: { id: 5 }, data: { status: "INATIVO" } });
    if (caso === "etapa estrangeira") dados.etapaDestinoId = etapaOrigem;
    if (caso === "etapa inativa") await db.bpmEtapa.update({ where: { id: etapaFinanceiro }, data: { ativo: false } });
    if (caso === "pipeline inativo") await db.bpmPipeline.update({ where: { id: financeiro }, data: { ativo: false } });
    if (caso === "versão") dados.versaoEsperada = 4;
    if (caso === "autoridade revogada") await db.usuarios.update({ where: { id: 3 }, data: { role: "COMERCIAL" } });
    await expect(encaminharCardManualmente(dados, 3)).rejects.toThrow(); expect(await db.bpmCard.count()).toBe(1);
  });
  it("replay converge sem duplicar; alteração de payload não reutiliza a solicitação", async () => {
    const original = await encaminharCardManualmente(input(), 3);
    expect(await encaminharCardManualmente(input(), 3)).toMatchObject({ cardId: original.cardId, idempotente: true });
    expect(await encaminharCardManualmente({ ...input(), versaoEsperada: 1 }, 3)).toMatchObject({ cardId: original.cardId, idempotente: true });
    await expect(encaminharCardManualmente({ ...input(), responsavelDestinoId: 1 }, 3)).rejects.toThrow("outro encaminhamento");
    expect(await db.bpmCard.count()).toBe(2); expect(await db.bpmCardVinculo.count()).toBe(1);
  });
  it("destino vinculado já existente não sofre mudança de etapa ou responsável", async () => {
    const original = await encaminharCardManualmente(input(), 3);
    await db.bpmCard.update({ where: { id: original.cardId }, data: { responsavelId: 1 } });
    await expect(encaminharCardManualmente({ ...input(), versaoEsperada: 1, idempotencyKey: "outro-pedido-manual" }, 3)).rejects.toThrow("Já existe encaminhamento");
    expect((await db.bpmCard.findUniqueOrThrow({ where: { id: original.cardId } })).responsavelId).toBe(1);
  });
  it("falha de outbox desfaz destino, vínculo, histórico e CAS; retry é seguro", async () => {
    estado.falharOutbox = true;
    await expect(encaminharCardManualmente(input(), 3)).rejects.toThrow("Falha de outbox");
    expect(await db.bpmCard.count()).toBe(1); expect(await db.bpmCardVinculo.count()).toBe(0); expect(await db.bpmCardHistorico.count()).toBe(0);
    expect((await db.bpmCard.findUniqueOrThrow({ where: { id: card } })).versao).toBe(0);
    estado.falharOutbox = false; await encaminharCardManualmente(input(), 3); expect(await db.bpmCard.count()).toBe(2);
  });
  it("duas solicitações concorrentes convergem para um único card", async () => {
    const resultados = await Promise.allSettled([encaminharCardManualmente(input(), 3), encaminharCardManualmente(input(), 3)]);
    expect(resultados.some(item => item.status === "fulfilled")).toBe(true);
    expect(await encaminharCardManualmente(input(), 3)).toMatchObject({ idempotente: true });
    expect(await db.bpmCard.count()).toBe(2); expect(await db.bpmCardVinculo.count()).toBe(1);
  });
  it("mesmo pipeline delega ao comando de movimento e não aceita trocar responsável", async () => {
    const dados = { ...input(), pipelineDestinoId: origem, etapaDestinoId: etapaOrigem, responsavelDestinoId: undefined };
    expect(await encaminharCardManualmente(dados, 3)).toMatchObject({ mesmoPipeline: true });
    expect(estado.mover).toHaveBeenCalledWith(expect.objectContaining({ cardId: card, ator: { tipo: "MANUAL", userId: 3 }, idempotencyKey: "manual:manual-ficticio-unico" }));
    await expect(encaminharCardManualmente({ ...dados, responsavelDestinoId: 1 }, 3)).rejects.toThrow("preserva o responsável");
    expect(await db.bpmCard.count()).toBe(1);
  });
  it("API exige sessão e não aceita autoridade por payload; botão não é exposto ao usuário comum", async () => {
    estado.auth.mockResolvedValue(null); expect(await EncaminharCardManualmenteBpm(input())).toMatchObject({ success: false });
    estado.auth.mockResolvedValue({ user: { id: "4" } }); expect(await ObterOpcoesEncaminhamentoManualBpm(card)).toMatchObject({ success: true, data: { permitido: false } });
    expect(await EncaminharCardManualmenteBpm({ ...input(), role: "Admin" } as never)).toMatchObject({ success: false });
    expect(await db.bpmCard.count()).toBe(1);
  });
});
