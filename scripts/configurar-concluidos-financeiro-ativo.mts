/** Prévia somente leitura por padrão; --apply exige checkpoint Vault específico. */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { CHAVES_CAMPOS: K } = await import("../src/lib/bpm/financeiro-config.client");
const { validarGrafoAutomacao, gatilhoConfigSchema } = await import("../src/lib/bpm/automacoes/central-schemas");
const { grupoCondicaoSchema } = await import("../src/lib/bpm/regras/schemas");

const FINANCEIRO = "cmuih4i54000209gmmyqrg557";
const OPERACIONAL = "cmuih4tnh000409gm5z34jvss";
const BOAS_VINDAS = "draft-stage-802def27-91ae-4231-b3f4-a251951c954a";
const VERSAO_FINANCEIRO = 17;
const VERSAO_OPERACIONAL = 7;
const CHAVE_AUTOMACAO = "financeiro.conclusao.automatica.contrato.pagamento.nf.dados";
const CHAVE_HANDOFF = "financeiro_concluido_criar_card_operacional";
const CONTATO = K.CONTATO_RESPONSAVEL;
const OBSERVACOES = K.OBSERVACOES_COMERCIAIS;
const CONCLUIDO_EM = "alpha.financeiro.data.conclusao.contratacao";
const NOVOS = [CONTATO, OBSERVACOES, CONCLUIDO_EM];
const CAMPOS_FINAL = [K.CNPJ, K.RAZAO_SOCIAL, CONTATO, K.EMAIL, K.SERVICO_CONTRATADO,
  K.STATUS_ASSINATURA, K.DATA_ASSINATURA, K.ANEXO_ASSINADO, K.VALOR_CONTRATADO,
  K.VALOR_LIQUIDO, K.FORMA_PAGAMENTO, K.PAGAMENTO_CONFIRMADO, K.DATA_PAGAMENTO,
  K.NF_EMITIDA, K.NUMERO_NF, K.DATA_EMISSAO_NF, K.VALOR_NF, K.LINK_NF,
  K.VENDEDOR_RESPONSAVEL, K.PARCEIRO_RESPONSAVEL, K.ORIGEM_CLIENTE,
  OBSERVACOES, CONCLUIDO_EM];
const CAMPOS_OPERACIONAL = CAMPOS_FINAL.filter((chave) =>
  chave !== CONCLUIDO_EM && chave !== K.LINK_NF && chave !== K.ANEXO_ASSINADO);
const OPCIONAIS_ENTRADA = new Set<string>([K.PARCEIRO_RESPONSAVEL, CONCLUIDO_EM]);
const OPCIONAIS_OPERACIONAL = new Set<string>([K.PARCEIRO_RESPONSAVEL]);
const arg = (key: string) => process.argv.slice(2).find((item) => item.startsWith(`--${key}=`))?.slice(key.length + 3);
const aplicar = process.argv.includes("--apply");

try {
  const [financeiro, operacional, campos, automacao, handoff, transicoes] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: FINANCEIRO }, select: { chave: true, ativo: true, configVersion: true,
      etapas: { where: { chave: { in: ["formalizacao_contratacao", "confirmacao_pagamento", "emissao_nota_fiscal", "contratacao_finalizada"] } },
        select: { id: true, chave: true, ativo: true, _count: { select: { cards: true } },
          formulario: { select: { id: true, versao: true, secoes: { select: { chave: true } } } } } } } }),
    db.bpmPipeline.findUnique({ where: { id: OPERACIONAL }, select: { nome: true, chave: true, ativo: true,
      configVersion: true, etapas: { where: { id: BOAS_VINDAS }, select: { id: true, ativo: true, formulario: { select: { id: true } } } } } }),
    db.bpmCampo.findMany({ where: { chave: { in: CAMPOS_FINAL } }, select: { id: true, chave: true, pipelineId: true,
      ativo: true, tipo: true, escopo: true } }),
    db.bpmAutomacao.findUnique({ where: { pipelineId_chave: { pipelineId: FINANCEIRO, chave: CHAVE_AUTOMACAO } }, select: { id: true } }),
    db.bpmAutomacao.findUnique({ where: { pipelineId_chave: { pipelineId: FINANCEIRO, chave: CHAVE_HANDOFF } },
      select: { id: true, ativa: true, versoes: { where: { status: "ATIVA" }, select: { versao: true, gatilhoTipo: true,
        gatilhoConfigJson: true, grafoJson: true } } } }),
    db.bpmTransicaoEtapa.findMany({ where: { pipelineId: FINANCEIRO },
      select: { id: true, etapaOrigemId: true, etapaDestinoId: true, permitida: true, origem: true, lifecycleDestino: true } }),
  ]);
  const etapa = (chave: string) => financeiro?.etapas.find((item) => item.chave === chave);
  const formalizacao = etapa("formalizacao_contratacao");
  const pagamento = etapa("confirmacao_pagamento");
  const nf = etapa("emissao_nota_fiscal");
  const final = etapa("contratacao_finalizada");
  const boasVindas = operacional?.etapas[0];
  const handoffVersao = handoff?.versoes[0];
  const handoffGatilho = handoffVersao ? JSON.parse(handoffVersao.gatilhoConfigJson) as { etapasIds?: string[] } : null;
  const handoffGrafo = handoffVersao ? JSON.parse(handoffVersao.grafoJson) as { nos: Array<{ acaoTipo?: string; parametros?: { pipelineId?: string; etapaId?: string } }> } : null;
  const handoffAlvo = handoffGrafo?.nos.find((no) => no.acaoTipo === "CRIAR_CARD_OUTRO_PIPELINE")?.parametros;
  const existentes = new Map(campos.map((campo) => [campo.chave, campo]));
  const camposEsperados = CAMPOS_FINAL.filter((chave) => !NOVOS.includes(chave));
  const chaveDuplicada = new Set(CAMPOS_FINAL).size !== CAMPOS_FINAL.length;
  const idsOrigens = [formalizacao?.id, pagamento?.id, nf?.id].filter((id): id is string => Boolean(id));
  const arestas = transicoes.filter((item) => idsOrigens.includes(item.etapaOrigemId) && item.etapaDestinoId === final?.id);
  if (financeiro?.chave !== "financeiro" || !financeiro.ativo || financeiro.configVersion !== VERSAO_FINANCEIRO
    || operacional?.nome !== "Operacional" || !operacional.ativo || operacional.configVersion !== VERSAO_OPERACIONAL
    || !formalizacao?.ativo || !pagamento?.ativo || !nf?.ativo || !final?.ativo || !boasVindas?.ativo
    || final.formulario || boasVindas.formulario || nf.formulario?.versao !== 3
    || nf.formulario.secoes.some((secao) => secao.chave === "dados_conclusao")
    || chaveDuplicada || automacao || NOVOS.some((chave) => existentes.has(chave))
    || camposEsperados.some((chave) => !existentes.get(chave)?.ativo)
    || !handoff?.ativa || handoff.versoes.length !== 1 || handoffVersao?.versao !== 1
    || handoffVersao.gatilhoTipo !== "ENTRAR_COLUNA"
    || !handoffGatilho?.etapasIds?.includes(final.id)
    || handoffAlvo?.pipelineId !== OPERACIONAL || handoffAlvo.etapaId !== BOAS_VINDAS
    || arestas.length !== 3 || arestas.some((item) => item.lifecycleDestino === "CONCLUIDO")) {
    throw new Error(`Pré-condições de Concluídos divergentes: ${JSON.stringify({
      financeiro: financeiro?.configVersion, operacional: operacional?.configVersion,
      finalFormulario: final?.formulario?.versao, boasVindasFormulario: boasVindas?.formulario?.id,
      nfFormulario: nf?.formulario?.versao, camposFaltantes: camposEsperados.filter((chave) => !existentes.get(chave)?.ativo),
      novosExistentes: NOVOS.filter((chave) => existentes.has(chave)), handoff: handoff?.ativa,
      handoffAlvo, arestas: arestas.length,
    })}`);
  }
  const plano = { financeiro: { id: FINANCEIRO, de: VERSAO_FINANCEIRO, para: VERSAO_FINANCEIRO + 1 },
    operacional: { id: OPERACIONAL, de: VERSAO_OPERACIONAL, para: VERSAO_OPERACIONAL + 1 },
    etapaConcluido: final.id, cardsLegadosConcluido: final._count.cards,
    etapaBoasVindas: BOAS_VINDAS, novosCampos: NOVOS, camposFormularioConcluido: CAMPOS_FINAL.length,
    camposFormularioOperacional: CAMPOS_OPERACIONAL.length, arestasAtualizadas: arestas.length,
    automacaoNova: CHAVE_AUTOMACAO, handoffExistente: CHAVE_HANDOFF,
    mutacaoCardsLegados: false };
  const campoIdExistente = new Map(campos.map((campo) => [campo.chave, campo.id]));
  const folha = (campoId: string, valor: string) => ({ operador: "AND", condicoes: [
    { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: campoId }, operador: "preenchido" },
    { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: campoId }, operador: "igual", valor },
  ] });
  const condicao = { operador: "AND", condicoes: [
    folha(campoIdExistente.get(K.STATUS_ASSINATURA)!, "Assinado"),
    folha(campoIdExistente.get(K.PAGAMENTO_CONFIRMADO)!, "Sim"),
    folha(campoIdExistente.get(K.NF_EMITIDA)!, "Sim"),
  ] };
  grupoCondicaoSchema.parse(condicao);
  const gatilho = gatilhoConfigSchema.parse({ escopo: "ETAPAS", etapasIds: idsOrigens });
  const grafo = validarGrafoAutomacao({ inicioId: "concluir", nos: [
    { id: "concluir", tipo: "ACAO", acaoTipo: "MOVER_CARD", parametros: { etapaId: final.id }, proximoId: "fim" },
    { id: "fim", tipo: "FIM" },
  ] });
  if (!aplicar) {
    console.log(JSON.stringify({ mode: "preview", ...plano }, null, 2));
  } else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")
      || arg("approval") !== "AUTORIZO_CONCLUIDOS_FINANCEIRO_ATIVO"
      || Number(arg("expect-financeiro")) !== VERSAO_FINANCEIRO
      || Number(arg("expect-operacional")) !== VERSAO_OPERACIONAL || Number(arg("admin-id")) !== 1) {
      throw new Error("Ambiente, autorização, administrador ou versão inválidos.");
    }
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup Vault dedicado obrigatório.");
    const m = JSON.parse(readFileSync(manifest, "utf8")), b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || m.reason !== "concluidos-financeiro-ativo-v18-v8"
      || !Number.isFinite(criado) || criado > Date.now() || Date.now() - criado > 48 * 3600_000
      || b.size < 1_000_000 || b.size !== m.sizeBytes
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) {
      throw new Error("Backup dedicado, completo, íntegro e recente obrigatório.");
    }
    await verificarBackupTurso(backup, manifest);
    const admin = await db.usuarios.findUnique({ where: { id: 1 }, select: { role: true, status: true } });
    if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador inválido.");
    await db.$transaction(async (tx) => {
      const reservaFinanceiro = await tx.bpmPipeline.updateMany({
        where: { id: FINANCEIRO, configVersion: VERSAO_FINANCEIRO }, data: { configVersion: { increment: 1 } },
      });
      const reservaOperacional = await tx.bpmPipeline.updateMany({
        where: { id: OPERACIONAL, configVersion: VERSAO_OPERACIONAL }, data: { configVersion: { increment: 1 } },
      });
      if (reservaFinanceiro.count !== 1 || reservaOperacional.count !== 1
        || await tx.bpmCard.count({ where: { etapaId: final.id } }) !== plano.cardsLegadosConcluido) {
        throw new Error("Versão ou cards mudaram durante a publicação.");
      }
      const specs = [
        { chave: CONTATO, nome: "Contato", tipo: "texto", escopo: "CARD" },
        { chave: OBSERVACOES, nome: "Observações comerciais relevantes", tipo: "texto_longo", escopo: "CARD" },
        { chave: CONCLUIDO_EM, nome: "Data de conclusão da contratação", tipo: "data_hora", escopo: "GLOBAL",
          fonteEntidade: "CARD", fonteAtributo: "concluidoEm" },
      ];
      const ids = new Map(campos.map((campo) => [campo.chave, campo.id]));
      for (const [ordem, spec] of specs.entries()) {
        const campo = await tx.bpmCampo.create({ data: { chave: spec.chave, pipelineId: FINANCEIRO,
          nome: spec.nome, tipo: spec.tipo, escopo: spec.escopo, ativo: true, visivel: true,
          editavel: spec.escopo === "CARD", somenteLeitura: spec.escopo !== "CARD", ordem: 300 + ordem,
          fonteEntidade: "fonteEntidade" in spec ? spec.fonteEntidade : null,
          fonteAtributo: "fonteAtributo" in spec ? spec.fonteAtributo : null,
        } });
        ids.set(spec.chave, campo.id);
      }
      const formularioNF = nf.formulario!;
      const secaoNF = await tx.bpmFormularioSecao.create({ data: { formularioId: formularioNF.id,
        chave: "dados_conclusao", titulo: "Dados para conclusão", ordem: 4 } });
      for (const [ordem, chave] of [CONTATO, OBSERVACOES].entries()) {
        const campoId = ids.get(chave)!;
        await tx.bpmCampoEtapaConfig.create({ data: { campoId, etapaId: nf.id,
          visivel: true, editavel: true, ordem: 200 + ordem, grupo: "Dados para conclusão" } });
        await tx.bpmFormularioComponente.create({ data: { secaoId: secaoNF.id,
          chave: `campo:${chave}`, tipo: "CAMPO", campoId, ordem } });
      }
      await tx.bpmEtapaFormulario.update({ where: { id: formularioNF.id }, data: { versao: { increment: 1 } } });
      const formFinal = await tx.bpmEtapaFormulario.create({ data: { etapaId: final.id, versao: 1, ativo: true } });
      const secaoFinal = await tx.bpmFormularioSecao.create({ data: { formularioId: formFinal.id,
        chave: "dados_contratacao", titulo: "Dados da contratação", ordem: 0 } });
      for (const [ordem, chave] of CAMPOS_FINAL.entries()) {
        const campoId = ids.get(chave)!;
        await tx.bpmCampoEtapaConfig.create({ data: { campoId, etapaId: final.id, visivel: true,
          editavel: false, somenteLeitura: true, obrigatorioEntrada: !OPCIONAIS_ENTRADA.has(chave),
          ordem, grupo: "Dados da contratação" } });
        await tx.bpmFormularioComponente.create({ data: { secaoId: secaoFinal.id,
          chave: `campo:${chave}`, tipo: "CAMPO", campoId, ordem } });
      }
      const formBoas = await tx.bpmEtapaFormulario.create({ data: { etapaId: BOAS_VINDAS, versao: 1, ativo: true } });
      const secaoBoas = await tx.bpmFormularioSecao.create({ data: { formularioId: formBoas.id,
        chave: "dados_contratacao", titulo: "Dados da contratação", ordem: 0 } });
      for (const [ordem, chave] of CAMPOS_OPERACIONAL.entries()) {
        const campoId = ids.get(chave)!;
        await tx.bpmCampoPipeline.upsert({ where: { campoId_pipelineId: { campoId, pipelineId: OPERACIONAL } },
          create: { campoId, pipelineId: OPERACIONAL }, update: {} });
        await tx.bpmCampoEtapaConfig.create({ data: { campoId, etapaId: BOAS_VINDAS, visivel: true,
          editavel: false, somenteLeitura: true,
          obrigatorioEntrada: !OPCIONAIS_OPERACIONAL.has(chave), ordem,
          grupo: "Dados da contratação" } });
        await tx.bpmFormularioComponente.create({ data: { secaoId: secaoBoas.id,
          chave: `campo:${chave}`, tipo: "CAMPO", campoId, ordem } });
      }
      for (const aresta of arestas) await tx.bpmTransicaoEtapa.update({ where: { id: aresta.id }, data: {
        permitida: true, origem: "AMBOS", lifecycleDestino: "CONCLUIDO", limparSubStatus: true,
      } });
      const auto = await tx.bpmAutomacao.create({ data: { pipelineId: FINANCEIRO, chave: CHAVE_AUTOMACAO,
        nome: "Concluir contratação com assinatura, pagamento, NF e dados completos",
        gatilhoTipo: "CARD_ATUALIZADO", acaoTipo: "MOVER_CARD", etapaId: pagamento.id,
        parametrosJson: "{}", ativa: true, criadoPorId: 1 } });
      await tx.bpmAutomacaoVersao.create({ data: { automacaoId: auto.id, versao: 1,
        status: "ATIVA", gatilhoTipo: "CARD_ATUALIZADO", gatilhoConfigJson: JSON.stringify(gatilho),
        condicaoJson: JSON.stringify(condicao), grafoJson: JSON.stringify(grafo),
        timezone: "America/Sao_Paulo", criadoPorId: 1, ativadaEm: new Date() } });
    }, { maxWait: 20_000, timeout: 120_000 });
    console.log(JSON.stringify({ mode: "apply", sucesso: true, ...plano }));
  }
} finally {
  await db.$disconnect();
}
