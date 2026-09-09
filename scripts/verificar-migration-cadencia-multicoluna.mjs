import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const mode = process.argv[2];
if (!new Set(["--preflight", "--post"]).has(mode)) {
  throw new Error(
    "Uso: node scripts/verificar-migration-cadencia-multicoluna.mjs --preflight|--post",
  );
}

const rawUrl = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
if (!rawUrl || !authToken) throw new Error("CONFIGURACAO_BANCO_AUSENTE");

const client = createClient({
  url: rawUrl.replace(/^libsql:\/\//, "https://"),
  authToken,
});

async function scalar(sql, key) {
  const result = await client.execute(sql);
  return Number(result.rows[0]?.[key] ?? 0);
}

try {
  const [tableCount, invalidLegacyScopes, duplicateLegacyStages, foreignKeys] =
    await Promise.all([
      scalar(
        "SELECT count(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'BpmCadenciaEtapa'",
        "total",
      ),
      scalar(
        `SELECT count(*) AS total
      FROM BpmCadencia c
      JOIN BpmEtapa e ON e.id = c.etapaId
      WHERE c.etapaId IS NOT NULL
        AND (c.pipelineId IS NULL OR e.pipelineId <> c.pipelineId)`,
        "total",
      ),
      scalar(
        `SELECT count(*) AS total FROM (
      SELECT etapaId FROM BpmCadencia
      WHERE etapaId IS NOT NULL
      GROUP BY etapaId HAVING count(*) > 1
    )`,
        "total",
      ),
      client.execute("PRAGMA foreign_key_check"),
    ]);

  if (invalidLegacyScopes !== 0)
    throw new Error("CADENCIA_LEGADA_FORA_PIPELINE");
  if (duplicateLegacyStages !== 0)
    throw new Error("CADENCIA_LEGADA_COLUNA_DUPLICADA");
  if (foreignKeys.rows.length !== 0) throw new Error("FOREIGN_KEY_VIOLATION");

  if (mode === "--preflight") {
    if (tableCount !== 0) throw new Error("BpmCadenciaEtapa_JA_EXISTE");
    console.info(
      JSON.stringify({
        mode: "preflight",
        compatible: true,
        tableAbsent: true,
        invalidLegacyScopes,
        duplicateLegacyStages,
        foreignKeyViolations: 0,
      }),
    );
  } else {
    if (tableCount !== 1) throw new Error("BpmCadenciaEtapa_AUSENTE");
    const [
      missingBackfill,
      invalidAssociations,
      duplicateAssociations,
      indexRows,
    ] = await Promise.all([
      scalar(
        `SELECT count(*) AS total
        FROM BpmCadencia c
        JOIN BpmEtapa e ON e.id = c.etapaId AND e.pipelineId = c.pipelineId
        LEFT JOIN BpmCadenciaEtapa ce ON ce.cadenciaId = c.id AND ce.etapaId = c.etapaId
        WHERE c.etapaId IS NOT NULL AND ce.id IS NULL`,
        "total",
      ),
      scalar(
        `SELECT count(*) AS total
        FROM BpmCadenciaEtapa ce
        JOIN BpmCadencia c ON c.id = ce.cadenciaId
        JOIN BpmEtapa e ON e.id = ce.etapaId
        WHERE c.pipelineId IS NULL OR e.pipelineId <> c.pipelineId`,
        "total",
      ),
      scalar(
        `SELECT count(*) AS total FROM (
        SELECT etapaId FROM BpmCadenciaEtapa
        GROUP BY etapaId HAVING count(*) > 1
      )`,
        "total",
      ),
      client.execute("PRAGMA index_list('BpmCadenciaEtapa')"),
    ]);
    const indexes = new Set(indexRows.rows.map((row) => String(row.name)));
    if (missingBackfill !== 0) throw new Error("BACKFILL_INCOMPLETO");
    if (invalidAssociations !== 0) throw new Error("ASSOCIACAO_FORA_PIPELINE");
    if (duplicateAssociations !== 0) throw new Error("ASSOCIACAO_DUPLICADA");
    if (
      !indexes.has("BpmCadenciaEtapa_etapaId_key") ||
      !indexes.has("BpmCadenciaEtapa_cadenciaId_idx")
    ) {
      throw new Error("INDICES_AUSENTES");
    }
    const associations = await scalar(
      "SELECT count(*) AS total FROM BpmCadenciaEtapa",
      "total",
    );
    console.info(
      JSON.stringify({
        mode: "post",
        compatible: true,
        associations,
        missingBackfill,
        invalidAssociations,
        duplicateAssociations,
        foreignKeyViolations: 0,
        indexes: [...indexes].sort(),
      }),
    );
  }
} finally {
  await client.close();
}
