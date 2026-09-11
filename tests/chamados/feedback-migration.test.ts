import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";

const CAMINHO_MIGRATION =
  "prisma/migrations/20260911131500_chamados_feedback_preferencia_prazo/migration.sql";
const CAMINHO_MIGRATION_TRIGGERS =
  "prisma/migrations/20260911133500_chamados_feedback_resposta_bool_triggers/migration.sql";

describe("migration de feedback dos chamados", () => {
  it("é aditiva, preserva chamados e aplica FKs/índice/constraints", async () => {
    const client = createClient({ url: "file::memory:" });
    try {
      await client.executeMultiple(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT NOT NULL);
        CREATE TABLE chamados (
          id INTEGER PRIMARY KEY,
          titulo TEXT NOT NULL,
          usuarioId INTEGER NOT NULL,
          status TEXT NOT NULL,
          closedAt DATETIME
        );
        INSERT INTO usuarios (id, nome) VALUES (1, 'Solicitante'), (3, 'Técnico');
        INSERT INTO chamados (id, titulo, usuarioId, status) VALUES
          (10, 'Legado', 1, 'ABERTO'),
          (11, 'Outro legado', 1, 'ABERTO');
      `);

      const migration = readFileSync(CAMINHO_MIGRATION, "utf8");
      expect(migration).not.toMatch(/^\s*(?:DROP|RENAME|UPDATE|DELETE|INSERT)\b/im);
      await client.executeMultiple(migration);

      const migrationTriggers = readFileSync(CAMINHO_MIGRATION_TRIGGERS, "utf8");
      expect(migrationTriggers).not.toMatch(/^\s*(?:DROP|RENAME|UPDATE|DELETE|INSERT|ALTER)\b/im);
      await client.executeMultiple(migrationTriggers);

      expect((await client.execute("SELECT id, titulo, status FROM chamados ORDER BY id")).rows).toEqual([
        expect.objectContaining({ id: 10, titulo: "Legado", status: "ABERTO" }),
        expect.objectContaining({ id: 11, titulo: "Outro legado", status: "ABERTO" }),
      ]);
      const colunas = (await client.execute("PRAGMA table_info('chamados')")).rows.map((row) => row.name);
      expect(colunas).toEqual(expect.arrayContaining(["dataDesejadaConclusao", "tecnicoSolicitadoId"]));
      expect((await client.execute("PRAGMA index_list('chamados')")).rows).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "chamados_tecnicoSolicitadoId_idx", unique: 0 })]),
      );
      expect((await client.execute("PRAGMA foreign_key_list('chamados')")).rows).toEqual(
        expect.arrayContaining([expect.objectContaining({
          table: "usuarios",
          from: "tecnicoSolicitadoId",
          to: "id",
          on_delete: "SET NULL",
        })]),
      );
      expect((await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
      )).rows).toEqual([
        expect.objectContaining({ name: "chamados_feedback_respondido_solucao_insert" }),
        expect.objectContaining({ name: "chamados_feedback_respondido_solucao_update" }),
      ]);

      await expect(client.execute({
        sql: `INSERT INTO chamados_feedback
          (chamadoId, status, notaRapidezResposta, notaPrazoConclusao,
           solucionadaComoEsperado, notaQualidadeSolucao, decidedAt)
          VALUES (?, 'RESPONDIDO', 5, 5, NULL, 5, CURRENT_TIMESTAMP)`,
        args: [10],
      })).rejects.toThrow(/exige resposta sobre a solução esperada/);

      await client.execute({
        sql: "INSERT INTO chamados_feedback (chamadoId, status) VALUES (?, 'PENDENTE')",
        args: [11],
      });
      await expect(client.execute({
        sql: `UPDATE chamados_feedback
          SET status = 'RESPONDIDO', notaRapidezResposta = 4,
              notaPrazoConclusao = 4, decidedAt = CURRENT_TIMESTAMP
          WHERE chamadoId = ?`,
        args: [11],
      })).rejects.toThrow(/exige resposta sobre a solução esperada/);
      expect((await client.execute({
        sql: "SELECT status FROM chamados_feedback WHERE chamadoId = ?",
        args: [11],
      })).rows[0]?.status).toBe("PENDENTE");

      await expect(client.execute(
        "UPDATE chamados_feedback SET status = 'RECUSADO' WHERE chamadoId = 11",
      )).rejects.toThrow(/CHECK/);
      await expect(client.execute(
        "UPDATE chamados_feedback SET notaRapidezResposta = 0 WHERE chamadoId = 11",
      )).rejects.toThrow(/CHECK/);

      await client.execute(
        "UPDATE chamados_feedback SET status = 'RECUSADO', decidedAt = CURRENT_TIMESTAMP WHERE chamadoId = 11",
      );
      expect((await client.execute(
        "SELECT status, notaRapidezResposta FROM chamados_feedback WHERE chamadoId = 11",
      )).rows[0]).toEqual(expect.objectContaining({ status: "RECUSADO", notaRapidezResposta: null }));

      await client.execute({
        sql: `INSERT INTO chamados_feedback
          (chamadoId, status, notaRapidezResposta, notaPrazoConclusao,
           solucionadaComoEsperado, comentario, decidedAt)
          VALUES (?, 'RESPONDIDO', 2, 1, 0, ?, CURRENT_TIMESTAMP)`,
        args: [10, "O atendimento não resolveu a demanda"],
      });
      await expect(client.execute(
        "UPDATE chamados_feedback SET notaRapidezResposta = 6 WHERE chamadoId = 10",
      )).rejects.toThrow(/CHECK/);
      await expect(client.execute({
        sql: `INSERT INTO chamados_feedback
          (chamadoId, status, notaRapidezResposta, notaPrazoConclusao,
           solucionadaComoEsperado, comentario, decidedAt)
          VALUES (?, 'RESPONDIDO', 2, 1, 0, ?, CURRENT_TIMESTAMP)`,
        args: [999, "Chamado inexistente no banco"],
      })).rejects.toThrow(/FOREIGN KEY/);

      await expect(client.execute({
        sql: "INSERT INTO chamados_feedback (chamadoId, status) VALUES (?, 'PENDENTE')",
        args: [10],
      })).rejects.toThrow(/UNIQUE|PRIMARY KEY/);

      await client.execute("UPDATE chamados SET tecnicoSolicitadoId = 3 WHERE id = 10");
      await client.execute("DELETE FROM usuarios WHERE id = 3");
      expect((await client.execute(
        "SELECT tecnicoSolicitadoId FROM chamados WHERE id = 10",
      )).rows[0]?.tecnicoSolicitadoId).toBeNull();

      await client.execute("DELETE FROM chamados WHERE id = 10");
      expect((await client.execute(
        "SELECT COUNT(*) AS total FROM chamados_feedback WHERE chamadoId = 10",
      )).rows[0]?.total).toBe(0);
      expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
      expect((await client.execute("PRAGMA integrity_check")).rows[0]?.integrity_check).toBe("ok");
    } finally {
      client.close();
    }
  });
});
