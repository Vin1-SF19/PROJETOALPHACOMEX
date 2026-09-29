/** Publica o campo Excel do checklist no Operacional; prévia read-only por padrão. */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";
import {
  CAMPO_CHECKLIST_EXCEL, ETAPA_ENVIO_CHECKLIST_ID, PIPELINE_OPERACIONAL_CHECKLIST_ID,
} from "../src/lib/bpm/checklist-envio-operacional";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const VERSAO = 10;
const MOTIVO_BACKUP = "operacional-checklist-excel-v11";
const aplicar = process.argv.includes("--apply");
const arg = (chave: string) => process.argv.slice(2).find((item) => item.startsWith(`--${chave}=`))?.slice(chave.length + 3);

try {
  const [pipeline, duplicado] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: PIPELINE_OPERACIONAL_CHECKLIST_ID }, select: {
      nome: true, ativo: true, configVersion: true,
      etapas: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, ordem: true,
        formulario: { select: { id: true, versao: true,
          secoes: { select: { componentes: { select: { id: true } } } } } } } },
    } }),
    db.bpmCampo.findUnique({ where: { chave: CAMPO_CHECKLIST_EXCEL }, select: { id: true } }),
  ]);
  const etapa = pipeline?.etapas.find((item) => item.id === ETAPA_ENVIO_CHECKLIST_ID);
  if (pipeline?.nome !== "Operacional" || !pipeline.ativo || pipeline.configVersion !== VERSAO
    || pipeline.etapas.length !== 13 || etapa?.ordem !== 2 || etapa.formulario?.versao !== 2
    || etapa.formulario.secoes.flatMap((secao) => secao.componentes).length !== 22
    || pipeline.etapas.some((item) => !item.formulario) || duplicado) {
    throw new Error("Pré-condições do checklist divergentes; refazer inventário antes de publicar.");
  }
  const destinos = pipeline.etapas.filter((item) => item.ordem >= etapa.ordem);
  const plano = { mode: aplicar ? "apply" : "preview", pipelineId: PIPELINE_OPERACIONAL_CHECKLIST_ID,
    versaoDe: VERSAO, versaoPara: VERSAO + 1, etapaId: etapa.id,
    campoNovo: CAMPO_CHECKLIST_EXCEL, tipo: "arquivo", formatos: [".xlsx", ".xls"],
    etapasComCampo: destinos.length, formularioEtapaDe: 2, formularioEtapaPara: 3,
    componentesEtapaDe: 22, componentesEtapaPara: 23,
    obrigatorioSaida: true, cardsExistentesAlterados: false };
  if (!aplicar) console.log(JSON.stringify(plano, null, 2));
  else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")
      || arg("approval") !== "AUTORIZO_CHECKLIST_OPERACIONAL"
      || Number(arg("expect-version")) !== VERSAO || Number(arg("admin-id")) !== 1) {
      throw new Error("Ambiente, autorização ou versão inválidos.");
    }
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup Vault dedicado obrigatório.");
    const m = JSON.parse(readFileSync(manifest, "utf8")), b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || m.reason !== MOTIVO_BACKUP
      || !Number.isFinite(criado) || criado > Date.now() || Date.now() - criado > 48 * 3600_000
      || b.size < 1_000_000 || b.size !== m.sizeBytes
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) {
      throw new Error("Backup dedicado, completo, íntegro e recente obrigatório.");
    }
    await verificarBackupTurso(backup, manifest);
    await db.$transaction(async (tx) => {
      const reservado = await tx.bpmPipeline.updateMany({ where: { id: PIPELINE_OPERACIONAL_CHECKLIST_ID,
        configVersion: VERSAO }, data: { configVersion: { increment: 1 } } });
      if (reservado.count !== 1) throw new Error("Versão do Operacional mudou durante a publicação.");
      const campo = await tx.bpmCampo.create({ data: { pipelineId: PIPELINE_OPERACIONAL_CHECKLIST_ID,
        chave: CAMPO_CHECKLIST_EXCEL, nome: "Checklist atualizado (Excel)", tipo: "arquivo",
        escopo: "CARD", visivel: true, editavel: true, somenteLeitura: false, ativo: true, ordem: 510 } });
      await tx.bpmCampoPipeline.create({ data: { campoId: campo.id, pipelineId: PIPELINE_OPERACIONAL_CHECKLIST_ID } });
      for (const destino of destinos) {
        await tx.bpmCampoEtapaConfig.create({ data: { campoId: campo.id, etapaId: destino.id,
          visivel: true, editavel: true, somenteLeitura: false,
          obrigatorioSaida: destino.id === etapa.id, ordem: 510, grupo: "Checklist atualizado" } });
        const formulario = destino.formulario!;
        const secao = await tx.bpmFormularioSecao.create({ data: { formularioId: formulario.id,
          chave: "checklist_atualizado", titulo: "Checklist atualizado", ordem: 3 } });
        await tx.bpmFormularioComponente.create({ data: { secaoId: secao.id,
          chave: `campo:${campo.id}`, tipo: "CAMPO", campoId: campo.id, ordem: 0 } });
        await tx.bpmEtapaFormulario.update({ where: { id: formulario.id }, data: { versao: { increment: 1 } } });
      }
    }, { maxWait: 20_000, timeout: 180_000 });
    console.log(JSON.stringify({ ...plano, sucesso: true }));
  }
} finally { await db.$disconnect(); }
