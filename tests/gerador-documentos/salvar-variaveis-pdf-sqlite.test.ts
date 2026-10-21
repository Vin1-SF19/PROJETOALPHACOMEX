import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

type ValorSqlite = string | number | bigint | null | Uint8Array;
type BancoFixture = {
  exec(sql: string): void;
  prepare(sql: string): { all(...args: ValorSqlite[]): Record<string, unknown>[]; run(...args: ValorSqlite[]): { changes: number | bigint } };
  close(): void;
};
// Node 24 já utilizado no projeto; DQS precisa ser explícito para reproduzir SQLite legado.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string, options: { enableDoubleQuotedStringLiterals: boolean }) => BancoFixture;
};
const mocks = vi.hoisted(() => ({
  ownership: vi.fn(), findDocumento: vi.fn(), findClausulas: vi.fn(), queryRaw: vi.fn(),
  transacao: vi.fn(), updateDocumento: vi.fn(), updateClausula: vi.fn(), executeRaw: vi.fn(), put: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/contratacao-comercial-server", () => ({}));
vi.mock("@/lib/bibble/tika", () => ({ extractTextFromBuffer: vi.fn() }));
vi.mock("@/lib/gerador-documentos/ownership", () => ({
  getSessaoGeradorDocumentos: vi.fn().mockResolvedValue({ userId: 10, role: "User" }),
  exigirAcessoModulo: vi.fn().mockResolvedValue({ userId: 10, isAdmin: false }),
  exigirOwnershipDocumento: mocks.ownership,
}));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));
vi.mock("@/lib/prisma", () => ({ default: {
  documentoGerado: { findUnique: mocks.findDocumento }, documentoClasulaGerada: { findMany: mocks.findClausulas },
  $queryRaw: (...args: unknown[]) => mocks.queryRaw(...args),
  $transaction: (...args: unknown[]) => mocks.transacao(...args),
} }));

import { AtualizarVariaveisContratoPadrao } from "@/actions/gerador-documentos";
import { carregarContratoPadrao, VALORES_INICIAIS_CONTRATO_PADRAO, CONTRATO_PADRAO_ID } from "@/lib/gerador-documentos/contrato-padrao";
import { renderizarConteudo } from "@/lib/gerador-documentos/render";
import * as pdf from "@/lib/gerador-documentos/pdf";

const DOCUMENTO_ID = "clx0000000000000000000000";
const PDF_ANTES = "https://blob.example/antes.pdf";
const PDF_DEPOIS = "https://blob.example/depois.pdf";
const HTML_DEPOIS = "https://blob.example/depois.html";
const payload = { documentoId: DOCUMENTO_ID, valores: { valor_total: "25000.01", valor_total_extenso: "forjado" } };
let banco: BancoFixture;
let pdfSpy: MockInstance<typeof pdf.gerarPdfDocumento>;
let errorSpy: MockInstance<typeof console.error>;
const tokenAnterior = process.env.BLOB_READ_WRITE_TOKEN;
const fetchOriginal = globalThis.fetch;

async function prepararBanco(comHtml: boolean, dqs = true) {
  banco?.close();
  banco = new DatabaseSync(":memory:", { enableDoubleQuotedStringLiterals: dqs });
  banco.exec(`CREATE TABLE DocumentoGerado (id TEXT PRIMARY KEY, status TEXT, pdfUrl TEXT, variaveisJson TEXT${comHtml ? ", htmlUrl TEXT" : ""});
    CREATE TABLE DocumentoClasulaGerada (id TEXT PRIMARY KEY, documentoId TEXT, conteudo TEXT);`);
  const modelo = await carregarContratoPadrao();
  const valores = { ...VALORES_INICIAIS_CONTRATO_PADRAO, __bpmCardId: "fixture-card", __modeloContratoPadrao: "docx-v1", contratante_nome: "CLIENTE SINTETICO", contratante_cnpj: "12.345.678/0001-90", contratante_endereco: "Rua Exemplo 10", contratante_email: "exemplo@example.com", data_assinatura: "2026-10-21" };
  banco.prepare("INSERT INTO DocumentoGerado (id, status, pdfUrl, variaveisJson) VALUES (?, ?, ?, ?)").run(DOCUMENTO_ID, "CONFERENCIA", PDF_ANTES, JSON.stringify(valores));
  const clausulas = modelo.clausulas.map((clausula, indice) => ({ ...clausula, id: `fixture-${indice}`, conteudoOriginal: clausula.conteudo, conteudo: renderizarConteudo(clausula.conteudo, modelo.variaveis, valores), reescritoPorIA: false }));
  clausulas.push(
    { ...clausulas[0], id: "fixture-manual", conteudo: "Texto alterado manualmente" },
    { ...clausulas[0], id: "fixture-ia", conteudo: "Texto alterado pela IA", reescritoPorIA: true },
  );
  for (const clausula of clausulas) banco.prepare("INSERT INTO DocumentoClasulaGerada VALUES (?, ?, ?)").run(clausula.id, DOCUMENTO_ID, clausula.conteudo);
  mocks.ownership.mockResolvedValue({ id: DOCUMENTO_ID, status: "CONFERENCIA", templateId: CONTRATO_PADRAO_ID, titulo: "Contrato sintético", pdfUrl: PDF_ANTES });
  mocks.findDocumento.mockImplementation(async () => banco.prepare("SELECT variaveisJson FROM DocumentoGerado WHERE id = ?").all(DOCUMENTO_ID)[0]);
  mocks.findClausulas.mockResolvedValue(clausulas);
  mocks.queryRaw.mockImplementation(async (strings: TemplateStringsArray, ...valoresSql: ValorSqlite[]) => banco.prepare(strings.join("?")).all(...valoresSql));
  mocks.executeRaw.mockImplementation(async (strings: TemplateStringsArray, ...valoresSql: ValorSqlite[]) => banco.prepare(strings.join("?")).run(...valoresSql).changes);
  mocks.updateDocumento.mockImplementation(async ({ where, data }) => ({ count: Number(banco.prepare("UPDATE DocumentoGerado SET variaveisJson = ?, pdfUrl = ? WHERE id = ? AND status = ? AND pdfUrl = ?").run(data.variaveisJson, data.pdfUrl, where.id, where.status, where.pdfUrl).changes) }));
  mocks.updateClausula.mockImplementation(async ({ where, data }) => ({ count: Number(banco.prepare("UPDATE DocumentoClasulaGerada SET conteudo = ? WHERE id = ? AND documentoId = ? AND conteudo = ?").run(data.conteudo, where.id, where.documentoId, where.conteudo).changes) }));
  mocks.transacao.mockImplementation(async (callback: (tx: unknown) => unknown) => {
    banco.exec("BEGIN");
    try {
      const resultado = await callback({ documentoGerado: { updateMany: mocks.updateDocumento }, documentoClasulaGerada: { updateMany: mocks.updateClausula }, $executeRaw: mocks.executeRaw });
      banco.exec("COMMIT"); return resultado;
    } catch (error) { banco.exec("ROLLBACK"); throw error; }
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn((...args: Parameters<typeof fetch>) => String(args[0]).startsWith("data:")
    ? fetchOriginal(...args) : Promise.reject(new Error("IO externo proibido na fixture"))));
  process.env.BLOB_READ_WRITE_TOKEN = "token-sintetico-sem-IO";
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  pdfSpy = vi.spyOn(pdf, "gerarPdfDocumento");
  mocks.put.mockReset().mockResolvedValueOnce({ url: HTML_DEPOIS }).mockResolvedValueOnce({ url: PDF_DEPOIS });
  await prepararBanco(false);
});
afterEach(() => {
  banco.close(); banco = undefined as unknown as BancoFixture;
  pdfSpy.mockRestore(); errorSpy.mockRestore(); vi.unstubAllGlobals();
  if (tokenAnterior === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = tokenAnterior;
});

function documentoPersistido() { return banco.prepare("SELECT * FROM DocumentoGerado WHERE id = ?").all(DOCUMENTO_ID)[0]; }

describe("salvar dados/PDF com coluna HTML opcional e SQLite real", () => {
  it("reproduz o falso positivo de SELECT não qualificado no SQLite com DQS", () => {
    expect(banco.prepare('SELECT "htmlUrl" FROM "DocumentoGerado" WHERE "id" = ?').all(DOCUMENTO_ID)).toEqual([{ '"htmlUrl"': "htmlUrl" }]);
    expect(() => banco.prepare('SELECT "DocumentoGerado"."htmlUrl" FROM "DocumentoGerado" WHERE "id" = ?').all(DOCUMENTO_ID)).toThrow("no such column");
  });

  it.each(["DocumentoGerado", "DocumentoTemplate"].flatMap((tabela) =>
    [true, false].flatMap((dqs) => ["ausente", "nulo", "preenchido"].map((coluna) => ({ tabela, dqs, coluna }))),
  ))("probe qualificado: $tabela, DQS=$dqs, htmlUrl=$coluna", ({ tabela, dqs, coluna }) => {
    const sqlite = new DatabaseSync(":memory:", { enableDoubleQuotedStringLiterals: dqs });
    try {
      sqlite.exec(`CREATE TABLE "${tabela}" (id TEXT${coluna === "ausente" ? "" : ", htmlUrl TEXT"})`);
      sqlite.prepare(`INSERT INTO "${tabela}" (id) VALUES (?)`).run("fixture");
      if (coluna === "preenchido") sqlite.prepare(`UPDATE "${tabela}" SET htmlUrl = ? WHERE id = ?`).run(HTML_DEPOIS, "fixture");
      const consultar = () => sqlite.prepare(`SELECT "${tabela}"."htmlUrl" FROM "${tabela}" WHERE id = ?`).all("fixture");
      if (coluna === "ausente") expect(consultar).toThrow("no such column");
      else expect(consultar()).toEqual([{ htmlUrl: coluna === "nulo" ? null : HTML_DEPOIS }]);
    } finally { sqlite.close(); }
  });

  it.each([true, false])("salva dados, cláusulas e PDF real sem coluna htmlUrl (DQS=%s)", async (dqs) => {
    await prepararBanco(false, dqs);
    const resultado = await AtualizarVariaveisContratoPadrao(payload);
    if (!resultado.success) {
      throw new Error(JSON.stringify({ erro: resultado.error, causa: errorSpy.mock.calls.map((chamada) => chamada[1] instanceof Error ? chamada[1].message : "") }));
    }
    expect(resultado.success).toBe(true);
    const salvo = documentoPersistido();
    expect(salvo.pdfUrl).toBe(PDF_DEPOIS);
    expect(JSON.parse(String(salvo.variaveisJson))).toMatchObject({ valor_total: "25000.01", valor_total_extenso: "vinte e cinco mil reais e um centavo", __bpmCardId: "fixture-card" });
    expect(resultado.data.clausulas.some((item) => item.conteudo.includes("vinte e cinco mil reais e um centavo"))).toBe(true);
    expect(resultado.data.clausulas.find((item) => item.id === "fixture-manual")?.conteudo).toBe("Texto alterado manualmente");
    expect(resultado.data.clausulas.find((item) => item.id === "fixture-ia")?.conteudo).toBe("Texto alterado pela IA");
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    const buffer = mocks.put.mock.calls[1][1] as Buffer;
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF"); expect(buffer.length).toBeGreaterThan(20000);
    expect(mocks.put.mock.calls[0][1].toString()).toContain("vinte e cinco mil reais e um centavo");
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).startsWith("data:"))).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each([true, false])("atualiza também htmlUrl quando a coluna existe (DQS=%s)", async (dqs) => {
    await prepararBanco(true, dqs);
    expect((await AtualizarVariaveisContratoPadrao(payload)).success).toBe(true);
    expect(documentoPersistido().htmlUrl).toBe(HTML_DEPOIS);
    expect(documentoPersistido().pdfUrl).toBe(PDF_DEPOIS);
    expect(mocks.executeRaw).toHaveBeenCalledOnce();
  });

  it.each(["PDF", "upload", "conflito do documento", "conflito da cláusula"])("não salva parcialmente em falha de %s", async (falha) => {
    await prepararBanco(true);
    if (falha === "PDF") pdfSpy.mockRejectedValueOnce(new Error("Falha sintética PDF"));
    if (falha === "upload") mocks.put.mockReset().mockRejectedValue(new Error("Falha sintética upload"));
    if (falha === "conflito do documento") banco.prepare("UPDATE DocumentoGerado SET pdfUrl = ? WHERE id = ?").run("https://blob.example/concorrente.pdf", DOCUMENTO_ID);
    if (falha === "conflito da cláusula") banco.prepare("UPDATE DocumentoClasulaGerada SET conteudo = ? WHERE id = ?").run("Alteração concorrente preservada", "fixture-0");
    const antes = documentoPersistido();
    const clausulasAntes = banco.prepare("SELECT * FROM DocumentoClasulaGerada ORDER BY id").all();
    expect((await AtualizarVariaveisContratoPadrao(payload)).success).toBe(false);
    expect(documentoPersistido()).toEqual(antes);
    expect(banco.prepare("SELECT * FROM DocumentoClasulaGerada ORDER BY id").all()).toEqual(clausulasAntes);
  });

  it.each(["FINALIZADO", "ARQUIVADO", "sem permissão"])("mantém bloqueio %s antes de gerar/upload/salvar", async (status) => {
    if (status === "sem permissão") mocks.ownership.mockRejectedValueOnce(new Error("Não autorizado"));
    else mocks.ownership.mockResolvedValueOnce({ id: DOCUMENTO_ID, status, templateId: CONTRATO_PADRAO_ID });
    expect((await AtualizarVariaveisContratoPadrao(payload)).success).toBe(false);
    expect(pdfSpy).not.toHaveBeenCalled(); expect(mocks.put).not.toHaveBeenCalled(); expect(mocks.transacao).not.toHaveBeenCalled();
  });
});
