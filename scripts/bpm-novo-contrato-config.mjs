import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local", quiet: true });

const { default: db } = await import("../src/lib/prisma.ts");
const { FINANCIAL_FIELD_KEYS: k } = await import("../src/lib/bpm/pipeline-financeiro.ts");

const groups = [
  { key: "fields", title: "Dados cadastrais", fields: [
    [k.CNPJ, true], [k.RAZAO_SOCIAL, true], [k.RUA, true], [k.NUMERO, true],
    ["alpha.complemento", false], [k.BAIRRO, true], [k.CEP, true],
    [k.MUNICIPIO, true], [k.ESTADO, true], [k.EMAIL, true], [k.REGIME_CLIENTE, true],
  ] },
  { key: "contratacao", title: "Dados da contratação", fields: [
    [k.SERVICO, true], [k.VALOR_BRUTO, true, "Valor bruto do contrato"],
    [k.FORMA_PAGAMENTO, true], [k.CONDICAO, true], [k.VENDEDOR, true],
    [k.ORIGEM, true, "Origem do cliente"], [k.PARCEIRO, false],
  ] },
  { key: "financeiro", title: "Campos financeiros", fields: [
    [k.REGIME_PRESTADOR, false], [k.IRRF_APLICAVEL, false], [k.ALIQUOTA_IRRF, false],
    [k.VALOR_IRRF, false], [k.CSRF_APLICAVEL, false], [k.ALIQUOTA_CSRF, false],
    [k.VALOR_CSRF, false], [k.TOTAL_RETENCOES, false], [k.VALOR_LIQUIDO, false],
    [k.VENCIMENTO, false], [k.DADOS_PAGAMENTO, false], [k.MEMORIA_CALCULO, false],
    [k.STATUS_FINANCEIRO, false],
  ] },
];
const keys = groups.flatMap((group) => group.fields.map(([key]) => key));
const calculated = new Set([k.VALOR_IRRF, k.VALOR_CSRF, k.TOTAL_RETENCOES, k.VALOR_LIQUIDO, k.MEMORIA_CALCULO, k.STATUS_FINANCEIRO]);
const args = new Map(process.argv.slice(2).map((arg) => {
  const index = arg.indexOf("=");
  return index < 0 ? [arg, ""] : [arg.slice(0, index), arg.slice(index + 1)];
}));
const apply = args.has("--apply");

const pipeline = await db.bpmPipeline.findFirst({ where: { chave: "financeiro" }, select: { id: true, nome: true, configVersion: true } });
if (!pipeline) throw new Error("Pipeline financeiro não encontrado");
const etapa = await db.bpmEtapa.findFirst({ where: { pipelineId: pipeline.id, chave: "solicitacao_contrato", ativo: true }, select: { id: true, nome: true } });
if (!etapa) throw new Error("Etapa Novo contrato não encontrada");
const formulario = await db.bpmEtapaFormulario.findUnique({
  where: { etapaId: etapa.id },
  include: { secoes: { include: { componentes: true }, orderBy: { ordem: "asc" } } },
});
if (!formulario?.ativo) throw new Error("Formulário ativo não encontrado");
const campos = await db.bpmCampo.findMany({
  where: { chave: { in: keys }, ativo: true, OR: [{ pipelineId: pipeline.id }, { pipelinesAssociados: { some: { pipelineId: pipeline.id } } }] },
  select: { id: true, chave: true, nome: true, tipo: true, escopo: true },
});
const porChave = new Map(campos.map((campo) => [campo.chave, campo]));
const valorOrigem = await db.bpmCampo.findUnique({ where: { chave: k.VALOR_NEGOCIADO_ORIGEM }, select: { id: true, chave: true, ativo: true } });
const regimeOrigem = await db.bpmCampo.findUnique({ where: { chave: "alpha.regime.tributario" }, select: { id: true, chave: true, ativo: true } });
const valorLegado = await db.bpmCampo.findUnique({ where: { chave: "alpha.legacy.valor.bruto.contrato" }, select: { id: true, chave: true, nome: true, tipo: true, escopo: true, ativo: true, pipelineId: true } });
if (!porChave.has(k.VALOR_BRUTO) && valorLegado?.pipelineId === pipeline.id && !valorLegado.ativo) {
  porChave.set(k.VALOR_BRUTO, { ...valorLegado, chave: k.VALOR_BRUTO });
}
if (!valorOrigem?.ativo) throw new Error("Campo de valor negociado do Comercial indisponível");
if (!regimeOrigem?.ativo) throw new Error("Campo de regime tributário do Comercial indisponível");
const missing = keys.filter((key) => !porChave.has(key));
if (missing.length) throw new Error(`Campos canônicos ausentes: ${missing.join(", ")}`);
const mapeamentoValorAnterior = await db.bpmCampoMapeamento.findUnique({ where: { campoDestinoId: porChave.get(k.VALOR_BRUTO).id } });
const mapeamentoRegimeAnterior = await db.bpmCampoMapeamento.findUnique({ where: { campoDestinoId: porChave.get(k.REGIME_CLIENTE).id } });
const statusAnterior = await db.bpmCampo.findUnique({ where: { id: porChave.get(k.STATUS_FINANCEIRO).id } });
const opcoesStatusAnteriores = await db.bpmCampoOpcao.findMany({ where: { campoId: porChave.get(k.STATUS_FINANCEIRO).id } });
const configuracoesEtapaAnteriores = await db.bpmCampoEtapaConfig.findMany({ where: { etapaId: etapa.id } });

const plan = {
  pipeline: pipeline.nome,
  etapa: etapa.nome,
  formularioId: formulario.id,
  versaoAtual: formulario.versao,
  configVersionAtual: pipeline.configVersion,
  grupos: groups.map((group) => ({ nome: group.title, campos: group.fields.map(([key, required, label]) => ({ chave: key, campoId: porChave.get(key).id, obrigatorio: required, rotuloEtapa: label ?? porChave.get(key).nome })) })),
  statusOpcaoAdicionar: "Aguardando pagamento",
  valorContrato: { campoDestinoId: porChave.get(k.VALOR_BRUTO).id, campoOrigemId: valorOrigem.id, modo: "COPIAR", ativarLegado: !campos.some((campo) => campo.chave === k.VALOR_BRUTO) },
  regimeCliente: { campoDestinoId: porChave.get(k.REGIME_CLIENTE).id, campoOrigemId: regimeOrigem.id, modo: "COPIAR" },
  componentesAtuais: formulario.secoes.flatMap((section) => section.componentes).length,
  estrategia: "Preservar IDs/valores dos campos; atualizar composição apenas da primeira etapa e opção do status financeiro; preservar seção de acompanhamento.",
};
if (!apply) {
  console.log(JSON.stringify({ mode: "PLAN", ...plan }, null, 2));
  await db.$disconnect();
  process.exit(0);
}

const adminId = Number(args.get("--admin-id"));
const expectedVersion = Number(args.get("--expected-version"));
const expectedConfigVersion = Number(args.get("--expected-config-version"));
const backupBase = args.get("--backup-base");
if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Aplicação exige Turso remoto explícito");
if (process.env.NOVO_CONTRATO_APPROVED !== "AUTORIZO_CONFIG_NOVO_CONTRATO_FINANCEIRO") throw new Error("Confirmação específica ausente");
if (!Number.isSafeInteger(adminId) || adminId <= 0) throw new Error("Informe --admin-id de um administrador autorizado");
const admin = await db.usuarios.findUnique({ where: { id: adminId }, select: { role: true } });
if (admin?.role !== "Admin") throw new Error("A conta informada não é administradora");
if (expectedVersion !== formulario.versao) throw new Error("Versão do formulário mudou; refaça o plano");
if (expectedConfigVersion !== pipeline.configVersion) throw new Error("Configuração do pipeline mudou; refaça o plano");
if (!backupBase?.startsWith("database-backups/pre-change/")) throw new Error("Informe --backup-base pre-change dedicado");
const dumpPath = path.resolve(`${backupBase}.sql`);
const manifestPath = path.resolve(`${backupBase}.manifest.json`);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!String(manifest.reason).includes("novo-contrato-financeiro")) throw new Error("Backup não é dedicado a esta publicação");
const idadeBackup = Date.now() - Date.parse(manifest.generatedAt);
if (!Number.isFinite(idadeBackup) || idadeBackup < 0 || idadeBackup > 48 * 60 * 60 * 1000) throw new Error("Backup vencido ou inválido");
execFileSync(process.execPath, ["scripts/verify-turso-backup.mjs", dumpPath, manifestPath], { stdio: "inherit" });

const snapshotPath = path.resolve(`${backupBase}.novo-contrato-config.${Date.now()}.json`);
await writeFile(snapshotPath, `${JSON.stringify({ plan, formulario, campos, valorLegado, valorOrigem, regimeOrigem, mapeamentoValorAnterior, mapeamentoRegimeAnterior, statusAnterior, opcoesStatusAnteriores, configuracoesEtapaAnteriores }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
await db.$transaction(async (tx) => {
  const atual = await tx.bpmEtapaFormulario.findUnique({ where: { etapaId: etapa.id }, select: { versao: true } });
  if (atual?.versao !== expectedVersion) throw new Error("Formulário alterado durante a publicação");
  const pipelineAtual = await tx.bpmPipeline.findUnique({ where: { id: pipeline.id }, select: { configVersion: true } });
  if (pipelineAtual?.configVersion !== expectedConfigVersion) throw new Error("Configuração alterada durante a publicação");
  if (plan.valorContrato.ativarLegado) {
    await tx.bpmCampo.update({ where: { id: plan.valorContrato.campoDestinoId }, data: { chave: k.VALOR_BRUTO, ativo: true, nome: "Valor bruto do contrato", escopo: "CARD", configVersao: { increment: 1 } } });
  }
  await tx.bpmCampoMapeamento.upsert({
    where: { campoDestinoId: plan.valorContrato.campoDestinoId },
    create: { campoDestinoId: plan.valorContrato.campoDestinoId, campoOrigemId: valorOrigem.id, modo: "COPIAR", ativo: true },
    update: { campoOrigemId: valorOrigem.id, modo: "COPIAR", ativo: true },
  });
  await tx.bpmCampoMapeamento.upsert({
    where: { campoDestinoId: plan.regimeCliente.campoDestinoId },
    create: { campoDestinoId: plan.regimeCliente.campoDestinoId, campoOrigemId: regimeOrigem.id, modo: "COPIAR", ativo: true },
    update: { campoOrigemId: regimeOrigem.id, modo: "COPIAR", ativo: true },
  });
  const status = porChave.get(k.STATUS_FINANCEIRO);
  const opcoesStatus = await tx.bpmCampoOpcao.findMany({ where: { campoId: status.id, ativo: true }, select: { rotulo: true, ordem: true } });
  if (!opcoesStatus.some((opcao) => opcao.rotulo === "Aguardando pagamento")) {
    await tx.bpmCampoOpcao.upsert({
      where: { campoId_chave: { campoId: status.id, chave: "aguardando-pagamento" } },
      create: { campoId: status.id, chave: "aguardando-pagamento", rotulo: "Aguardando pagamento", ordem: Math.max(-1, ...opcoesStatus.map((item) => item.ordem)) + 1 },
      update: { rotulo: "Aguardando pagamento", ativo: true },
    });
  }
  const statusAtual = await tx.bpmCampo.findUnique({ where: { id: status.id }, select: { opcoesJson: true } });
  let opcoesJson = [];
  try {
    const parsed = JSON.parse(statusAtual?.opcoesJson ?? "[]");
    if (Array.isArray(parsed)) opcoesJson = parsed.filter((item) => typeof item === "string");
  } catch { throw new Error("Catálogo legado do Status financeiro inválido"); }
  if (!opcoesJson.includes("Aguardando pagamento")) {
    await tx.bpmCampo.update({ where: { id: status.id }, data: { opcoesJson: JSON.stringify([...opcoesJson, "Aguardando pagamento"]), configVersao: { increment: 1 } } });
  }
  const sectionByKey = new Map(formulario.secoes.map((section) => [section.chave, section]));
  for (const [order, group] of groups.entries()) {
    let section = sectionByKey.get(group.key);
    if (section) {
      section = await tx.bpmFormularioSecao.update({ where: { id: section.id }, data: { titulo: group.title, ordem: order } });
    } else {
      section = await tx.bpmFormularioSecao.create({ data: { formularioId: formulario.id, chave: group.key, titulo: group.title, ordem: order } });
    }
    for (const [fieldOrder, [key, required, label]] of group.fields.entries()) {
      const campo = porChave.get(key);
      await tx.bpmCampoEtapaConfig.upsert({
        where: { campoId_etapaId: { campoId: campo.id, etapaId: etapa.id } },
        create: { campoId: campo.id, etapaId: etapa.id, visivel: true, editavel: !calculated.has(key), somenteLeitura: calculated.has(key), obrigatorio: required, ordem: fieldOrder, grupo: group.title },
        update: { visivel: true, editavel: !calculated.has(key), somenteLeitura: calculated.has(key), obrigatorio: required, ordem: fieldOrder, grupo: group.title },
      });
      const existing = formulario.secoes.flatMap((item) => item.componentes).find((item) => item.campoId === campo.id);
      const configJson = label ? JSON.stringify({ label }) : existing?.configJson ?? null;
      if (existing) {
        await tx.bpmFormularioComponente.update({ where: { id: existing.id }, data: { secaoId: section.id, ordem: fieldOrder, configJson } });
      } else {
        await tx.bpmFormularioComponente.create({ data: { secaoId: section.id, chave: `field:${campo.id}`, tipo: "CAMPO", campoId: campo.id, ordem: fieldOrder, configJson } });
      }
    }
  }
  const wanted = new Set(keys);
  const extras = formulario.secoes.flatMap((section) => section.componentes).filter((component) => component.tipo === "CAMPO" && !wanted.has(campos.find((campo) => campo.id === component.campoId)?.chave));
  for (const component of extras) await tx.bpmFormularioComponente.delete({ where: { id: component.id } });
  const workflow = sectionByKey.get("workflow");
  if (workflow) await tx.bpmFormularioSecao.update({ where: { id: workflow.id }, data: { ordem: groups.length } });
  await tx.bpmEtapaFormulario.update({ where: { id: formulario.id }, data: { versao: { increment: 1 } } });
  await tx.bpmPipeline.update({ where: { id: pipeline.id }, data: { configVersion: { increment: 1 } } });
  await tx.bpmPipelineConfigAuditoria.create({ data: {
    pipelineId: pipeline.id,
    adminId,
    campoAlterado: "formulario_novo_contrato_financeiro",
    valorAnteriorJson: JSON.stringify({ versao: formulario.versao, snapshotPath }),
    valorNovoJson: JSON.stringify({ versao: formulario.versao + 1, grupos: groups.map((group) => group.key) }),
  } });
}, { maxWait: 20_000, timeout: 60_000 });
console.log(JSON.stringify({ mode: "APPLIED", formularioId: formulario.id, versao: formulario.versao + 1, snapshotPath }));
await db.$disconnect();
