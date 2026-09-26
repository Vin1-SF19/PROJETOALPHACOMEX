/** Publicação protegida da conclusão automática e dos campos de entrega. Padrão: somente leitura. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { validarGrafoAutomacao, gatilhoConfigSchema } = await import("../src/lib/bpm/automacoes/central-schemas");
const { grupoCondicaoSchema } = await import("../src/lib/bpm/regras/schemas");

const args = new Map(process.argv.slice(2).map((arg) => {
  const i = arg.indexOf("=");
  return i === -1 ? [arg, ""] : [arg.slice(0, i), arg.slice(i + 1)];
}));
const chaveAutomacao = "financeiro.conclusao.automatica.contrato.pagamento";
const chavesEtapas = ["formalizacao_contratacao", "confirmacao_pagamento", "emissao_nota_fiscal", "contratacao_finalizada", "boas_vindas"];
const chavesCampos = [
  "alpha.financeiro.status.contrato.assinatura", "alpha.pagamento.confirmado",
  "alpha.cnpj", "alpha.razao.social", "alpha.contato.responsavel.representante", "alpha.e.mail",
  "alpha.servico.contratado", "alpha.contrato.assinado.anexo", "alpha.data.da.assinatura",
  "alpha.valor.acordado.no.contrato", "alpha.financeiro.valor.liquido.pagamento",
  "alpha.forma.de.pagamento", "alpha.data.do.pagamento", "alpha.nf.emitida",
  "alpha.numero.da.nf", "alpha.arquivo.link.da.nf", "alpha.vendedor.a",
  "alpha.parceiro.responsavel", "alpha.canal.origem.do.cliente", "alpha.observacoes.comerciais",
];
const camposObrigatoriosOperacional = [
  "alpha.cnpj", "alpha.razao.social", "alpha.contato.responsavel.representante",
  "alpha.e.mail", "alpha.servico.contratado", "alpha.vendedor.a",
];
// Contrato e NF são lidos pelo vínculo seguro na projeção viva da contratação.
// A NF pode ser atualizada após o handoff; sua cópia no formulário ficaria obsoleta.
const camposOperacional = chavesCampos.filter((chave) => ![
  "alpha.contrato.assinado.anexo", "alpha.nf.emitida", "alpha.numero.da.nf", "alpha.arquivo.link.da.nf",
].includes(chave));
const camposFinal = chavesCampos.filter((chave) => ![
  "alpha.cnpj", "alpha.razao.social", "alpha.contato.responsavel.representante",
  "alpha.e.mail", "alpha.servico.contratado", "alpha.valor.acordado.no.contrato",
  "alpha.forma.de.pagamento", "alpha.pagamento.confirmado", "alpha.nf.emitida",
  "alpha.vendedor.a", "alpha.parceiro.responsavel", "alpha.canal.origem.do.cliente",
  "alpha.contrato.assinado.anexo",
].includes(chave));

try {
  const pipelines = await db.bpmPipeline.findMany({ where: { chave: { in: ["financeiro", "operacional"] }, ativo: true },
    select: { id: true, chave: true, configVersion: true, etapas: { where: { ativo: true }, select: { id: true, chave: true } } } });
  const financeiro = pipelines.find((item) => item.chave === "financeiro");
  const operacional = pipelines.find((item) => item.chave === "operacional");
  if (!financeiro || !operacional) throw new Error("Financeiro ou Operacional ativo ausente");
  const etapas = new Map([...financeiro.etapas, ...operacional.etapas].map((item) => [item.chave, item.id]));
  if (chavesEtapas.some((chave) => !etapas.has(chave))) throw new Error("Etapas esperadas ausentes");
  const campos = await db.bpmCampo.findMany({ where: { chave: { in: chavesCampos }, ativo: true },
    select: { id: true, chave: true, tipo: true, escopo: true, pipelineId: true } });
  if (campos.length !== chavesCampos.length) throw new Error("Campos esperados ausentes ou inativos");
  const campoId = new Map(campos.map((item) => [item.chave, item.id]));
  const finalId = etapas.get("contratacao_finalizada")!;
  const boasVindasId = etapas.get("boas_vindas")!;
  const origens = ["formalizacao_contratacao", "confirmacao_pagamento"];
  const [automacaoExistente, arestasExistentes, formularios, configCampos] = await Promise.all([
    db.bpmAutomacao.findUnique({ where: { pipelineId_chave: { pipelineId: financeiro.id, chave: chaveAutomacao } }, select: { id: true } }),
    db.bpmTransicaoEtapa.findMany({ where: { etapaOrigemId: { in: origens.map((chave) => etapas.get(chave)!) }, etapaDestinoId: finalId }, select: { id: true, etapaOrigemId: true, origem: true, permitida: true, lifecycleDestino: true } }),
    db.bpmEtapaFormulario.findMany({ where: { etapaId: { in: [finalId, boasVindasId] }, ativo: true }, include: { secoes: true } }),
    db.bpmCampoEtapaConfig.findMany({ where: { etapaId: { in: [finalId, boasVindasId] }, campoId: { in: campos.map((item) => item.id) } }, select: { campoId: true, etapaId: true, visivel: true, obrigatorio: true } }),
  ]);
  if (automacaoExistente || arestasExistentes.some((item) => item.permitida)) {
    throw new Error("Conclusão automática ou aresta ativa já existe; revisar manualmente antes de repetir");
  }
  const formFinal = formularios.find((item) => item.etapaId === finalId);
  const formOperacional = formularios.find((item) => item.etapaId === boasVindasId);
  if (!formFinal?.secoes.some((item) => item.chave === "fields") || !formOperacional?.secoes.some((item) => item.chave === "fields")) {
    throw new Error("Formulário publicado de Concluídos ou Boas-vindas ausente");
  }
  const plano = {
    mode: "PLAN", financeiro: { id: financeiro.id, version: financeiro.configVersion },
    operacional: { id: operacional.id, version: operacional.configVersion },
    automacao: chaveAutomacao, arestas: origens.map((chave) => ({
      origem: chave, destino: "contratacao_finalizada",
      atual: arestasExistentes.find((item) => item.etapaOrigemId === etapas.get(chave)) ?? null,
    })),
    camposFinal, camposOperacional, camposObrigatoriosOperacional,
    configsExistentes: configCampos.map((item) => ({ campoId: item.campoId, etapaId: item.etapaId, visivel: item.visivel, obrigatorio: item.obrigatorio })),
    formularios: formularios.map((item) => ({ etapaId: item.etapaId, versao: item.versao })),
  };
  const igual = (id: string, valor: string) => ({ operador: "AND", condicoes: [
    { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: id }, operador: "preenchido" },
    { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: id }, operador: "igual", valor },
  ] });
  const condicao = { operador: "AND", condicoes: [
    igual(campoId.get("alpha.financeiro.status.contrato.assinatura")!, "Assinado"),
    igual(campoId.get("alpha.pagamento.confirmado")!, "Sim"),
  ] };
  grupoCondicaoSchema.parse(condicao);
  const gatilho = gatilhoConfigSchema.parse({ escopo: "ETAPAS", etapasIds: [
    ...origens.map((chave) => etapas.get(chave)!), etapas.get("emissao_nota_fiscal")!,
  ] });
  const grafo = validarGrafoAutomacao({ inicioId: "concluir", nos: [
    { id: "concluir", tipo: "ACAO", acaoTipo: "MOVER_CARD", parametros: { etapaId: finalId }, proximoId: "fim" },
    { id: "fim", tipo: "FIM" },
  ] });
  if (!args.has("--apply")) { console.log(JSON.stringify(plano, null, 2)); process.exit(0); }

  if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Publicação exige Turso remoto explícito");
  if (process.env.FINANCEIRO_CONCLUSAO_APROVADO !== "SIM_PUBLICAR_CONCLUSAO_OPERACIONAL") throw new Error("Confirmação específica ausente");
  if (Number(args.get("--expected-financeiro-version")) !== financeiro.configVersion
    || Number(args.get("--expected-operacional-version")) !== operacional.configVersion) throw new Error("Configuração mudou desde o plano");
  const adminId = Number(args.get("--admin-id"));
  const admin = Number.isSafeInteger(adminId) ? await db.usuarios.findUnique({ where: { id: adminId }, select: { role: true, status: true } }) : null;
  if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador ativo obrigatório");
  const manifestPath = args.get("--backup-manifest");
  if (!manifestPath?.startsWith("database-backups/pre-change/")) throw new Error("Backup pre-change obrigatório");
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
  if (manifest.reason !== "financeiro-conclusao-operacional-checkpoint" || manifest.integrityCheck !== "ok"
    || manifest.foreignKeyViolations !== 0 || manifest.restoreTest !== "cópia local aberta e checada"
    || !Number.isFinite(Date.parse(manifest.generatedAt)) || Date.now() - Date.parse(manifest.generatedAt) > 48 * 60 * 60 * 1000) {
    throw new Error("Backup dedicado inválido ou vencido");
  }
  const backup = await readFile(manifest.backupPath);
  if (backup.length !== manifest.sizeBytes || createHash("sha256").update(backup).digest("hex") !== manifest.sha256) throw new Error("Backup não confere com o manifesto");
  const snapshotPath = resolve(`database-backups/pre-change/financeiro-conclusao-config-${Date.now()}.json`);
  await writeFile(snapshotPath, `${JSON.stringify(plano, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  await db.$transaction(async (tx) => {
    const reservaFinanceiro = await tx.bpmPipeline.updateMany({ where: { id: financeiro.id, configVersion: financeiro.configVersion }, data: { configVersion: { increment: 1 } } });
    const reservaOperacional = await tx.bpmPipeline.updateMany({ where: { id: operacional.id, configVersion: operacional.configVersion }, data: { configVersion: { increment: 1 } } });
    if (reservaFinanceiro.count !== 1 || reservaOperacional.count !== 1) throw new Error("Versão concorrente alterada");
    for (const chave of origens) {
      const existente = arestasExistentes.find((item) => item.etapaOrigemId === etapas.get(chave));
      if (existente) await tx.bpmTransicaoEtapa.update({ where: { id: existente.id }, data: {
        permitida: true, origem: "AUTOMACAO", lifecycleDestino: "CONCLUIDO", limparSubStatus: true,
      } });
      else await tx.bpmTransicaoEtapa.create({ data: {
        pipelineId: financeiro.id, chave: `auto_${chave}_concluidos`, etapaOrigemId: etapas.get(chave)!, etapaDestinoId: finalId,
        permitida: true, origem: "AUTOMACAO", lifecycleDestino: "CONCLUIDO", limparSubStatus: true,
      } });
    }
    const automacao = await tx.bpmAutomacao.create({ data: { pipelineId: financeiro.id, chave: chaveAutomacao,
      nome: "Concluir contratação após assinatura e pagamento", gatilhoTipo: "CARD_ATUALIZADO", acaoTipo: "MOVER_CARD",
      etapaId: etapas.get("confirmacao_pagamento")!, parametrosJson: "{}", ativa: true, criadoPorId: adminId } });
    await tx.bpmAutomacaoVersao.create({ data: { automacaoId: automacao.id, versao: 1, status: "ATIVA",
      gatilhoTipo: "CARD_ATUALIZADO", gatilhoConfigJson: JSON.stringify(gatilho), condicaoJson: JSON.stringify(condicao),
      grafoJson: JSON.stringify(grafo), timezone: "America/Sao_Paulo", criadoPorId: adminId, ativadaEm: new Date() } });
    const formulariosPorEtapa = new Map(formularios.map((item) => [item.etapaId, item]));
    for (const [etapaId, chaves] of [[finalId, camposFinal], [boasVindasId, camposOperacional]] as const) {
      const formulario = formulariosPorEtapa.get(etapaId)!;
      const secaoId = formulario.secoes.find((item) => item.chave === "fields")!.id;
      for (const [i, chave] of chaves.entries()) {
        const id = campoId.get(chave)!;
        const campo = campos.find((item) => item.id === id)!;
        if (campo.pipelineId !== (etapaId === finalId ? financeiro.id : operacional.id)) {
          await tx.bpmCampoPipeline.upsert({ where: { campoId_pipelineId: { campoId: id, pipelineId: etapaId === finalId ? financeiro.id : operacional.id } },
            create: { campoId: id, pipelineId: etapaId === finalId ? financeiro.id : operacional.id }, update: {} });
        }
        await tx.bpmCampoEtapaConfig.upsert({ where: { campoId_etapaId: { campoId: id, etapaId } },
          create: { campoId: id, etapaId, visivel: true, editavel: false, somenteLeitura: true,
            obrigatorio: etapaId === boasVindasId && camposObrigatoriosOperacional.includes(chave), ordem: 100 + i, grupo: "Dados da contratação" },
          update: etapaId === boasVindasId && camposObrigatoriosOperacional.includes(chave) ? { visivel: true, obrigatorio: true } : { visivel: true } });
        await tx.bpmFormularioComponente.upsert({ where: { secaoId_chave: { secaoId, chave: `field:${id}` } },
          create: { secaoId, chave: `field:${id}`, tipo: "CAMPO", campoId: id, ordem: 100 + i }, update: {} });
      }
      await tx.bpmEtapaFormulario.update({ where: { id: formulario.id }, data: { versao: { increment: 1 } } });
    }
  }, { timeout: 120_000, maxWait: 10_000 });
  console.log(JSON.stringify({ mode: "APPLIED", snapshotPath, automacao: chaveAutomacao }));
} finally {
  await db.$disconnect();
}
