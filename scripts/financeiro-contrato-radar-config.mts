/** Plano por padrão; --apply exige autorização específica e backup Vault validado. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { CONTRATO_PADRAO_ID } = await import("../src/lib/gerador-documentos/contrato-padrao-id");
const { validarGrafoAutomacao, gatilhoConfigSchema } = await import("../src/lib/bpm/automacoes/central-schemas");
const { grupoCondicaoSchema } = await import("../src/lib/bpm/regras/schemas");

const args = new Map(process.argv.slice(2).map((arg) => {
  const index = arg.indexOf("=");
  return index < 0 ? [arg, ""] : [arg.slice(0, index), arg.slice(index + 1)];
}));
const novosCampos = [
  { chave: "alpha.financeiro.contrato.valor.inicial", nome: "Valor inicial do contrato", variavel: "valor_inicial" },
  { chave: "alpha.financeiro.contrato.valor.final", nome: "Valor final do contrato", variavel: "valor_final" },
  { chave: "alpha.financeiro.contrato.desconto", nome: "Desconto do contrato", variavel: "desconto_valor" },
] as const;
const camposFonte = {
  rua: "alpha.rua", numero: "alpha.numero", complemento: "alpha.complemento",
  bairro: "alpha.bairro", cep: "alpha.cep", municipio: "alpha.municipio",
  estado: "alpha.estado", email: "alpha.e.mail",
  valorTotal: "alpha.financeiro.valor.bruto.contrato",
  formaPagamento: "alpha.forma.de.pagamento", condicaoNegociada: "alpha.condicao.negociada",
} as const;
const chaveAutomacao = "financeiro.elaboracao.gerar.contrato.radar";
const [pipeline, template, contratada] = await Promise.all([
  db.bpmPipeline.findFirst({ where: { chave: "financeiro", ativo: true }, select: { id: true, configVersion: true } }),
  db.documentoTemplate.findFirst({ where: { id: CONTRATO_PADRAO_ID, status: "ATIVO" }, select: { id: true, titulo: true } }),
  db.empresaContratada.findFirst({
    where: { razaoSocial: "ALPHA - COMEX, SERVICOS ADMINISTRATIVOS ESPECIALIZADOS E COWORKING LTDA", status: "ATIVO" },
    select: { id: true, razaoSocial: true, cnpj: true, logradouro: true, numero: true, bairro: true, municipio: true, uf: true, cep: true },
  }),
]);
if (!pipeline || !template || !contratada?.cnpj || !contratada.logradouro || !contratada.numero || !contratada.municipio) {
  throw new Error("Pipeline, template padrão ou cadastro completo da contratada indisponível");
}
const [origem, destino, campos, existentes] = await Promise.all([
  db.bpmEtapa.findFirst({ where: { pipelineId: pipeline.id, chave: "solicitacao_contrato", ativo: true }, select: { id: true } }),
  db.bpmEtapa.findFirst({ where: { pipelineId: pipeline.id, chave: "elaboracao_contrato", ativo: true }, select: { id: true } }),
  db.bpmCampo.findMany({ where: { chave: { in: Object.values(camposFonte) }, ativo: true,
    OR: [{ pipelineId: pipeline.id }, { pipelinesAssociados: { some: { pipelineId: pipeline.id } } }],
  }, select: { id: true, chave: true } }),
  db.bpmCampo.findMany({ where: { chave: { in: novosCampos.map((campo) => campo.chave) } }, select: { id: true, chave: true, ativo: true } }),
]);
if (!origem || !destino || campos.length !== Object.values(camposFonte).length) throw new Error("Etapas ou campos fonte divergentes");
const formulario = await db.bpmEtapaFormulario.findUnique({ where: { etapaId: origem.id }, include: { secoes: true } });
const secao = formulario?.secoes.find((item) => item.chave === "contratacao");
if (!formulario?.ativo || !secao) throw new Error("Formulário da Solicitação de Contrato incompleto");
const fonte = Object.fromEntries(campos.map((campo) => [campo.chave, campo.id]));
const campo = (chave: string) => `{{campo.${fonte[chave]}}}`;
const variaveis = {
  contratante_nome: "{{empresa.razaoSocial}}",
  contratante_cnpj: "{{empresa.cnpj}}",
  contratante_endereco: `${campo(camposFonte.rua)}, nº ${campo(camposFonte.numero)}, bairro ${campo(camposFonte.bairro)}, ${campo(camposFonte.municipio)}/${campo(camposFonte.estado)}, CEP ${campo(camposFonte.cep)}`,
  contratante_email: campo(camposFonte.email),
  valor_total: campo(camposFonte.valorTotal),
  __bpmServico: "{{card.servico}}",
  __bpmFormaPagamento: campo(camposFonte.formaPagamento),
  __bpmCondicaoNegociada: campo(camposFonte.condicaoNegociada),
};
const condicaoRadar = { operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "card", campo: "servico" }, operador: "contem", valor: "Radar" }] };
const gatilhoConfig = { escopo: "ETAPAS", etapaId: destino.id };
grupoCondicaoSchema.parse(condicaoRadar);
gatilhoConfigSchema.parse(gatilhoConfig);
const plano = {
  pipelineId: pipeline.id, configVersion: pipeline.configVersion,
  origemId: origem.id, destinoId: destino.id, formularioVersao: formulario.versao,
  camposNovos: novosCampos.map((item) => ({ ...item, existente: existentes.find((campo) => campo.chave === item.chave) ?? null })),
  templateId: template.id, contratadaId: contratada.id, automacao: chaveAutomacao,
  condicao: condicaoRadar, titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS + {{empresa.razaoSocial}}",
};
if (!args.has("--apply")) {
  console.log(JSON.stringify({ mode: "PLAN", ...plano }, null, 2));
  await db.$disconnect();
  process.exit(0);
}

if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Publicação exige Turso remoto explícito");
if (process.env.FINANCEIRO_CONTRATO_RADAR_APROVADO !== "SIM_PUBLICAR_CONTRATO_RADAR") throw new Error("Confirmação específica ausente");
if (existentes.length) throw new Error("Campos já existem; replaneje antes de repetir");
if (await db.bpmAutomacao.findUnique({ where: { pipelineId_chave: { pipelineId: pipeline.id, chave: chaveAutomacao } } })) throw new Error("Automação já existe; replaneje antes de repetir");
if (Number(args.get("--expected-config-version")) !== pipeline.configVersion || Number(args.get("--expected-form-version")) !== formulario.versao) throw new Error("Versões mudaram após o plano");
const adminId = Number(args.get("--admin-id"));
const admin = Number.isSafeInteger(adminId) ? await db.usuarios.findUnique({ where: { id: adminId }, select: { role: true, status: true } }) : null;
if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Informe administrador ativo autorizado");
const manifestPath = args.get("--backup-manifest");
if (!manifestPath || !resolve(manifestPath).includes("/database-backups/pre-change/")) throw new Error("Backup dedicado pre-change obrigatório");
const manifestAbsoluto = resolve(manifestPath);
const manifest = JSON.parse(await readFile(manifestAbsoluto, "utf8"));
if (manifest.reason !== "radar-contrato-elaboracao-pagamento-solicitacao-checkpoint" || !Number.isFinite(Date.parse(manifest.generatedAt))
  || Date.now() - Date.parse(manifest.generatedAt) > 48 * 60 * 60 * 1000 || manifest.integrityCheck !== "ok"
  || manifest.foreignKeyViolations !== 0 || manifest.restoreTest !== "cópia local aberta e checada") throw new Error("Backup vencido ou sem verificação");
const backup = await readFile(manifest.backupPath);
if (backup.length !== manifest.sizeBytes || createHash("sha256").update(backup).digest("hex") !== manifest.sha256) throw new Error("Backup não confere com o manifesto");
const snapshotPath = resolve(dirname(manifestAbsoluto), `financeiro-contrato-radar-before-${Date.now()}.json`);
await writeFile(snapshotPath, `${JSON.stringify({ plano, formulario, campos, existentes }, null, 2)}\n`, { flag: "wx", mode: 0o600 });

const idsNovos: Record<string, string> = {};
for (const [indice, item] of novosCampos.entries()) {
  const criado = await db.bpmCampo.create({ data: {
    chave: item.chave, pipelineId: pipeline.id, nome: item.nome, tipo: "moeda", escopo: "CARD", ativo: false,
    visivel: true, editavel: true, obrigatorio: false, ordem: 7 + indice,
  } });
  idsNovos[item.variavel] = criado.id;
  await db.bpmCampoEtapaConfig.create({ data: {
    campoId: criado.id, etapaId: origem.id, visivel: true, editavel: true, obrigatorioSaida: true,
    ordem: 7 + indice, grupo: "Dados da contratação", condicaoVisibilidadeJson: JSON.stringify(condicaoRadar),
  } });
  await db.bpmFormularioComponente.create({ data: {
    secaoId: secao.id, chave: `field:${criado.id}`, tipo: "CAMPO", campoId: criado.id, ordem: 7 + indice,
  } });
}
const grafo = { inicioId: "gerar", nos: [
  { id: "gerar", tipo: "ACAO", acaoTipo: "GERAR_CONTRATO", parametros: {
    templateId: template.id, titulo: plano.titulo, empresaContratadaId: contratada.id, permitirPendencias: true,
    variaveis: { ...variaveis, ...Object.fromEntries(Object.entries(idsNovos).map(([nome, id]) => [nome, `{{campo.${id}}}`])) },
  }, proximoId: "fim" },
  { id: "fim", tipo: "FIM" },
] };
validarGrafoAutomacao(grafo);
const automacao = await db.bpmAutomacao.create({ data: {
  chave: chaveAutomacao, nome: "Gerar contrato padrão RADAR", descricao: "Cria documento em conferência ao entrar em Elaboração do Contrato.",
  pipelineId: pipeline.id, etapaId: destino.id, gatilhoTipo: "ENTRAR_COLUNA", acaoTipo: "GERAR_CONTRATO",
  parametrosJson: JSON.stringify(grafo.nos[0].parametros), ativa: false, criadoPorId: adminId,
} });
await db.bpmAutomacaoVersao.create({ data: {
  automacaoId: automacao.id, versao: 1, status: "ATIVA", gatilhoTipo: "ENTRAR_COLUNA",
  gatilhoConfigJson: JSON.stringify(gatilhoConfig), condicaoJson: JSON.stringify(condicaoRadar),
  grafoJson: JSON.stringify(grafo), timezone: "America/Sao_Paulo", criadoPorId: adminId, ativadaEm: new Date(),
} });
for (const id of Object.values(idsNovos)) await db.bpmCampo.update({ where: { id }, data: { ativo: true } });
await db.bpmAutomacao.update({ where: { id: automacao.id }, data: { ativa: true } });
await db.bpmEtapaFormulario.update({ where: { id: formulario.id }, data: { versao: { increment: 1 } } });
await db.bpmPipeline.update({ where: { id: pipeline.id }, data: { configVersion: { increment: 1 } } });
console.log(JSON.stringify({ mode: "APPLIED", snapshotPath, campos: idsNovos, automacaoId: automacao.id }));
await db.$disconnect();
