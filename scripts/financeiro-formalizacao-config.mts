/** Publicação controlada da Formalização. Sem --apply, consulta somente leitura. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { default: db } = await import("../src/lib/prisma");
const { grupoCondicaoSchema } = await import("../src/lib/bpm/regras/schemas");

const args = new Map(process.argv.slice(2).map((arg) => {
  const at = arg.indexOf("=");
  return at < 0 ? [arg, ""] : [arg.slice(0, at), arg.slice(at + 1)];
}));
const apply = args.has("--apply");
const chaves = {
  status: "alpha.financeiro.status.contrato.assinatura",
  statusLegado: "alpha.status.da.assinatura",
  statusContrato: "alpha.status.do.contrato",
  data: "alpha.data.da.assinatura",
  anexo: "alpha.contrato.assinado.anexo",
  pagamento: "alpha.pagamento.confirmado",
  prazo: "alpha.financeiro.prazo.assinatura",
} as const;
const etapasChaves = ["formalizacao_contratacao", "confirmacao_pagamento", "emissao_nota_fiscal"];
const host = "banco-alpha-alphacomex.aws-us-east-1.turso.io";

try {
  const pipeline = await db.bpmPipeline.findUnique({ where: { chave: "financeiro" }, select: { id: true, configVersion: true } });
  if (!pipeline) throw new Error("Pipeline Financeiro não encontrado");
  const etapas = await db.bpmEtapa.findMany({
    where: { pipelineId: pipeline.id, chave: { in: [...etapasChaves, "contratacao_finalizada"] }, ativo: true },
    include: { formulario: { include: { secoes: { include: { componentes: true } } } } },
  });
  const porEtapa = new Map(etapas.map((etapa) => [etapa.chave, etapa]));
  if ([...etapasChaves, "contratacao_finalizada"].some((chave) => !porEtapa.get(chave)?.formulario?.ativo)) {
    throw new Error("Etapas ou formulários publicados ausentes");
  }
  const campos = await db.bpmCampo.findMany({ where: { chave: { in: Object.values(chaves) }, pipelineId: pipeline.id } });
  const porChave = new Map(campos.map((campo) => [campo.chave, campo]));
  for (const chave of Object.values(chaves).filter((chave) => chave !== chaves.prazo)) {
    if (!porChave.get(chave)?.ativo) throw new Error(`Campo ativo ausente: ${chave}`);
  }
  const doc = porChave.get(chaves.anexo)!;
  const [valoresDocumento, anexosDocumento, contextoValores] = await Promise.all([
    db.bpmCardCampoValor.count({ where: { campoId: doc.id } }),
    db.bpmCardAnexo.count({ where: { campoId: doc.id } }),
    db.bpmCardServicoContexto.count({ where: { card: { pipelineId: pipeline.id }, contratoComercialId: { not: null } } }),
  ]);
  if (doc.tipo !== "texto" && doc.tipo !== "arquivo") throw new Error("Tipo do anexo mudou de forma inesperada");
  if (doc.tipo === "texto" && (valoresDocumento || anexosDocumento)) {
    throw new Error("Há valores ou anexos históricos; não alterar o tipo automaticamente");
  }
  const status = porChave.get(chaves.status)!;
  if (status.tipo !== "selecao" || JSON.stringify(JSON.parse(status.opcoesJson ?? "null")) !== JSON.stringify(["Aguardando assinatura", "Assinado"])) {
    throw new Error("Opções do status canônico divergentes");
  }
  const condicaoAssinado = { operador: "AND", condicoes: [{
    tipo: "condicao", campo: { fonte: "campo_dinamico", campo: status.id }, operador: "igual", valor: "Assinado",
  }] };
  const condicaoContratoPendente = { operador: "AND", condicoes: [{
    tipo: "condicao", campo: { fonte: "campo_dinamico", campo: status.id }, operador: "diferente", valor: "Assinado",
  }] };
  const condicaoPagamentoPendente = { operador: "AND", condicoes: [{
    tipo: "condicao", campo: { fonte: "campo_dinamico", campo: porChave.get(chaves.pagamento)!.id }, operador: "diferente", valor: "Sim",
  }] };
  for (const grupo of [condicaoAssinado, condicaoContratoPendente, condicaoPagamentoPendente]) grupoCondicaoSchema.parse(grupo);

  const alvo = Object.fromEntries(etapasChaves.map((chave) => {
    const etapa = porEtapa.get(chave)!;
    const secao = etapa.formulario?.secoes.find((item) => item.chave === "fields");
    if (!secao) throw new Error(`Seção de campos ausente: ${chave}`);
    return [chave, { etapaId: etapa.id, formularioId: etapa.formulario!.id, versao: etapa.formulario!.versao, secaoId: secao.id }];
  }));
  const plano = {
    sourceHost: new URL((process.env.TURSO_DATABASE_URL ?? "").replace(/^libsql:\/\//, "https://")).host,
    pipelineId: pipeline.id, configVersion: pipeline.configVersion, etapas: alvo,
    campos: Object.fromEntries(Object.entries(chaves).map(([nome, chave]) => [nome, porChave.get(chave)?.id ?? "CRIAR"])),
    operacoes: [
      "Renomear status canônico para Status da assinatura e ocultar campo de assinatura legado sem excluir dados",
      "Alterar Contrato assinado/anexo de texto para arquivo após confirmar zero valores/anexos históricos",
      "Publicar status, data, anexo e status do contrato em Formalização, Pagamento e Nota Fiscal",
      "Criar Prazo da assinatura por card e publicá-lo nessas três etapas",
      "Exigir data/anexo ao marcar Assinado e Contrato/Pagamento antes de Concluídos",
      "Preservar valores de cards e vínculos comerciais existentes; nenhum backfill",
    ],
    valoresDocumento, anexosDocumento, vinculosMetasExistentes: contextoValores,
  };
  if (!apply) {
    console.log(JSON.stringify({ mode: "PLAN", ...plano }, null, 2));
    process.exit(0);
  }

  if (plano.sourceHost !== host) throw new Error("Origem Turso não corresponde ao ambiente aprovado");
  if (process.env.FINANCEIRO_FORMALIZACAO_APROVADO !== "SIM_PUBLICAR_FORMALIZACAO_FINANCEIRO") {
    throw new Error("Confirmação específica da escrita não registrada");
  }
  const adminId = Number(args.get("--admin-id"));
  if (!Number.isSafeInteger(adminId) || adminId <= 0) throw new Error("Informe --admin-id válido");
  const admin = await db.usuarios.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
  if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador ativo inválido");
  const manifestPath = args.get("--backup-manifest");
  if (!manifestPath?.startsWith("database-backups/pre-change/")) throw new Error("Informe manifesto pre-change dedicado");
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
  const age = Date.now() - Date.parse(manifest.generatedAt);
  if (manifest.reason !== "financeiro-formalizacao-assinatura-contrato-checkpoint"
    || manifest.sourceHost !== host || age < 0 || age > 48 * 60 * 60 * 1000
    || manifest.integrityCheck !== "ok" || manifest.foreignKeyViolations !== 0
    || !String(manifest.restoreTest).includes("cópia local isolada")) {
    throw new Error("Backup dedicado ausente, inválido ou vencido");
  }
  const backup = await readFile(manifest.backupPath);
  if (backup.length !== manifest.sizeBytes || createHash("sha256").update(backup).digest("hex") !== manifest.sha256) {
    throw new Error("Backup não confere com o manifesto");
  }
  const snapshot = await Promise.all([
    db.bpmCampo.findMany({ where: { pipelineId: pipeline.id } }),
    db.bpmCampoEtapaConfig.findMany({ where: { etapaId: { in: etapas.map((etapa) => etapa.id) } } }),
    db.bpmFormularioComponente.findMany({ where: { secao: { formulario: { etapaId: { in: etapas.map((etapa) => etapa.id) } } } } }),
    db.bpmRequisito.findMany({ where: { pipelineId: pipeline.id } }),
  ]);
  const snapshotPath = resolve(`database-backups/pre-change/financeiro-formalizacao-config-${Date.now()}.json`);
  await writeFile(snapshotPath, `${JSON.stringify({ plano, snapshot }, null, 2)}\n`, { flag: "wx", mode: 0o600 });

  await db.$transaction(async (tx) => {
    console.error("[formalizacao-config] transação iniciada: reservando versão do pipeline");
    const reserva = await tx.bpmPipeline.updateMany({
      where: { id: pipeline.id, configVersion: pipeline.configVersion },
      data: { configVersion: { increment: 1 } },
    });
    if (reserva.count !== 1) throw new Error("Pipeline alterado após o plano");
    for (const [chave, item] of Object.entries(alvo)) {
      const atual = await tx.bpmEtapaFormulario.findUnique({ where: { etapaId: item.etapaId }, select: { versao: true } });
      if (atual?.versao !== item.versao) throw new Error(`Formulário alterado: ${chave}`);
    }
    if (doc.tipo === "texto" && (await tx.bpmCardCampoValor.count({ where: { campoId: doc.id } })
      || await tx.bpmCardAnexo.count({ where: { campoId: doc.id } }))) throw new Error("Documento recebeu dados após o plano");
    console.error("[formalizacao-config] versões conferidas: atualizando campos");
    await tx.bpmCampo.update({ where: { id: status.id }, data: { nome: "Status da assinatura", configVersao: { increment: 1 } } });
    await tx.bpmCampo.update({ where: { id: doc.id }, data: { tipo: "arquivo", configVersao: { increment: 1 } } });
    let prazo = porChave.get(chaves.prazo);
    if (!prazo) prazo = await tx.bpmCampo.create({ data: {
      pipelineId: pipeline.id, chave: chaves.prazo, nome: "Prazo da assinatura", tipo: "data_hora",
      escopo: "CARD", ativo: true, visivel: true, editavel: true,
    } });
    const legada = porChave.get(chaves.statusLegado)!;
    const statusContrato = porChave.get(chaves.statusContrato)!;
    const data = porChave.get(chaves.data)!;
    for (const chave of etapasChaves) {
      console.error(`[formalizacao-config] configurando etapa ${chave}`);
      const item = alvo[chave];
      for (const [campo, ordem] of [[statusContrato, 90], [status, 91], [data, 92], [doc, 93], [prazo, 94]] as const) {
        const condicao = campo.id === data.id || campo.id === doc.id ? JSON.stringify(condicaoAssinado) : null;
        await tx.bpmCampoEtapaConfig.upsert({ where: { campoId_etapaId: { campoId: campo.id, etapaId: item.etapaId } },
          create: { campoId: campo.id, etapaId: item.etapaId, visivel: true, ordem,
            editavel: campo.id !== statusContrato.id, somenteLeitura: campo.id === statusContrato.id,
            obrigatorio: campo.id === status.id, condicaoObrigatoriedadeJson: condicao },
          update: { visivel: true, editavel: campo.id !== statusContrato.id, somenteLeitura: campo.id === statusContrato.id,
            obrigatorio: campo.id === status.id, condicaoObrigatoriedadeJson: condicao },
        });
        await tx.bpmFormularioComponente.upsert({ where: { secaoId_chave: { secaoId: item.secaoId, chave: `field:${campo.id}` } },
          create: { secaoId: item.secaoId, chave: `field:${campo.id}`, tipo: "CAMPO", campoId: campo.id, ordem },
          update: { campoId: campo.id, ordem },
        });
      }
      await tx.bpmCampoEtapaConfig.updateMany({ where: { etapaId: item.etapaId, campoId: legada.id }, data: { visivel: false } });
      await tx.bpmEtapaFormulario.update({ where: { etapaId: item.etapaId }, data: { versao: { increment: 1 } } });
    }
    const final = porEtapa.get("contratacao_finalizada")!;
    console.error("[formalizacao-config] configurando requisitos finais");
    const requisitos = [
      { chave: "financeiro.formalizacao.final.contrato", campoId: null, alvoTipo: "REGRA", condicaoJson: JSON.stringify(condicaoContratoPendente), mensagem: "Contrato pendente: assinatura não confirmada.", ordem: 1 },
      { chave: "financeiro.formalizacao.final.data", campoId: data.id, alvoTipo: "CAMPO", condicaoJson: null, mensagem: "Data da assinatura obrigatória.", ordem: 2 },
      { chave: "financeiro.formalizacao.final.anexo", campoId: doc.id, alvoTipo: "CAMPO", condicaoJson: null, mensagem: "Contrato assinado/anexo obrigatório.", ordem: 3 },
      { chave: "financeiro.formalizacao.final.pagamento", campoId: null, alvoTipo: "REGRA", condicaoJson: JSON.stringify(condicaoPagamentoPendente), mensagem: "Pagamento pendente: confirmação não registrada.", ordem: 4 },
    ];
    for (const req of requisitos) {
      await tx.bpmRequisito.upsert({ where: { pipelineId_chave: { pipelineId: pipeline.id, chave: req.chave } },
        create: { ...req, pipelineId: pipeline.id, etapaId: final.id, fase: "ENTER_STAGE", fonte: "ADMIN", ativo: true },
        update: { ...req, etapaId: final.id, fase: "ENTER_STAGE", fonte: "ADMIN", ativo: true },
      });
    }
  }, { maxWait: 10_000, timeout: 60_000 });
  console.log(JSON.stringify({ mode: "APPLIED", snapshotPath, backup: manifest.backupPath, ...plano }, null, 2));
} finally {
  await db.$disconnect();
}
