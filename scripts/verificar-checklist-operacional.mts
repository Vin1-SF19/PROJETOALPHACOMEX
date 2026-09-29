/** Leitura independente da configuração publicada do checklist operacional. */
import { config } from "dotenv";
import {
  CAMPO_CHECKLIST_EXCEL, ETAPA_ENVIO_CHECKLIST_ID, PIPELINE_OPERACIONAL_CHECKLIST_ID,
} from "../src/lib/bpm/checklist-envio-operacional";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
try {
  const [pipeline, campo] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: PIPELINE_OPERACIONAL_CHECKLIST_ID }, select: {
      configVersion: true, etapas: { where: { ativo: true }, select: { id: true, ordem: true,
        formulario: { select: { versao: true, secoes: { select: { componentes: { select: { campoId: true } } } } } } } },
    } }),
    db.bpmCampo.findUnique({ where: { chave: CAMPO_CHECKLIST_EXCEL }, select: {
      id: true, tipo: true, escopo: true, pipelineId: true, ativo: true,
      etapaConfiguracoes: { select: { etapaId: true, visivel: true, obrigatorioSaida: true } },
    } }),
  ]);
  const etapas = pipeline?.etapas.filter((item) => item.ordem >= 2) ?? [];
  const etapa = etapas.find((item) => item.id === ETAPA_ENVIO_CHECKLIST_ID);
  const configuracoes = campo?.etapaConfiguracoes.filter((item) => item.visivel) ?? [];
  const resultado = { verificado: pipeline?.configVersion === 11 && campo?.ativo === true
      && campo.tipo === "arquivo" && campo.escopo === "CARD" && campo.pipelineId === PIPELINE_OPERACIONAL_CHECKLIST_ID
      && configuracoes.length === etapas.length && etapas.length === 11
      && configuracoes.every((item) => item.obrigatorioSaida === (item.etapaId === ETAPA_ENVIO_CHECKLIST_ID))
      && etapa?.formulario?.versao === 3
      && etapa.formulario.secoes.flatMap((secao) => secao.componentes).filter((item) => item.campoId === campo.id).length === 1,
    pipelineVersao: pipeline?.configVersion, etapasComCampo: configuracoes.length,
    formularioEtapaVersao: etapa?.formulario?.versao,
    obrigatorioSaida: configuracoes.find((item) => item.etapaId === ETAPA_ENVIO_CHECKLIST_ID)?.obrigatorioSaida ?? false };
  console.log(JSON.stringify(resultado));
  if (!resultado.verificado) process.exitCode = 1;
} finally { await db.$disconnect(); }
