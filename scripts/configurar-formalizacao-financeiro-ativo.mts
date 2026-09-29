/** Prévia por padrão. Publicação Turso exige checkpoint Vault desta etapa. */
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
const ELABORACAO = "draft-stage-945a9c43-8226-48bd-b3c6-65dd5fa79396";
const FORMALIZACAO = "draft-stage-9a44c118-2739-42d3-a4f2-4e8ab7428381";
const arg = (key: string) => process.argv.slice(2).find((item) => item.startsWith(`--${key}=`))?.slice(key.length + 3);
const aplicar = process.argv.includes("--apply");
const cond = (id: string, operador: string, valor?: string) => ({
  operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: id }, operador, ...(valor === undefined ? {} : { valor }) }],
});
const grafo = (acoes: Array<{ tipo: string; parametros: Record<string, unknown> }>) => ({
  inicioId: "acao_1", nos: [
    ...acoes.map((acao, i) => ({ id: `acao_${i + 1}`, tipo: "ACAO", acaoTipo: acao.tipo,
      parametros: acao.parametros, proximoId: i + 1 < acoes.length ? `acao_${i + 2}` : "fim" })),
    { id: "fim", tipo: "FIM" },
  ],
});

try {
  const [pipeline, elaboracao, formalizacao, continuacao, finalizada, campos, cards] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: PIPELINE }, select: { chave: true, configVersion: true } }),
    db.bpmEtapa.findUnique({ where: { id: ELABORACAO }, select: { chave: true, ativo: true, formulario: { select: { id: true } } } }),
    db.bpmEtapa.findUnique({ where: { id: FORMALIZACAO }, select: { chave: true, ativo: true, formulario: { select: { id: true } } } }),
    db.bpmEtapa.findMany({ where: { pipelineId: PIPELINE, chave: { in: ["confirmacao_pagamento", "emissao_nota_fiscal"] } },
      select: { id: true, chave: true, ativo: true, formulario: { select: { id: true } }, _count: { select: { cards: true } } } }),
    db.bpmEtapa.findFirst({ where: { pipelineId: PIPELINE, chave: "contratacao_finalizada", ativo: true }, select: { id: true } }),
    db.bpmCampo.findMany({ where: { chave: { in: [K.STATUS_ASSINATURA, K.STATUS_CONTRATO, K.DATA_ASSINATURA, K.ANEXO_ASSINADO, K.PRAZO_ASSINATURA, K.PAGAMENTO_CONFIRMADO] } },
      select: { id: true, chave: true, pipelineId: true, tipo: true, opcoesJson: true, ativo: true } }),
    db.bpmCard.count({ where: { etapaId: FORMALIZACAO } }),
  ]);
  const assinatura = campos.find((item) => item.pipelineId === PIPELINE && item.chave === K.STATUS_ASSINATURA);
  if (pipeline?.chave !== "financeiro" || pipeline.configVersion !== 9
    || elaboracao?.chave !== "elaboracao_contrato" || !elaboracao.ativo || !elaboracao.formulario
    || formalizacao?.chave !== "formalizacao_contratacao" || !formalizacao.ativo || formalizacao.formulario
    || continuacao.length !== 2 || continuacao.some((item) => !item.ativo || item.formulario || item._count.cards)
    || !finalizada || cards || !assinatura?.ativo || assinatura.tipo !== "selecao"
    || JSON.stringify(JSON.parse(assinatura.opcoesJson ?? "null")) !== JSON.stringify(["Aguardando assinatura"])
    || campos.some((item) => item.chave !== K.STATUS_ASSINATURA)) {
    throw new Error("Pré-condições da Formalização ativa divergentes. Publique Elaboração primeiro e refaça o plano.");
  }
  const [configElaboracao, opcoesAssinatura, requisitos, automacoes] = await Promise.all([
    db.bpmCampoEtapaConfig.findUnique({ where: { campoId_etapaId: { campoId: assinatura.id, etapaId: ELABORACAO } }, select: { somenteLeitura: true } }),
    db.bpmCampoOpcao.findMany({ where: { campoId: assinatura.id, ativo: true }, select: { rotulo: true } }),
    db.bpmRequisito.count({ where: { pipelineId: PIPELINE, chave: { startsWith: "financeiro.formalizacao.ativa." } } }),
    db.bpmAutomacao.count({ where: { pipelineId: PIPELINE, chave: { startsWith: "financeiro.formalizacao.ativa." } } }),
  ]);
  if (!configElaboracao?.somenteLeitura || opcoesAssinatura.length !== 1 || opcoesAssinatura[0].rotulo !== "Aguardando assinatura"
    || requisitos || automacoes) throw new Error("Status de assinatura ou configuração anterior divergente.");
  const plano = { pipelineId: PIPELINE, versaoAtual: pipeline.configVersion, versaoNova: 10,
    etapaId: FORMALIZACAO, cardsNaEtapa: cards, camposNovos: 5, campoCompartilhadoAtualizado: 1,
    formularios: 3, requisitosFormalizacao: 2, requisitosConclusao: 4, automacoesAtivas: 3,
    camposVisiveis: ["Status do contrato", "Status da assinatura", "Data da assinatura", "Contrato assinado/anexo", "Prazo da assinatura"],
  };
  if (!aplicar) console.log(JSON.stringify({ mode: "preview", ...plano }, null, 2));
  else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://") || arg("approval") !== "AUTORIZO_FORMALIZACAO_FINANCEIRO_ATIVO"
      || Number(arg("expect-financeiro")) !== 9 || Number(arg("admin-id")) !== 1) {
      throw new Error("Autorização específica, ambiente ou versão inválidos.");
    }
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup dedicado obrigatório.");
    const m = JSON.parse(readFileSync(manifest, "utf8")), b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || !String(m.reason).includes("formalizacao-financeiro-ativo")
      || !Number.isFinite(criado) || criado > Date.now() || Date.now() - criado > 48 * 3600_000
      || b.size < 1_000_000 || b.size !== m.sizeBytes || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) {
      throw new Error("Backup dedicado, íntegro e recente obrigatório.");
    }
    await verificarBackupTurso(backup, manifest);
    const admin = await db.usuarios.findUnique({ where: { id: 1 }, select: { role: true, status: true } });
    if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador inválido.");
    await db.$transaction(async (tx) => {
      if (await tx.bpmCard.count({ where: { etapaId: { in: [FORMALIZACAO, ...continuacao.map((item) => item.id)] } } })) {
        throw new Error("Entraram cards nas etapas de assinatura; refaça o plano.");
      }
      const atualizado = await tx.bpmPipeline.updateMany({ where: { id: PIPELINE, configVersion: 9 }, data: { configVersion: { increment: 1 } } });
      if (atualizado.count !== 1) throw new Error("Pipeline alterado durante a publicação.");
      await tx.bpmCampo.update({ where: { id: assinatura.id }, data: {
        nome: "Status da assinatura", editavel: true, somenteLeitura: false,
        opcoesJson: JSON.stringify(["Aguardando assinatura", "Assinado"]), configVersao: { increment: 1 },
      } });
      await tx.bpmCampoOpcao.create({ data: { campoId: assinatura.id, chave: "assinado", rotulo: "Assinado", ordem: 1 } });
      const specs = [
        { chave: K.STATUS_CONTRATO, nome: "Status do contrato", tipo: "selecao", opcoes: ["Pendente", "CONTRATO CONCLUÍDO"] },
        { chave: K.DATA_ASSINATURA, nome: "Data da assinatura", tipo: "data" },
        { chave: K.ANEXO_ASSINADO, nome: "Contrato assinado/anexo", tipo: "arquivo" },
        { chave: K.PRAZO_ASSINATURA, nome: "Prazo da assinatura", tipo: "data_hora" },
        { chave: K.PAGAMENTO_CONFIRMADO, nome: "Pagamento confirmado", tipo: "selecao", opcoes: ["Sim", "Não"] },
      ] as const;
      const ids = new Map<string, string>([[K.STATUS_ASSINATURA, assinatura.id]]);
      for (const [ordem, spec] of specs.entries()) {
        const campo = await tx.bpmCampo.create({ data: { pipelineId: PIPELINE, chave: spec.chave,
          nome: spec.nome, tipo: spec.tipo, escopo: "CARD", ordem: ordem + 1,
          editavel: spec.chave !== K.STATUS_CONTRATO, somenteLeitura: spec.chave === K.STATUS_CONTRATO,
          opcoesJson: "opcoes" in spec ? JSON.stringify(spec.opcoes) : null,
          opcoes: "opcoes" in spec ? { create: spec.opcoes.map((rotulo, i) => ({ chave: `opcao-${i}`, rotulo, ordem: i })) } : undefined,
        } });
        ids.set(spec.chave, campo.id);
      }
      const condAssinado = cond(assinatura.id, "igual", "Assinado");
      for (const etapaId of [FORMALIZACAO, ...continuacao.map((item) => item.id)]) {
        const form = await tx.bpmEtapaFormulario.create({ data: { etapaId, versao: 1 } });
        const secao = await tx.bpmFormularioSecao.create({ data: { formularioId: form.id,
          chave: "assinatura", titulo: etapaId === FORMALIZACAO ? "Formalização do contrato" : "Assinatura e pagamento", ordem: 0 } });
        const ordemCampos = [K.STATUS_CONTRATO, K.STATUS_ASSINATURA, K.DATA_ASSINATURA,
          K.ANEXO_ASSINADO, K.PRAZO_ASSINATURA, ...(etapaId === FORMALIZACAO ? [] : [K.PAGAMENTO_CONFIRMADO])];
        for (const [ordem, chave] of ordemCampos.entries()) {
          const campoId = ids.get(chave)!;
          const condicao = chave === K.DATA_ASSINATURA || chave === K.ANEXO_ASSINADO ? JSON.stringify(condAssinado) : null;
          await tx.bpmCampoEtapaConfig.create({ data: { campoId, etapaId, visivel: true,
            editavel: chave !== K.STATUS_CONTRATO, somenteLeitura: chave === K.STATUS_CONTRATO,
            obrigatorioSaida: chave === K.STATUS_ASSINATURA, condicaoObrigatoriedadeJson: condicao,
            valorPadrao: chave === K.DATA_ASSINATURA ? "{{agora.data}}" : null,
            ordem, grupo: "Assinatura e pagamento",
          } });
          await tx.bpmFormularioComponente.create({ data: { secaoId: secao.id, chave: `campo:${chave}`,
            tipo: "CAMPO", campoId, ordem } });
        }
      }
      const requisitos = [
        { chave: "financeiro.formalizacao.ativa.data", etapaId: FORMALIZACAO, fase: "DURING_STAGE", campoId: ids.get(K.DATA_ASSINATURA)!, alvoTipo: "CAMPO", condicaoJson: JSON.stringify(condAssinado), mensagem: "Data da assinatura obrigatória quando assinado.", ordem: 1 },
        { chave: "financeiro.formalizacao.ativa.anexo", etapaId: FORMALIZACAO, fase: "DURING_STAGE", campoId: ids.get(K.ANEXO_ASSINADO)!, alvoTipo: "CAMPO", condicaoJson: JSON.stringify(condAssinado), mensagem: "Contrato assinado/anexo obrigatório quando assinado.", ordem: 2 },
        { chave: "financeiro.formalizacao.ativa.final.assinatura", etapaId: finalizada.id, fase: "ENTER_STAGE", campoId: null, alvoTipo: "REGRA", condicaoJson: JSON.stringify(cond(assinatura.id, "diferente", "Assinado")), mensagem: "Contrato pendente: assinatura não confirmada.", ordem: 1 },
        { chave: "financeiro.formalizacao.ativa.final.data", etapaId: finalizada.id, fase: "ENTER_STAGE", campoId: ids.get(K.DATA_ASSINATURA)!, alvoTipo: "CAMPO", condicaoJson: null, mensagem: "Data da assinatura obrigatória.", ordem: 2 },
        { chave: "financeiro.formalizacao.ativa.final.anexo", etapaId: finalizada.id, fase: "ENTER_STAGE", campoId: ids.get(K.ANEXO_ASSINADO)!, alvoTipo: "CAMPO", condicaoJson: null, mensagem: "Contrato assinado/anexo obrigatório.", ordem: 3 },
        { chave: "financeiro.formalizacao.ativa.final.pagamento", etapaId: finalizada.id, fase: "ENTER_STAGE", campoId: null, alvoTipo: "REGRA", condicaoJson: JSON.stringify(cond(ids.get(K.PAGAMENTO_CONFIRMADO)!, "diferente", "Sim")), mensagem: "Pagamento pendente: confirmação não registrada.", ordem: 4 },
      ];
      for (const item of requisitos) {
        if (item.condicaoJson) grupoCondicaoSchema.parse(JSON.parse(item.condicaoJson));
        await tx.bpmRequisito.create({ data: { ...item, pipelineId: PIPELINE, fonte: "ADMIN", ativo: true } });
      }
      const automacoes = [
        { chave: "financeiro.formalizacao.ativa.entrada", nome: "Formalização — contrato pendente",
          gatilhoTipo: "ENTRAR_COLUNA", gatilhoConfig: { escopo: "ETAPAS", etapaId: FORMALIZACAO },
          condicao: null, acoes: [{ tipo: "ALTERAR_CAMPO", parametros: { campoId: ids.get(K.STATUS_CONTRATO), valor: "Pendente", somenteSeVazio: true } }] },
        { chave: "financeiro.formalizacao.ativa.assinatura", nome: "Assinatura confirmada — concluir contrato",
          gatilhoTipo: "CAMPO_VALOR_ASSUMIDO", gatilhoConfig: { escopo: "GLOBAL_PIPELINE", campoId: assinatura.id, valor: "Assinado" },
          condicao: condAssinado, acoes: [{ tipo: "ALTERAR_CAMPO", parametros: { campoId: ids.get(K.STATUS_CONTRATO), valor: "CONTRATO CONCLUÍDO" } }] },
        { chave: "financeiro.formalizacao.ativa.lembrete", nome: "Assinatura pendente — lembrete diário",
          gatilhoTipo: "RECORRENCIA_ATINGIDA", gatilhoConfig: { escopo: "GLOBAL_PIPELINE",
            recorrencia: { tipo: "DIARIA", hora: "09:00", ancora: "AGORA" } },
          condicao: { operador: "AND", condicoes: [
            { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: assinatura.id }, operador: "igual", valor: "Aguardando assinatura" },
            { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: ids.get(K.PRAZO_ASSINATURA)! }, operador: "preenchido" },
          ] }, acoes: [{ tipo: "CRIAR_TAREFA", parametros: { titulo: "Acompanhar assinatura do contrato",
            descricao: "Assinatura pendente; confira o prazo configurado no card.", tipo: "ASSINATURA_CONTRATO",
            prazoCampoId: ids.get(K.PRAZO_ASSINATURA), naoDuplicarDiaTipo: true, prioridade: "NORMAL" } }] },
      ];
      for (const item of automacoes) {
        gatilhoConfigSchema.parse(item.gatilhoConfig);
        if (item.condicao) grupoCondicaoSchema.parse(item.condicao);
        const graph = validarGrafoAutomacao(grafo(item.acoes));
        const criada = await tx.bpmAutomacao.create({ data: { chave: item.chave, nome: item.nome,
          pipelineId: PIPELINE, etapaId: FORMALIZACAO, gatilhoTipo: item.gatilhoTipo,
          acaoTipo: item.acoes[0].tipo, parametrosJson: JSON.stringify(item.acoes[0].parametros), ativa: true, criadoPorId: 1 } });
        await tx.bpmAutomacaoVersao.create({ data: { automacaoId: criada.id, versao: 1, status: "ATIVA",
          gatilhoTipo: item.gatilhoTipo, gatilhoConfigJson: JSON.stringify(item.gatilhoConfig),
          condicaoJson: item.condicao ? JSON.stringify(item.condicao) : null,
          grafoJson: JSON.stringify(graph), timezone: "America/Sao_Paulo", criadoPorId: 1, ativadaEm: new Date() } });
      }
    }, { maxWait: 20_000, timeout: 120_000 });
    console.log(JSON.stringify({ mode: "apply", sucesso: true, ...plano }));
  }
} finally { await db.$disconnect(); }
