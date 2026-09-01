import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const PIPELINE_ID = "cmsd9yvb90000dzggt1gjl980";
const ETAPA_ID = "cmsd9yvb90003dzgg34vyurim";
const VISIVEIS = new Set(["Nome do responsável", "CNPJ", "Radar pretendido"]);
const OCULTOS = [
  ["vault_20260901_nl_01", "cmsnjn2qj0001dzhcyeyr4p8g", "Canal de origem"],
  ["vault_20260901_nl_02", "cmsnjzlqz000vdz5gkyt8m66p", "Confirmar serviço"],
  ["vault_20260901_nl_03", "cmsnjzlvt000xdz5ge8a11jm0", "Mês para protocolar"],
  ["vault_20260901_nl_04", "cmsnjzm0i000zdz5gqbugkoom", "Faturamento nos últimos 5 anos"],
  ["vault_20260901_nl_05", "cmsnjzm5b0011dz5gynagpp5v", "Armazenamento"],
  ["vault_20260901_nl_06", "cmsnjzma80013dz5glzxelx0j", "Faturas sob titularidade da empresa"],
  ["vault_20260901_nl_07", "cmsnjzmfd0015dz5gxsp3mz8x", "Atuação da empresa"],
  ["vault_20260901_nl_08", "cmsnjzmk20017dz5g4b3ndhld", "Tributos pagos no último semestre"],
  ["vault_20260901_nl_09", "cmsnjzmos0019dz5go1obih9f", "Valor acordado no contrato"],
  ["vault_20260901_nl_10", "cmsnjzmti001bdz5gmvf6kwdc", "Forma de pagamento"],
  ["vault_20260901_nl_11", "cmsnjzmy8001ddz5gwpocdb7j", "Exportador"],
  ["vault_20260901_nl_12", "cmsnjzn30001fdz5g5gganw9l", "Nível de complexidade para a revisão"],
  ["vault_20260901_nl_13", "cmsnjzn8v001hdz5g362n7apr", "Histórico de tentativas anteriores de revisão"],
  ["vault_20260901_nl_14", "cmsnjzneo001jdz5gtfhr574m", "Embasamento do processo"],
  ["vault_20260901_nl_15", "cmsnjznjj001ldz5gd9p9sqrr", "Motivo de Lost"],
  ["vault_20260901_nl_16", "cmsnjzno9001ndz5go7wstl62", "Motivo de Lost - Outro"],
];

const rawUrl = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
if (!rawUrl || !authToken) {
  throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios em .env.local.");
}
const client = createClient({
  url: rawUrl.replace(/^libsql:\/\//, "https://"),
  authToken,
});

async function carregarEstado(executor) {
  const pipeline = await executor.execute({
    sql: `SELECT id, nome, ativo FROM BpmPipeline WHERE id = ?`,
    args: [PIPELINE_ID],
  });
  const etapa = await executor.execute({
    sql: `SELECT id, nome, ativo, pipelineId FROM BpmEtapa WHERE id = ?`,
    args: [ETAPA_ID],
  });
  const campos = await executor.execute({
    sql: `SELECT id, nome FROM BpmCampo WHERE pipelineId = ? AND etapaId IS NULL ORDER BY ordem, nome`,
    args: [PIPELINE_ID],
  });
  const ocultos = await executor.execute({
    sql: `SELECT campoId FROM BpmCampoOcultoEtapa WHERE etapaId = ?`,
    args: [ETAPA_ID],
  });
  const obrigConfirmar = await executor.execute({
    sql: `SELECT id, campoId, etapaId FROM BpmCampoObrigatorioEtapa WHERE campoId = ? AND etapaId = ?`,
    args: [OCULTOS[1][1], ETAPA_ID],
  });
  return {
    pipeline: pipeline.rows,
    etapa: etapa.rows,
    campos: campos.rows,
    ocultos: ocultos.rows,
    obrigConfirmar: obrigConfirmar.rows,
  };
}

function validarPreflight(estado) {
  if (estado.pipeline.length !== 1 || estado.pipeline[0].nome !== "Revisão de Radar" || !estado.pipeline[0].ativo) {
    throw new Error("Pipeline esperado não encontrado ou inativo.");
  }
  if (
    estado.etapa.length !== 1
    || estado.etapa[0].nome !== "Novos leads"
    || estado.etapa[0].pipelineId !== PIPELINE_ID
    || !estado.etapa[0].ativo
  ) {
    throw new Error("Etapa Novos leads esperada não encontrada, inativa ou em outro pipeline.");
  }
  const catalogo = new Map(estado.campos.map((campo) => [campo.id, campo.nome]));
  if (catalogo.size !== 19) throw new Error(`Catálogo global inesperado: ${catalogo.size} campos.`);
  for (const [, campoId, nome] of OCULTOS) {
    if (catalogo.get(campoId) !== nome) throw new Error(`Campo divergente no preflight: ${nome}.`);
  }
  const visiveis = estado.campos.filter((campo) => VISIVEIS.has(campo.nome));
  if (visiveis.length !== VISIVEIS.size) throw new Error("Lista de campos preservados divergiu.");
}

function resumo(estado) {
  const idsOcultos = new Set(estado.ocultos.map((item) => item.campoId));
  return {
    pipeline: estado.pipeline[0]?.nome ?? null,
    etapa: estado.etapa[0]?.nome ?? null,
    camposGlobais: estado.campos.length,
    ocultosNaEtapa: estado.ocultos.length,
    visiveisGlobais: estado.campos
      .filter((campo) => !idsOcultos.has(campo.id))
      .map((campo) => campo.nome),
    confirmarServicoObrigatorio: estado.obrigConfirmar.length > 0,
    confirmarServicoObrigatoriedadeIds: estado.obrigConfirmar.map((item) => item.id),
    modo: APPLY ? "apply" : "dry-run",
  };
}

try {
  const estadoInicial = await carregarEstado(client);
  validarPreflight(estadoInicial);
  console.info(JSON.stringify({ antes: resumo(estadoInicial) }));
  if (!APPLY) {
    console.info("Dry-run concluído. Use --apply somente após backup validado e aprovação explícita.");
  } else {
    const transaction = await client.transaction("write");
    try {
      const estadoTransacao = await carregarEstado(transaction);
      validarPreflight(estadoTransacao);
      for (const [id, campoId] of OCULTOS) {
        await transaction.execute({
          sql: `INSERT OR IGNORE INTO BpmCampoOcultoEtapa (id, campoId, etapaId) VALUES (?, ?, ?)`,
          args: [id, campoId, ETAPA_ID],
        });
      }
      await transaction.execute({
        sql: `DELETE FROM BpmCampoObrigatorioEtapa WHERE campoId = ? AND etapaId = ?`,
        args: [OCULTOS[1][1], ETAPA_ID],
      });

      const estadoFinal = await carregarEstado(transaction);
      const final = resumo(estadoFinal);
      if (
        final.ocultosNaEtapa !== 16
        || final.confirmarServicoObrigatorio
        || JSON.stringify(final.visiveisGlobais) !== JSON.stringify([...VISIVEIS])
      ) {
        throw new Error(`Pós-condição inválida: ${JSON.stringify(final)}`);
      }
      await transaction.commit();
      console.info(JSON.stringify({ depois: final }));
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  }
} finally {
  client.close();
}
