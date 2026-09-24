/** Verificação read-only depois da limpeza aprovada. */
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });
const url = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
if (!url || !authToken) throw new Error("Turso não configurado.");
const db = createClient({ url: url.replace(/^libsql:\/\//, "https://"), authToken });
const pipelineId = "cmsd9yvb90000dzggt1gjl980";
const etapaId = "cmsd9yvb90003dzgg34vyurim";
const formularioId = "form:cmsd9yvb90003dzgg34vyurim";
const preservarId = "cmubiy7zm00010agmru1wbspt";
const one = async (sql, args = []) => Number((await db.execute({ sql, args })).rows[0]?.total ?? 0);
try {
  const cards = await db.execute({ sql: "SELECT id, status FROM BpmCard WHERE pipelineId = ?", args: [pipelineId] });
  const form = await db.execute({ sql: "SELECT id, versao, ativo FROM BpmEtapaFormulario WHERE id = ?", args: [formularioId] });
  const sections = await one("SELECT COUNT(*) AS total FROM BpmFormularioSecao WHERE formularioId = ?", [formularioId]);
  const components = await one("SELECT COUNT(*) AS total FROM BpmFormularioComponente c JOIN BpmFormularioSecao s ON s.id = c.secaoId WHERE s.formularioId = ?", [formularioId]);
  const required = await one("SELECT COUNT(*) AS total FROM BpmCampoEtapaConfig WHERE etapaId = ? AND (obrigatorio = 1 OR obrigatorioEntrada = 1 OR obrigatorioSaida = 1)", [etapaId]);
  const conditionalRequirements = await one("SELECT COUNT(*) AS total FROM BpmCampoEtapaConfig WHERE etapaId = ? AND condicaoObrigatoriedadeJson IS NOT NULL", [etapaId]);
  const fieldRequirements = await one("SELECT COUNT(*) AS total FROM BpmRequisito WHERE etapaId = ? AND ativo = 1 AND alvoTipo = 'CAMPO'", [etapaId]);
  const legacy = await one("SELECT COUNT(*) AS total FROM BpmCampoObrigatorioEtapa WHERE etapaId = ?", [etapaId]);
  const preservedValues = await one("SELECT COUNT(*) AS total FROM BpmCardCampoValor WHERE cardId = ?", [preservarId]);
  const foreignKeyViolations = (await db.execute("PRAGMA foreign_key_check")).rows.length;
  const result = {
    cards: cards.rows.map((row) => ({ id: String(row.id), status: String(row.status) })),
    formVersion: Number(form.rows[0]?.versao ?? 0), formActive: Boolean(form.rows[0]?.ativo),
    sections, components, required, conditionalRequirements, fieldRequirements, legacy, preservedValues, foreignKeyViolations,
  };
  if (result.cards.length !== 1 || result.cards[0].id !== preservarId || result.formVersion !== 32 || sections !== 0 || components !== 0 || required !== 0 || legacy !== 3 || preservedValues !== 15 || foreignKeyViolations !== 0) {
    throw new Error(`Verificação divergente: ${JSON.stringify(result)}`);
  }
  console.info(JSON.stringify({ verified: true, ...result }));
} finally {
  await db.close();
}
