import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { expect, it } from "vitest";

it("valida migration em memória: backfill idempotente, unicidade e integridade referencial", async () => {
  const db = createClient({ url: "file::memory:" });
  try {
    await db.executeMultiple(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE BpmEtapa (id TEXT PRIMARY KEY);
      CREATE TABLE BpmChecklistTemplate (id TEXT PRIMARY KEY, etapaId TEXT);
      INSERT INTO BpmEtapa VALUES ('a'), ('b');
      INSERT INTO BpmChecklistTemplate VALUES ('legado', 'a'), ('global', NULL);
    `);
    const migration = readFileSync("prisma/migrations/20260908214000_bpm_checklist_template_multiplas_etapas/migration.sql", "utf8");
    await db.executeMultiple(migration);
    await db.executeMultiple(migration);
    expect((await db.execute("SELECT templateId, etapaId FROM BpmChecklistTemplateEtapa")).rows).toEqual([
      expect.objectContaining({ templateId: "legado", etapaId: "a" }),
    ]);
    const insert = (id: string, templateId: string, etapaId: string) => db.execute({
      sql: "INSERT INTO BpmChecklistTemplateEtapa (id, templateId, etapaId) VALUES (?, ?, ?)",
      args: [id, templateId, etapaId],
    });
    await expect(insert("duplicado", "legado", "a")).rejects.toThrow(/UNIQUE/);
    await expect(insert("orfao", "ausente", "a")).rejects.toThrow(/FOREIGN KEY/);
    await expect(insert("etapa-ausente", "legado", "ausente")).rejects.toThrow(/FOREIGN KEY/);
    await insert("segunda", "legado", "b");
    await expect(db.execute("DELETE FROM BpmEtapa WHERE id = 'a'")).rejects.toThrow(/FOREIGN KEY/);
    expect((await db.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
    const indices = (await db.execute("PRAGMA index_list('BpmChecklistTemplateEtapa')")).rows;
    expect(indices.filter((row) => String(row.name).startsWith("BpmChecklistTemplateEtapa_"))).toHaveLength(3);
    await db.execute("DELETE FROM BpmChecklistTemplate WHERE id = 'legado'");
    expect((await db.execute("SELECT * FROM BpmChecklistTemplateEtapa")).rows).toHaveLength(0);
    expect((await db.execute("SELECT id FROM BpmChecklistTemplate")).rows).toEqual([expect.objectContaining({ id: "global" })]);
    expect((await db.execute("PRAGMA integrity_check")).rows[0].integrity_check).toBe("ok");
  } finally {
    db.close();
  }
});
