/** Publicação configuracional protegida: Próximo Contato em Sem viabilidade. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: dbImport } = await import("../src/lib/prisma");
const db = dbImport;

const PIPELINE_ID = "cmuih48la000009gmzw3wwuzf";
const ETAPA_ID = "draft-stage-fbd48b37-faa8-4740-aa50-61e925a36ac5";
const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const aplicar = args.includes("--apply");
if (aplicar === args.includes("--preview")) throw new Error("Escolha --preview ou --apply.");

try {
  const [pipeline, etapa] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: PIPELINE_ID }, select: { nome: true, ativo: true, configVersion: true } }),
    db.bpmEtapa.findUnique({ where: { id: ETAPA_ID }, select: {
      nome: true, pipelineId: true, ehFinal: true, capabilitiesJson: true,
      formulario: { select: { id: true } },
    } }),
  ]);
  if (!pipeline?.ativo || pipeline.nome !== "Revisão de Radar"
    || !etapa || etapa.pipelineId !== PIPELINE_ID || etapa.nome !== "Sem viabilidade"
    || !etapa.ehFinal || etapa.capabilitiesJson || etapa.formulario) {
    throw new Error("Configuração da etapa mudou; revisar plano.");
  }
  const preview = {
    pipeline: { id: PIPELINE_ID, version: pipeline.configVersion },
    etapa: { id: ETAPA_ID, nome: etapa.nome },
    inserts: { formulario: 1, secao: 1, componente: 1, auditoria: 1 },
    updates: { capabilityEtapa: "FOLLOW_UP_SCHEDULER", configVersion: pipeline.configVersion + 1 },
    regra: { obrigatorioEntrada: true, obrigatorioSaida: false, valor: "BpmCard.proximoContatoEm" },
  };
  if (!aplicar) {
    process.stdout.write(`${JSON.stringify({ mode: "preview", ...preview }, null, 2)}\n`);
  } else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Turso remoto explícito obrigatório.");
    const backup = option("backup"), manifest = option("manifest");
    const versao = Number(option("radar-version")), adminId = Number(option("admin-id"));
    if (!backup || !manifest || versao !== pipeline.configVersion
      || !Number.isSafeInteger(adminId) || adminId <= 0
      || option("approval") !== "AUTORIZO_SEM_VIABILIDADE_RADAR") {
      throw new Error("Aplicação exige backup, versão vigente, auditor e autorização específica.");
    }
    const manifesto = JSON.parse(readFileSync(manifest, "utf8"));
    const arquivo = statSync(backup);
    const criadoEm = new Date(manifesto.generatedAt ?? manifesto.createdAt).getTime();
    if (!backup.includes("database-backups/pre-change/") || arquivo.size < 1_000_000
      || arquivo.size !== manifesto.sizeBytes || !Number.isFinite(criadoEm)
      || criadoEm > Date.now() || Date.now() - criadoEm > 48 * 3600_000
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== manifesto.sha256) {
      throw new Error("Backup ausente, divergente ou vencido.");
    }
    execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
    if (!await db.usuarios.findUnique({ where: { id: adminId }, select: { id: true } })) throw new Error("Auditor não encontrado.");
    await db.$transaction(async (tx) => {
      const mudou = await tx.bpmPipeline.updateMany({
        where: { id: PIPELINE_ID, configVersion: versao },
        data: { configVersion: { increment: 1 } },
      });
      if (mudou.count !== 1) throw new Error("Versão mudou; cancelado.");
      const atual = await tx.bpmEtapa.findUnique({ where: { id: ETAPA_ID }, select: {
        capabilitiesJson: true, formulario: { select: { id: true } },
      } });
      if (!atual || atual.capabilitiesJson || atual.formulario) throw new Error("Etapa mudou; cancelado.");
      await tx.bpmEtapa.update({ where: { id: ETAPA_ID }, data: {
        capabilitiesJson: JSON.stringify(["FOLLOW_UP_SCHEDULER"]),
      } });
      await tx.bpmEtapaFormulario.create({ data: {
        etapaId: ETAPA_ID, ativo: true,
        secoes: { create: [{
          chave: "proximo_contato", titulo: "Acompanhamento", ordem: 0,
          componentes: { create: [{
            chave: "proximo_contato", tipo: "CAPABILITY", capability: "FOLLOW_UP_SCHEDULER", ordem: 0,
            configJson: JSON.stringify({ obrigatorioEntrada: true, obrigatorioSaida: false }),
          }] },
        }] },
      } });
      await tx.bpmPipelineConfigAuditoria.create({ data: {
        pipelineId: PIPELINE_ID, adminId,
        campoAlterado: "SEM_VIABILIDADE_PROXIMO_CONTATO_PUBLICADO",
        valorAnteriorJson: JSON.stringify({ configVersion: versao, formulario: null }),
        valorNovoJson: JSON.stringify({ configVersion: versao + 1, etapaId: ETAPA_ID, obrigatorioEntrada: true }),
      } });
    });
    process.stdout.write(`${JSON.stringify({ mode: "apply", success: true, radarVersion: versao + 1 })}\n`);
  }
} finally {
  await db.$disconnect();
}
