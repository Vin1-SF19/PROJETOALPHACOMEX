/** Prévia read-only por padrão; publica o componente nativo de documentos da etapa. */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";
import { ETAPA_DOCUMENTACAO_ANALISE_ID, PIPELINE_DOCUMENTACAO_OPERACIONAL_ID } from "../src/lib/bpm/documentacao-analise";
import { CAMPO_CHECKLIST_EXCEL, ETAPA_ENVIO_CHECKLIST_ID } from "../src/lib/bpm/checklist-envio-operacional";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const aplicar = process.argv.includes("--apply");
const arg = (chave: string) => process.argv.slice(2).find((item) => item.startsWith(`--${chave}=`))?.slice(chave.length + 3);

try {
  const pipeline = await db.bpmPipeline.findUnique({ where: { id: PIPELINE_DOCUMENTACAO_OPERACIONAL_ID },
    select: { nome: true, ativo: true, configVersion: true, etapas: { where: { id: ETAPA_DOCUMENTACAO_ANALISE_ID },
      select: { id: true, ordem: true, formulario: { select: { id: true, versao: true,
        secoes: { select: { chave: true, componentes: { select: { tipo: true, capability: true } } } } } } } } } });
  const etapa = pipeline?.etapas[0];
  const componentes = etapa?.formulario?.secoes.flatMap((secao) => secao.componentes) ?? [];
  const checklistAnterior = pipeline?.configVersion === 11 ? await db.bpmCampo.findUnique({
    where: { chave: CAMPO_CHECKLIST_EXCEL }, select: { id: true, pipelineId: true,
      etapaConfiguracoes: { where: { etapaId: ETAPA_ENVIO_CHECKLIST_ID }, select: { visivel: true, obrigatorioSaida: true } },
      componentesFormulario: { where: { secao: { formulario: { etapaId: ETAPA_ENVIO_CHECKLIST_ID } } }, select: { id: true } },
    } }) : null;
  if (pipeline?.nome !== "Operacional" || !pipeline.ativo || ![10, 11].includes(pipeline.configVersion)
    || etapa?.ordem !== 3 || !etapa.formulario || etapa.formulario.secoes.some((secao) => secao.chave === "documentacao_pendente")
    || componentes.some((item) => item.tipo === "CHECKLIST" || item.capability === "STAGE_CHECKLIST")
    || (pipeline.configVersion === 11 && (!checklistAnterior
      || checklistAnterior.pipelineId !== PIPELINE_DOCUMENTACAO_OPERACIONAL_ID
      || checklistAnterior.etapaConfiguracoes.length !== 1
      || !checklistAnterior.etapaConfiguracoes[0].visivel
      || !checklistAnterior.etapaConfiguracoes[0].obrigatorioSaida
      || checklistAnterior.componentesFormulario.length !== 1))) {
    throw new Error("Pré-condições da etapa divergentes; refazer inventário.");
  }
  const versao = pipeline.configVersion;
  const plano = { mode: aplicar ? "apply" : "preview", pipelineId: PIPELINE_DOCUMENTACAO_OPERACIONAL_ID,
    etapaId: ETAPA_DOCUMENTACAO_ANALISE_ID, versaoDe: versao, versaoPara: versao + 1,
    componente: "STAGE_CHECKLIST", rotulo: "Documentos pendentes", obrigatorioSaida: false,
    formularioVersaoDe: etapa.formulario.versao, formularioVersaoPara: etapa.formulario.versao + 1,
    templatesExistentes: await db.bpmChecklistTemplate.count({ where: { pipelineId: PIPELINE_DOCUMENTACAO_OPERACIONAL_ID, ativo: true, excluidoEm: null } }),
    dadosDeCardsAlterados: false };
  if (!aplicar) console.log(JSON.stringify(plano, null, 2));
  else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")
      || arg("approval") !== "AUTORIZO_DOCUMENTACAO_OPERACIONAL"
      || Number(arg("expect-version")) !== versao || Number(arg("admin-id")) !== 1) {
      throw new Error("Ambiente, autorização ou versão inválidos.");
    }
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup Vault dedicado obrigatório.");
    const m = JSON.parse(readFileSync(manifest, "utf8")), b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || m.reason !== `operacional-documentacao-v${versao + 1}`
      || !Number.isFinite(criado) || criado > Date.now() || Date.now() - criado > 48 * 3600_000
      || b.size < 1_000_000 || b.size !== m.sizeBytes
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) {
      throw new Error("Backup dedicado, completo, íntegro e recente obrigatório.");
    }
    await verificarBackupTurso(backup, manifest);
    await db.$transaction(async (tx) => {
      const reservado = await tx.bpmPipeline.updateMany({ where: { id: PIPELINE_DOCUMENTACAO_OPERACIONAL_ID,
        configVersion: versao }, data: { configVersion: { increment: 1 } } });
      if (reservado.count !== 1) throw new Error("Versão do Operacional mudou durante a publicação.");
      const secao = await tx.bpmFormularioSecao.create({ data: { formularioId: etapa.formulario!.id,
        chave: "documentacao_pendente", titulo: "Documentação em análise", ordem: 4 } });
      await tx.bpmFormularioComponente.create({ data: { secaoId: secao.id, chave: "stage-checklist-documentacao",
        tipo: "CHECKLIST", capability: "STAGE_CHECKLIST", ordem: 0,
        configJson: JSON.stringify({ label: "Documentos pendentes", obrigatorioSaida: false }) } });
      await tx.bpmEtapaFormulario.update({ where: { id: etapa.formulario!.id }, data: { versao: { increment: 1 } } });
    }, { maxWait: 20_000, timeout: 120_000 });
    console.log(JSON.stringify({ ...plano, sucesso: true }));
  }
} finally { await db.$disconnect(); }
