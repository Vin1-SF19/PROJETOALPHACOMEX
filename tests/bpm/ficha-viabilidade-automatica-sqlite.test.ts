import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { FichaAlphaPDF } from "@/components/GerarFicha";

const m = vi.hoisted(() => ({ db: null as PrismaClient | null, put: vi.fn(), realtime: vi.fn(), acesso: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: new Proxy({}, { get: (_target, chave) => {
  if (!m.db) throw new Error("Fixture não inicializada");
  const value = Reflect.get(m.db, chave);
  return typeof value === "function" ? value.bind(m.db) : value;
} }) }));
vi.mock("@vercel/blob", () => ({ put: m.put, del: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: m.realtime }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: m.acesso }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  FICHA_CONCLUIDA, FICHA_FALHA, FICHA_PENDENTE,
  garantirFichaViabilidade, obterFichaViabilidadePersistida, processarIntencaoFichaViabilidade,
  reconciliarFichasViabilidade, registrarIntencaoFichaViabilidade, resolverAtorFichaViabilidade,
  salvarComplementoFichaViabilidade,
} from "@/lib/bpm/ficha-viabilidade-automatica-server";
import { GarantirFichaViabilidadeBpm, ObterFichaViabilidadeBpm, SalvarComplementoFichaViabilidadeBpm } from "@/actions/bpm/FichaViabilidade";
import { entradaSolicitaFichaViabilidade } from "@/lib/bpm/ficha-viabilidade-documento";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (file: string) => { exec(sql: string): void; close(): void };
};
let db: PrismaClient, diretorio: string;
const cardId = "card-ficha-ficticio", empresaId = 51;
function criarTabelas(sqlite: InstanceType<typeof DatabaseSync>) {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  for (const modelo of ["Cliente", "usuarios", "BpmCard", "BpmPipeline", "BpmEtapa", "BpmCampo", "BpmCardCampoValor", "BpmCardReuniao", "PessoaClienteVinculo", "Pessoa", "ConsultaPreAnalise", "BpmCardHistorico", "BpmCardAnexo", "BpmAutomacaoLease", "BpmAutomacaoExecucao", "BpmEventoDominio"]) {
    const corpo = schema.match(new RegExp(`model ${modelo} \\{([\\s\\S]*?)\\n\\}`))?.[1];
    if (!corpo) throw new Error(`Modelo ausente: ${modelo}`);
    const colunas = corpo.split("\n").flatMap(linha => {
      const campo = linha.trim().match(/^(\w+)\s+(String|Int|Float|Boolean|DateTime|BigInt|Decimal|Bytes|Json)(\?)?\s*(.*)$/);
      if (!campo) return [];
      const [, nome, tipo, opcional, atributos] = campo;
      const tipos: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "REAL", Boolean: "BOOLEAN", DateTime: "DATETIME", BigInt: "INTEGER", Decimal: "REAL", Bytes: "BLOB", Json: "TEXT" };
      const original = atributos.match(/@default\(("[^"]*"|true|false|\d+|now\(\))\)/)?.[1];
      const padrao = original === "now()" ? "CURRENT_TIMESTAMP" : original === "true" ? "1" : original === "false" ? "0" : original ?? (!opcional ? tipo === "DateTime" ? "CURRENT_TIMESTAMP" : ["Int", "Float", "Boolean"].includes(tipo) ? "0" : "''" : undefined);
      return [`"${nome}" ${tipos[tipo]}${atributos.includes("@id") ? " PRIMARY KEY" : atributos.includes("@unique") ? " UNIQUE" : ""}${!opcional ? " NOT NULL" : ""}${padrao ? ` DEFAULT ${padrao}` : ""}`];
    });
    if (modelo === "BpmCardAnexo") colunas.push("UNIQUE(cardId,url)");
    if (modelo === "BpmCardCampoValor") colunas.push("UNIQUE(cardId,campoId)");
    sqlite.exec(`CREATE TABLE "${modelo}" (${colunas.join(",")})`);
  }
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("BLOBCRM_READ_WRITE_TOKEN", "private-fixture-token");
  diretorio = mkdtempSync(join(tmpdir(), "crm-ficha-test-"));
  const filename = join(diretorio, "test.sqlite");
  const sqlite = new DatabaseSync(filename);
  try { criarTabelas(sqlite); } finally { sqlite.close(); }
  db = new PrismaClient({ adapter: new PrismaLibSQL({ url: `file:${filename}` }) });
  m.db = db;
  m.put.mockResolvedValue({ url: "https://private.invalid/ficha.pdf" });
  m.acesso.mockResolvedValue({ autorizado: true });
  m.realtime.mockResolvedValue(undefined);
  m.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
  await db.$executeRaw`INSERT INTO usuarios(id,usuario,nome,email,status,role) VALUES(7,'ator','Quem Agendou','ator@example.test','ATIVO','Admin'),(8,'closer','Closer Diferente','closer@example.test','ATIVO','Comercial')`;
  await db.cliente.create({ data: { id: empresaId, razaoSocial: "EMPRESA FICTÍCIA DA FICHA", cnpj: "12345678000100", uf: "SP", capitalSocial: "100000", dataConstituicao: "2020-01-01" } });
  await db.bpmPipeline.create({ data: { id: "pipeline-ficha", chave: "comercial", nome: "Revisão de Radar" } });
  await db.bpmEtapa.create({ data: { id: "etapa-reuniao", pipelineId: "pipeline-ficha", nome: "Reunião Agendada", chave: "reuniao_agendada", ordem: 2 } });
  await db.bpmCard.create({ data: { id: cardId, empresaId, pipelineId: "pipeline-ficha", etapaId: "etapa-reuniao", responsavelId: 8, dataReuniao: new Date("2026-11-10T15:00:00Z") } });
});
afterEach(async () => { await db.$disconnect(); m.db = null; rmSync(diretorio, { recursive: true, force: true }); vi.unstubAllEnvs(); });

async function intencao(key = "entrada-1", actorUserId: number | null = 7, empresa = empresaId, card = cardId) {
  return db.$transaction(tx => registrarIntencaoFichaViabilidade(tx, { cardId: card, empresaId: empresa, eventoId: "evento-da-entrada", idempotencyKey: key, actorUserId }));
}
async function lerPdf(bytes: Buffer) {
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  try {
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n), content = await page.getTextContent();
      pages.push({ size: page.view, text: content.items.map(item => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ") });
    }
    return pages;
  } finally { await pdf.destroy(); }
}

describe("ficha automática persistida em SQLite privado", () => {
  it("grava PDF real igual à Pré-Análise, privado e vinculado; só o ator recebe descriptor anunciado", async () => {
    const job = await intencao();
    const result = await processarIntencaoFichaViabilidade(job);
    expect(result.estado).toBe("PRONTA");
    expect(result.gerada).toBe(true);
    if (!result.data) throw new Error("Ficha ausente");
    const upload = m.put.mock.calls[0];
    expect(upload[2]).toMatchObject({ access: "private", token: "private-fixture-token", contentType: "application/pdf" });
    const bytes: unknown = upload[1];
    if (!Buffer.isBuffer(bytes)) throw new Error("PDF real esperado");
    const actual = await lerPdf(bytes);
    const reference = await lerPdf(await renderToBuffer(FichaAlphaPDF({ dados: result.data.dados, userLogado: "Quem Agendou", finalidade: "pre-analise", logoPath: join(process.cwd(), "public/LogoTipo02.png") })));
    expect(actual).toEqual(reference);
    expect(actual).toHaveLength(1);
    expect(actual[0].size[2]).toBeCloseTo(595.28, 1);
    expect(actual[0].text).toContain("Com a revisão do RADAR");
    expect(actual[0].text).not.toContain("ANÁLISE DE VIABILIDADE");
    expect(result.data.dados.viabilidade).toBeUndefined();
    expect(result.data.userLogado).toBe("Quem Agendou");
    const anexo = await db.bpmCardAnexo.findUniqueOrThrow({ where: { id: result.data.anexoId } });
    expect(anexo).toMatchObject({ cardId, enviadoPorId: 7, tipo: "application/pdf" });
    expect(anexo.url).toMatch(/^bpm-blob:bpm\/card-ficha-ficticio\//);
    expect((await obterFichaViabilidadePersistida(cardId)).gerada).toBe(false);
    expect((await obterFichaViabilidadePersistida(cardId, job, 7)).gerada).toBe(true);
    expect((await obterFichaViabilidadePersistida(cardId, job, 8)).gerada).toBe(false);
    expect((await processarIntencaoFichaViabilidade(job)).gerada).toBe(false);
    expect(m.put).toHaveBeenCalledOnce();
  });

  it("complementa mantendo ID e CAS, preserva outros arquivos; reentrada não sobrescreve o documento", async () => {
    const first = await processarIntencaoFichaViabilidade(await intencao());
    if (!first.data) throw new Error("Ficha ausente");
    const original = await db.bpmCardAnexo.findUniqueOrThrow({ where: { id: first.data.anexoId } });
    await db.bpmCardAnexo.create({ data: { id: "outro-anexo", cardId, nome: "Outro.pdf", url: "bpm-blob:bpm/outro/seguro.pdf", enviadoPorId: 8 } });
    await db.bpmCardHistorico.create({ data: { cardId, acao: "ANEXO_UPLOAD_REGISTRADO", valorAnteriorJson: "bpm-blob:bpm/outro/seguro.pdf", createdAt: new Date(Date.now() + 1_000) } });
    const extras = { nomeResponsavel: "Responsável complementado", email: "ficticio@example.test", telefone: "11999999999", dataSituacao: "10/11/2026", horaSituacao: "12:00", mesProtocolo: "11/2026", origemLead: "Instagram", origemLeadDetalhe: "Campanha fictícia", observacoes: "Complemento salvo" };
    const saved = await salvarComplementoFichaViabilidade({ cardId, expectedRevision: 1, extras }, 7, "Admin");
    expect(saved).toMatchObject({ anexoId: first.data.anexoId, revision: 2, dados: { extra: extras } });
    expect((await obterFichaViabilidadePersistida(cardId)).data).toEqual(saved);
    const cleanups = await db.bpmCardHistorico.findMany({ where: { acao: "ANEXO_BLOB_LIMPEZA_PENDENTE" } });
    expect(cleanups.map(item => item.valorAnteriorJson)).toEqual([original.url]);
    expect(await db.bpmCardAnexo.findUnique({ where: { id: "outro-anexo" } })).not.toBeNull();
    const reentry = await processarIntencaoFichaViabilidade(await intencao("entrada-2"));
    expect(reentry).toMatchObject({ estado: "PRONTA", gerada: false, data: saved });
    await expect(salvarComplementoFichaViabilidade({ cardId, expectedRevision: 1, extras: {} }, 7, "Admin")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.put).toHaveBeenCalledTimes(2);
    expect(await db.bpmCardAnexo.count({ where: { cardId } })).toBe(2);
  });

  it("salva e reabre duas alterações de e-mail reutilizando o lease liberado e incrementando fencing", async () => {
    const initial = await processarIntencaoFichaViabilidade(await intencao());
    if (!initial.data) throw new Error("Ficha ausente");
    const message = "SQLITE_CONSTRAINT: SQLite error: UNIQUE constraint failed: BpmAutomacaoLease.recurso";
    const createLease = vi.spyOn(db.bpmAutomacaoLease, "create").mockImplementation(() => {
      throw Object.assign(new Error(message), { name: "DriverAdapterError", cause: { kind: "sqlite", extendedCode: 1, message } });
    });
    try {
      const first = await SalvarComplementoFichaViabilidadeBpm({ cardId, expectedRevision: 1, extras: { email: "primeiro@example.test" } });
      expect(first).toMatchObject({ success: true, data: { anexoId: initial.data.anexoId, revision: 2, dados: { extra: { email: "primeiro@example.test" } } } });
      expect((await db.bpmAutomacaoLease.findUniqueOrThrow({ where: { recurso: `ficha-viabilidade:${cardId}` } })).fencingToken).toBe(2);
      const second = await SalvarComplementoFichaViabilidadeBpm({ cardId, expectedRevision: 2, extras: { email: "segundo@example.test" } });
      expect(second).toMatchObject({ success: true, data: { anexoId: initial.data.anexoId, revision: 3 } });
      expect(await ObterFichaViabilidadeBpm({ cardId })).toMatchObject({ success: true, data: { anexoId: initial.data.anexoId, revision: 3, dados: { extra: { email: "segundo@example.test" } } } });
      const lease = await db.bpmAutomacaoLease.findUniqueOrThrow({ where: { recurso: `ficha-viabilidade:${cardId}` } });
      expect(lease.fencingToken).toBe(3);
      expect(lease.expiraEm.getTime()).toBe(0);
      expect(createLease).not.toHaveBeenCalled();
      expect(await db.bpmCardAnexo.count()).toBe(1);
      const bytes: unknown = m.put.mock.calls.at(-1)?.[1];
      if (!Buffer.isBuffer(bytes)) throw new Error("PDF real esperado");
      expect((await lerPdf(bytes))[0].text.toLowerCase()).toContain("segundo@example.test");
    } finally { createLease.mockRestore(); }
  });

  it("uma criação concorrente com o erro HTTP real de UNIQUE mantém lease ocupado e não gera upload", async () => {
    await processarIntencaoFichaViabilidade(await intencao());
    await db.bpmAutomacaoLease.update({ where: { recurso: `ficha-viabilidade:${cardId}` }, data: { expiraEm: new Date(Date.now() + 60_000) } });
    const message = "SQLITE_CONSTRAINT: SQLite error: UNIQUE constraint failed: BpmAutomacaoLease.recurso";
    const error = Object.assign(new Error(message), { name: "DriverAdapterError", cause: { kind: "sqlite", extendedCode: 1, message, originalMessage: message } });
    const createLease = vi.spyOn(db.bpmAutomacaoLease, "create").mockImplementationOnce(() => { throw error; });
    try {
      await expect(salvarComplementoFichaViabilidade({ cardId, expectedRevision: 1, extras: { email: "concorrente@example.test" } }, 7, "Admin")).rejects.toMatchObject({ code: "BUSY" });
      expect(m.put).toHaveBeenCalledOnce();
      expect((await obterFichaViabilidadePersistida(cardId)).data?.revision).toBe(1);
      expect((await db.bpmAutomacaoLease.findUniqueOrThrow({ where: { recurso: `ficha-viabilidade:${cardId}` } })).fencingToken).toBe(1);
    } finally { createLease.mockRestore(); }
  });

  it("falhas diferentes da UNIQUE do recurso permanecem erros e recebem diagnóstico sanitizado", async () => {
    await processarIntencaoFichaViabilidade(await intencao());
    await db.bpmAutomacaoLease.update({ where: { recurso: `ficha-viabilidade:${cardId}` }, data: { expiraEm: new Date(Date.now() + 60_000) } });
    const error = Object.assign(new Error("Informação privada não deve ir para o log"), { code: "TEST_DB_UNAVAILABLE" });
    const createLease = vi.spyOn(db.bpmAutomacaoLease, "create").mockImplementationOnce(() => { throw error; });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await SalvarComplementoFichaViabilidadeBpm({ cardId, expectedRevision: 1, extras: { email: "privado@example.test" } });
      expect(result).toMatchObject({ success: false, code: "FAILED" });
      expect(log).toHaveBeenCalledWith("[FichaViabilidade] Falha na operação", { operacao: "salvar", errorName: "Error", errorCode: "TEST_DB_UNAVAILABLE" });
      expect(JSON.stringify(log.mock.calls)).not.toContain("privado@example.test");
      expect(JSON.stringify(log.mock.calls)).not.toContain(error.message);
      expect(m.put).toHaveBeenCalledOnce();
    } finally { createLease.mockRestore(); log.mockRestore(); }
  });

  it("duas gerações concorrentes e replay convergem para um anexo e um upload", async () => {
    let liberar: (() => void) | undefined;
    const started = Promise.withResolvers<void>();
    m.put.mockImplementationOnce(async () => { started.resolve(); await new Promise<void>(resolve => { liberar = resolve; }); return {}; });
    const job = await intencao(), first = processarIntencaoFichaViabilidade(job);
    await started.promise;
    const concurrent = await processarIntencaoFichaViabilidade(job);
    expect(concurrent.estado).toBe("PENDENTE");
    liberar?.();
    expect((await first).estado).toBe("PRONTA");
    expect((await processarIntencaoFichaViabilidade(job)).gerada).toBe(false);
    expect(await db.bpmCardAnexo.count()).toBe(1);
    expect(m.put).toHaveBeenCalledOnce();
  });

  it("erro no Blob preserva reunião e permite retry; erro em realtime/release não demove arquivo confirmado", async () => {
    const job = await intencao();
    m.put.mockRejectedValueOnce(new Error("Blob indisponível"));
    expect((await processarIntencaoFichaViabilidade(job)).estado).toBe("FALHA");
    expect(await db.bpmCardAnexo.count()).toBe(0);
    expect((await db.bpmCard.findUniqueOrThrow({ where: { id: cardId } })).etapaId).toBe("etapa-reuniao");
    m.realtime.mockRejectedValueOnce(new Error("Canal indisponível"));
    const originalUpdate = db.bpmAutomacaoLease.updateMany.bind(db.bpmAutomacaoLease);
    const spy = vi.spyOn(db.bpmAutomacaoLease, "updateMany").mockImplementation(args => {
      if (args.data.expiraEm instanceof Date && args.data.expiraEm.getTime() === 0) throw new Error("Release indisponível");
      return originalUpdate(args);
    });
    const result = await processarIntencaoFichaViabilidade(job, true);
    spy.mockRestore();
    expect(result).toMatchObject({ estado: "PRONTA", gerada: true });
    expect((await db.bpmCardHistorico.findUniqueOrThrow({ where: { id: job } })).acao).toBe(FICHA_CONCLUIDA);
    expect(await db.bpmCardAnexo.count()).toBe(1);
  });

  it("lease expirado/fencing bloqueia confirmação antiga e deixa upload órfão reconciliável", async () => {
    const job = await intencao();
    m.put.mockImplementationOnce(async () => { await db.bpmAutomacaoLease.update({ where: { recurso: `ficha-viabilidade:${cardId}` }, data: { titular: "sucessor", fencingToken: { increment: 1 } } }); return {}; });
    const result = await processarIntencaoFichaViabilidade(job);
    expect(result.gerada).toBe(false);
    expect(await db.bpmCardAnexo.count()).toBe(0);
    expect(await db.bpmCardHistorico.count({ where: { acao: "ANEXO_UPLOAD_SEM_REGISTRO" } })).toBe(1);
    expect((await db.bpmAutomacaoLease.findUniqueOrThrow({ where: { recurso: `ficha-viabilidade:${cardId}` } })).titular).toBe("sucessor");
    expect((await db.bpmCardHistorico.findUniqueOrThrow({ where: { id: job } })).acao).toBe(FICHA_PENDENTE);
  });

  it("falha na confirmação da intenção reverte atomicamente anexo e snapshot; retry anuncia sem arquivo ativo duplicado", async () => {
    const job = await intencao();
    await db.$executeRawUnsafe("CREATE TRIGGER falha_confirmacao_ficha BEFORE UPDATE ON BpmCardHistorico WHEN NEW.acao = 'FICHA_VIABILIDADE_PROCESSADA' BEGIN SELECT RAISE(ABORT, 'fixture-confirmacao-indisponivel'); END");
    const first = await processarIntencaoFichaViabilidade(job);
    expect(first).toMatchObject({ estado: "FALHA", gerada: false, data: null });
    expect(await db.bpmCardAnexo.count()).toBe(0);
    expect(await db.bpmCardHistorico.count({ where: { acao: "FICHA_VIABILIDADE_ESTADO" } })).toBe(0);
    expect(await db.bpmCardHistorico.count({ where: { acao: "ANEXO_UPLOAD_SEM_REGISTRO" } })).toBe(1);
    await db.$executeRawUnsafe("DROP TRIGGER falha_confirmacao_ficha");
    const retried = await processarIntencaoFichaViabilidade(job, true);
    expect(retried).toMatchObject({ estado: "PRONTA", gerada: true });
    expect((await obterFichaViabilidadePersistida(cardId, job, 7)).gerada).toBe(true);
    expect(await db.bpmCardAnexo.count()).toBe(1);
    expect((await processarIntencaoFichaViabilidade(job)).gerada).toBe(false);
    expect(m.put).toHaveBeenCalledTimes(2);
  });

  it("falha de complemento preserva a versão confirmada; dois salvamentos não perdem complementos", async () => {
    const initial = await processarIntencaoFichaViabilidade(await intencao());
    if (!initial.data) throw new Error("Ficha ausente");
    const old = await db.bpmCardAnexo.findUniqueOrThrow({ where: { id: initial.data.anexoId } });
    await db.$executeRawUnsafe("CREATE TRIGGER falha_troca_ficha BEFORE UPDATE ON BpmCardAnexo BEGIN SELECT RAISE(ABORT, 'fixture-troca-indisponivel'); END");
    await expect(salvarComplementoFichaViabilidade({ cardId, expectedRevision: 1, extras: { nomeResponsavel: "Não confirmado" } }, 7, "Admin")).rejects.toThrow();
    expect((await obterFichaViabilidadePersistida(cardId)).data).toEqual(initial.data);
    expect((await db.bpmCardAnexo.findUniqueOrThrow({ where: { id: initial.data.anexoId } })).url).toBe(old.url);
    await db.$executeRawUnsafe("DROP TRIGGER falha_troca_ficha");
    let liberar: (() => void) | undefined;
    const started = Promise.withResolvers<void>();
    m.put.mockImplementationOnce(async () => { started.resolve(); await new Promise<void>(resolve => { liberar = resolve; }); return {}; });
    const firstSave = salvarComplementoFichaViabilidade({ cardId, expectedRevision: 1, extras: { nomeResponsavel: "Confirmado" } }, 7, "Admin");
    await started.promise;
    await expect(salvarComplementoFichaViabilidade({ cardId, expectedRevision: 1, extras: { nomeResponsavel: "Concorrente" } }, 7, "Admin")).rejects.toMatchObject({ code: "BUSY" });
    liberar?.();
    const saved = await firstSave;
    expect(saved).toMatchObject({ anexoId: initial.data.anexoId, revision: 2, dados: { extra: { nomeResponsavel: "Confirmado" } } });
    expect((await obterFichaViabilidadePersistida(cardId)).data).toEqual(saved);
    expect(await db.bpmCardAnexo.count()).toBe(1);
  });

  it("worker ignora legado, esgotados e backoff antes do limite e alcança a nova intenção elegível", async () => {
    expect(await reconciliarFichasViabilidade()).toEqual({ examinadas: 0, concluidas: 0, falhas: 0 });
    expect(m.put).not.toHaveBeenCalled();
    // Estes registros representam um backlog já existente, não comandos novos.
    // Semear em lote evita dezenas de transações de preparação antes da asserção
    // que de fato verifica a seleção do worker sob o limite de uma intenção.
    const proximaTentativaEm = Date.now() + 60_000;
    await db.bpmCardHistorico.createMany({ data: [
      { id: "backlog-json-invalido", cardId, acao: FICHA_PENDENTE, valorNovoJson: "{json inválido", createdAt: new Date(0) },
      { id: "backlog-payload-incompleto", cardId, acao: FICHA_PENDENTE,
        valorNovoJson: JSON.stringify({ schemaVersion: 1, tentativas: 0, proximaTentativaEm: 0 }), createdAt: new Date(0) },
      ...Array.from({ length: 35 }, (_, n) => ({
        id: `backlog-ficha-${n}`, cardId, acao: FICHA_FALHA, createdAt: new Date(0),
        valorNovoJson: JSON.stringify({ schemaVersion: 1, empresaId, eventoId: `evento-anterior-${n}`,
          actorUserId: 7, gerada: false, tentativas: n < 25 ? 5 : 1, proximaTentativaEm: n < 25 ? 0 : proximaTentativaEm }),
      })),
    ] });
    await intencao("nova-elegivel");
    expect(await reconciliarFichasViabilidade(1)).toEqual({ examinadas: 1, concluidas: 1, falhas: 0 });
    expect(m.put).toHaveBeenCalledOnce();
  });

  it("troca da empresa impede vazamento/confirmação; ações autenticam e exigem permissão de edição", async () => {
    await processarIntencaoFichaViabilidade(await intencao());
    await db.cliente.create({ data: { id: 52, razaoSocial: "OUTRA EMPRESA FICTÍCIA" } });
    await db.bpmCard.update({ where: { id: cardId }, data: { empresaId: 52 } });
    expect((await obterFichaViabilidadePersistida(cardId)).data).toBeNull();
    await expect(salvarComplementoFichaViabilidade({ cardId, expectedRevision: 1, extras: {} }, 7, "Admin")).rejects.toMatchObject({ code: "NOT_FOUND" });
    m.auth.mockResolvedValueOnce(null);
    expect(await ObterFichaViabilidadeBpm({ cardId })).toMatchObject({ success: false });
    m.acesso.mockRejectedValueOnce(new Error("Não autorizado"));
    expect(await GarantirFichaViabilidadeBpm({ cardId })).toMatchObject({ success: false, error: "Não autorizado" });
    m.acesso.mockRejectedValueOnce(new Error("Não autorizado"));
    expect(await SalvarComplementoFichaViabilidadeBpm({ cardId, expectedRevision: 1, extras: {} })).toMatchObject({ success: false, error: "Não autorizado" });
    expect(m.acesso).toHaveBeenCalledWith(cardId, 7, "Admin", "editarCard");
  });

  it("intenção transacional é scoped por card/empresa/key e rollback não produz trabalho", async () => {
    await expect(db.$transaction(async tx => { await registrarIntencaoFichaViabilidade(tx, { cardId, empresaId, actorUserId: 7, eventoId: "e", idempotencyKey: "rollback" }); throw new Error("Rollback"); })).rejects.toThrow("Rollback");
    expect(await db.bpmCardHistorico.count()).toBe(0);
    expect(await reconciliarFichasViabilidade()).toMatchObject({ examinadas: 0 });
    const first = await intencao("same-key");
    const second = await intencao("same-key", 7, empresaId, "outro-card");
    expect(first).not.toBe(second);
    expect(await intencao("same-key")).toBe(first);
  });

  it("ator causal vem do evento do agendamento, não closer/configurador; escopo de entrada é restrito", async () => {
    await db.bpmEventoDominio.create({ data: { id: "agenda", tipo: "REUNIAO_AGENDADA", entidadeTipo: "CARD", entidadeId: cardId, cardId, atorTipo: "USUARIO", atorUserId: 7, correlationId: "c", idempotencyKey: "agendou" } });
    await db.bpmAutomacaoExecucao.create({ data: { id: "exec", automacaoId: "configurador-diferente", cardId, eventoChave: "agenda", gatilhoTipo: "EVENTO", eventoId: "agenda" } });
    expect(await db.$transaction(tx => resolverAtorFichaViabilidade(tx, { cardId, tipo: "AUTOMACAO", automacaoExecucaoId: "exec" }))).toBe(7);
    expect(await db.$transaction(tx => resolverAtorFichaViabilidade(tx, { cardId: "outro-card", tipo: "AUTOMACAO", automacaoExecucaoId: "exec" }))).toBeNull();
    expect(entradaSolicitaFichaViabilidade({ chave: "comercial", nome: "Revisão de Radar" }, { chave: "reuniao_agendada", nome: "Reunião Agendada" })).toBe(true);
    expect(entradaSolicitaFichaViabilidade({ chave: "financeiro", nome: "Revisão de Radar" }, { chave: "reuniao_agendada", nome: "Reunião Agendada" })).toBe(false);
    expect(entradaSolicitaFichaViabilidade({ chave: "comercial", nome: "Outro Funil" }, { chave: "reuniao_agendada", nome: "Reunião Agendada" })).toBe(false);
    expect((await garantirFichaViabilidade(cardId, 7)).estado).toBe("PRONTA");
  });
});
