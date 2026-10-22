import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseSync } from "./node-sqlite";
import { createClient } from "@libsql/client";
import { PrismaClient, StatusItemChecklist } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { artifacts, assertApplyGates, applyPrepared, buildPlan, diagnose, hash, normalizeCode, planModelBootstrap, planStorage, planTestFolder, STATUSES } from "../../scripts/checklist-analistas/lib.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "checklist-analistas-schema-"));
const file = path.join(dir, "fixture.db");
const url = `file:${file}`;
const db = new DatabaseSync(file);
const base = readFileSync(path.join(import.meta.dirname, "fixtures/base-checklist.sql"), "utf8");
const migration = readFileSync(path.resolve("prisma/migrations/20261022143000_checklist_analistas_crm/migration.sql"), "utf8");
const client = createClient({ url });
const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
const gates = (input: Partial<Parameters<typeof assertApplyGates>[0]>) => assertApplyGates(input as Parameters<typeof assertApplyGates>[0]);

function seed() {
  db.exec(`
    INSERT INTO usuarios(id,nome,usuario,email,senha,role) VALUES(1,'Analista sintético','sintetico','sintetico@example.invalid','fixture','Operacional');
    INSERT INTO Cliente(id,razaoSocial,updatedAt) VALUES(1,'Empresa sintética',CURRENT_TIMESTAMP);
    INSERT INTO ClienteOperacional(id,nome,email,senha) VALUES('conta','Conta sintética','conta@example.invalid','legacy-fixture');
    INSERT INTO PastaChecklist(id,nome,updatedAt) VALUES('teste-id','Teste',CURRENT_TIMESTAMP);
    INSERT INTO operacional_clientes(id,embasamento,clienteId,clienteOperacionalId,pastaChecklistId,tipo,updatedAt)
    VALUES('atendimento','RECEITA_BRUTA_DAS',1,'conta','teste-id','RECEITA_BRUTA_DAS',CURRENT_TIMESTAMP);
    INSERT INTO Checklist(id,empresaId,tipo,atualizadoEm) VALUES('checklist','atendimento','RECEITA_BRUTA_DAS',CURRENT_TIMESTAMP);
    INSERT INTO ModeloItemChecklist(id,tipo,codigo,nome,secao,updatedAt) VALUES('modelo',NULL,'Doc 01','Documento sintético','CONSTITUICAO',CURRENT_TIMESTAMP);
    INSERT INTO ItemChecklist(id,checklistId,modeloItemId,codigo,secao,descricao,status,observacao,atualizadoEm)
    VALUES('item','checklist','modelo','Doc 01','CONSTITUICAO','Snapshot original','FALAR_DR_EDVAN','Preservar',CURRENT_TIMESTAMP);
    INSERT INTO DocumentoChecklist(id,itemId,nome,url) VALUES('documento','item','sintetico.pdf','https://fixture.invalid/a.pdf');
    INSERT INTO BpmCard(id,empresaId) VALUES('card-a',1),('card-b',1);
  `);
}

beforeAll(() => { db.exec(base); seed(); });
afterAll(async () => { await prisma.$disconnect(); client.close(); db.close(); rmSync(dir, { recursive: true, force: true }); });

describe.sequential("contrato aditivo CheckList Analistas", () => {
  it("diagnostica base canônica sem efetuar mutação ou inferir dono", async () => {
    const before = db.prepare("SELECT total_changes() n").get()!.n;
    const result = await diagnose(client);
    expect(result).toMatchObject({ canonical: true, state: "NOT_APPLIED", blockers: [], mutationCount: 0 });
    expect(result.counts).toMatchObject({ operationalRecords: 1, unassignedOwners: 1, accountsPlaintext: 1 });
    expect(db.prepare("SELECT total_changes() n").get()!.n).toBe(before);
    expect(JSON.stringify(result)).not.toContain("Empresa sintética");
    expect(JSON.stringify(result)).not.toContain("legacy-fixture");
  });

  it("SQL é estritamente aditivo e preserva instâncias, senha, pasta, texto e status", async () => {
    expect(migration.replace(/^--.*$/gm, "")).not.toMatch(/^\s*(DROP|DELETE|UPDATE|INSERT)\b|RENAME\s+TO|foreign_keys\s*=\s*OFF/im);
    db.exec(`BEGIN; ${migration} COMMIT;`);
    expect(db.prepare("SELECT analistaId,revision,pastaChecklistId FROM operacional_clientes").get()).toMatchObject({ analistaId: null, revision: 0, pastaChecklistId: "teste-id" });
    expect(db.prepare("SELECT senha,senhaHash FROM ClienteOperacional").get()).toMatchObject({ senha: "legacy-fixture", senhaHash: null });
    expect(db.prepare("SELECT status,descricao,observacao,modeloItemId,modeloRevisaoId FROM ItemChecklist").get()).toMatchObject({ status: "FALAR_DR_EDVAN", descricao: "Snapshot original", observacao: "Preservar", modeloItemId: "modelo", modeloRevisaoId: null });
    expect(db.prepare("SELECT identidadeId,versao FROM ModeloItemChecklist").get()).toMatchObject({ identidadeId: null, versao: 1 });
    expect(db.prepare("SELECT storageAccess,url FROM DocumentoChecklist").get()).toMatchObject({ storageAccess: null, url: "https://fixture.invalid/a.pdf" });
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(await diagnose(client)).toMatchObject({ canonical: true, state: "APPLIED", blockers: [] });
  });

  it("DDL aplicado corresponde ao schema canônico em colunas, índices e FKs", () => {
    const sql = execFileSync(path.resolve("node_modules/.bin/prisma"), ["migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, env: { ...process.env, DATABASE_URL: "file:/tmp/checklist-parity-unused.db" } });
    const expected = new DatabaseSync(":memory:");
    try {
      expected.exec(sql);
      const tables = ["ClienteOperacional", "operacional_clientes", "Checklist", "ModeloItemChecklist", "ItemChecklist", "DocumentoChecklist", "NotificacaoCliente", "Auditoria", "ModeloChecklistIdentidade", "ChecklistCrmVinculo", "ChecklistEvento", "ChecklistEventoLeitura", "ChecklistUploadRecibo"];
      const rows = (connection: DatabaseSync, pragma: string) => connection.prepare(pragma).all().map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !["cid", "id", "seq"].includes(key)))).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      for (const table of tables) {
        expect(rows(db, `PRAGMA table_info("${table}")`), table).toEqual(rows(expected, `PRAGMA table_info("${table}")`));
        expect(rows(db, `PRAGMA foreign_key_list("${table}")`), table).toEqual(rows(expected, `PRAGMA foreign_key_list("${table}")`));
        const indexNames = (connection: DatabaseSync) => connection.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=? ORDER BY name`).all(table).map((row) => row.name);
        expect(indexNames(db), table).toEqual(indexNames(expected));
      }
    } finally { expected.close(); }
  });

  it("Prisma decodifica os 11 status e mantém os dois status legados", async () => {
    expect(Object.values(StatusItemChecklist).sort()).toEqual([...STATUSES].sort());
    for (const status of STATUSES) {
      db.prepare("UPDATE ItemChecklist SET status=? WHERE id='item'").run(status);
      expect((await prisma.itemChecklist.findUnique({ where: { id: "item" }, select: { status: true } }))!.status).toBe(status);
    }
  });

  it("owner FK aceita null e impede usuário inexistente; CAS consome só uma revisão", () => {
    expect(() => db.exec("UPDATE operacional_clientes SET analistaId=999 WHERE id='atendimento'")).toThrow();
    db.exec("UPDATE operacional_clientes SET analistaId=1 WHERE id='atendimento'");
    expect(db.prepare("UPDATE operacional_clientes SET revision=revision+1 WHERE id=? AND revision=?").run("atendimento", 0).changes).toBe(1);
    expect(db.prepare("UPDATE operacional_clientes SET revision=revision+1 WHERE id=? AND revision=?").run("atendimento", 0).changes).toBe(0);
  });

  it("não impõe unicidade por empresa master/conta e permite dois cards no mesmo dossiê", () => {
    db.exec("INSERT INTO operacional_clientes(id,embasamento,clienteId,clienteOperacionalId,updatedAt) VALUES('atendimento-2','RECEITA_BRUTA_DAS',1,'conta',CURRENT_TIMESTAMP)");
    db.exec("INSERT INTO ChecklistCrmVinculo(id,cardId,empresaOperacionalId,updatedAt) VALUES('link-a','card-a','atendimento',CURRENT_TIMESTAMP),('link-b','card-b','atendimento',CURRENT_TIMESTAMP)");
    expect(() => db.exec("INSERT INTO ChecklistCrmVinculo(id,cardId,empresaOperacionalId,updatedAt) VALUES('link-c','card-a','atendimento-2',CURRENT_TIMESTAMP)")).toThrow();
    expect(db.prepare("SELECT count(*) n FROM ChecklistCrmVinculo WHERE empresaOperacionalId='atendimento'").get()!.n).toBe(2);
  });

  it("mutationId, revisão agregada, leitura e notificação têm unicidade persistente", () => {
    const insert = db.prepare("INSERT INTO ChecklistEvento(id,mutationId,payloadHash,agregadoTipo,agregadoId,revision,tipo,empresaId,atorTipo,atorUsuarioId) VALUES(?,?,?,'ATENDIMENTO','atendimento',?,'ITEM_ATUALIZADO','atendimento','USUARIO',1)");
    insert.run("event-1", "mutation-1", hash("payload-1"), 2);
    expect(() => insert.run("event-2", "mutation-1", hash("payload-2"), 3)).toThrow();
    expect(() => insert.run("event-3", "mutation-3", hash("payload-3"), 2)).toThrow();
    db.exec("INSERT INTO ChecklistEventoLeitura(id,eventoId,usuarioId) VALUES('read-1','event-1',1)");
    expect(() => db.exec("INSERT INTO ChecklistEventoLeitura(id,eventoId,usuarioId) VALUES('read-2','event-1',1)")).toThrow();
    db.exec("INSERT INTO NotificacaoCliente(id,clienteId,tipo,titulo,empresaId,eventoId) VALUES('notif-1','conta','STATUS','Sintética','atendimento','event-1')");
    expect(() => db.exec("INSERT INTO NotificacaoCliente(id,clienteId,tipo,titulo,empresaId,eventoId) VALUES('notif-2','conta','STATUS','Sintética','atendimento','event-1')")).toThrow();
    db.exec("INSERT INTO Auditoria(userId,acao,checklistEventoId) VALUES(1,'Checklist:ITEM_ATUALIZADO','event-1')");
    expect(db.prepare("SELECT count(*) n FROM Auditoria WHERE checklistEventoId='event-1'").get()!.n).toBe(1);
  });

  it("recibo relaciona objeto/documento único e preserva autoria; exclusão não apaga journal", () => {
    db.exec("INSERT INTO ChecklistUploadRecibo(id,tokenHash,empresaId,itemId,clienteOperacionalId,storageProvider,storageKey,nome,tamanhoBytes,mimeType,expiresAt,documentoId,updatedAt) VALUES('recibo','token-hash','atendimento','item','conta','fixture','key-1','sintetico.pdf',3,'application/pdf','2099-01-01','documento',CURRENT_TIMESTAMP)");
    expect(() => db.exec("INSERT INTO ChecklistUploadRecibo(id,tokenHash,empresaId,itemId,storageProvider,storageKey,nome,tamanhoBytes,mimeType,expiresAt,documentoId,updatedAt) VALUES('recibo-2','token-hash-2','atendimento','item','fixture','key-2','sintetico.pdf',3,'application/pdf','2099-01-01','documento',CURRENT_TIMESTAMP)")).toThrow();
    expect(() => db.exec("DELETE FROM DocumentoChecklist WHERE id='documento'")).toThrow();
    expect(() => db.exec("DELETE FROM ChecklistEvento WHERE id='event-1'")).toThrow();
  });

  it("catálogo diagnostica colisão normalizada sem fundir, propagar ou expor código", async () => {
    expect(normalizeCode("  Dóc - 01 ")).toBe("DOC_01");
    db.exec("INSERT INTO ModeloItemChecklist(id,codigo,nome,secao,updatedAt) VALUES('colisao','Dóc-01','Sintético','CONSTITUICAO',CURRENT_TIMESTAMP)");
    const result = await planModelBootstrap(client);
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0].map((item: { id: string }) => item.id).sort()).toEqual(["colisao", "modelo"]);
    expect(JSON.stringify(result)).not.toContain("DOC_01");
    expect(db.prepare("SELECT count(*) n FROM ItemChecklist").get()!.n).toBe(1);
    db.exec("DELETE FROM ModeloItemChecklist WHERE id='colisao'");
    expect((await buildPlan("bootstrap-modelos", client)).planSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("várias revisões da mesma identidade não viram falsa colisão de legado", async () => {
    db.exec("INSERT INTO ModeloChecklistIdentidade(id,escopo,codigoNormalizado,updatedAt) VALUES('identity','GLOBAL','DOC_01',CURRENT_TIMESTAMP)");
    db.exec("UPDATE ModeloItemChecklist SET identidadeId='identity' WHERE id='modelo'");
    db.exec("INSERT INTO ModeloItemChecklist(id,codigo,nome,secao,identidadeId,versao,updatedAt) VALUES('rev2','Doc 01','Sintético','CONSTITUICAO','identity',2,CURRENT_TIMESTAMP)");
    expect((await planModelBootstrap(client)).collisions).toEqual([]);
    expect(() => db.exec("INSERT INTO ModeloItemChecklist(id,codigo,nome,secao,identidadeId,versao,updatedAt) VALUES('rev3','Doc 01','Sintético','CONSTITUICAO','identity',2,CURRENT_TIMESTAMP)")).toThrow();
  });

  it("Teste/storage geram apenas plano com IDs/counts, sem payload ou mutação", async () => {
    const before = readFileSync(file);
    expect(await planTestFolder(client)).toMatchObject({ folders: [{ id: "teste-id", companies: 1, checklists: 1, documents: 1 }], virtualSemPasta: "FILTRO_VIRTUAL_NAO_EXCLUIR", mutationCount: 0 });
    expect(await planStorage(client)).toMatchObject({ documents: 1, legacyWithoutPrivateMetadata: 1, copies: 0, objectReads: 0, deletes: 0 });
    expect(readFileSync(file)).toEqual(before);
  });

  it("nega aplicação sem gates e sem ambiente staging comprovado", async () => {
    await expect(applyPrepared(client, "schema", "invalid", undefined)).rejects.toThrow("GATES_OBRIGATORIOS");
    await expect(gates({ environment: "production" })).rejects.toThrow("AMBIENTE_STAGING_NAO_COMPROVADO");
    await expect(gates({ environment: "staging", panelOrigin: "https://staging.alpha-comex.com", databaseUrl: url, stagingFingerprint: "wrong" })).rejects.toThrow("FINGERPRINT_STAGING_DIVERGENTE");
    await expect(gates({ environment: "staging", panelOrigin: "https://staging.alpha-comex.com", databaseUrl: url, stagingFingerprint: hash(url) })).rejects.toThrow("EVIDENCIAS_VAULT_BACKUP_CONSENTIMENTO_OBRIGATORIAS");
  });

  it("CLI default é dry-run; apply sem .env.staging explícito falha fechado", () => {
    const cli = path.resolve("scripts/checklist-analistas/cli.mjs");
    const output = JSON.parse(execFileSync(process.execPath, [cli], { encoding: "utf8" }));
    expect(output).toMatchObject({ mode: "dry-run", connected: false, mutations: 0 });
    expect(() => execFileSync(process.execPath, [cli, "plan", "--apply"], { stdio: "pipe" })).toThrow();
    expect(() => execFileSync(process.execPath, [cli, "diagnose", "--env-file", ".env.local"], { stdio: "pipe" })).toThrow();
  });

  it("plano estável é amarrado ao artefato SQL e não executa rollback destrutivo", async () => {
    const art = await artifacts();
    expect((await buildPlan("schema")).operationPlan).toMatchObject({ migrationSha256: hash(migration), schemaSha256: art.schemaSha256 });
    const result = JSON.parse(execFileSync(process.execPath, [path.resolve("scripts/checklist-analistas/cli.mjs"), "rollback"], { encoding: "utf8" }));
    expect(result).toMatchObject({ executed: false, mutations: 0, requiresBackup: true });
  });
});
