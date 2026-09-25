/** Plano/publicação da etapa Elaboração do Contrato. Sem --apply é somente leitura. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { default: db } = await import("../src/lib/prisma");
const { gatilhoConfigSchema, validarGrafoAutomacao } = await import("../src/lib/bpm/automacoes/central-schemas");
const { grupoCondicaoSchema } = await import("../src/lib/bpm/regras/schemas");
const pipelineKey = "financeiro";
const etapaAnteriorKey = "solicitacao_contrato";
const etapaKey = "elaboracao_contrato";
const chaves = {
  elaborado: "alpha.contrato.elaborado",
  dataElaboracao: "alpha.data.de.elaboracao",
  enviado: "alpha.contrato.enviado.para.assinatura",
  dataEnvio: "alpha.data.do.envio",
  contrato: "alpha.link.arquivo.do.contrato",
  status: "alpha.financeiro.status.contrato.assinatura",
} as const;
const contratacao = ["alpha.servico.contratado", "alpha.financeiro.valor.bruto.contrato", "alpha.forma.de.pagamento", "alpha.condicao.negociada"];
const args = new Map(process.argv.slice(2).map((arg) => {
  const separator = arg.indexOf("=");
  return separator < 0 ? [arg, ""] : [arg.slice(0, separator), arg.slice(separator + 1)];
}));

function condicao(campoId: string, valor: string) {
  return { operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: campoId }, operador: "igual", valor }] };
}
function grafo(acoes: Array<{ tipo: string; parametros: Record<string, unknown> }>) {
  const nos = acoes.map((acao, indice) => ({ id: `acao_${indice + 1}`, tipo: "ACAO", acaoTipo: acao.tipo,
    parametros: acao.parametros, proximoId: indice + 1 < acoes.length ? `acao_${indice + 2}` : "fim" }));
  return { inicioId: "acao_1", nos: [...nos, { id: "fim", tipo: "FIM" }] };
}

const pipeline = await db.bpmPipeline.findFirst({ where: { chave: pipelineKey }, select: { id: true, configVersion: true } });
if (!pipeline) throw new Error("Pipeline Financeiro não encontrado");
const [anterior, etapa] = await Promise.all([
  db.bpmEtapa.findFirst({ where: { pipelineId: pipeline.id, chave: etapaAnteriorKey, ativo: true }, select: { id: true, nome: true } }),
  db.bpmEtapa.findFirst({ where: { pipelineId: pipeline.id, chave: etapaKey, ativo: true }, select: { id: true, nome: true } }),
]);
if (!anterior || !etapa) throw new Error("Etapas ativas esperadas não encontradas");
const formularioAnterior = await db.bpmEtapaFormulario.findUnique({ where: { etapaId: anterior.id }, include: {
  secoes: { include: { componentes: { include: { campo: true } } } },
} });
const formulario = await db.bpmEtapaFormulario.findUnique({ where: { etapaId: etapa.id }, include: {
  secoes: { include: { componentes: { include: { campo: true } } } },
} });
if (!formularioAnterior?.ativo || !formulario?.ativo) throw new Error("Formulários ativos ausentes");
const camposEtapa = formulario.secoes.flatMap((secao) => secao.componentes.map((componente) => componente.campo).filter((campo) => campo !== null));
const porChave = new Map(camposEtapa.map((campo) => [campo.chave, campo]));
for (const chave of Object.values(chaves).filter((chave) => chave !== chaves.status)) {
  if (!porChave.get(chave)?.ativo) throw new Error(`Campo publicado e ativo ausente: ${chave}`);
}
const status = await db.bpmCampo.findUnique({ where: { chave: chaves.status }, include: { opcoes: { where: { ativo: true } } } });
if (!status?.ativo || !status.opcoes.some((opcao) => opcao.rotulo === "Aguardando assinatura")) throw new Error("Status de assinatura canônico indisponível");
if (status.tipo === "selecao") {
  const opcoes = (() => { try { return JSON.parse(status.opcoesJson ?? "null"); } catch { return null; } })();
  if (!Array.isArray(opcoes) || !opcoes.includes("Aguardando assinatura")) {
    throw new Error("Automação de status precisa de opções válidas para o validador de campos");
  }
}
const cadastro = formularioAnterior.secoes.filter((secao) => secao.chave === "fields")
  .flatMap((secao) => secao.componentes.map((componente) => componente.campo).filter((campo) => campo !== null));
const camposPrimeiraEtapa = formularioAnterior.secoes.flatMap((secao) => secao.componentes.map((componente) => componente.campo).filter((campo) => campo !== null));
const exigidos = [...cadastro.filter((campo) => campo.chave !== "alpha.complemento"), ...contratacao.map((chave) => camposPrimeiraEtapa.find((campo) => campo.chave === chave))];
if (exigidos.some((campo) => !campo?.ativo) || exigidos.length !== 14) throw new Error("Dados cadastrais ou de contratação divergentes");
const configsPrimeiraEtapa = await db.bpmCampoEtapaConfig.findMany({ where: { etapaId: anterior.id, campoId: { in: exigidos.map((campo) => campo!.id) } } });
if (configsPrimeiraEtapa.length !== exigidos.length || configsPrimeiraEtapa.some((config) => !config.visivel || !config.obrigatorio)) {
  throw new Error("A configuração obrigatória da etapa anterior mudou");
}
const ids = Object.fromEntries(Object.entries(chaves).filter(([chave]) => chave !== "status")
  .map(([chave, valor]) => [chave, porChave.get(valor)!.id])) as Record<Exclude<keyof typeof chaves, "status">, string>;
const condicaoElaborado = condicao(ids.elaborado, "Sim");
const condicaoEnviado = condicao(ids.enviado, "Sim");
const envioSemElaboracao = { operador: "AND", condicoes: [
  condicaoEnviado,
  { operador: "OR", condicoes: [
    { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: ids.elaborado }, operador: "vazio" },
    { tipo: "condicao", campo: { fonte: "campo_dinamico", campo: ids.elaborado }, operador: "igual", valor: "Não" },
  ] },
] };
const requisitos = [
  ...exigidos.map((campo, ordem) => ({ chave: `financeiro.elaboracao.conferir.${campo!.chave}`, campoId: campo!.id,
    alvoTipo: "CAMPO", condicaoJson: JSON.stringify(condicaoElaborado), mensagem: `${campo!.nome} deve estar preenchido antes da elaboração.`, ordem })),
  { chave: "financeiro.elaboracao.data", campoId: ids.dataElaboracao, alvoTipo: "CAMPO", condicaoJson: JSON.stringify(condicaoElaborado), mensagem: "Data de elaboração obrigatória.", ordem: 20 },
  { chave: "financeiro.elaboracao.envio.data", campoId: ids.dataEnvio, alvoTipo: "CAMPO", condicaoJson: JSON.stringify(condicaoEnviado), mensagem: "Data e hora do envio obrigatórias.", ordem: 21 },
  { chave: "financeiro.elaboracao.envio.contrato", campoId: ids.contrato, alvoTipo: "CAMPO", condicaoJson: JSON.stringify(condicaoEnviado), mensagem: "Link/arquivo do contrato obrigatório.", ordem: 22 },
  { chave: "financeiro.elaboracao.envio.sem.elaboracao", campoId: null, alvoTipo: "REGRA", condicaoJson: JSON.stringify(envioSemElaboracao), mensagem: "Marque Contrato elaborado = Sim antes de enviar para assinatura.", ordem: 23 },
];
const automacoes = [
  { chave: "financeiro.elaboracao.envio.assinatura", nome: "Contrato enviado — acompanhar assinatura", gatilhoTipo: "CAMPO_VALOR_ASSUMIDO",
    gatilhoConfig: { escopo: "ETAPAS", etapaId: etapa.id, campoId: ids.enviado, valor: "Sim" }, condicao: null,
    grafo: grafo([
      { tipo: "ALTERAR_CAMPO", parametros: { campoId: status.id, valor: "Aguardando assinatura", somenteSeVazio: true } },
      { tipo: "CRIAR_TAREFA", parametros: { titulo: "Acompanhar assinatura do contrato", tipo: "ASSINATURA_CONTRATO", prioridade: "NORMAL", naoDuplicarPendenteTipo: true } },
    ]) },
  ...exigidos.map((campo) => ({ chave: `financeiro.elaboracao.revisar.${campo!.chave}`, nome: `Revisar contrato após alterar ${campo!.nome}`,
    gatilhoTipo: "CAMPO_ALTERADO", gatilhoConfig: { escopo: "GLOBAL_PIPELINE", campoId: campo!.id }, condicao: condicaoElaborado,
    grafo: grafo([{ tipo: "CRIAR_ALERTA", parametros: { texto: `${campo!.nome} foi alterado após a elaboração. Confira se o contrato precisa ser atualizado.` } }]) })),
];
for (const requisito of requisitos) grupoCondicaoSchema.parse(JSON.parse(requisito.condicaoJson));
for (const automacao of automacoes) {
  gatilhoConfigSchema.parse(automacao.gatilhoConfig);
  if (automacao.condicao) grupoCondicaoSchema.parse(automacao.condicao);
  validarGrafoAutomacao(automacao.grafo);
}
const dataElaboracaoConfig = await db.bpmCampoEtapaConfig.findUnique({ where: { campoId_etapaId: { campoId: ids.dataElaboracao, etapaId: etapa.id } } });
const dataEnvioConfig = await db.bpmCampoEtapaConfig.findUnique({ where: { campoId_etapaId: { campoId: ids.dataEnvio, etapaId: etapa.id } } });
const contratoConfig = await db.bpmCampoEtapaConfig.findUnique({ where: { campoId_etapaId: { campoId: ids.contrato, etapaId: etapa.id } } });
if (!dataElaboracaoConfig || !dataEnvioConfig || !contratoConfig) throw new Error("Configurações da etapa ausentes");
const alterados = [ids.dataEnvio, ids.contrato];
const valoresHistoricos = await db.bpmCardCampoValor.count({ where: { campoId: { in: alterados } } });
const anexosHistoricos = await db.bpmCardAnexo.count({ where: { campoId: { in: alterados } } });
const historicos = await db.bpmCardCampoValor.findMany({ where: { campoId: { in: alterados } }, select: { campoId: true, valor: true } });
const datasSemHora = historicos.filter((item) => item.campoId === ids.dataEnvio && /^\d{4}-\d{2}-\d{2}$/.test(item.valor ?? ""));
if (anexosHistoricos || historicos.length !== datasSemHora.length) {
  throw new Error("Valores/anexos históricos incompatíveis com a mudança de tipo; revisar antes de publicar");
}

const plano = {
  pipelineId: pipeline.id, etapaId: etapa.id, formularioVersao: formulario.versao, configVersion: pipeline.configVersion,
  campos: { ...ids, status: status.id }, requisitos: requisitos.map((item) => ({ chave: item.chave, alvoTipo: item.alvoTipo, campoId: item.campoId })),
  tipos: { [ids.dataEnvio]: "data_hora", [ids.contrato]: "url_ou_arquivo" },
  padroes: { [ids.dataElaboracao]: "{{agora.data}}", [ids.dataEnvio]: "{{agora.instante}}" },
  automacoes: automacoes.map((item) => ({ chave: item.chave, gatilhoTipo: item.gatilhoTipo })),
  valoresHistoricos, anexosHistoricos, datasSemHora: datasSemHora.length,
};
if (!args.has("--apply")) {
  console.log(JSON.stringify({ mode: "PLAN", ...plano }, null, 2));
  await db.$disconnect();
  process.exit(0);
}

if (process.env.FINANCEIRO_ELABORACAO_APROVADO !== "SIM_PUBLICAR_SEGUNDA_ETAPA") throw new Error("Aprovação específica ausente");
const adminId = Number(args.get("--admin-id"));
if (!Number.isSafeInteger(adminId) || adminId <= 0) throw new Error("Informe --admin-id");
const admin = await db.usuarios.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador ativo inválido");
const manifestPath = args.get("--backup-manifest");
if (!manifestPath?.startsWith("database-backups/pre-change/")) throw new Error("Informe o backup dedicado pre-change");
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
if (manifest.reason !== "elaboracao-contrato-config-checkpoint" || !Number.isFinite(Date.parse(manifest.generatedAt))
  || Date.now() - Date.parse(manifest.generatedAt) > 48 * 60 * 60 * 1000
  || manifest.integrityCheck !== "ok" || manifest.foreignKeyViolations !== 0 || manifest.restoreTest !== "cópia local aberta e checada") {
  throw new Error("Backup dedicado inválido, não verificado ou vencido");
}
const backup = await readFile(manifest.backupPath);
if (backup.length !== manifest.sizeBytes || createHash("sha256").update(backup).digest("hex") !== manifest.sha256) throw new Error("Backup não confere com o manifesto");
const snapshotPath = resolve(`database-backups/pre-change/financeiro-elaboracao-config-${Date.now()}.json`);
const [requisitosAntes, automacoesAntes, configsAntes, camposAntes] = await Promise.all([
  db.bpmRequisito.findMany({ where: { pipelineId: pipeline.id, chave: { in: requisitos.map((item) => item.chave) } } }),
  db.bpmAutomacao.findMany({ where: { pipelineId: pipeline.id, chave: { in: automacoes.map((item) => item.chave) } }, include: { versoes: true } }),
  db.bpmCampoEtapaConfig.findMany({ where: { id: { in: [dataElaboracaoConfig.id, dataEnvioConfig.id, contratoConfig.id] } } }),
  db.bpmCampo.findMany({ where: { id: { in: [ids.dataEnvio, ids.contrato] } } }),
]);
await writeFile(snapshotPath, `${JSON.stringify({ plano, requisitosAntes, automacoesAntes, configsAntes, camposAntes }, null, 2)}\n`, { flag: "wx", mode: 0o600 });

// Turso encerra transações interativas longas. Preparar itens inativos permite repetir
// a operação após falha sem publicar uma configuração incompleta durante a preparação.
const tx = db;
{
  const versao = await tx.bpmEtapaFormulario.findUnique({ where: { etapaId: etapa.id }, select: { versao: true } });
  const pipelineAtual = await tx.bpmPipeline.findUnique({ where: { id: pipeline.id }, select: { configVersion: true } });
  if (versao?.versao !== formulario.versao || pipelineAtual?.configVersion !== pipeline.configVersion) throw new Error("Configuração mudou após o plano");
  const historicosAtuais = await tx.bpmCardCampoValor.findMany({ where: { campoId: { in: alterados } }, select: { campoId: true, valor: true } });
  if (historicosAtuais.length !== datasSemHora.length || historicosAtuais.some((item) => item.campoId !== ids.dataEnvio || !/^\d{4}-\d{2}-\d{2}$/.test(item.valor ?? ""))
    || await tx.bpmCardAnexo.count({ where: { campoId: { in: alterados } } })) throw new Error("Valores históricos mudaram após o plano");
  await tx.bpmCampo.update({ where: { id: ids.dataEnvio }, data: { tipo: "data_hora", configVersao: { increment: 1 } } });
  await tx.bpmCampo.update({ where: { id: ids.contrato }, data: { tipo: "url_ou_arquivo", configVersao: { increment: 1 } } });
  for (const [campoId, valorPadrao, condicaoJson] of [
    [ids.dataElaboracao, "{{agora.data}}", JSON.stringify(condicaoElaborado)],
    [ids.dataEnvio, "{{agora.instante}}", JSON.stringify(condicaoEnviado)],
    [ids.contrato, null, JSON.stringify(condicaoEnviado)],
  ] as const) {
    await tx.bpmCampoEtapaConfig.update({ where: { campoId_etapaId: { campoId, etapaId: etapa.id } },
      data: { valorPadrao, condicaoObrigatoriedadeJson: condicaoJson } });
  }
  for (const requisito of requisitos) {
    await tx.bpmRequisito.upsert({ where: { pipelineId_chave: { pipelineId: pipeline.id, chave: requisito.chave } },
      create: { ...requisito, pipelineId: pipeline.id, etapaId: etapa.id, fase: "DURING_STAGE", fonte: "ADMIN", ativo: false },
      update: { ...requisito, etapaId: etapa.id, fase: "DURING_STAGE", fonte: "ADMIN", ativo: false },
    });
  }
  for (const item of automacoes) {
    const automacao = await tx.bpmAutomacao.upsert({ where: { pipelineId_chave: { pipelineId: pipeline.id, chave: item.chave } },
      create: { chave: item.chave, nome: item.nome, pipelineId: pipeline.id, etapaId: etapa.id, gatilhoTipo: item.gatilhoTipo,
        acaoTipo: item.grafo.nos[0]?.tipo === "ACAO" && "acaoTipo" in item.grafo.nos[0] ? item.grafo.nos[0].acaoTipo : "CRIAR_ALERTA", parametrosJson: "{}", ativa: false, criadoPorId: adminId },
      update: { nome: item.nome, etapaId: etapa.id, gatilhoTipo: item.gatilhoTipo, ativa: false },
    });
    const ultima = await tx.bpmAutomacaoVersao.findFirst({ where: { automacaoId: automacao.id }, orderBy: { versao: "desc" }, select: { versao: true } });
    await tx.bpmAutomacaoVersao.updateMany({ where: { automacaoId: automacao.id, status: "ATIVA" }, data: { status: "ARQUIVADA", arquivadaEm: new Date() } });
    await tx.bpmAutomacaoVersao.create({ data: { automacaoId: automacao.id, versao: (ultima?.versao ?? 0) + 1, status: "ATIVA",
      gatilhoTipo: item.gatilhoTipo, gatilhoConfigJson: JSON.stringify(item.gatilhoConfig), condicaoJson: item.condicao ? JSON.stringify(item.condicao) : null,
      grafoJson: JSON.stringify(item.grafo), timezone: "America/Sao_Paulo", criadoPorId: adminId, ativadaEm: new Date() } });
  }
  for (const requisito of requisitos) {
    await tx.bpmRequisito.update({ where: { pipelineId_chave: { pipelineId: pipeline.id, chave: requisito.chave } }, data: { ativo: true } });
  }
  for (const item of automacoes) {
    await tx.bpmAutomacao.update({ where: { pipelineId_chave: { pipelineId: pipeline.id, chave: item.chave } }, data: { ativa: true } });
  }
  await tx.bpmEtapaFormulario.update({ where: { etapaId: etapa.id }, data: { versao: { increment: 1 } } });
  await tx.bpmPipeline.update({ where: { id: pipeline.id }, data: { configVersion: { increment: 1 } } });
}
console.log(JSON.stringify({ mode: "APPLIED", snapshotPath, backup: manifest.backupPath, requisitos: requisitos.length, automacoes: automacoes.length }));
await db.$disconnect();
