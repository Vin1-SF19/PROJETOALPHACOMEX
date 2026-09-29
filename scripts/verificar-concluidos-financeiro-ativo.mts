/** Leitura independente da publicação de Concluído e do handoff Operacional. */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const FINANCEIRO = "cmuih4i54000209gmmyqrg557";
const OPERACIONAL = "cmuih4tnh000409gm5z34jvss";
const ETAPA_FINAL = "draft-stage-61b69302-cf10-4be3-a537-93fc253e246e";
const ETAPA_NF = "draft-stage-66b7d19c-b953-4687-baff-0e529e082d4c";
const BOAS_VINDAS = "draft-stage-802def27-91ae-4231-b3f4-a251951c954a";
const CHAVE_AUTOMACAO = "financeiro.conclusao.automatica.contrato.pagamento.nf.dados";
const CHAVE_HANDOFF = "financeiro_concluido_criar_card_operacional";

try {
  const [financeiro, operacional, etapas, campos, configs, automacoes, transicoes] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: FINANCEIRO }, select: { configVersion: true } }),
    db.bpmPipeline.findUnique({ where: { id: OPERACIONAL }, select: { configVersion: true } }),
    db.bpmEtapa.findMany({ where: { id: { in: [ETAPA_FINAL, ETAPA_NF, BOAS_VINDAS] } },
      select: { id: true, formulario: { select: { versao: true, secoes: { select: { chave: true,
        componentes: { select: { campoId: true } } } } } } } }),
    db.bpmCampo.findMany({ where: { chave: { in: ["alpha.contato.responsavel.representante",
      "alpha.observacoes.comerciais", "alpha.financeiro.data.conclusao.contratacao"] } },
      select: { id: true, chave: true, ativo: true, tipo: true, escopo: true,
        fonteEntidade: true, fonteAtributo: true } }),
    db.bpmCampoEtapaConfig.findMany({ where: { etapaId: { in: [ETAPA_FINAL, BOAS_VINDAS] } },
      select: { etapaId: true, campoId: true, obrigatorioEntrada: true, visivel: true, editavel: true } }),
    db.bpmAutomacao.findMany({ where: { pipelineId: FINANCEIRO, chave: { in: [CHAVE_AUTOMACAO, CHAVE_HANDOFF] } },
      select: { chave: true, ativa: true, versoes: { where: { status: "ATIVA" }, select: { versao: true,
        gatilhoTipo: true, grafoJson: true } } } }),
    db.bpmTransicaoEtapa.findMany({ where: { etapaDestinoId: ETAPA_FINAL, permitida: true },
      select: { etapaOrigem: { select: { chave: true } }, lifecycleDestino: true, origem: true } }),
  ]);
  const formulario = (id: string) => etapas.find((etapa) => etapa.id === id)?.formulario;
  const componentes = (id: string) => formulario(id)?.secoes.flatMap((secao) => secao.componentes) ?? [];
  const auto = automacoes.find((item) => item.chave === CHAVE_AUTOMACAO);
  const handoff = automacoes.find((item) => item.chave === CHAVE_HANDOFF);
  const acoesAuto = auto?.versoes[0] ? JSON.parse(auto.versoes[0].grafoJson) as { nos: Array<{ acaoTipo?: string; parametros?: { etapaId?: string } }> } : null;
  const acoesHandoff = handoff?.versoes[0] ? JSON.parse(handoff.versoes[0].grafoJson) as { nos: Array<{ acaoTipo?: string; parametros?: { pipelineId?: string; etapaId?: string } }> } : null;
  const resultado = { financeiro: financeiro?.configVersion, operacional: operacional?.configVersion,
    formFinal: formulario(ETAPA_FINAL)?.versao, componentesFinal: componentes(ETAPA_FINAL).length,
    formNF: formulario(ETAPA_NF)?.versao, formBoasVindas: formulario(BOAS_VINDAS)?.versao,
    componentesBoasVindas: componentes(BOAS_VINDAS).length,
    campos: campos.map((campo) => ({ chave: campo.chave, ativo: campo.ativo, tipo: campo.tipo,
      escopo: campo.escopo, fonte: campo.fonteEntidade && `${campo.fonteEntidade}.${campo.fonteAtributo}` })),
    configsFinal: configs.filter((item) => item.etapaId === ETAPA_FINAL).length,
    obrigatoriosFinal: configs.filter((item) => item.etapaId === ETAPA_FINAL && item.obrigatorioEntrada).length,
    configsOperacional: configs.filter((item) => item.etapaId === BOAS_VINDAS).length,
    configsCamposFormularioOperacional: configs.filter((item) => item.etapaId === BOAS_VINDAS
      && componentes(BOAS_VINDAS).some((componente) => componente.campoId === item.campoId && item.visivel)).length,
    automacaoConclusao: { ativa: auto?.ativa, versao: auto?.versoes[0]?.versao,
      destino: acoesAuto?.nos.find((no) => no.acaoTipo === "MOVER_CARD")?.parametros?.etapaId },
    handoff: { ativa: handoff?.ativa, versao: handoff?.versoes[0]?.versao,
      destino: acoesHandoff?.nos.find((no) => no.acaoTipo === "CRIAR_CARD_OUTRO_PIPELINE")?.parametros },
    arestas: transicoes.filter((item) => ["formalizacao_contratacao", "confirmacao_pagamento", "emissao_nota_fiscal"]
      .includes(item.etapaOrigem.chave ?? "")).map((item) => ({ origem: item.etapaOrigem.chave,
      lifecycle: item.lifecycleDestino, permissao: item.origem })),
  };
  console.log(JSON.stringify(resultado, null, 2));
  if (resultado.financeiro !== 18 || resultado.operacional !== 8 || resultado.formFinal !== 1
    || resultado.componentesFinal !== 23 || resultado.formNF !== 4 || resultado.formBoasVindas !== 1
    || resultado.componentesBoasVindas !== 20 || campos.length !== 3 || campos.some((campo) => !campo.ativo)
    || resultado.configsFinal !== 23 || resultado.obrigatoriosFinal !== 21
    || resultado.configsCamposFormularioOperacional !== 20
    || resultado.automacaoConclusao.ativa !== true || resultado.automacaoConclusao.destino !== ETAPA_FINAL
    || resultado.handoff.ativa !== true || resultado.handoff.destino?.pipelineId !== OPERACIONAL
    || resultado.handoff.destino?.etapaId !== BOAS_VINDAS || resultado.arestas.length !== 3
    || resultado.arestas.some((item) => item.lifecycle !== "CONCLUIDO")) {
    throw new Error("Configuração publicada de Concluído/Operacional diverge do plano.");
  }
} finally {
  await db.$disconnect();
}
