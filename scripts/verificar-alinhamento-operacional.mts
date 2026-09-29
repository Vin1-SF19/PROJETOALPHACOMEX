/** Verificação read-only da configuração publicada de Alinhamento Estratégico. */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const OPERACIONAL = "cmuih4tnh000409gm5z34jvss";
const ALINHAMENTO = "draft-stage-fea7d252-8276-439f-9b39-c676c15d7cf9";
const CHAVES = ["alpha.operacional.analista.responsavel", "alpha.operacional.analista.nome",
  "alpha.operacional.analista.cpf",
  "alpha.operacional.alinhamento.link.resumo"];

try {
  const [pipeline, campos] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: OPERACIONAL }, select: { configVersion: true,
      etapas: { where: { ativo: true }, select: { id: true, ordem: true,
        formulario: { select: { versao: true,
          secoes: { select: { componentes: { select: { campoId: true } } } } } },
      } } } }),
    db.bpmCampo.findMany({ where: { chave: { in: CHAVES } }, select: { id: true, chave: true,
      tipo: true, escopo: true, fonteEntidade: true, fonteAtributo: true,
      etapaConfiguracoes: { where: { etapaId: ALINHAMENTO }, select: {
        obrigatorioSaida: true, visivel: true } },
    } }),
  ]);
  const etapa = pipeline?.etapas.find((item) => item.id === ALINHAMENTO);
  const porChave = new Map(campos.map((campo) => [campo.chave, campo]));
  const nome = porChave.get(CHAVES[1]), cpf = porChave.get(CHAVES[2]), link = porChave.get(CHAVES[3]);
  const posteriores = pipeline?.etapas.filter((item) => item.ordem >= (etapa?.ordem ?? 99)) ?? [];
  const transportados = posteriores.every((item) => {
    const ids = new Set(item.formulario?.secoes.flatMap((secao) => secao.componentes.map((componente) => componente.campoId)));
    return ids.has(nome?.id ?? "") && ids.has(cpf?.id ?? "") && ids.has(link?.id ?? "");
  });
  const resultado = { pipelineVersao: pipeline?.configVersion, campos: campos.length,
    alinhamentoFormularioVersao: etapa?.formulario?.versao,
    alinhamentoComponentes: etapa?.formulario?.secoes.reduce((total, secao) => total + secao.componentes.length, 0),
    obrigatoriosSaida: campos.filter((campo) => campo.etapaConfiguracoes[0]?.obrigatorioSaida
      && campo.etapaConfiguracoes[0]?.visivel).length,
    nomeCanonico: nome?.tipo === "texto" && nome.escopo === "GLOBAL"
      && nome.fonteEntidade === "USUARIO" && nome.fonteAtributo === "nome",
    cpfCanonico: cpf?.tipo === "cpf" && cpf.escopo === "GLOBAL"
      && cpf.fonteEntidade === "USUARIO" && cpf.fonteAtributo === "cpf",
    linkUrl: link?.tipo === "url" && link.escopo === "CARD",
    etapasComDados: posteriores.length, transportados,
  };
  if (resultado.pipelineVersao !== 10 || resultado.campos !== 4
    || resultado.alinhamentoFormularioVersao !== 2 || resultado.alinhamentoComponentes !== 22
    || resultado.obrigatoriosSaida !== 4 || !resultado.nomeCanonico || !resultado.cpfCanonico || !resultado.linkUrl
    || resultado.etapasComDados !== 12 || !resultado.transportados) {
    throw new Error(`Publicação incompleta: ${JSON.stringify(resultado)}`);
  }
  console.log(JSON.stringify({ verificado: true, ...resultado }));
} finally {
  await db.$disconnect();
}
