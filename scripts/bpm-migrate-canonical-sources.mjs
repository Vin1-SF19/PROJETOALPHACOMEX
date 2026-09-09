import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
const confirmationIndex = process.argv.indexOf("--confirm");
const confirmation = confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : null;
if (mode === "apply" && confirmation !== "P0-1-CANONICAL-SOURCES") {
  throw new Error("CONFIRMACAO_EXPLICITA_AUSENTE");
}

const rawUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
if (!rawUrl) throw new Error("CONFIGURACAO_BANCO_AUSENTE");
const client = createClient({
  url: rawUrl.replace(/^libsql:\/\//, "https://"),
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const CAMPO_CANDIDATOS_SQL = `
WITH pares AS (
  SELECT f.id campoId, f.etapaId etapaId, 'CAMPO_ETAPA_ID' motivo
  FROM BpmCampo f JOIN BpmEtapa e ON e.id=f.etapaId
  WHERE f.etapaId IS NOT NULL
    AND (e.pipelineId=f.pipelineId OR EXISTS (
      SELECT 1 FROM BpmCampoPipeline cp WHERE cp.campoId=f.id AND cp.pipelineId=e.pipelineId
    ))
  UNION ALL
  SELECT o.campoId, o.etapaId, 'OBRIGATORIO_LEGADO'
  FROM BpmCampoObrigatorioEtapa o
  JOIN BpmCampo f ON f.id=o.campoId JOIN BpmEtapa e ON e.id=o.etapaId
  WHERE e.pipelineId=f.pipelineId OR EXISTS (
    SELECT 1 FROM BpmCampoPipeline cp WHERE cp.campoId=f.id AND cp.pipelineId=e.pipelineId
  )
  UNION ALL
  SELECT h.campoId, h.etapaId, 'OCULTO_LEGADO'
  FROM BpmCampoOcultoEtapa h
  JOIN BpmCampo f ON f.id=h.campoId JOIN BpmEtapa e ON e.id=h.etapaId
  WHERE e.pipelineId=f.pipelineId OR EXISTS (
    SELECT 1 FROM BpmCampoPipeline cp WHERE cp.campoId=f.id AND cp.pipelineId=e.pipelineId
  )
), candidatos AS (
  SELECT campoId, etapaId, GROUP_CONCAT(motivo) motivos
  FROM pares
  GROUP BY campoId, etapaId
)
SELECT c.campoId, c.etapaId, c.motivos, f.nome campoNome, e.nome etapaNome,
       f.visivel, f.editavel, f.somenteLeitura, f.ordem,
       EXISTS(SELECT 1 FROM BpmCampoObrigatorioEtapa o WHERE o.campoId=c.campoId AND o.etapaId=c.etapaId) legadoObrigatorio,
       EXISTS(SELECT 1 FROM BpmCampoOcultoEtapa h WHERE h.campoId=c.campoId AND h.etapaId=c.etapaId) legadoOculto,
       EXISTS(SELECT 1 FROM BpmRequisito r WHERE r.ativo=1 AND r.campoId=c.campoId AND r.fonte='CAMPO') requisitoCampoAtivo
FROM candidatos c
JOIN BpmCampo f ON f.id=c.campoId
JOIN BpmEtapa e ON e.id=c.etapaId
WHERE NOT EXISTS (
  SELECT 1 FROM BpmCampoEtapaConfig cfg WHERE cfg.campoId=c.campoId AND cfg.etapaId=c.etapaId
)
ORDER BY e.pipelineId, e.ordem, f.ordem, f.id`;

function stableId(prefix, ...parts) {
  return `c${createHash("sha256").update([prefix, ...parts].join(":"), "utf8").digest("hex").slice(0, 24)}`;
}

function number(value) {
  return Number(value ?? 0);
}

async function rows(db, sql, args = []) {
  return (await db.execute({ sql, args })).rows;
}

async function scalar(db, sql, key = "total") {
  return number((await rows(db, sql))[0]?.[key]);
}

async function diagnosticar(db) {
  const [candidatosCampos, transicoesPendentes, slasPendentes, cadenciasPendentes, conflitosOcultacao] = await Promise.all([
    rows(db, CAMPO_CANDIDATOS_SQL),
    rows(db, `SELECT l.etapaOrigemId, l.etapaDestinoId, o.pipelineId
      FROM BpmEtapaTransicaoPermitida l
      JOIN BpmEtapa o ON o.id=l.etapaOrigemId
      JOIN BpmEtapa d ON d.id=l.etapaDestinoId AND d.pipelineId=o.pipelineId
      WHERE NOT EXISTS (SELECT 1 FROM BpmTransicaoEtapa c WHERE c.etapaOrigemId=l.etapaOrigemId AND c.etapaDestinoId=l.etapaDestinoId)`),
    rows(db, `SELECT e.id etapaId, e.pipelineId, e.nome, e.slaDias
      FROM BpmEtapa e WHERE e.slaDias IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM BpmSlaConfig s WHERE s.etapaId=e.id AND s.ativa=1)`),
    rows(db, `SELECT c.id cadenciaId, c.etapaId
      FROM BpmCadencia c JOIN BpmEtapa e ON e.id=c.etapaId AND e.pipelineId=c.pipelineId
      WHERE c.etapaId IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM BpmCadenciaEtapa ce WHERE ce.cadenciaId=c.id AND ce.etapaId=c.etapaId)`),
    rows(db, `SELECT h.campoId, h.etapaId FROM BpmCampoOcultoEtapa h
      JOIN BpmCampoEtapaConfig c ON c.campoId=h.campoId AND c.etapaId=h.etapaId
      WHERE c.visivel=1`),
  ]);
  const [invalidos, requisitosCondicionais, requisitosSemConfigCanonica, cadenciasConflitantes] = await Promise.all([
    scalar(db, `SELECT COUNT(*) total FROM BpmCampoEtapaConfig c JOIN BpmCampo f ON f.id=c.campoId JOIN BpmEtapa e ON e.id=c.etapaId
      WHERE e.pipelineId<>f.pipelineId AND NOT EXISTS (SELECT 1 FROM BpmCampoPipeline cp WHERE cp.campoId=f.id AND cp.pipelineId=e.pipelineId)`),
    scalar(db, `SELECT COUNT(*) total FROM BpmRequisito WHERE ativo=1 AND campoId IS NOT NULL AND condicaoJson IS NOT NULL`),
    rows(db, `SELECT r.id, r.campoId, r.etapaId FROM BpmRequisito r
      WHERE r.ativo=1 AND r.campoId IS NOT NULL AND r.fonte IN ('CAMPO','ETAPA_CONFIG','LEGADO')
      AND NOT EXISTS (
        SELECT 1 FROM BpmCampoEtapaConfig c
        WHERE c.campoId=r.campoId AND (r.etapaId IS NULL OR c.etapaId=r.etapaId)
      )`),
    scalar(db, `SELECT COUNT(*) total FROM BpmCadencia c JOIN BpmCadenciaEtapa ce ON ce.etapaId=c.etapaId AND ce.cadenciaId<>c.id
      WHERE c.etapaId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM BpmCadenciaEtapa own WHERE own.cadenciaId=c.id AND own.etapaId=c.etapaId)`),
  ]);
  const paresCandidatos = new Set(candidatosCampos.map((item) => `${item.campoId}:${item.etapaId}`));
  const camposCandidatos = new Set(candidatosCampos.map((item) => item.campoId));
  const requisitosSemRepresentacao = requisitosSemConfigCanonica.filter((item) => item.etapaId
    ? !paresCandidatos.has(`${item.campoId}:${item.etapaId}`)
    : !camposCandidatos.has(item.campoId));
  if (invalidos || requisitosCondicionais || requisitosSemRepresentacao.length || cadenciasConflitantes) {
    throw new Error(`PRECONDICAO_FALHOU:${JSON.stringify({ invalidos, requisitosCondicionais, requisitosSemRepresentacao, cadenciasConflitantes })}`);
  }
  const totais = (await rows(db, `SELECT
    (SELECT COUNT(*) FROM BpmTransicaoEtapa) transicoesCanonicas,
    (SELECT COUNT(*) FROM BpmEtapaTransicaoPermitida) transicoesLegadas,
    (SELECT COUNT(*) FROM BpmCampoEtapaConfig) configsCampoEtapa,
    (SELECT COUNT(*) FROM BpmCampoPipeline) associacoesCampoPipeline,
    (SELECT COUNT(*) FROM BpmCampoPipeline cp JOIN BpmCampo f ON f.id=cp.campoId WHERE cp.pipelineId=f.pipelineId) associacoesRedundantes,
    (SELECT COUNT(*) FROM BpmCampoPipeline cp JOIN BpmCampo f ON f.id=cp.campoId WHERE cp.pipelineId<>f.pipelineId) compartilhamentosReais,
    (SELECT COUNT(*) FROM BpmRequisito WHERE ativo=1 AND campoId IS NOT NULL) requisitosCampoAtivos,
    (SELECT COUNT(*) FROM BpmSlaConfig) slaConfigs,
    (SELECT COUNT(*) FROM BpmCadenciaEtapa) cadenciaEtapas`))[0];
  const obrigatoriosAtualizar = await rows(db, `SELECT c.* FROM BpmCampoEtapaConfig c JOIN BpmCampo f ON f.id=c.campoId
    WHERE c.obrigatorio=0 AND (
      EXISTS (SELECT 1 FROM BpmCampoObrigatorioEtapa o WHERE o.campoId=c.campoId AND o.etapaId=c.etapaId)
      OR EXISTS (
        SELECT 1 FROM BpmRequisito r
        WHERE r.ativo=1 AND r.campoId=f.id AND r.fonte IN ('CAMPO','ETAPA_CONFIG','LEGADO')
          AND r.fase<>'EXIT_STAGE' AND (r.etapaId IS NULL OR r.etapaId=c.etapaId)
      )
    )`);
  const obrigatoriosSaidaAtualizar = await rows(db, `SELECT c.* FROM BpmCampoEtapaConfig c
    WHERE c.obrigatorioSaida=0 AND EXISTS (
      SELECT 1 FROM BpmRequisito r
      WHERE r.ativo=1 AND r.campoId=c.campoId AND r.fonte IN ('CAMPO','ETAPA_CONFIG','LEGADO')
        AND r.fase='EXIT_STAGE' AND (r.etapaId IS NULL OR r.etapaId=c.etapaId)
    )`);
  const requisitosDesativar = await rows(db, `SELECT * FROM BpmRequisito
    WHERE ativo=1 AND campoId IS NOT NULL AND fonte IN ('CAMPO','ETAPA_CONFIG','LEGADO')`);
  const associacoesRemover = await rows(db, `SELECT cp.* FROM BpmCampoPipeline cp
    JOIN BpmCampo f ON f.id=cp.campoId WHERE cp.pipelineId=f.pipelineId`);
  return {
    totais: Object.fromEntries(Object.entries(totais).map(([key, value]) => [key, number(value)])),
    candidatosCampos,
    obrigatoriosAtualizar,
    obrigatoriosSaidaAtualizar,
    conflitosOcultacao,
    requisitosDesativar,
    associacoesRemover,
    transicoesPendentes,
    slasPendentes,
    cadenciasPendentes,
  };
}

function resumo(plano) {
  return {
    mode,
    before: plano.totais,
    proposed: {
      transicoesInserir: plano.transicoesPendentes.length,
      configsCampoEtapaInserir: plano.candidatosCampos.length,
      configsObrigatorioAtualizar: plano.obrigatoriosAtualizar.length,
      configsObrigatorioSaidaAtualizar: plano.obrigatoriosSaidaAtualizar.length,
      conflitosOcultacaoPreservadosPeloCanonico: plano.conflitosOcultacao.length,
      requisitosCampoDesativar: plano.requisitosDesativar.length,
      associacoesRedundantesRemover: plano.associacoesRemover.length,
      compartilhamentosReaisPreservar: plano.totais.compartilhamentosReais,
      slaConfigsInserir: plano.slasPendentes.length,
      cadenciaEtapasInserir: plano.cadenciasPendentes.length,
    },
  };
}

async function aplicar() {
  const tx = await client.transaction("write");
  try {
    const plano = await diagnosticar(tx);
    const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
    const rollbackDirectory = path.resolve("database-backups", "pre-change");
    await mkdir(rollbackDirectory, { recursive: true });
    const rollbackPath = path.join(rollbackDirectory, `p0-1-canonical-sources-rollback-${timestamp}.json`);
    await writeFile(
      rollbackPath,
      `${JSON.stringify(plano, (_key, value) => typeof value === "bigint" ? Number(value) : value, 2)}\n`,
      "utf8",
    );

    const agora = new Date().toISOString();
    for (const edge of plano.transicoesPendentes) {
      await tx.execute({
        sql: `INSERT INTO BpmTransicaoEtapa
          (id,pipelineId,etapaOrigemId,etapaDestinoId,permitida,origem,limparSubStatus,createdAt,updatedAt)
          VALUES (?,?,?,?,1,'AMBOS',1,?,?)`,
        args: [stableId("p01_transition", edge.etapaOrigemId, edge.etapaDestinoId), edge.pipelineId, edge.etapaOrigemId, edge.etapaDestinoId, agora, agora],
      });
    }
    for (const item of plano.candidatosCampos) {
      const obrigatorio = number(item.legadoObrigatorio) === 1 || number(item.requisitoCampoAtivo) === 1;
      const visivel = number(item.legadoOculto) === 1 ? false : number(item.visivel) === 1;
      const somenteLeitura = number(item.somenteLeitura) === 1;
      await tx.execute({
        sql: `INSERT INTO BpmCampoEtapaConfig
          (id,campoId,etapaId,visivel,editavel,somenteLeitura,obrigatorio,obrigatorioEntrada,obrigatorioSaida,ordem,createdAt,updatedAt)
          VALUES (?,?,?,?,?,?,?,0,0,?,?,?)`,
        args: [stableId("p01_field_stage", item.campoId, item.etapaId), item.campoId, item.etapaId, visivel, somenteLeitura ? false : number(item.editavel) === 1, somenteLeitura, obrigatorio, number(item.ordem), agora, agora],
      });
    }
    for (const config of plano.obrigatoriosAtualizar) {
      await tx.execute({ sql: "UPDATE BpmCampoEtapaConfig SET obrigatorio=1, updatedAt=? WHERE id=? AND obrigatorio=0", args: [agora, config.id] });
    }
    for (const config of plano.obrigatoriosSaidaAtualizar) {
      await tx.execute({ sql: "UPDATE BpmCampoEtapaConfig SET obrigatorioSaida=1, updatedAt=? WHERE id=? AND obrigatorioSaida=0", args: [agora, config.id] });
    }
    if (plano.requisitosDesativar.length) {
      await tx.execute({
        sql: `UPDATE BpmRequisito SET ativo=0, updatedAt=?
          WHERE ativo=1 AND campoId IS NOT NULL AND fonte IN ('CAMPO','ETAPA_CONFIG','LEGADO')`,
        args: [agora],
      });
    }
    if (plano.associacoesRemover.length) {
      await tx.execute(`DELETE FROM BpmCampoPipeline WHERE id IN (
        SELECT cp.id FROM BpmCampoPipeline cp JOIN BpmCampo f ON f.id=cp.campoId WHERE cp.pipelineId=f.pipelineId
      )`);
    }
    for (const item of plano.slasPendentes) {
      await tx.execute({
        sql: `INSERT INTO BpmSlaConfig
          (id,pipelineId,etapaId,nome,quantidade,unidade,inicioMomento,suspendeAutomacaoAoVencer,ativa,prioridade,createdAt,updatedAt)
          VALUES (?,?,?, ?,?,'DIAS','ENTRADA_ETAPA',1,1,0,?,?)`,
        args: [stableId("p01_sla", item.etapaId), item.pipelineId, item.etapaId, `SLA migrado — ${item.nome}`, number(item.slaDias), agora, agora],
      });
    }
    for (const item of plano.cadenciasPendentes) {
      await tx.execute({
        sql: "INSERT INTO BpmCadenciaEtapa (id,cadenciaId,etapaId,createdAt) VALUES (?,?,?,?)",
        args: [stableId("p01_cadence_stage", item.cadenciaId, item.etapaId), item.cadenciaId, item.etapaId, agora],
      });
    }
    const fk = await rows(tx, "PRAGMA foreign_key_check");
    if (fk.length) throw new Error(`FOREIGN_KEY_VIOLATION:${fk.length}`);
    await tx.commit();
    return { rollbackPath, applied: resumo(plano) };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

try {
  if (mode === "dry-run") {
    const plano = await diagnosticar(client);
    console.info(JSON.stringify(resumo(plano), null, 2));
  } else {
    const result = await aplicar();
    const after = await diagnosticar(client);
    const integrity = await rows(client, "PRAGMA integrity_check");
    console.info(JSON.stringify({ ...result, after: resumo(after).before, remaining: resumo(after).proposed, integrity: integrity[0] }, null, 2));
  }
} finally {
  await client.close();
}
