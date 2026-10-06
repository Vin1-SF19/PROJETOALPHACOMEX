/** Conferência somente leitura da publicação dos campos de revisão do Operacional. */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");

const pipelineId = "cmuih4tnh000409gm5z34jvss";
const chaves = [
  "alpha.operacional.revisao.resultado",
  "alpha.operacional.protocolo.anotacao",
  "alpha.operacional.protocolo.data",
  "alpha.operacional.protocolo.certificado",
  "alpha.operacional.protocolo.numero",
  "alpha.operacional.protocolo.documentos_juntados",
  "alpha.operacional.protocolo.codigos_corretos",
];

try {
  const campos = await db.bpmCampo.findMany({ where: { pipelineId, chave: { in: chaves } },
    select: { id: true, chave: true, tipo: true, ativo: true } });
  const ids = campos.map((campo) => campo.id);
  const [pipeline, configuracoes, componentes, secoes, requisitos, vinculosRedundantes, formularios, cards] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: pipelineId }, select: { configVersion: true } }),
    db.bpmCampoEtapaConfig.count({ where: { campoId: { in: ids } } }),
    db.bpmFormularioComponente.count({ where: { campoId: { in: ids } } }),
    db.bpmFormularioSecao.count({ where: { chave: { in: ["revisao_resultado", "protocolo_registro", "protocolo_revisao"] },
      formulario: { etapa: { pipelineId } } } }),
    db.bpmRequisito.findMany({ where: { pipelineId, chave: { in: [
      "alpha.operacional.protocolo.revisao.documentos_nao_confirmados",
      "alpha.operacional.protocolo.revisao.codigos_nao_confirmados",
    ] } }, select: { fase: true, ativo: true, condicaoJson: true } }),
    db.bpmCampoPipeline.count({ where: { campoId: { in: ids }, pipelineId } }),
    db.bpmEtapaFormulario.findMany({ where: { etapa: { pipelineId, ordem: { gte: 4 } } }, select: { versao: true } }),
    db.bpmCard.count({ where: { pipelineId } }),
  ]);
  const resumo = {
    versao: pipeline?.configVersion,
    campos: campos.length,
    todosAtivos: campos.every((campo) => campo.ativo),
    confirmacoesBooleanas: campos.filter((campo) => campo.chave?.endsWith("documentos_juntados")
      || campo.chave?.endsWith("codigos_corretos")).filter((campo) => campo.tipo === "booleano").length,
    configuracoes, componentes, secoes,
    requisitos: requisitos.length,
    regrasAtivasSaida: requisitos.filter((requisito) => requisito.ativo && requisito.fase === "EXIT_STAGE"
      && requisito.condicaoJson?.includes('"diferente"') && requisito.condicaoJson.includes('"Sim"')).length,
    vinculosRedundantes,
    formulariosVersao4: formularios.filter((formulario) => formulario.versao === 4).length,
    cards,
  };
  console.log(JSON.stringify(resumo));
  if (resumo.versao !== 13 || resumo.campos !== 7 || !resumo.todosAtivos || resumo.confirmacoesBooleanas !== 2
    || resumo.configuracoes !== 54 || resumo.componentes !== 54 || resumo.secoes !== 24 || resumo.requisitos !== 2
    || resumo.regrasAtivasSaida !== 2 || resumo.vinculosRedundantes !== 0 || resumo.formulariosVersao4 !== 9) {
    process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
