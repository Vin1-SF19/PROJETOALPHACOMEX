/** Prévia somente leitura por padrão. --apply exige backup Vault e autorização específica. */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { CHAVES_CAMPOS: K } = await import("../src/lib/bpm/financeiro-config.client");
const { grupoCondicaoSchema } = await import("../src/lib/bpm/regras/schemas");
const { validarGrafoAutomacao } = await import("../src/lib/bpm/automacoes/central-schemas");

const PIPELINE = "cmuih4i54000209gmmyqrg557";
const PREFIXO = "financeiro.nf.ativo.";
const CHAVES = [K.NF_EMITIDA, K.NUMERO_NF, K.DATA_EMISSAO_NF, K.VALOR_NF, K.LINK_NF];
const AUTOMACOES_PAGAMENTO = ["estado.edicao", "estado.entrada", "estado.assinatura", "estado.pagamento"]
  .map((sufixo) => `financeiro.pagamento.ativo.${sufixo}`);
const TITULO_ANTERIOR = "Emitir Nota Fiscal – {{empresa.razaoSocial}}";
const TITULO_NOVO = "Emitir NF – {{empresa.razaoSocial}}";
const arg = (key: string) => process.argv.slice(2).find((item) => item.startsWith(`--${key}=`))?.slice(key.length + 3);
const aplicar = process.argv.includes("--apply");
const folha = (campoId: string, operador: string, valor?: unknown, tipoEsperado?: string) => ({
  tipo: "condicao", campo: { fonte: "campo_dinamico", campo: campoId }, operador, valor,
  ...(tipoEsperado ? { tipoEsperado } : {}),
});
const grupo = (...condicoes: object[]) => ({ operador: "AND", condicoes });

try {
  const [pipeline, etapas, existentes, requisitos, automacoesNF, automacoesPagamento] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: PIPELINE }, select: { chave: true, ativo: true, configVersion: true } }),
    db.bpmEtapa.findMany({ where: { pipelineId: PIPELINE, chave: { in: ["emissao_nota_fiscal", "confirmacao_pagamento"] }, ativo: true },
      select: { id: true, chave: true, formulario: { select: { id: true, versao: true, secoes: { select: { id: true, chave: true, componentes: { select: { campoId: true } } } } } }, _count: { select: { cards: true } } } }),
    db.bpmCampo.findMany({ where: { chave: { in: CHAVES } }, select: { id: true, chave: true } }),
    db.bpmRequisito.count({ where: { pipelineId: PIPELINE, chave: { startsWith: PREFIXO } } }),
    db.bpmAutomacao.count({ where: { pipelineId: PIPELINE, chave: { startsWith: PREFIXO } } }),
    db.bpmAutomacao.findMany({ where: { pipelineId: PIPELINE, chave: { in: AUTOMACOES_PAGAMENTO }, ativa: true },
      select: { id: true, chave: true, versoes: { where: { status: "ATIVA" }, select: { id: true, versao: true, gatilhoTipo: true,
        gatilhoConfigJson: true, condicaoJson: true, grafoJson: true, timezone: true } } } }),
  ]);
  const nf = etapas.find((etapa) => etapa.chave === "emissao_nota_fiscal");
  const pagamento = etapas.find((etapa) => etapa.chave === "confirmacao_pagamento");
  const versaoAtual = pipeline?.configVersion;
  const secoesNF = nf?.formulario?.secoes ?? [];
  const formulariosValidos = nf?.formulario?.versao === 2 && pagamento?.formulario?.versao === 2
    && secoesNF.some((secao) => secao.chave === "pagamento") && !secoesNF.some((secao) => secao.chave === "nota_fiscal");
  const automacoesValidas = automacoesPagamento.length === AUTOMACOES_PAGAMENTO.length
    && automacoesPagamento.every((automacao) => {
      if (automacao.versoes.length !== 1 || automacao.versoes[0].versao !== 1) return false;
      const grafo = JSON.parse(automacao.versoes[0].grafoJson) as { nos: Array<{ acaoTipo?: string; parametros?: { tipo?: string; titulo?: string } }> };
      const tarefas = grafo.nos.filter((no) => no.acaoTipo === "CRIAR_TAREFA" && no.parametros?.tipo === "EMISSAO_NF"
        && no.parametros.titulo === TITULO_ANTERIOR);
      if (tarefas.length !== 1) return false;
      tarefas[0].parametros!.titulo = TITULO_NOVO;
      validarGrafoAutomacao(grafo);
      return true;
    });
  if (pipeline?.chave !== "financeiro" || !pipeline.ativo || typeof versaoAtual !== "number" || !Number.isSafeInteger(versaoAtual)
    || versaoAtual < 12 || (aplicar && Number(arg("expect-financeiro")) !== versaoAtual)
    || !formulariosValidos || existentes.length || requisitos || automacoesNF || !automacoesValidas) {
    throw new Error(`Pré-condições da NF divergentes: ${JSON.stringify({
      versao: pipeline?.configVersion, formularioNF: nf?.formulario?.versao,
      formularioPagamento: pagamento?.formulario?.versao, secoesNF: secoesNF.map((secao) => secao.chave),
      camposExistentes: existentes.map((campo) => campo.chave), requisitos, automacoesNF,
      automacoesPagamento: automacoesPagamento.map((automacao) => ({
        chave: automacao.chave, versoes: automacao.versoes.map((versao) => versao.versao),
      })), automacoesValidas,
    })}`);
  }
  const plano = { pipelineId: PIPELINE, versaoAtual, versaoNova: versaoAtual + 1,
    etapaId: nf!.id, formularioNF: "v2→v3", cardsNF: nf!._count.cards,
    novosCampos: CHAVES, requisitos: 5, automacoesPagamentoAtualizadas: AUTOMACOES_PAGAMENTO,
    tituloTarefa: TITULO_NOVO, tarefaTipo: "EMISSAO_NF", statusContratacao: "sem alteração" };
  if (!aplicar) {
    console.log(JSON.stringify({ mode: "preview", ...plano }, null, 2));
  } else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")
      || arg("approval") !== "AUTORIZO_EMISSAO_NF_FINANCEIRO_ATIVO"
      || Number(arg("admin-id")) !== 1) {
      throw new Error("Autorização específica, ambiente, administrador ou versão inválidos.");
    }
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup e manifesto Vault dedicados obrigatórios.");
    const m = JSON.parse(readFileSync(manifest, "utf8")), b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || m.reason !== `emissao-nf-financeiro-ativo-v${versaoAtual + 1}`
      || !Number.isFinite(criado) || criado > Date.now() || Date.now() - criado > 48 * 3600_000
      || b.size < 1_000_000 || b.size !== m.sizeBytes
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) {
      throw new Error("Backup dedicado, completo, íntegro e recente obrigatório.");
    }
    await verificarBackupTurso(backup, manifest);
    const admin = await db.usuarios.findUnique({ where: { id: 1 }, select: { role: true, status: true } });
    if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador inválido.");
    await db.$transaction(async (tx) => {
      const versao = await tx.bpmPipeline.updateMany({
        where: { id: PIPELINE, configVersion: versaoAtual }, data: { configVersion: { increment: 1 } },
      });
      if (versao.count !== 1 || await tx.bpmCard.count({ where: { etapaId: nf!.id } }) !== plano.cardsNF) {
        throw new Error("Financeiro ou cards mudaram durante a publicação.");
      }
      const specs = [
        { chave: K.NF_EMITIDA, nome: "NF emitida", tipo: "selecao", opcoes: ["Sim", "Não"] },
        { chave: K.NUMERO_NF, nome: "Número da NF", tipo: "texto" },
        { chave: K.DATA_EMISSAO_NF, nome: "Data de emissão", tipo: "data" },
        { chave: K.VALOR_NF, nome: "Valor da NF", tipo: "moeda" },
        { chave: K.LINK_NF, nome: "Arquivo/link da NF", tipo: "url_ou_arquivo" },
      ];
      const ids = new Map<string, string>();
      for (const [ordem, spec] of specs.entries()) {
        const opcoes = "opcoes" in spec ? spec.opcoes : undefined;
        const campo = await tx.bpmCampo.create({ data: { chave: spec.chave, pipelineId: PIPELINE,
          nome: spec.nome, tipo: spec.tipo, opcoesJson: opcoes ? JSON.stringify(opcoes) : null,
          escopo: "CARD", ativo: true, visivel: true, editavel: true, ordem: 100 + ordem,
          ...(opcoes ? { opcoes: { create: opcoes.map((rotulo, indice) => ({ chave: `nf-${indice}`, rotulo, ordem: indice })) } } : {}),
        } });
        ids.set(spec.chave, campo.id);
      }
      const confirmado = grupo(folha(ids.get(K.NF_EMITIDA)!, "preenchido"), folha(ids.get(K.NF_EMITIDA)!, "igual", "Sim"));
      grupoCondicaoSchema.parse(confirmado);
      const secao = await tx.bpmFormularioSecao.create({ data: {
        formularioId: nf!.formulario!.id, chave: "nota_fiscal", titulo: "Emissão da Nota Fiscal", ordem: 3,
      } });
      for (const [ordem, spec] of specs.entries()) {
        const campoId = ids.get(spec.chave)!;
        await tx.bpmCampoEtapaConfig.create({ data: { campoId, etapaId: nf!.id,
          visivel: true, editavel: true, somenteLeitura: false, ordem: 100 + ordem, grupo: "Emissão da Nota Fiscal",
          condicaoObrigatoriedadeJson: spec.chave === K.NF_EMITIDA ? null : JSON.stringify(confirmado),
          valorPadrao: spec.chave === K.DATA_EMISSAO_NF ? "{{agora.data}}" : null,
        } });
        await tx.bpmFormularioComponente.create({ data: {
          secaoId: secao.id, chave: `campo:${spec.chave}`, tipo: "CAMPO", campoId, ordem,
        } });
      }
      await tx.bpmEtapaFormulario.update({ where: { id: nf!.formulario!.id }, data: { versao: { increment: 1 } } });
      const obrigatorios = [K.NUMERO_NF, K.DATA_EMISSAO_NF, K.VALOR_NF, K.LINK_NF];
      for (const [ordem, chave] of obrigatorios.entries()) {
        await tx.bpmRequisito.create({ data: { chave: `${PREFIXO}obrigatorio.${ordem}`,
          pipelineId: PIPELINE, etapaId: nf!.id, campoId: ids.get(chave), alvoTipo: "CAMPO", fase: "DURING_STAGE",
          condicaoJson: JSON.stringify(confirmado), mensagem: `${specs.find((spec) => spec.chave === chave)!.nome} obrigatório quando NF emitida = Sim.`,
          fonte: "ADMIN", ativo: true, ordem,
        } });
      }
      const valorInvalido = grupo(folha(ids.get(K.NF_EMITIDA)!, "igual", "Sim"),
        folha(ids.get(K.VALOR_NF)!, "menorOuIgual", 0, "numero"));
      grupoCondicaoSchema.parse(valorInvalido);
      await tx.bpmRequisito.create({ data: { chave: `${PREFIXO}valor_nao_positivo`, pipelineId: PIPELINE,
        etapaId: nf!.id, alvoTipo: "REGRA", fase: "EXIT_STAGE", condicaoJson: JSON.stringify(valorInvalido),
        mensagem: "Valor da NF deve ser maior que zero.", fonte: "ADMIN", ativo: true, ordem: obrigatorios.length,
      } });
      for (const automacao of automacoesPagamento) {
        const anterior = automacao.versoes[0];
        const grafo = JSON.parse(anterior.grafoJson) as { inicioId: string; nos: Array<{ acaoTipo?: string; parametros?: Record<string, unknown> }> };
        for (const no of grafo.nos) {
          if (no.acaoTipo === "CRIAR_TAREFA" && no.parametros?.tipo === "EMISSAO_NF") no.parametros.titulo = TITULO_NOVO;
        }
        validarGrafoAutomacao(grafo);
        const arquivada = await tx.bpmAutomacaoVersao.updateMany({
          where: { id: anterior.id, status: "ATIVA" }, data: { status: "ARQUIVADA", arquivadaEm: new Date() },
        });
        if (arquivada.count !== 1) throw new Error("Automação de pagamento mudou durante a publicação.");
        await tx.bpmAutomacaoVersao.create({ data: { automacaoId: automacao.id, versao: anterior.versao + 1,
          status: "ATIVA", gatilhoTipo: anterior.gatilhoTipo, gatilhoConfigJson: anterior.gatilhoConfigJson,
          condicaoJson: anterior.condicaoJson, grafoJson: JSON.stringify(grafo), timezone: anterior.timezone,
          criadoPorId: 1, ativadaEm: new Date(),
        } });
      }
    }, { maxWait: 20_000, timeout: 120_000 });
    console.log(JSON.stringify({ mode: "apply", sucesso: true, ...plano }));
  }
} finally { await db.$disconnect(); }
