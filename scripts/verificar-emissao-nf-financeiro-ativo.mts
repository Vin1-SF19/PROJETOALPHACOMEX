/** Leitura independente da configuração publicada de NF no Financeiro ativo. */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const pipelineId = "cmuih4i54000209gmmyqrg557";
const chaves = ["alpha.nf.emitida", "alpha.numero.da.nf", "alpha.data.de.emissao",
  "alpha.valor.da.nf", "alpha.arquivo.link.da.nf"];

try {
  const [pipeline, etapa, campos, requisitos, automacoes] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: pipelineId }, select: { configVersion: true } }),
    db.bpmEtapa.findFirst({ where: { pipelineId, chave: "emissao_nota_fiscal" },
      select: { formulario: { select: { versao: true, secoes: { select: { chave: true,
        componentes: { select: { campoId: true } } } } } }, _count: { select: { cards: true } } } }),
    db.bpmCampo.findMany({ where: { pipelineId, chave: { in: chaves } },
      select: { id: true, chave: true, tipo: true, ativo: true, visivel: true, editavel: true,
        etapaConfiguracoes: { select: { condicaoObrigatoriedadeJson: true, valorPadrao: true } } } }),
    db.bpmRequisito.findMany({ where: { pipelineId, chave: { startsWith: "financeiro.nf.ativo." } },
      select: { chave: true, ativo: true, fase: true } }),
    db.bpmAutomacao.findMany({ where: { pipelineId, chave: { startsWith: "financeiro.pagamento.ativo.estado." } },
      select: { chave: true, versoes: { where: { status: "ATIVA" }, select: { versao: true, grafoJson: true } } } }),
  ]);
  const secao = etapa?.formulario?.secoes.find((item) => item.chave === "nota_fiscal");
  const idsCampos = new Set(campos.map((campo) => campo.id));
  const camposPorChave = new Map(campos.map((campo) => [campo.chave, campo]));
  const titulos = automacoes.map((automacao) => ({ chave: automacao.chave,
    versoes: automacao.versoes.map((versao) => versao.versao),
    titulos: automacao.versoes.map((versao) => {
      const grafo = JSON.parse(versao.grafoJson) as { nos: Array<{ acaoTipo?: string; parametros?: { tipo?: string; titulo?: string } }> };
      return grafo.nos.find((no) => no.acaoTipo === "CRIAR_TAREFA" && no.parametros?.tipo === "EMISSAO_NF")?.parametros?.titulo;
    }),
  }));
  const resultado = { versao: pipeline?.configVersion, formulario: etapa?.formulario?.versao,
    cardsNaEtapa: etapa?._count.cards, componentesNF: secao?.componentes.length,
    campos: campos.map((campo) => ({ chave: campo.chave, tipo: campo.tipo, ativo: campo.ativo,
      visivel: campo.visivel, editavel: campo.editavel, configuracoes: campo.etapaConfiguracoes.length,
      obrigatoriedadeCondicional: Boolean(campo.etapaConfiguracoes[0]?.condicaoObrigatoriedadeJson),
      valorPadrao: campo.etapaConfiguracoes[0]?.valorPadrao })), requisitos, automacoes: titulos };
  console.log(JSON.stringify(resultado, null, 2));
  if (resultado.versao !== 17 || resultado.formulario !== 3 || resultado.componentesNF !== 5
    || campos.length !== 5 || secao?.componentes.some((componente) => !componente.campoId || !idsCampos.has(componente.campoId))
    || campos.some((campo) => !campo.ativo || !campo.visivel || !campo.editavel || campo.etapaConfiguracoes.length !== 1)
    || camposPorChave.get(chaves[0])?.tipo !== "selecao"
    || chaves.slice(1).some((chave) => !camposPorChave.get(chave)?.etapaConfiguracoes[0]?.condicaoObrigatoriedadeJson)
    || camposPorChave.get(chaves[2])?.etapaConfiguracoes[0]?.valorPadrao !== "{{agora.data}}"
    || requisitos.length !== 5 || requisitos.some((requisito) => !requisito.ativo)
    || titulos.length !== 4 || titulos.some((item) => item.versoes.length !== 1 || item.versoes[0] !== 2
      || item.titulos[0] !== "Emitir NF – {{empresa.razaoSocial}}")) {
    throw new Error("Configuração publicada da NF não corresponde ao plano.");
  }
} finally {
  await db.$disconnect();
}
