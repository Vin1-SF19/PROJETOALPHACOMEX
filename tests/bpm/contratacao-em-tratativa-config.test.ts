import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ALVO_CONTRATACAO as a, prepararContratacao, aplicarContratacao, verificarContratacao, reverterContratacao, validarBackupContratacao, type PlanoContratacao, type AutorizacaoContratacao } from "@/lib/bpm/contratacao-em-tratativa-config";

let url: string;
let client: Client, directory: string, backup: string, manifest: string, plan: PlanoContratacao;
const tables = ["BpmPipeline", "BpmEtapa", "BpmCampo", "BpmCampoOpcao", "BpmCampoMapeamento", "BpmCampoEtapaConfig", "BpmCampoObrigatorioEtapa", "BpmCampoOcultoEtapa", "BpmEtapaFormulario", "BpmFormularioSecao", "BpmFormularioComponente", "BpmPipelineConfigAuditoria", "BpmCard", "BpmCardCampoValor", "BpmCampoValorGlobal", "BpmCardHistorico", "usuarios"];
const quote = (value: unknown): string => value === null ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
async function exportBackup() {
  const definitions = (await client.execute("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name")).rows;
  const lines: string[] = []; let totalRows = 0;
  for (const table of definitions) {
    lines.push(`${table.sql};`);
    const result = await client.execute(`SELECT * FROM "${table.name}"`);
    totalRows += result.rows.length;
    for (const row of result.rows) lines.push(`INSERT INTO "${table.name}"(${result.columns.map((column) => `"${column}"`).join(",")}) VALUES(${result.columns.map((column) => quote(row[column])).join(",")});`);
  }
  const sql = lines.join("\n");
  await writeFile(backup, sql);
  await writeFile(manifest, JSON.stringify({ generatedAt: new Date().toISOString(), databaseHash: plan.databaseHash, tables: definitions.length, totalRows, sha256: createHash("sha256").update(sql).digest("hex"), sizeBytes: Buffer.byteLength(sql) }));
}
const auth = (mode = "APLICAR"): AutorizacaoContratacao => ({ fingerprint: plan.fingerprint, approval: `${mode}_${plan.operation}:${plan.fingerprint}`, adminId: 1, backup, manifest });
const count = async (table: string) => Number((await client.execute(`SELECT count(*) AS n FROM "${table}"`)).rows[0].n);

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "crm-config-test-"));
  url = `file:${path.join(directory, "db.sqlite")}`;
  client = createClient({ url });
  const { mkdir } = await import("node:fs/promises");
  const backupDir = path.join(directory, "database-backups", "pre-change"); await mkdir(backupDir, { recursive: true });
  backup = path.join(backupDir, "test.sql"); manifest = `${backup}.json`;
  // Real SQLite schema constraints mirror the published Prisma tables involved in this operation.
  await client.executeMultiple(`
    CREATE TABLE BpmPipeline(id TEXT PRIMARY KEY,nome TEXT,ativo INTEGER,configVersion INTEGER,updatedAt TEXT);
    CREATE TABLE BpmEtapa(id TEXT PRIMARY KEY,pipelineId TEXT,nome TEXT,ativo INTEGER,capabilitiesJson TEXT);
    CREATE TABLE BpmCampo(id TEXT PRIMARY KEY,pipelineId TEXT,chave TEXT,tipo TEXT,ativo INTEGER,escopo TEXT);
    CREATE TABLE BpmCampoOpcao(id TEXT PRIMARY KEY,campoId TEXT,ativo INTEGER,rotulo TEXT);
    CREATE TABLE BpmCampoMapeamento(id TEXT PRIMARY KEY,campoOrigemId TEXT,campoDestinoId TEXT);
    CREATE TABLE BpmCampoEtapaConfig(id TEXT PRIMARY KEY,campoId TEXT,etapaId TEXT,visivel INTEGER DEFAULT 1,editavel INTEGER DEFAULT 1,somenteLeitura INTEGER DEFAULT 0,obrigatorio INTEGER DEFAULT 0,obrigatorioEntrada INTEGER DEFAULT 0,obrigatorioSaida INTEGER DEFAULT 0,ordem INTEGER,grupo TEXT,createdAt TEXT,updatedAt TEXT,UNIQUE(campoId,etapaId));
    CREATE TABLE BpmCampoObrigatorioEtapa(id TEXT PRIMARY KEY,campoId TEXT,etapaId TEXT);
    CREATE TABLE BpmCampoOcultoEtapa(id TEXT PRIMARY KEY,campoId TEXT,etapaId TEXT);
    CREATE TABLE BpmEtapaFormulario(id TEXT PRIMARY KEY,etapaId TEXT UNIQUE,versao INTEGER,ativo INTEGER,updatedAt TEXT);
    CREATE TABLE BpmFormularioSecao(id TEXT PRIMARY KEY,formularioId TEXT,chave TEXT,titulo TEXT);
    CREATE TABLE BpmFormularioComponente(id TEXT PRIMARY KEY,secaoId TEXT,chave TEXT,tipo TEXT,campoId TEXT,capability TEXT,ordem INTEGER,configJson TEXT,createdAt TEXT,updatedAt TEXT,UNIQUE(secaoId,chave));
    CREATE TABLE BpmPipelineConfigAuditoria(id TEXT PRIMARY KEY,pipelineId TEXT,adminId INTEGER,campoAlterado TEXT,valorAnteriorJson TEXT,valorNovoJson TEXT,createdAt TEXT);
    CREATE TABLE BpmCard(id TEXT PRIMARY KEY,responsavelId INTEGER,pipelineId TEXT);
    CREATE TABLE BpmCardCampoValor(id TEXT PRIMARY KEY,cardId TEXT,campoId TEXT,valor TEXT);
    CREATE TABLE BpmCampoValorGlobal(id TEXT PRIMARY KEY,campoId TEXT,valor TEXT);
    CREATE TABLE BpmCardHistorico(id TEXT PRIMARY KEY,cardId TEXT,acao TEXT);
    CREATE TABLE usuarios(id INTEGER PRIMARY KEY,role TEXT,status TEXT);
    INSERT INTO usuarios VALUES(1,'Admin','ATIVO');
    INSERT INTO BpmCard VALUES('card',1,'${a.pipelineId}');
    INSERT INTO BpmCardCampoValor VALUES('answer','card','${a.campos[0].id}','2500');
    INSERT INTO BpmCardHistorico VALUES('history','card','CRIADO');
    INSERT INTO BpmPipeline VALUES('${a.pipelineId}','Revisão de Radar',1,31,'original');
    INSERT INTO BpmEtapa VALUES('${a.etapaId}','${a.pipelineId}','Em tratativa',1,'["FOLLOW_UP_SCHEDULER"]');
    INSERT INTO BpmEtapaFormulario VALUES('${a.formularioId}','${a.etapaId}',2,1,'original');
    INSERT INTO BpmFormularioSecao VALUES('${a.secaoId}','${a.formularioId}','dados_financeiro','Dados para o Financeiro');
  `);
  for (const [index, field] of a.campos.entries()) {
    await client.execute({ sql: "INSERT INTO BpmCampo VALUES(?,?,?,?,1,'CARD')", args: [field.id, a.pipelineId, field.chave, field.tipo] });
    await client.execute({ sql: "INSERT INTO BpmCampoEtapaConfig(id,campoId,etapaId,obrigatorioEntrada,ordem) VALUES(?,?,?,1,?)", args: [`closed-${index}`, field.id, a.fechadoId, index] });
    await client.execute({ sql: "INSERT INTO BpmCampoEtapaConfig(id,campoId,etapaId,ordem) VALUES(?,?,?,?)", args: [`meeting-${index}`, field.id, "reuniao-agendada", index] });
  }
  await client.execute({ sql: "INSERT INTO BpmCampoOpcao VALUES('pay',?,1,'À vista')", args: [a.campos[1].id] });
  for (let index = 0; index < 16; index++) {
    await client.execute({ sql: "INSERT INTO BpmFormularioComponente(id,secaoId,chave,tipo,campoId,ordem) VALUES(?,?,?,'CAMPO',?,?)", args: [`component-${index}`, a.secaoId, `field-${index}`, `existing-${index}`, index] });
    await client.execute({ sql: "INSERT INTO BpmCampoEtapaConfig(id,campoId,etapaId,ordem) VALUES(?,?,?,?)", args: [`config-${index}`, `existing-${index}`, a.etapaId, 100 + index] });
  }
  plan = await prepararContratacao(client, url);
  await exportBackup();
});
afterEach(async () => { client.close(); await rm(directory, { recursive: true, force: true }); });

describe("configuração aditiva de contratação em Em tratativa", () => {
  it("preview é determinístico e não grava nem associa campos", async () => {
    expect(await prepararContratacao(client, url)).toEqual(plan);
    expect(await count("BpmPipelineConfigAuditoria")).toBe(0);
    expect(await count("BpmFormularioComponente")).toBe(16);
  });
  it("aplica dois campos opcionais compartilhados, preserva obrigação de Fechado e permite retry sem duplicar", async () => {
    const receipt = await aplicarContratacao(client, url, plan, auth());
    expect(await verificarContratacao(client, url, receipt)).toEqual({ verified: true, pipelineVersion: 32, formVersion: 3 });
    expect(await aplicarContratacao(client, url, plan, auth())).toEqual(receipt);
    expect(await count("BpmPipelineConfigAuditoria")).toBe(1);
    const configs = (await client.execute({ sql: "SELECT campoId,visivel,editavel,somenteLeitura,obrigatorio,obrigatorioEntrada,obrigatorioSaida,ordem,grupo FROM BpmCampoEtapaConfig WHERE etapaId=? AND ordem>=116 ORDER BY ordem", args: [a.etapaId] })).rows;
    expect(configs).toEqual(a.campos.map((field, index) => ({ campoId: field.id, visivel: 1, editavel: 1, somenteLeitura: 0, obrigatorio: 0, obrigatorioEntrada: 0, obrigatorioSaida: 0, ordem: 116 + index, grupo: "Dados para o Financeiro" })));
    expect((await client.execute({ sql: "SELECT obrigatorioEntrada FROM BpmCampoEtapaConfig WHERE etapaId=?", args: [a.fechadoId] })).rows.every((row) => row.obrigatorioEntrada === 1)).toBe(true);
    expect((await client.execute("SELECT valor FROM BpmCardCampoValor WHERE id='answer'")).rows[0].valor).toBe("2500");
    expect(await count("BpmCampo")).toBe(2);
    expect(await count("BpmFormularioSecao")).toBe(1);
  });
  it("exige confirmação específica antes de escrever", async () => {
    await expect(aplicarContratacao(client, url, plan, { ...auth(), approval: "sim" })).rejects.toThrow("Confirmação específica");
    expect(await count("BpmFormularioComponente")).toBe(16);
  });
  it.each(["expired", "wrong-database", "incomplete", "corrupt"])("recusa backup %s", async (kind) => {
    const data = JSON.parse(await readFile(manifest, "utf8"));
    if (kind === "expired") data.generatedAt = new Date(Date.now() - 49 * 3600_000).toISOString();
    if (kind === "wrong-database") data.databaseHash = "outro";
    if (kind === "incomplete") data.tables -= 1;
    if (kind === "corrupt") await writeFile(backup, "corrompido");
    await writeFile(manifest, JSON.stringify(data));
    await expect(aplicarContratacao(client, url, plan, auth())).rejects.toThrow();
    expect(await count("BpmPipelineConfigAuditoria")).toBe(0);
  });
  it("detecta edição concorrente sem depender somente da versão", async () => {
    await client.execute("UPDATE BpmFormularioComponente SET configJson='alterado' WHERE id='component-0'");
    await expect(aplicarContratacao(client, url, plan, auth())).rejects.toThrow("Drift");
    expect((await client.execute("SELECT configVersion FROM BpmPipeline")).rows[0].configVersion).toBe(31);
  });
  it("uma falha no último INSERT desfaz versões e as quatro inserções", async () => {
    await client.executeMultiple("CREATE TRIGGER reject_audit BEFORE INSERT ON BpmPipelineConfigAuditoria BEGIN SELECT RAISE(ABORT,'test-failure'); END;");
    plan = await prepararContratacao(client, url); await exportBackup();
    await expect(aplicarContratacao(client, url, plan, auth())).rejects.toThrow("test-failure");
    expect(await count("BpmFormularioComponente")).toBe(16);
    expect((await client.execute("SELECT configVersion FROM BpmPipeline")).rows[0].configVersion).toBe(31);
  });
  it("rollback apaga somente os quatro registros criados e avança versões", async () => {
    const receipt = await aplicarContratacao(client, url, plan, auth());
    await exportBackup(); // backup completo novo, imediatamente anterior à reversão
    expect(await reverterContratacao(client, url, receipt, auth("REVERTER"))).toEqual({ reverted: true, pipelineVersion: 33, formVersion: 4 });
    expect(await count("BpmFormularioComponente")).toBe(16);
    expect(await count("BpmCampoEtapaConfig")).toBe(20);
    expect(await count("BpmPipelineConfigAuditoria")).toBe(2);
    await expect(aplicarContratacao(client, url, plan, auth())).rejects.toThrow("revertido");
  });
  it("rollback recusa conteúdo concorrente nos registros criados", async () => {
    const receipt = await aplicarContratacao(client, url, plan, auth());
    await client.execute({ sql: "UPDATE BpmCampoEtapaConfig SET grupo='Personalizado' WHERE id=?", args: [receipt.configIds[0]] });
    await expect(reverterContratacao(client, url, receipt, auth("REVERTER"))).rejects.toThrow("Drift");
    expect(await count("BpmFormularioComponente")).toBe(18);
  });
  it("rollback recusa novos valores desde a aplicação", async () => {
    const receipt = await aplicarContratacao(client, url, plan, auth());
    await client.execute("UPDATE BpmCardCampoValor SET valor='3000' WHERE id='answer'");
    await expect(reverterContratacao(client, url, receipt, auth("REVERTER"))).rejects.toThrow("Cards/valores mudaram");
    expect(await count("BpmFormularioComponente")).toBe(18);
  });
  it("não aceita plano modificado nem banco diferente", async () => {
    await expect(aplicarContratacao(client, "file:other", plan, auth())).rejects.toThrow("identidade");
    await expect(aplicarContratacao(client, url, { ...plan, formVersion: 22 }, auth())).rejects.toThrow("Fingerprint");
    await expect(validarBackupContratacao(plan, backup, manifest, Date.now() + 49 * 3600_000)).rejects.toThrow("vencido");
    expect(tables.length).toBe(plan.tableCount);
  });
});
