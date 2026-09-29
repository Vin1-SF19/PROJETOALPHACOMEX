/** Conferência somente leitura da configuração publicada na coluna documental. */
import { config } from "dotenv";
import { ETAPA_DOCUMENTACAO_ANALISE_ID, PIPELINE_DOCUMENTACAO_OPERACIONAL_ID } from "../src/lib/bpm/documentacao-analise";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");

try {
  const pipeline = await db.bpmPipeline.findUnique({
    where: { id: PIPELINE_DOCUMENTACAO_OPERACIONAL_ID },
    select: {
      configVersion: true,
      etapas: {
        where: { id: ETAPA_DOCUMENTACAO_ANALISE_ID },
        select: {
          formulario: {
            select: {
              versao: true,
              secoes: {
                select: {
                  chave: true,
                  componentes: { select: { tipo: true, capability: true, configJson: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  const formulario = pipeline?.etapas[0]?.formulario;
  const secao = formulario?.secoes.find((item) => item.chave === "documentacao_pendente");
  const componente = secao?.componentes.find((item) => item.tipo === "CHECKLIST" && item.capability === "STAGE_CHECKLIST");
  let configuracao: unknown;
  try { configuracao = JSON.parse(componente?.configJson ?? "null"); } catch { configuracao = null; }
  const configValida = configuracao && typeof configuracao === "object" && "obrigatorioSaida" in configuracao
    && configuracao.obrigatorioSaida === false && "label" in configuracao
    && configuracao.label === "Documentos pendentes";
  const verificado = pipeline?.configVersion === 12 && formulario?.versao === 4
    && secao?.componentes.length === 1 && Boolean(configValida);
  console.log(JSON.stringify({ verificado, pipelineVersao: pipeline?.configVersion,
    formularioVersao: formulario?.versao, componente: componente?.capability ?? null }));
  if (!verificado) process.exitCode = 1;
} finally { await db.$disconnect(); }
