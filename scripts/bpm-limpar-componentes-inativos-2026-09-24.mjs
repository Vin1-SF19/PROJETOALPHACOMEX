import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const execute = process.argv.includes("--execute");
const rawUrl = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
if (!rawUrl.startsWith("libsql://") || !authToken) {
  throw new Error("Esta operação exige o Turso remoto configurado em .env.local.");
}

const campos = new Map([
  ["ca4cadfe0c70c89d56c098a40", "Radar atual"],
  ["c04896f2c2567b2e71dcfc721", "Status da sede"],
]);
const formularios = [
  { id: "form:cmssy4gd70003dz7s1u6cvx68", versao: 2, pipelineId: "cmssy4gd60000dz7sn1gdl3yi", configVersion: 3 },
  { id: "form:cmssy4gd70006dz7s2hr78bgx", versao: 2, pipelineId: "cmssy4gd60000dz7sn1gdl3yi", configVersion: 3 },
  { id: "form:cmsd9yvb90005dzgg8fj8vzeu", versao: 3, pipelineId: "cmsd9yvb90000dzggt1gjl980", configVersion: 85 },
];
const esperado = new Set(formularios.flatMap((formulario) => [...campos.keys()].map(
  (campoId) => `component:${formulario.id.slice(5)}:field:${campoId}`,
)));

const client = createClient({ url: rawUrl.replace(/^libsql:\/\//, "https://"), authToken });
const tx = await client.transaction(execute ? "write" : "read");
try {
  const placeholders = [...esperado].map(() => "?").join(",");
  const componentes = (await tx.execute({
    sql: `SELECT co.id, co.campoId, ca.nome, ca.ativo, f.id AS formularioId,
                 f.versao, f.ativo AS formularioAtivo, p.id AS pipelineId,
                 p.configVersion, cfg.visivel, cfg.obrigatorio,
                 cfg.obrigatorioEntrada, cfg.obrigatorioSaida
          FROM BpmFormularioComponente co
          JOIN BpmFormularioSecao s ON s.id = co.secaoId
          JOIN BpmEtapaFormulario f ON f.id = s.formularioId
          JOIN BpmEtapa e ON e.id = f.etapaId
          JOIN BpmPipeline p ON p.id = e.pipelineId
          JOIN BpmCampo ca ON ca.id = co.campoId
          JOIN BpmCampoEtapaConfig cfg ON cfg.campoId = ca.id AND cfg.etapaId = e.id
          WHERE co.id IN (${placeholders})`,
    args: [...esperado],
  })).rows;
  if (componentes.length !== esperado.size) throw new Error("Inventário de componentes mudou.");
  for (const componente of componentes) {
    const formulario = formularios.find((item) => item.id === componente.formularioId);
    if (!esperado.has(String(componente.id)) || !formulario
      || componente.pipelineId !== formulario.pipelineId
      || Number(componente.versao) !== formulario.versao
      || Number(componente.configVersion) !== formulario.configVersion
      || Number(componente.formularioAtivo) !== 1
      || campos.get(String(componente.campoId)) !== componente.nome
      || Number(componente.ativo) !== 0
      || Number(componente.visivel) !== 1
      || Number(componente.obrigatorio) !== 0
      || Number(componente.obrigatorioEntrada) !== 0
      || Number(componente.obrigatorioSaida) !== 0) {
      throw new Error(`Pré-condição alterada para o componente ${componente.id}.`);
    }
  }

  const valores = await tx.execute({
    sql: "SELECT count(*) AS total FROM BpmCardCampoValor WHERE campoId IN (?, ?)",
    args: [...campos.keys()],
  });
  if (Number(valores.rows[0].total) !== 0) throw new Error("Um dos campos passou a conter valores de card.");

  if (execute) {
    for (const componente of componentes) {
      const removido = await tx.execute({
        sql: "DELETE FROM BpmFormularioComponente WHERE id = ? AND campoId = ?",
        args: [componente.id, componente.campoId],
      });
      if (removido.rowsAffected !== 1) throw new Error("Falha ao retirar componente.");
    }
    for (const formulario of formularios) {
      const atualizado = await tx.execute({
        sql: "UPDATE BpmEtapaFormulario SET versao = versao + 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND versao = ?",
        args: [formulario.id, formulario.versao],
      });
      if (atualizado.rowsAffected !== 1) throw new Error("Versão do formulário mudou.");
    }
    for (const [pipelineId, forms] of Map.groupBy(formularios, (item) => item.pipelineId)) {
      const atualizado = await tx.execute({
        sql: "UPDATE BpmPipeline SET configVersion = configVersion + 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND configVersion = ?",
        args: [pipelineId, forms[0].configVersion],
      });
      if (atualizado.rowsAffected !== 1) throw new Error("Versão do pipeline mudou.");
      await tx.execute({
        sql: `INSERT INTO BpmPipelineConfigAuditoria
              (id, pipelineId, adminId, campoAlterado, valorAnteriorJson, valorNovoJson, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [
          randomUUID(), pipelineId, 8, "formulario_etapa_limpeza_campos_inativos",
          JSON.stringify({ componentes: componentes.filter((item) => item.pipelineId === pipelineId) }),
          JSON.stringify({ removidos: componentsForPipeline(componentes, pipelineId), motivo: "campos inativos fora do catálogo canônico" }),
        ],
      });
    }
    const fks = await tx.execute("PRAGMA foreign_key_check");
    if (fks.rows.length) throw new Error(`Violações de FK: ${fks.rows.length}`);
  }

  await tx.commit();
  console.info(JSON.stringify({ mode: execute ? "executed" : "dry-run", componentes: componentes.length, formularios: formularios.map((item) => item.id), valoresCard: Number(valores.rows[0].total) }));
} catch (error) {
  await tx.rollback();
  throw error;
} finally {
  tx.close();
  await client.close();
}

function componentsForPipeline(componentes, pipelineId) {
  return componentes.filter((item) => item.pipelineId === pipelineId).map((item) => item.id);
}
