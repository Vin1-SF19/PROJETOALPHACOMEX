/** Configuração do pagamento no Financeiro ativo. Prévia por padrão; --apply exige Vault. */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { CHAVES_CAMPOS: K } = await import("../src/lib/bpm/financeiro-config.client");
const { validarGrafoAutomacao, gatilhoConfigSchema } = await import("../src/lib/bpm/automacoes/central-schemas");
const { grupoCondicaoSchema } = await import("../src/lib/bpm/regras/schemas");

const PIPELINE = "cmuih4i54000209gmmyqrg557";
const PREFIXO = "financeiro.pagamento.ativo.";
const arg = (key: string) => process.argv.slice(2).find((item) => item.startsWith(`--${key}=`))?.slice(key.length + 3);
const aplicar = process.argv.includes("--apply");
const ref = (id: string) => ({ fonte: "campo_dinamico", campo: id });
const folha = (id: string, operador: string, valor?: unknown, valorCampo?: object, tipoEsperado?: string) => ({
  tipo: "condicao", campo: ref(id), operador, ...(valorCampo ? { valorCampo } : { valor }), ...(tipoEsperado ? { tipoEsperado } : {}),
});
const grupo = (...condicoes: object[]) => ({ operador: "AND", condicoes });
const ou = (...condicoes: object[]) => ({ operador: "OR", condicoes });
const igual = (id: string, valor: string) => grupo(folha(id, "preenchido"), folha(id, "igual", valor));
const preenchido = (id: string) => folha(id, "preenchido");
const noAcao = (id: string, tipo: string, parametros: Record<string, unknown>, proximoId: string) => ({ id, tipo: "ACAO", acaoTipo: tipo, parametros, proximoId });
const noCondicao = (id: string, condicao: object, entaoId: string, senaoId: string) => ({ id, tipo: "CONDICAO", condicao, entaoId, senaoId });
const alterar = (id: string, campoId: string, valor: string, proximoId: string) => noAcao(id, "ALTERAR_CAMPO", { campoId, valor }, proximoId);
const fim = { id: "fim", tipo: "FIM" };
const formaOpcoes = ["Pix", "Cartão de crédito", "Boleto", "Transferência bancária", "Manual"];
const financeiroOpcoes = ["Aguardando pagamento", "PAGAMENTO CONCLUÍDO", "Divergência financeira", "Pagamento vencido"];
const contratacaoOpcoes = ["Aguardando assinatura e pagamento", "Aguardando pagamento", "Aguardando assinatura", "Contratação concluída"];

try {
  const pipeline = await db.bpmPipeline.findUnique({ where: { id: PIPELINE }, select: {
    chave: true, ativo: true, configVersion: true, etapas: { where: { ativo: true }, select: {
      id: true, chave: true, formulario: { select: { id: true, versao: true, secoes: { select: { id: true, chave: true, componentes: { select: { campoId: true } } } } } },
      _count: { select: { cards: true } },
    } },
  } });
  const etapas = new Map(pipeline?.etapas.map((etapa) => [etapa.chave, etapa]) ?? []);
  const pagamento = etapas.get("confirmacao_pagamento"), nf = etapas.get("emissao_nota_fiscal"), final = etapas.get("contratacao_finalizada");
  const formalizacao = etapas.get("formalizacao_contratacao");
  const chavesExistentes = [K.PAGAMENTO_CONFIRMADO, K.STATUS_ASSINATURA, K.STATUS_CONTRATO,
    K.DATA_ASSINATURA, K.ANEXO_ASSINADO,
    K.VALOR_LIQUIDO, K.VALOR_CONTRATADO, K.TOTAL_RETENCOES, K.VENCIMENTO, K.STATUS_FINANCEIRO, K.RAZAO_SOCIAL];
  const chavesNovas = [K.DATA_PAGAMENTO, K.VALOR_ESPERADO, K.VALOR_RECEBIDO,
    K.FORMA_PAGAMENTO_UTILIZADA, K.COMPROVANTE, K.PAGAMENTO_NO_EXITO, K.STATUS_CONTRATACAO];
  const [campos, requisitosExistentes, automacoesExistentes, configuracoesExistentes] = await Promise.all([
    db.bpmCampo.findMany({ where: { chave: { in: [...chavesExistentes, ...chavesNovas, K.COMPROVANTE_PAGAMENTO] } }, select: {
      id: true, chave: true, pipelineId: true, ativo: true, tipo: true, opcoesJson: true,
    } }),
    db.bpmRequisito.count({ where: { pipelineId: PIPELINE, chave: { startsWith: PREFIXO } } }),
    db.bpmAutomacao.count({ where: { pipelineId: PIPELINE, chave: { startsWith: PREFIXO } } }),
    db.bpmCampoEtapaConfig.findMany({ where: { etapaId: { in: [pagamento?.id ?? "", nf?.id ?? ""] } }, select: { campoId: true, etapaId: true } }),
  ]);
  const porChave = new Map(campos.filter((campo) => campo.pipelineId === PIPELINE).map((campo) => [campo.chave, campo]));
  const tem = (chave: string) => porChave.get(chave)?.id;
  const formOk = (etapa: typeof pagamento) => Boolean(etapa?.formulario && etapa.formulario.secoes.some((secao) => secao.chave === "assinatura"));
  if (pipeline?.chave !== "financeiro" || !pipeline.ativo || pipeline.configVersion !== 10
    || !formOk(formalizacao) || !formOk(pagamento) || !formOk(nf) || !final
    || formalizacao?.formulario?.secoes.some((secao) => secao.chave === "estado_contratacao")
    || [pagamento, nf].some((etapa) => etapa?.formulario?.secoes.some((secao) => secao.chave === "pagamento"))
    || chavesExistentes.some((chave) => !porChave.get(chave)?.ativo)
    || chavesNovas.some((chave) => campos.some((campo) => campo.chave === chave))
    || campos.some((campo) => campo.chave === K.COMPROVANTE_PAGAMENTO)
    || requisitosExistentes || automacoesExistentes
    || ![pagamento, nf].every((etapa) => etapa?.formulario?.versao === 1)
    || !configuracoesExistentes.some((item) => item.etapaId === pagamento?.id && item.campoId === tem(K.PAGAMENTO_CONFIRMADO))
    || !configuracoesExistentes.some((item) => item.etapaId === nf?.id && item.campoId === tem(K.PAGAMENTO_CONFIRMADO))) {
    throw new Error("Pré-condições do Financeiro v10 divergentes; confira Elaboração e Formalização publicadas.");
  }
  const opcoesStatus = JSON.parse(porChave.get(K.STATUS_FINANCEIRO)!.opcoesJson ?? "null");
  if (JSON.stringify(opcoesStatus) !== JSON.stringify(["Aguardando pagamento"])) throw new Error("Status financeiro anterior foi editado; replaneje.");
  const plano = { pipelineId: PIPELINE, versaoAtual: 10, versaoNova: 11,
    etapaId: pagamento!.id, cardsPagamento: pagamento!._count.cards, cardsNF: nf!._count.cards,
    novosCampos: chavesNovas, formularioFormalizacao: "v1→v2", formularioPagamento: "v1→v2", formularioNF: "v1→v2",
    formaUtilizada: formaOpcoes, statusFinanceiro: financeiroOpcoes, statusContratacao: contratacaoOpcoes,
    comprovanteManual: "Forma utilizada = Manual", pagamentoNoExito: "Cobrança somente após evento dataExito",
    dataPagamento: "{{agora.instante}} na primeira confirmação válida",
  };
  if (!aplicar) console.log(JSON.stringify({ mode: "preview", ...plano }, null, 2));
  else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")
      || arg("approval") !== "AUTORIZO_PAGAMENTO_FINANCEIRO_ATIVO"
      || Number(arg("expect-financeiro")) !== 10 || Number(arg("admin-id")) !== 1) {
      throw new Error("Autorização específica do pagamento, ambiente, administrador ou versão inválidos.");
    }
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup e manifesto Vault dedicados obrigatórios.");
    const m = JSON.parse(readFileSync(manifest, "utf8")), b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || !String(m.reason).includes("pagamento-financeiro-ativo")
      || !Number.isFinite(criado) || criado > Date.now() || Date.now() - criado > 48 * 3600_000
      || b.size < 1_000_000 || b.size !== m.sizeBytes
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) {
      throw new Error("Backup dedicado, completo, íntegro e recente obrigatório.");
    }
    await verificarBackupTurso(backup, manifest);
    const admin = await db.usuarios.findUnique({ where: { id: 1 }, select: { role: true, status: true } });
    if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador inválido.");
    await db.$transaction(async (tx) => {
      const versao = await tx.bpmPipeline.updateMany({ where: { id: PIPELINE, configVersion: 10 }, data: { configVersion: { increment: 1 } } });
      if (versao.count !== 1) throw new Error("Configuração mudou durante a publicação.");
      if (await tx.bpmCard.count({ where: { etapaId: { in: [pagamento!.id, nf!.id] } } }) !== plano.cardsPagamento + plano.cardsNF)
        throw new Error("Cards mudaram entre prévia e publicação.");
      const ids = new Map<string, string>(chavesExistentes.map((chave) => [chave, tem(chave)!]));
      const specs = [
        { chave: K.DATA_PAGAMENTO, nome: "Data do pagamento", tipo: "data_hora" },
        { chave: K.VALOR_ESPERADO, nome: "Valor esperado", tipo: "moeda" },
        { chave: K.VALOR_RECEBIDO, nome: "Valor recebido", tipo: "moeda" },
        { chave: K.FORMA_PAGAMENTO_UTILIZADA, nome: "Forma de pagamento utilizada", tipo: "selecao", opcoes: formaOpcoes },
        { chave: K.COMPROVANTE, nome: "Comprovante", tipo: "arquivo" },
        { chave: K.PAGAMENTO_NO_EXITO, nome: "Pagamento no êxito", tipo: "selecao", opcoes: ["Sim", "Não"] },
        { chave: K.STATUS_CONTRATACAO, nome: "Status da contratação", tipo: "selecao", opcoes: contratacaoOpcoes },
      ];
      for (const [ordem, spec] of specs.entries()) {
        const somenteLeitura = ([K.VALOR_ESPERADO, K.STATUS_CONTRATACAO] as string[]).includes(spec.chave);
        const opcoes = "opcoes" in spec ? spec.opcoes : undefined;
        const campo = await tx.bpmCampo.create({ data: { pipelineId: PIPELINE, chave: spec.chave, nome: spec.nome,
          tipo: spec.tipo, escopo: "CARD", ordem: 50 + ordem, editavel: !somenteLeitura, somenteLeitura,
          opcoesJson: opcoes ? JSON.stringify(opcoes) : null,
          opcoes: opcoes ? { create: opcoes.map((rotulo, i) => ({ chave: `opcao-${i}`, rotulo, ordem: i })) } : undefined,
        } });
        ids.set(spec.chave, campo.id);
      }
      const id = (chave: string) => ids.get(chave)!;
      await tx.bpmCampo.update({ where: { id: id(K.STATUS_FINANCEIRO) }, data: {
        opcoesJson: JSON.stringify(financeiroOpcoes), configVersao: { increment: 1 },
        opcoes: { create: financeiroOpcoes.slice(1).map((rotulo, i) => ({ chave: `pagamento-${i}`, rotulo, ordem: i + 1 })) },
      } });
      const confirmado = igual(id(K.PAGAMENTO_CONFIRMADO), "Sim");
      const manual = grupo(folha(id(K.PAGAMENTO_CONFIRMADO), "igual", "Sim"), folha(id(K.FORMA_PAGAMENTO_UTILIZADA), "igual", "Manual"));
      const formaCampos = [K.PAGAMENTO_CONFIRMADO, K.DATA_PAGAMENTO, K.VALOR_ESPERADO, K.VALOR_RECEBIDO,
        K.FORMA_PAGAMENTO_UTILIZADA, K.COMPROVANTE, K.STATUS_FINANCEIRO, K.PAGAMENTO_NO_EXITO, K.STATUS_CONTRATACAO];
      for (const etapa of [pagamento!, nf!]) {
        const formulario = etapa.formulario!;
        const secao = await tx.bpmFormularioSecao.create({ data: { formularioId: formulario.id,
          chave: "pagamento", titulo: "Confirmação do pagamento", ordem: 1 } });
        for (const [ordem, chave] of formaCampos.entries()) {
          const anterior = configuracoesExistentes.some((item) => item.etapaId === etapa.id && item.campoId === id(chave));
          const somenteLeitura = ([K.VALOR_ESPERADO, K.STATUS_FINANCEIRO, K.STATUS_CONTRATACAO] as string[]).includes(chave);
          const condicao = chave === K.COMPROVANTE ? manual
            : ([K.DATA_PAGAMENTO, K.VALOR_RECEBIDO, K.FORMA_PAGAMENTO_UTILIZADA] as string[]).includes(chave) ? confirmado : null;
          const data = { visivel: true, editavel: !somenteLeitura, somenteLeitura,
            ordem: 30 + ordem, grupo: "Confirmação do pagamento",
            obrigatorioSaida: etapa.id === pagamento!.id && chave === K.PAGAMENTO_NO_EXITO,
            condicaoObrigatoriedadeJson: condicao ? JSON.stringify(condicao) : null,
            valorPadrao: chave === K.DATA_PAGAMENTO ? "{{agora.instante}}" : null };
          if (anterior) await tx.bpmCampoEtapaConfig.update({ where: { campoId_etapaId: { campoId: id(chave), etapaId: etapa.id } }, data });
          else await tx.bpmCampoEtapaConfig.create({ data: { campoId: id(chave), etapaId: etapa.id, ...data } });
          if (!formulario.secoes.some((item) => item.componentes.some((componente) => componente.campoId === id(chave)))) {
            await tx.bpmFormularioComponente.create({ data: { secaoId: secao.id, chave: `campo:${chave}`, tipo: "CAMPO", campoId: id(chave), ordem } });
          }
        }
        await tx.bpmEtapaFormulario.update({ where: { id: formulario.id }, data: { versao: { increment: 1 } } });
      }
      const formularioFormalizacao = formalizacao!.formulario!;
      const secaoEstado = await tx.bpmFormularioSecao.create({ data: { formularioId: formularioFormalizacao.id,
        chave: "estado_contratacao", titulo: "Estado da contratação", ordem: 2 } });
      await tx.bpmCampoEtapaConfig.create({ data: { campoId: id(K.STATUS_CONTRATACAO), etapaId: formalizacao!.id,
        visivel: true, editavel: false, somenteLeitura: true, ordem: 80, grupo: "Estado da contratação" } });
      await tx.bpmFormularioComponente.create({ data: { secaoId: secaoEstado.id,
        chave: `campo:${K.STATUS_CONTRATACAO}`, tipo: "CAMPO", campoId: id(K.STATUS_CONTRATACAO), ordem: 0 } });
      await tx.bpmEtapaFormulario.update({ where: { id: formularioFormalizacao.id }, data: { versao: { increment: 1 } } });
      const requisitos = [
        ["data", K.DATA_PAGAMENTO, confirmado, "Data do pagamento obrigatória quando confirmado."],
        ["valor", K.VALOR_RECEBIDO, confirmado, "Valor recebido obrigatório quando confirmado."],
        ["forma", K.FORMA_PAGAMENTO_UTILIZADA, confirmado, "Forma de pagamento utilizada obrigatória quando confirmado."],
        ["comprovante", K.COMPROVANTE, manual, "Comprovante obrigatório para processo manual."],
      ] as const;
      for (const [ordem, [sufixo, chave, condicao, mensagem]] of requisitos.entries()) {
        grupoCondicaoSchema.parse(condicao);
        await tx.bpmRequisito.create({ data: { chave: `${PREFIXO}${sufixo}`, pipelineId: PIPELINE,
          etapaId: pagamento!.id, campoId: id(chave), alvoTipo: "CAMPO", fase: "DURING_STAGE",
          condicaoJson: JSON.stringify(condicao), mensagem, fonte: "ADMIN", ativo: true, ordem } });
      }
      const divergencia = grupo(preenchido(id(K.VALOR_ESPERADO)), preenchido(id(K.VALOR_RECEBIDO)),
        folha(id(K.VALOR_RECEBIDO), "diferente", undefined, ref(id(K.VALOR_ESPERADO)), "numero"));
      grupoCondicaoSchema.parse(divergencia);
      await tx.bpmRequisito.create({ data: { chave: `${PREFIXO}divergencia`, pipelineId: PIPELINE,
        etapaId: pagamento!.id, campoId: null, alvoTipo: "REGRA", fase: "EXIT_STAGE",
        condicaoJson: JSON.stringify(divergencia), mensagem: "Divergência financeira: valor recebido diferente do esperado.",
        fonte: "ADMIN", ativo: true, ordem: requisitos.length } });
      await tx.bpmRequisito.create({ data: { chave: `${PREFIXO}exigibilidade`, pipelineId: PIPELINE,
        etapaId: pagamento!.id, campoId: id(K.PAGAMENTO_NO_EXITO), alvoTipo: "CAMPO", fase: "EXIT_STAGE",
        condicaoJson: null, mensagem: "Informe se o pagamento ocorre no êxito antes de avançar.",
        fonte: "ADMIN", ativo: true, ordem: requisitos.length + 1 } });
      const iguais = grupo(preenchido(id(K.VALOR_ESPERADO)), preenchido(id(K.VALOR_RECEBIDO)),
        folha(id(K.VALOR_RECEBIDO), "igual", undefined, ref(id(K.VALOR_ESPERADO)), "numero"));
      const fonteAtual = ou(
        grupo(preenchido(id(K.VALOR_LIQUIDO)), folha(id(K.VALOR_ESPERADO), "igual", undefined, ref(id(K.VALOR_LIQUIDO)), "numero")),
        grupo(folha(id(K.VALOR_LIQUIDO), "vazio"), preenchido(id(K.VALOR_CONTRATADO)),
          ou(folha(id(K.TOTAL_RETENCOES), "vazio"), folha(id(K.TOTAL_RETENCOES), "igual", 0, undefined, "numero")),
          folha(id(K.VALOR_ESPERADO), "igual", undefined, ref(id(K.VALOR_CONTRATADO)), "numero")),
      );
      const pagamentoValido = grupo(iguais, fonteAtual, preenchido(id(K.DATA_PAGAMENTO)),
        preenchido(id(K.FORMA_PAGAMENTO_UTILIZADA)),
        folha(id(K.VALOR_ESPERADO), "maiorOuIgual", 0, undefined, "numero"),
        folha(id(K.VALOR_RECEBIDO), "maiorOuIgual", 0, undefined, "numero"));
      const assinatura = grupo(...igual(id(K.STATUS_ASSINATURA), "Assinado").condicoes,
        preenchido(id(K.DATA_ASSINATURA)), preenchido(id(K.ANEXO_ASSINADO)));
      const estado = { inicioId: "pago", nos: [
        noCondicao("pago", confirmado, "validado", "vencido"),
        noCondicao("validado", pagamentoValido, "pago_status", "comparar"),
        noCondicao("comparar", divergencia, "divergente", "aguardando"),
        alterar("pago_status", id(K.STATUS_FINANCEIRO), "PAGAMENTO CONCLUÍDO", "tarefa_nf"),
        noCondicao("assinatura_pago", assinatura, "ambos", "aguarda_assinatura"),
        alterar("ambos", id(K.STATUS_CONTRATACAO), "Contratação concluída", "fim"),
        alterar("aguarda_assinatura", id(K.STATUS_CONTRATACAO), "Aguardando assinatura", "fim"),
        noAcao("tarefa_nf", "CRIAR_TAREFA", { titulo: "Emitir Nota Fiscal – {{empresa.razaoSocial}}", tipo: "EMISSAO_NF",
          prioridade: "ALTA", naoDuplicarTipo: true }, "assinatura_pago"),
        alterar("divergente", id(K.STATUS_FINANCEIRO), "Divergência financeira", "pendente_assinatura"),
        noCondicao("vencido", igual(id(K.STATUS_FINANCEIRO), "Pagamento vencido"), "pendente_assinatura", "aguardando"),
        alterar("aguardando", id(K.STATUS_FINANCEIRO), "Aguardando pagamento", "pendente_assinatura"),
        noCondicao("pendente_assinatura", assinatura, "aguarda_pagamento", "aguarda_ambos"),
        alterar("aguarda_pagamento", id(K.STATUS_CONTRATACAO), "Aguardando pagamento", "fim"),
        alterar("aguarda_ambos", id(K.STATUS_CONTRATACAO), "Aguardando assinatura e pagamento", "fim"), fim,
      ] };
      const esperado = { inicioId: "liquido", nos: [
        noCondicao("liquido", grupo(preenchido(id(K.VALOR_LIQUIDO))), "copiar_liquido", "bruto"),
        alterar("copiar_liquido", id(K.VALOR_ESPERADO), `{{campo.${id(K.VALOR_LIQUIDO)}}}`, "fim"),
        noCondicao("bruto", grupo(preenchido(id(K.VALOR_CONTRATADO)),
          ou(folha(id(K.TOTAL_RETENCOES), "vazio"), folha(id(K.TOTAL_RETENCOES), "igual", 0, undefined, "numero"))), "copiar_bruto", "fim"),
        alterar("copiar_bruto", id(K.VALOR_ESPERADO), `{{campo.${id(K.VALOR_CONTRATADO)}}}`, "fim"), fim,
      ] };
      const exigivel = ou(igual(id(K.PAGAMENTO_NO_EXITO), "Não"),
        grupo(igual(id(K.PAGAMENTO_NO_EXITO), "Sim"),
          { tipo: "condicao", campo: { fonte: "contratacao", campo: "dataExito" }, operador: "preenchido" }));
      const vencido = grupo(ou(folha(id(K.PAGAMENTO_CONFIRMADO), "vazio"), folha(id(K.PAGAMENTO_CONFIRMADO), "igual", "Não")),
        preenchido(id(K.VENCIMENTO)),
        folha(id(K.VENCIMENTO), "menorOuIgual", undefined, { fonte: "agora", campo: "data" }, "data"), exigivel,
        ou(folha(id(K.STATUS_FINANCEIRO), "vazio"), folha(id(K.STATUS_FINANCEIRO), "diferente", "Pagamento vencido")));
      const cobranca = { inicioId: "marcar", nos: [
        alterar("marcar", id(K.STATUS_FINANCEIRO), "Pagamento vencido", "tarefa"),
        noAcao("tarefa", "CRIAR_TAREFA", { titulo: "Cobrar pagamento vencido – {{empresa.razaoSocial}}",
          tipo: "COBRANCA_FINANCEIRA", prioridade: "ALTA", naoDuplicarPendenteTipo: true }, "alerta"),
        noAcao("alerta", "CRIAR_ALERTA", { texto: "Pagamento vencido: conferir vencimento e cobrar conforme a política interna." }, "fim"), fim,
      ] };
      const automacoes = [
        { chave: "esperado.entrada", nome: "Pagamento — atualizar valor esperado na entrada", tipo: "ENTRAR_COLUNA", config: { escopo: "ETAPAS", etapaId: pagamento!.id }, condicao: null, grafo: esperado },
        { chave: "esperado.liquido", nome: "Pagamento — sincronizar valor líquido", tipo: "CAMPO_ALTERADO", config: { escopo: "ETAPAS", etapaId: pagamento!.id, campoId: id(K.VALOR_LIQUIDO) }, condicao: null, grafo: esperado },
        { chave: "esperado.bruto", nome: "Pagamento — sincronizar valor bruto sem retenções", tipo: "CAMPO_ALTERADO", config: { escopo: "ETAPAS", etapaId: pagamento!.id, campoId: id(K.VALOR_CONTRATADO) }, condicao: null, grafo: esperado },
        { chave: "esperado.retencoes", nome: "Pagamento — revisar valor esperado após retenções", tipo: "CAMPO_ALTERADO", config: { escopo: "ETAPAS", etapaId: pagamento!.id, campoId: id(K.TOTAL_RETENCOES) }, condicao: null, grafo: esperado },
        { chave: "estado.edicao", nome: "Pagamento — recalcular requisitos", tipo: "CARD_ATUALIZADO", config: { escopo: "ETAPAS", etapasIds: [formalizacao!.id, pagamento!.id, nf!.id] }, condicao: null, grafo: estado },
        { chave: "estado.entrada", nome: "Pagamento — recalcular na entrada", tipo: "ENTRAR_COLUNA", config: { escopo: "ETAPAS", etapasIds: [formalizacao!.id, pagamento!.id, nf!.id] }, condicao: null, grafo: estado },
        { chave: "estado.assinatura", nome: "Pagamento — verificar assinatura", tipo: "CAMPO_ALTERADO", config: { escopo: "GLOBAL_PIPELINE", campoId: id(K.STATUS_ASSINATURA) }, condicao: null, grafo: estado },
        { chave: "estado.pagamento", nome: "Pagamento — verificar confirmação", tipo: "CAMPO_ALTERADO", config: { escopo: "GLOBAL_PIPELINE", campoId: id(K.PAGAMENTO_CONFIRMADO) }, condicao: null, grafo: estado },
        { chave: "cobranca", nome: "Pagamento — cobrança no vencimento exigível", tipo: "RECORRENCIA_ATINGIDA", config: { escopo: "ETAPAS", etapaId: pagamento!.id,
          recorrencia: { tipo: "DIARIA", hora: "09:00", ancora: "AGORA" } }, condicao: vencido, grafo: cobranca },
      ];
      for (const item of automacoes) {
        gatilhoConfigSchema.parse(item.config);
        if (item.condicao) grupoCondicaoSchema.parse(item.condicao);
        const grafo = validarGrafoAutomacao(item.grafo);
        const automacao = await tx.bpmAutomacao.create({ data: { chave: `${PREFIXO}${item.chave}`,
          nome: item.nome, pipelineId: PIPELINE, etapaId: pagamento!.id, gatilhoTipo: item.tipo,
          acaoTipo: "ALTERAR_CAMPO", parametrosJson: "{}", ativa: true, criadoPorId: 1 } });
        await tx.bpmAutomacaoVersao.create({ data: { automacaoId: automacao.id, versao: 1,
          status: "ATIVA", gatilhoTipo: item.tipo, gatilhoConfigJson: JSON.stringify(item.config),
          condicaoJson: item.condicao ? JSON.stringify(item.condicao) : null,
          grafoJson: JSON.stringify(grafo), timezone: "America/Sao_Paulo", criadoPorId: 1, ativadaEm: new Date() } });
      }
    }, { maxWait: 20_000, timeout: 120_000 });
    console.log(JSON.stringify({ mode: "apply", sucesso: true, ...plano }));
  }
} finally { await db.$disconnect(); }
