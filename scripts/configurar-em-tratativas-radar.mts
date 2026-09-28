/** Prévia read-only; publicação requer autorização específica e backup Turso verificado. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import prismaDefault from "../src/lib/prisma";

const db = (prismaDefault as unknown as { default?: typeof prismaDefault }).default ?? prismaDefault;
const PIPELINE_ID = "cmuih48la000009gmzw3wwuzf";
const ETAPA_ID = "draft-stage-22afe145-6639-4299-bf9a-68343ce622f9";
const DESTINOS = ["Fechado", "Lost", "Stand By", "Monitoramento", "Sem viabilidade"];
const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = args.includes("--apply");
if (apply === args.includes("--preview")) throw new Error("Escolha --preview ou --apply.");

try {
  const pipeline = await db.bpmPipeline.findUnique({ where: { id: PIPELINE_ID }, select: {
    id: true, nome: true, ativo: true, configVersion: true,
    etapas: { select: { id: true, nome: true, capabilitiesJson: true, script: true, formulario: { select: { id: true } } } },
    transicoesEtapa: { select: { id: true, etapaOrigemId: true, etapaDestinoId: true, permitida: true, origem: true } },
  } });
  if (!pipeline || !pipeline.ativo || pipeline.nome !== "Revisão de Radar") throw new Error("Identidade do pipeline divergiu.");
  const etapa = pipeline.etapas.find((item) => item.id === ETAPA_ID && item.nome === "Em tratativas");
  if (!etapa || etapa.formulario || etapa.capabilitiesJson || etapa.script) throw new Error("Etapa alterada; revisar plano antes de publicar.");
  const saidas = pipeline.transicoesEtapa.filter((item) => item.etapaOrigemId === ETAPA_ID);
  const nomeDestino = (id: string) => pipeline.etapas.find((item) => item.id === id)?.nome ?? "DESTINO_AUSENTE";
  const permitidas = saidas.filter((item) => DESTINOS.includes(nomeDestino(item.etapaDestinoId)));
  if (permitidas.length !== 5 || new Set(permitidas.map((item) => nomeDestino(item.etapaDestinoId))).size !== 5) {
    throw new Error("Os cinco destinos não foram encontrados univocamente.");
  }
  const habilitar = permitidas.filter((item) => !item.permitida);
  const desabilitar = saidas.filter((item) => item.permitida && !DESTINOS.includes(nomeDestino(item.etapaDestinoId)));
  const preview = {
    pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, configVersion: pipeline.configVersion,
    formulario: { secao: "Contato e follow-up", componentes: ["FOLLOW_UP_SCHEDULER", "FOLLOW_UP_CHECKLIST"] },
    script: "", perguntasAdicionais: "nenhuma — configuráveis na UI",
    saidasHabilitar: habilitar.map((item) => ({ id: item.id, destino: nomeDestino(item.etapaDestinoId) })),
    saidasDesabilitar: desabilitar.map((item) => ({ id: item.id, destino: nomeDestino(item.etapaDestinoId) })),
    saidasFinais: [...DESTINOS],
    inserts: { formulario: 1, secao: 1, componentes: 2, auditoria: 1 },
    updates: { pipeline: 1, etapa: 1, transicoes: habilitar.length + desabilitar.length },
  };
  if (!apply) {
    process.stdout.write(`${JSON.stringify({ mode: "preview", ...preview }, null, 2)}\n`);
  } else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Turso remoto explícito obrigatório.");
    const backup = option("backup"), manifest = option("manifest");
    const expectedVersion = Number(option("expect-version"));
    const adminId = Number(option("admin-id"));
    if (!backup || !manifest || expectedVersion !== pipeline.configVersion || !Number.isInteger(adminId) || adminId <= 0
      || option("approval") !== "AUTORIZO_EM_TRATATIVAS_REVISAO_RADAR") {
      throw new Error("Aplicação exige backup verificado, versão vigente, auditor e autorização específica.");
    }
    const manifesto = JSON.parse(readFileSync(manifest, "utf8"));
    const arquivo = statSync(backup);
    const criadoEm = new Date(manifesto.generatedAt ?? manifesto.createdAt).getTime();
    if (!backup.includes("database-backups/pre-change/") || arquivo.size < 1_000_000
      || arquivo.size !== manifesto.sizeBytes || !Number.isFinite(criadoEm)
      || criadoEm > Date.now() || Date.now() - criadoEm > 48 * 3600_000
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== manifesto.sha256) {
      throw new Error("Backup completo ausente, divergente ou vencido.");
    }
    execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
    if (!await db.usuarios.findUnique({ where: { id: adminId }, select: { id: true } })) throw new Error("Auditor não encontrado.");
    await db.$transaction(async (tx) => {
      const versao = await tx.bpmPipeline.updateMany({
        where: { id: PIPELINE_ID, configVersion: expectedVersion },
        data: { configVersion: { increment: 1 } },
      });
      if (versao.count !== 1) throw new Error("Versão mudou; publicação cancelada.");
      const atual = await tx.bpmEtapa.findUnique({ where: { id: ETAPA_ID }, select: { formulario: { select: { id: true } }, capabilitiesJson: true, script: true } });
      if (!atual || atual.formulario || atual.capabilitiesJson || atual.script) throw new Error("Etapa mudou; publicação cancelada.");
      await tx.bpmEtapa.update({ where: { id: ETAPA_ID }, data: {
        capabilitiesJson: JSON.stringify(["FOLLOW_UP_SCHEDULER", "FOLLOW_UP_CHECKLIST"]),
      } });
      await tx.bpmEtapaFormulario.create({ data: { etapaId: ETAPA_ID, ativo: true, secoes: { create: [{
        chave: "contato_e_followup", titulo: "Contato e follow-up", ordem: 0,
        componentes: { create: [
          { chave: "proximo_contato", tipo: "CAPABILITY", capability: "FOLLOW_UP_SCHEDULER", ordem: 0 },
          { chave: "ultimo_followup", tipo: "CAPABILITY", capability: "FOLLOW_UP_CHECKLIST", ordem: 1 },
        ] },
      }] } } });
      for (const item of habilitar) {
        const mudou = await tx.bpmTransicaoEtapa.updateMany({ where: { id: item.id, permitida: false }, data: { permitida: true } });
        if (mudou.count !== 1) throw new Error("Transição mudou; publicação cancelada.");
      }
      for (const item of desabilitar) {
        const mudou = await tx.bpmTransicaoEtapa.updateMany({ where: { id: item.id, permitida: true }, data: { permitida: false } });
        if (mudou.count !== 1) throw new Error("Transição mudou; publicação cancelada.");
      }
      await tx.bpmPipelineConfigAuditoria.create({ data: {
        pipelineId: PIPELINE_ID, adminId, campoAlterado: "EM_TRATATIVAS_CONFIGURACAO_PUBLICADA",
        valorAnteriorJson: JSON.stringify({ configVersion: expectedVersion, formulario: null, saidas: saidas.filter((item) => item.permitida).map((item) => nomeDestino(item.etapaDestinoId)) }),
        valorNovoJson: JSON.stringify({ configVersion: expectedVersion + 1, formulario: preview.formulario, saidas: DESTINOS }),
      } });
    });
    process.stdout.write(`${JSON.stringify({ mode: "apply", success: true, configVersion: expectedVersion + 1 })}\n`);
  }
} finally {
  await db.$disconnect();
}
