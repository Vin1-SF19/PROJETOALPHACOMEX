/** Verificação read-only da configuração publicada de Boas-vindas. */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");

const OPERACIONAL = "cmuih4tnh000409gm5z34jvss";
const FINANCEIRO = "cmuih4i54000209gmmyqrg557";
const BOAS = "draft-stage-802def27-91ae-4231-b3f4-a251951c954a";
const HANDOFF = "financeiro_concluido_criar_card_operacional";

try {
  const [pipeline, camposNovos, configs, handoff] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: OPERACIONAL }, select: { configVersion: true,
      etapas: { where: { ativo: true }, select: { id: true, formulario: { select: { versao: true,
        secoes: { select: { componentes: { select: { id: true } } } } } } } } } }),
    db.bpmCampo.findMany({ where: { pipelineId: OPERACIONAL,
      chave: { startsWith: "alpha.operacional." } }, select: { id: true, chave: true } }),
    db.bpmCampoEtapaConfig.findMany({ where: { etapaId: BOAS, obrigatorioSaida: true },
      select: { campoId: true, visivel: true, editavel: true, somenteLeitura: true } }),
    db.bpmAutomacao.findUnique({ where: { pipelineId_chave: { pipelineId: FINANCEIRO, chave: HANDOFF } },
      select: { versoes: { where: { status: "ATIVA" }, select: { versao: true, grafoJson: true } } } }),
  ]);
  const boas = pipeline?.etapas.find((etapa) => etapa.id === BOAS);
  const grafo = JSON.parse(handoff?.versoes[0]?.grafoJson ?? "null") as {
    nos?: Array<{ acaoTipo?: string; parametros?: { responsavelId?: number } }>;
  } | null;
  const criacao = grafo?.nos?.find((no) => no.acaoTipo === "CRIAR_CARD_OUTRO_PIPELINE");
  const resultado = {
    pipelineVersao: pipeline?.configVersion,
    etapasAtivas: pipeline?.etapas.length,
    etapasComFormulario: pipeline?.etapas.filter((etapa) => Boolean(etapa.formulario)).length,
    boasFormularioVersao: boas?.formulario?.versao,
    boasComponentes: boas?.formulario?.secoes.reduce((soma, secao) => soma + secao.componentes.length, 0),
    camposNovos: camposNovos.length,
    camposObrigatoriosSaida: configs.length,
    camposObrigatoriosEditaveis: configs.filter((item) => item.visivel && item.editavel && !item.somenteLeitura).length,
    handoffVersaoAtiva: handoff?.versoes[0]?.versao,
    responsavelInicialId: criacao?.parametros?.responsavelId,
  };
  if (resultado.pipelineVersao !== 9 || resultado.etapasAtivas !== 13
    || resultado.etapasComFormulario !== 13 || resultado.boasFormularioVersao !== 2
    || resultado.boasComponentes !== 37 || resultado.camposNovos !== 8
    || resultado.camposObrigatoriosSaida !== 17 || resultado.camposObrigatoriosEditaveis !== 17
    || resultado.handoffVersaoAtiva !== 2 || resultado.responsavelInicialId !== 10) {
    throw new Error(`Publicação incompleta: ${JSON.stringify(resultado)}`);
  }
  console.log(JSON.stringify({ verificado: true, ...resultado }));
} finally {
  await db.$disconnect();
}
