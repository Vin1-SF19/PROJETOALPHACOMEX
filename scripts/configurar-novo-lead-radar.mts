/**
 * Publicação pontual da composição Novo Lead. --preview é somente leitura.
 * --apply exige backup dedicado verificado, versão esperada, admin real e aprovação
 * específica. Este script não faz migration, seed genérico nem backfill de cards.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import prismaDefault from "../src/lib/prisma";
// O loader tsx expõe o módulo CJS do Prisma com um nível adicional de default.
const db = (prismaDefault as unknown as { default?: typeof prismaDefault }).default ?? prismaDefault;

const PIPELINE_ID = "cmuih48la000009gmzw3wwuzf";
const OPCOES_RADAR = [
  "Habilitação de Radar 50k",
  "Revisão de Radar Limitado a USD150k",
  "Revisão de Radar Ilimitado",
];
const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = args.includes("--apply");
if (apply === args.includes("--preview")) throw new Error("Escolha --preview ou --apply.");

const current = await db.bpmPipeline.findUnique({
  where: { id: PIPELINE_ID },
  select: {
    id: true, nome: true, ativo: true, configVersion: true,
    etapas: { where: { ativo: true }, select: { id: true, nome: true, ehInicial: true, formulario: { select: { id: true, versao: true, secoes: { select: { id: true } } } } } },
    campos: { select: { id: true, nome: true } },
    transicoesEtapa: { select: { etapaOrigemId: true, etapaDestinoId: true, permitida: true } },
  },
});
if (!current || !current.ativo || current.nome !== "Revisão de Radar") throw new Error("Identidade do pipeline divergiu.");
const entrada = current.etapas.find((etapa) => etapa.ehInicial && etapa.nome === "Novo Lead");
if (!entrada) throw new Error("Etapa inicial Novo Lead ausente.");
const saidas = current.transicoesEtapa.filter((item) => item.etapaOrigemId === entrada.id && item.permitida)
  .map((item) => current.etapas.find((etapa) => etapa.id === item.etapaDestinoId)?.nome).sort();
if (JSON.stringify(saidas) !== JSON.stringify(["Agendar Reunião", "Stand By"])) throw new Error("Saídas de Novo Lead divergiram.");
if (current.campos.length || (entrada.formulario?.secoes.length ?? 0) > 0) throw new Error("Campos ou seções já existem. Revisar plano; não sobrescrever.");

const preview = {
  pipelineId: current.id, etapaId: entrada.id, configVersion: current.configVersion,
  camposNovos: ["Radar pretendido", "Canal de origem", "Qualificação"],
  opcoesRadar: OPCOES_RADAR,
  opcoesQualificacao: ["Qualificado", "Sem qualificação"],
  opcoesDeSaidaExistentes: saidas,
  insertsPlanejados: { BpmCampo: 3, BpmCampoOpcao: 5, BpmCampoEtapaConfig: 3, BpmEtapaFormulario: entrada.formulario ? 0 : 1, BpmFormularioSecao: 1, BpmFormularioComponente: 3, BpmPipelineConfigAuditoria: 1 },
  updatesPlanejados: { BpmPipeline: 1, BpmEtapaFormulario: entrada.formulario ? 1 : 0 },
};
if (!apply) {
  console.log(JSON.stringify({ modo: "preview", ...preview }, null, 2));
  process.exit(0);
}

const backup = option("backup");
const manifest = option("manifest");
const adminId = Number(option("admin-id"));
const expectedVersion = Number(option("expect-version"));
if (!backup || !manifest || !Number.isInteger(adminId) || adminId <= 0
  || expectedVersion !== current.configVersion
  || option("approval") !== "CONFIGURAR_NOVO_LEAD_REVISAO_RADAR") {
  throw new Error("Aplicação exige backup, manifest, admin-id real, expect-version e aprovação específica.");
}
const manifestData = JSON.parse(readFileSync(manifest, "utf8"));
const backupStat = statSync(backup);
if (!backup.includes("database-backups/pre-change/") || backupStat.size < 1_000_000
  || backupStat.size !== manifestData.sizeBytes
  || !String(manifestData.reason ?? "").includes("Novo Lead Revisao de Radar")) {
  throw new Error("Backup pre-change dedicado ausente ou inválido.");
}
const backupHash = createHash("sha256").update(readFileSync(backup)).digest("hex");
if (backupHash !== manifestData.sha256) throw new Error("SHA-256 do backup divergente.");
const backupCreatedAt = new Date(manifestData.generatedAt ?? manifestData.createdAt).getTime();
if (!Number.isFinite(backupCreatedAt) || backupCreatedAt > Date.now()
  || Date.now() - backupCreatedAt > 48 * 3600_000) {
  throw new Error("Data do backup inválida ou com mais de 48 horas.");
}
execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
const admin = await db.usuarios.findUnique({ where: { id: adminId }, select: { id: true } });
if (!admin) throw new Error("admin-id não existe.");

await db.$transaction(async (tx) => {
  const changed = await tx.bpmPipeline.updateMany({
    where: { id: PIPELINE_ID, configVersion: expectedVersion },
    data: { configVersion: { increment: 1 } },
  });
  if (changed.count !== 1) throw new Error("Versão do pipeline mudou; publicar cancelado.");
  const [camposExistentes, secoesExistentes] = await Promise.all([
    tx.bpmCampo.count({ where: { pipelineId: PIPELINE_ID } }),
    tx.bpmFormularioSecao.count({ where: { formulario: { etapaId: entrada.id } } }),
  ]);
  if (camposExistentes || secoesExistentes) {
    throw new Error("Campos ou seções criados em paralelo; publicar cancelado.");
  }
  const campos = [];
  for (const [ordem, spec] of [
    { nome: "Radar pretendido", tipo: "selecao", opcoes: OPCOES_RADAR, obrigatorio: true },
    { nome: "Canal de origem", tipo: "texto", opcoes: [] as string[], obrigatorio: false },
    { nome: "Qualificação", tipo: "selecao", opcoes: ["Qualificado", "Sem qualificação"], obrigatorio: false },
  ].entries()) {
    const campo = await tx.bpmCampo.create({
      data: {
        pipelineId: PIPELINE_ID, nome: spec.nome, tipo: spec.tipo, ordem,
        ativo: true, escopo: "CARD", visivel: true, editavel: true,
        opcoes: { create: spec.opcoes.map((rotulo, indice) => ({ chave: `opcao_${indice + 1}`, rotulo, ordem: indice })) },
        etapaConfiguracoes: { create: {
          etapaId: entrada.id, visivel: true, editavel: true, ordem,
          obrigatorio: spec.obrigatorio, obrigatorioSaida: spec.obrigatorio,
        } },
      },
      select: { id: true, nome: true },
    });
    campos.push(campo);
  }
  const secao = {
    chave: "dados_novo_lead", titulo: "Dados do Novo Lead", ordem: 0,
    componentes: { create: campos.map((campo, ordem) => ({
      chave: `campo_${ordem + 1}`, tipo: "CAMPO", campoId: campo.id, ordem,
    })) },
  };
  if (entrada.formulario) {
    await tx.bpmFormularioSecao.create({ data: { formularioId: entrada.formulario.id, ...secao } });
    await tx.bpmEtapaFormulario.update({ where: { id: entrada.formulario.id }, data: { versao: { increment: 1 } } });
  } else {
    await tx.bpmEtapaFormulario.create({ data: { etapaId: entrada.id, ativo: true, secoes: { create: [secao] } } });
  }
  await tx.bpmPipelineConfigAuditoria.create({ data: {
    pipelineId: PIPELINE_ID, adminId,
    campoAlterado: "NOVO_LEAD_CONFIGURACAO_PUBLICADA",
    valorAnteriorJson: JSON.stringify({ configVersion: expectedVersion, campos: 0 }),
    valorNovoJson: JSON.stringify({ configVersion: expectedVersion + 1, campos: campos.map((campo) => campo.nome), opcoesRadar: OPCOES_RADAR }),
  } });
});
console.log(JSON.stringify({ modo: "apply", sucesso: true, pipelineId: PIPELINE_ID, configVersion: expectedVersion + 1 }));
