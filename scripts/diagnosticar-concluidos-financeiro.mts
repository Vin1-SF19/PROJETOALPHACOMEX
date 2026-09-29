/** Diagnóstico somente leitura da etapa Concluídos e do handoff operacional. */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");

try {
  const pipelines = await db.bpmPipeline.findMany({
    where: { OR: [{ chave: { in: ["financeiro", "operacional"] } }, { nome: { contains: "Operacional" } }] },
    select: {
      id: true, nome: true, chave: true, ativo: true, configVersion: true,
      etapas: {
        orderBy: { ordem: "asc" },
        select: {
          id: true, nome: true, chave: true, ativo: true, ordem: true, ehFinal: true,
          _count: { select: { cards: true } },
          formulario: {
            select: {
              id: true,
              versao: true,
              secoes: {
                select: {
                  chave: true,
                  componentes: { select: { campo: { select: { chave: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
  const financeiro = pipelines.find((pipeline) => pipeline.chave === "financeiro" && pipeline.ativo);
  const final = financeiro?.etapas.find((etapa) => etapa.chave === "contratacao_finalizada");
  const camposSolicitados = await db.bpmCampo.findMany({
    where: { chave: { in: ["alpha.contato.responsavel.representante", "alpha.observacoes.comerciais",
      "alpha.financeiro.data.conclusao.contratacao"] } },
    select: { id: true, chave: true, nome: true, pipelineId: true, ativo: true, tipo: true,
      escopo: true, fonteEntidade: true, fonteAtributo: true },
  });
  const [campos, configs, automacoes, transicoes] = financeiro && final ? await Promise.all([
    db.bpmCampo.findMany({ where: { ativo: true, OR: [{ pipelineId: financeiro.id },
      { pipelinesAssociados: { some: { pipelineId: financeiro.id } } }] },
      select: { id: true, chave: true, nome: true, tipo: true, escopo: true, fonteEntidade: true } }),
    db.bpmCampoEtapaConfig.findMany({ where: { etapaId: final.id },
      select: { campoId: true, visivel: true, editavel: true, somenteLeitura: true, obrigatorio: true } }),
    db.bpmAutomacao.findMany({ where: { pipelineId: financeiro.id },
      select: { chave: true, ativa: true, versoes: { where: { status: "ATIVA" },
        select: { versao: true, gatilhoTipo: true, gatilhoConfigJson: true, condicaoJson: true, grafoJson: true } } } }),
    db.bpmTransicaoEtapa.findMany({ where: { pipelineId: financeiro.id, etapaDestinoId: final.id },
      select: { etapaOrigem: { select: { chave: true } }, permitida: true, origem: true, lifecycleDestino: true } }),
  ]) : [[], [], [], []];
  const porId = new Map(campos.map((campo) => [campo.id, campo]));
  const cardsFinal = final ? await db.bpmCard.findMany({ where: { etapaId: final.id },
    select: { id: true, status: true, concluidoEm: true,
      empresa: { select: { cnpj: true, razaoSocial: true, pessoas: { where: { ativo: true },
        select: { principal: true, pessoa: { select: { nome: true } } } } } },
      campoValores: { select: { campoId: true, valor: true } },
      vinculosOrigem: { select: { cardDestino: { select: { pipelineId: true } } } } } }) : [];
  console.log(JSON.stringify({ pipelines: pipelines.map((pipeline) => ({
    ...pipeline, etapas: pipeline.etapas.map((etapa) => ({ id: etapa.id, chave: etapa.chave,
      nome: etapa.nome, ativo: etapa.ativo, ordem: etapa.ordem, ehFinal: etapa.ehFinal, cards: etapa._count.cards,
      formulario: etapa.formulario ? { id: etapa.formulario.id, versao: etapa.formulario.versao,
        secoes: etapa.formulario.secoes.map((secao) => ({ chave: secao.chave,
          campos: secao.componentes.map((componente) => componente.campo?.chave) })) } : null })) })),
    cardsFinal: cardsFinal.map((card) => {
      const valores = new Map(card.campoValores.map((item) => [porId.get(item.campoId)?.chave, item.valor?.trim()]));
      const requeridos = ["alpha.e.mail", "alpha.servico.contratado", "alpha.data.da.assinatura",
        "alpha.financeiro.valor.bruto.contrato", "alpha.financeiro.valor.liquido.pagamento",
        "alpha.forma.de.pagamento", "alpha.data.do.pagamento", "alpha.numero.da.nf",
        "alpha.arquivo.link.da.nf", "alpha.vendedor.a", "alpha.canal.origem.do.cliente",
        "alpha.observacoes.comerciais"];
      return { id: card.id, status: card.status, dataConclusao: Boolean(card.concluidoEm),
        camposPreenchidos: card.campoValores.filter((valor) => valor.valor?.trim()).length,
        cnpj: Boolean(card.empresa.cnpj), razaoSocial: Boolean(card.empresa.razaoSocial),
        contato: card.empresa.pessoas.some((item) => item.principal && item.pessoa.nome?.trim()),
        assinaturaConfirmada: valores.get("alpha.financeiro.status.contrato.assinatura") === "Assinado",
        pagamentoConfirmado: valores.get("alpha.pagamento.confirmado") === "Sim",
        nfEmitida: valores.get("alpha.nf.emitida") === "Sim",
        campos: Object.fromEntries(requeridos.map((chave) => [chave, Boolean(valores.get(chave))])),
        operacionalVinculado: card.vinculosOrigem.some((vinculo) => vinculo.cardDestino.pipelineId === "cmuih4tnh000409gm5z34jvss") };
    }),
    camposSolicitados,
    camposDisponiveis: campos.map((campo) => ({ chave: campo.chave, nome: campo.nome, tipo: campo.tipo,
      escopo: campo.escopo, fonteEntidade: campo.fonteEntidade })),
    camposFinal: configs.map((item) => ({ chave: porId.get(item.campoId)?.chave, nome: porId.get(item.campoId)?.nome,
      ...item })), automacoes: automacoes.map((item) => ({ chave: item.chave, ativa: item.ativa,
      versoes: item.versoes.map((versao) => ({ versao: versao.versao, gatilhoTipo: versao.gatilhoTipo,
        gatilhoConfig: JSON.parse(versao.gatilhoConfigJson), condicao: versao.condicaoJson ? JSON.parse(versao.condicaoJson) : null,
        grafo: JSON.parse(versao.grafoJson) })) })), transicoes }, null, 2));
} finally {
  await db.$disconnect();
}
