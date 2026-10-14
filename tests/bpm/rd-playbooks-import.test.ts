import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/react";
import { composePlaybooks, PLAYBOOK_DESTINATIONS, PLAYBOOK_SOURCES, type SourcePlaybook } from "../../scripts/lib/rd-playbooks";
import { desserializarScriptEtapa, serializarScriptEtapa, scriptEtapaPersistidoValido } from "@/lib/bpm/script-etapa";
const guide = (overrides: Partial<SourcePlaybook> = {}): SourcePlaybook => ({
  id: "synthetic-guide-a", name: "Atendimento", pipeline: "Funil sintético", objective: "Confirmar necessidade", description: "Orientação inicial\n\nPróxima orientação", ...overrides,
});
const nodes = (content: JSONContent): JSONContent[] => [content, ...(content.content ?? []).flatMap(nodes)];

describe("composição dos playbooks na superfície Scripts", () => {
  it("possui correspondência explícita de 14 IDs para 10 etapas e não infere destino por nome", () => {
    expect(Object.keys(PLAYBOOK_DESTINATIONS)).toHaveLength(14);
    expect(new Set(Object.values(PLAYBOOK_DESTINATIONS).map(([pipeline, etapa]) => `${pipeline}/${etapa}`)).size).toBe(10);
    expect(Object.values(PLAYBOOK_DESTINATIONS).every(([pipeline, etapa]) => pipeline.trim() && etapa.trim())).toBe(true);
    expect(PLAYBOOK_DESTINATIONS["Atendimento"]).toBeUndefined();
    expect(PLAYBOOK_DESTINATIONS["unknown-synthetic-id"]).toBeUndefined();
  });
  it("preserva texto legado e parágrafos sem expor marcadores ou IDs técnicos na apresentação", () => {
    const output = composePlaybooks("Texto nativo\nSegunda linha", [guide()]);
    expect(scriptEtapaPersistidoValido(output)).toBe(true);
    const parsed = desserializarScriptEtapa(output);
    expect(parsed.plainText.startsWith("Texto nativo\nSegunda linha")).toBe(true);
    expect(parsed.plainText).toContain("Origem: Funil sintético / Atendimento");
    expect(parsed.plainText).not.toContain("synthetic-guide-a");
    expect(parsed.plainText).not.toContain("SCRIPT_NOTE_V1");
    expect(parsed.content.content?.slice(0, 2)).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Texto nativo" }] },
      { type: "paragraph", content: [{ type: "text", text: "Segunda linha" }] },
    ]);
  });
  it("preserva exatamente conteúdo estruturado, lista e link seguro preexistentes", () => {
    const existing: JSONContent = { type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Guia nativo" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Consultar documentação", marks: [{ type: "link", attrs: { href: "https://example.com/guia" } }, { type: "bold" }] }] }] }] },
    ] };
    const snapshot = JSON.stringify(existing);
    const output = composePlaybooks(serializarScriptEtapa(existing, "Guia nativo\nConsultar documentação"), [guide()]);
    const parsed = desserializarScriptEtapa(output);
    expect(parsed.content.content?.slice(0, existing.content!.length)).toEqual(existing.content);
    expect(JSON.stringify(existing)).toBe(snapshot);
    expect(scriptEtapaPersistidoValido(output)).toBe(true);
  });
  it("agrupa guias com conteúdo exatamente igual, preservando todas as origens", () => {
    const first = guide();
    const second = guide({ id: "synthetic-guide-b", name: "Atendimento complementar", pipeline: "Outro funil" });
    const parsed = desserializarScriptEtapa(composePlaybooks(null, [first, second]));
    expect(parsed.plainText.split("Confirmar necessidade")).toHaveLength(2);
    expect(parsed.plainText.split("Orientação inicial")).toHaveLength(2);
    expect(parsed.plainText).toContain("Funil sintético / Atendimento; Outro funil / Atendimento complementar");
    expect(nodes(parsed.content).filter((node) => node.type === "heading" && node.content?.some((child) => child.text?.startsWith("Orientação RD")))).toHaveLength(1);
  });
  it("não perde orientações diferentes convergindo à mesma etapa", () => {
    const parsed = desserializarScriptEtapa(composePlaybooks(null, [guide(), guide({ id: "synthetic-guide-b", description: "Outra instrução distinta" })]));
    expect(parsed.plainText).toContain("Orientação inicial");
    expect(parsed.plainText).toContain("Outra instrução distinta");
    expect(nodes(parsed.content).filter((node) => node.type === "heading" && node.content?.some((child) => child.text?.startsWith("Orientação RD")))).toHaveLength(2);
  });
  it("corrige mojibake da origem sem reescrever o script nativo", () => {
    const parsed = desserializarScriptEtapa(composePlaybooks("Empréstimo nativo", [guide({ name: "EmprÃ©stimo", objective: "RevisÃ£o", description: "OrientaÃ§Ã£o" })]));
    expect(parsed.plainText).toContain("Empréstimo nativo");
    expect(parsed.plainText).toContain("Orientação RD — Empréstimo");
    expect(parsed.plainText).toContain("Revisão");
    expect(parsed.plainText).toContain("Orientação");
    expect(parsed.plainText).not.toContain("Ã");
  });
  it("trata HTML da origem como texto inerte e não cria obrigações ou nós executáveis", () => {
    const malicious = '<script>alert(1)</script> <a href="javascript:alert(2)">clique</a>';
    const parsed = desserializarScriptEtapa(composePlaybooks(null, [guide({ description: malicious })]));
    const all = nodes(parsed.content);
    expect(all.some((node) => ["script", "iframe", "image", "taskList", "taskItem"].includes(node.type ?? ""))).toBe(false);
    expect(all.some((node) => node.marks?.some((mark) => mark.type === "link"))).toBe(false);
    expect(all.some((node) => node.type === "text" && node.text === malicious)).toBe(true);
  });
  it("recusa wrapper estruturado corrompido e links inseguros existentes", () => {
    expect(() => composePlaybooks("SCRIPT_NOTE_V1:{corrompido", [guide()])).toThrow("existente inválido");
    const malicious = serializarScriptEtapa({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Perigoso", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] }, "Perigoso");
    expect(() => composePlaybooks(malicious, [guide()])).toThrow("existente inválido");
  });
  it("bloqueia composição acima do limite sem truncar o conteúdo", () => {
    expect(() => composePlaybooks("x".repeat(7990), [guide()])).toThrow();
    expect(() => composePlaybooks(null, [guide({ description: "x".repeat(8001) })])).toThrow();
  });
  it("produz resultado estável para a mesma composição, sem modificar fontes", () => {
    const guides = [guide(), guide({ id: "synthetic-b", description: "Outra instrução" })];
    const source = JSON.stringify(guides);
    expect(composePlaybooks("Nativo", guides)).toBe(composePlaybooks("Nativo", guides));
    expect(JSON.stringify(guides)).toBe(source);
  });
});


const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => { exec(sql: string): void; close(): void; prepare(sql: string): { get(): Record<string, unknown> | undefined; all(): Record<string, unknown>[] } };
};
const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
function cliFixture() {
  const dir = mkdtempSync(join(tmpdir(), "rd-playbook-cli-")); directories.push(dir);
  const dbPath = join(dir, "test.db"), url = `file:${dbPath}`, planPath = join(dir, "plan.json"), sourcePath = join(dir, "source.json"), backup = join(dir, "backup.sql");
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const pipelines = [...new Set(Object.values(PLAYBOOK_DESTINATIONS).map(([pipeline]) => pipeline))];
  const stages = [...new Map(Object.values(PLAYBOOK_DESTINATIONS).map(([pipeline, etapa]) => [`${pipeline}/${etapa}`, [pipeline, etapa] as const])).values()];
  let dump = `CREATE TABLE BpmPipeline (id TEXT PRIMARY KEY,nome TEXT,configVersion INTEGER,updatedAt TEXT);
CREATE TABLE BpmEtapa (id TEXT PRIMARY KEY,pipelineId TEXT,nome TEXT,script TEXT,updatedAt TEXT,ativo INTEGER);
CREATE TABLE BpmImportacaoExterna (id TEXT PRIMARY KEY,provider TEXT,fingerprint TEXT,status TEXT,resumoJson TEXT,iniciadoEm TEXT,concluidoEm TEXT);`;
  pipelines.forEach((name, i) => { dump += `INSERT INTO BpmPipeline VALUES ('p${i}',${quote(name)},4,'2026-01-01T00:00:00.000Z');`; });
  stages.forEach(([pipeline, etapa], i) => { dump += `INSERT INTO BpmEtapa VALUES ('s${i}','p${pipelines.indexOf(pipeline)}',${quote(etapa)},'Texto nativo ${i}','2026-01-01T00:00:00.000Z',1);`; });
  const db = new DatabaseSync(dbPath); db.exec(dump); db.close();
  writeFileSync(sourcePath, JSON.stringify(Object.keys(PLAYBOOK_DESTINATIONS).map((id, i) => ({ ...guide({ id, name: PLAYBOOK_SOURCES[id].name, pipeline: PLAYBOOK_SOURCES[id].pipeline, description: `Orientação de teste ${i}` }), deal_pipeline: { id: PLAYBOOK_SOURCES[id].pipelineId } }))));
  writeFileSync(backup, dump);
  writeFileSync(backup.replace(".sql", ".manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), databaseHash: sha(url), sha256: sha(dump), sizeBytes: Buffer.byteLength(dump), tables: 3, totalRows: 13 }));
  const run = (mode: string, args: string[] = []) => spawnSync(process.execPath, ["--import", "tsx", "scripts/importar-playbooks-rd-alpha.mts", mode, `--plan=${planPath}`, `--source=${sourcePath}`, ...args], { cwd: process.cwd(), env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "" }, encoding: "utf8", timeout: 15000 });
  const query = (sql: string) => { const db = new DatabaseSync(dbPath); try { return db.prepare(sql).all(); } finally { db.close(); } };
  const exec = (sql: string) => { const db = new DatabaseSync(dbPath); try { db.exec(sql); } finally { db.close(); } };
  const preview = run("preview"); expect(preview.stderr + preview.stdout, "prévia sintética").not.toContain("Error:"); expect(preview.status).toBe(0);
  const plan = JSON.parse(readFileSync(planPath, "utf8")) as { fingerprint: string; summary: { guides: number; stages: number; pipelines: number } };
  const apply = () => run("apply", [`--confirm=${plan.fingerprint}`, `--backup=${backup}`]);
  const rollback = () => run("rollback", [`--confirm=rollback:${plan.fingerprint}`, `--backup=${backup}`]);
  return { dir, plan, planPath, sourcePath, backup, run, query, exec, apply, rollback };
}

describe("CLI playbooks com banco e backup sintéticos reais", () => {
  it("aplica 14 guias em 10 etapas, preserva nativos, verifica e reverte com auditoria idempotente", () => {
    const f = cliFixture();
    expect(f.plan.summary).toEqual({ guides: 14, stages: 10, pipelines: 3 });
    const applied = f.apply(); expect(applied.stderr + applied.stdout).not.toContain("Error:"); expect(applied.status).toBe(0);
    f.query("SELECT id,script FROM BpmEtapa").forEach((row) => { expect(desserializarScriptEtapa(String(row.script)).plainText).toContain(`Texto nativo ${String(row.id).slice(1)}`); });
    expect(f.query("SELECT configVersion FROM BpmPipeline").every((row) => row.configVersion === 5)).toBe(true);
    expect(f.apply().stdout).toContain("JA_APLICADO");
    expect(f.query("SELECT id FROM BpmImportacaoExterna")).toHaveLength(1);
    const verified = f.run("verify"); expect(verified.status).toBe(0); expect(JSON.parse(verified.stdout)).toMatchObject({ applied: true, checks: 13, matching: 13, differing: 0 });
    expect(f.rollback().status).toBe(0); expect(f.rollback().stdout).toContain("JA_REVERTIDO");
    f.query("SELECT id,script FROM BpmEtapa").forEach((row) => expect(row.script).toBe(`Texto nativo ${String(row.id).slice(1)}`));
    expect(f.query("SELECT configVersion FROM BpmPipeline").every((row) => row.configVersion === 6)).toBe(true);
    expect(f.query("SELECT id FROM BpmImportacaoExterna")).toHaveLength(2);
    expect(f.apply().status).not.toBe(0);
  }, 15000);
  it("recusa confirmação ausente, backup adulterado e alteração humana após prévia sem escrever parcialmente", () => {
    const f = cliFixture();
    expect(f.run("apply", [`--backup=${f.backup}`]).status).not.toBe(0);
    f.exec("UPDATE BpmEtapa SET script='Edição humana' WHERE id='s9'");
    const conflict = f.apply(); expect(conflict.status).not.toBe(0); expect(conflict.stderr).toContain("Conflito");
    expect(f.query("SELECT id FROM BpmImportacaoExterna")).toHaveLength(0);
    expect(f.query("SELECT script FROM BpmEtapa WHERE id='s0'")[0].script).toBe("Texto nativo 0");
    writeFileSync(f.backup, "corrompido");
    expect(f.apply().stderr).toContain("divergentes");
  }, 15000);
  it("rollback protege edição humana posterior e verify distingue aplicação de estado atual", () => {
    const f = cliFixture(); expect(f.apply().status).toBe(0);
    f.exec("UPDATE BpmEtapa SET script='Revisão humana posterior' WHERE id='s0'");
    const reverted = f.rollback(); expect(reverted.status).not.toBe(0); expect(reverted.stderr).toContain("Conflito");
    expect(f.query("SELECT script FROM BpmEtapa WHERE id='s0'")[0].script).toBe("Revisão humana posterior");
    expect(f.query("SELECT id FROM BpmImportacaoExterna")).toHaveLength(1);
    const verify = f.run("verify"); expect(verify.status).toBe(2); expect(JSON.parse(verify.stdout)).toMatchObject({ applied: true, matching: 12, differing: 1 });
  }, 15000);
  it("falha ao registrar auditoria desfaz todas as etapas e versões na mesma transação", () => {
    const f = cliFixture();
    f.exec("CREATE TRIGGER bloquear_auditoria BEFORE INSERT ON BpmImportacaoExterna BEGIN SELECT RAISE(ABORT,'falha sintética'); END;");
    expect(f.apply().status).not.toBe(0);
    f.query("SELECT id,script FROM BpmEtapa").forEach((row) => expect(row.script).toBe(`Texto nativo ${String(row.id).slice(1)}`));
    expect(f.query("SELECT configVersion FROM BpmPipeline").every((row) => row.configVersion === 4)).toBe(true);
    expect(f.query("SELECT id FROM BpmImportacaoExterna")).toHaveLength(0);
  }, 15000);
  it("identidade de origem adulterada e inventário incompleto bloqueiam a prévia", () => {
    const f = cliFixture();
    const source = JSON.parse(readFileSync(f.sourcePath, "utf8")) as Array<{ name: string }>;
    source[0].name = "Nome divergente";
    writeFileSync(f.sourcePath, JSON.stringify(source));
    expect(f.run("preview").stderr).toContain("Identidade de origem divergente");
    writeFileSync(f.sourcePath, JSON.stringify(source.slice(1)));
    expect(f.run("preview").stderr).toContain("14 guias mapeados");
    expect(f.query("SELECT id FROM BpmImportacaoExterna")).toHaveLength(0);
  }, 15000);
  it("prévia bloqueia destino ausente, duplicado ou fora do pipeline e ledger impede duplicar em outro plano", () => {
    const f = cliFixture();
    f.exec("UPDATE BpmEtapa SET pipelineId='inexistente' WHERE id='s0'");
    expect(f.run("preview").stderr).toContain("Destino ausente ou ambíguo");
    f.exec("UPDATE BpmEtapa SET pipelineId='p0' WHERE id='s0'");
    f.exec("INSERT INTO BpmEtapa SELECT 'duplicado',pipelineId,nome,script,updatedAt,ativo FROM BpmEtapa WHERE id='s0'");
    expect(f.run("preview").stderr).toContain("Destino ausente ou ambíguo");
    f.exec("DELETE FROM BpmEtapa WHERE id='duplicado'");
    expect(f.apply().status).toBe(0);
    expect(f.run("preview").stderr).toContain("já importados");
  }, 15000);
});
