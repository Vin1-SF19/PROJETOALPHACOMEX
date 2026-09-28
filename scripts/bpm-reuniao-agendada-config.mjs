import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma.ts");
const { repetirTransacaoOcupada } = await import("../src/lib/bpm/sqlite-busy-retry.ts");

const campos = [
  ["mes_protocolar", "Mês para protocolar", "data", []],
  ["faturamento_5_anos", "Faturamento nos últimos 5 anos", "selecao", ["Menos de 5M", "De 5 a 16M", "Acima de 16M"]],
  ["armazenamento", "Armazenamento", "selecao", ["Sede da empresa — imóvel alugado", "Sede da empresa — imóvel próprio", "Sede da empresa — imóvel do sócio", "Local separado — galpão alugado", "Local separado — galpão próprio", "Operador logístico", "Sem local definido", "Local cedido"]],
  ["faturas_titularidade", "Faturas sob titularidade da empresa", "selecao", ["Internet", "Energia", "Internet e energia", "Despesas inclusas no coworking", "Despesas inclusas no comodato", "À regularizar"]],
  ["atuacao_empresa", "Atuação da empresa", "selecao", ["Varejo/e-commerce", "Atacado/distribuidor", "Indústria", "Prestação de serviços"]],
  ["tributos_semestre", "Tributos pagos no último semestre", "selecao", ["Suficiente para Radar 150k", "Suficiente para Radar Ilimitado"]],
  ["valor_acordado", "Valor acordado no contrato", "moeda", []],
  ["forma_pagamento", "Forma de pagamento", "selecao", ["50% Entrada / 50% Êxito (Pix)", "Parcelamento Cartão de Crédito - até 12x com juros", "Integral na contratação - 10% OFF (Pix)"]],
  ["exportador", "Exportador", "texto", []],
  ["complexidade_revisao", "Nível de complexidade da revisão", "selecao", ["Nível 1 — Sem ajustes na documentação", "Nível 2 — Ajustes na capacidade operacional", "Nível 3 — Mudança de regime tributário usando início/retomada", "Nível 4 — Ajustes complexos"]],
  ["historico_tentativas", "Histórico de tentativas anteriores", "selecao", ["Sim", "Não"]],
  ["embasamento_processo", "Embasamento do processo", "selecao", ["Disponibilidade financeira", "Início ou retomada — Tributos semestrais", "Receita Bruta (DAS)", "Receita Bruta (CPRB)", "Desoneração tributária"]],
  ["resumo_reuniao", "Resumo da reunião", "texto_longo", []],
];
const chave = (slug) => `alpha.radar.viabilidade.${slug}`;
const args = new Map(process.argv.slice(2).map((arg) => {
  const pos = arg.indexOf("=");
  return pos < 0 ? [arg, ""] : [arg.slice(0, pos), arg.slice(pos + 1)];
}));
const apply = args.has("--apply");
const pipeline = await db.bpmPipeline.findFirst({
  where: { nome: "Revisão de Radar", ativo: true },
  select: { id: true, nome: true, configVersion: true },
});
if (!pipeline) throw new Error("Pipeline Revisão de Radar não encontrado");
const etapa = await db.bpmEtapa.findFirst({
  where: { pipelineId: pipeline.id, nome: "Reunião Agendada", ativo: true },
  select: { id: true, nome: true, capabilitiesJson: true },
});
if (!etapa) throw new Error("Etapa Reunião Agendada não encontrada");
const atuais = await Promise.all([
  db.bpmCampo.findMany({ where: { pipelineId: pipeline.id }, include: { opcoes: true, etapaConfiguracoes: true } }),
  db.bpmEtapaFormulario.findUnique({ where: { etapaId: etapa.id }, include: { secoes: { include: { componentes: true } } } }),
  db.bpmTransicaoEtapa.findMany({ where: { etapaOrigemId: etapa.id }, include: { etapaDestino: { select: { nome: true } } } }),
  db.bpmCadencia.findMany({ where: { pipelineId: pipeline.id, etapas: { some: { etapaId: etapa.id } } }, include: { passos: true, etapas: true } }),
]);
const radar = atuais[0].find((campo) => campo.nome === "Radar pretendido" && campo.ativo && campo.tipo === "selecao");
if (!radar || radar.opcoes.filter((opcao) => opcao.ativo).length !== 3) throw new Error("Radar pretendido ativo com três opções não encontrado");
const manter = new Set(["Em tratativas", "Em tratativa", "Stand By", "Standby - Follow Up", "Sem viabilidade"]);
const plan = {
  pipeline: pipeline.nome,
  etapa: etapa.nome,
  configVersion: pipeline.configVersion,
  campoRadarReutilizado: radar.id,
  camposCriar: campos.filter(([slug]) => !atuais[0].some((campo) => campo.chave === chave(slug))).map(([slug, nome, tipo, opcoes]) => ({ chave: chave(slug), nome, tipo, opcoes, rascunho: tipo === "selecao" && opcoes.length === 0 })),
  formularioAtual: atuais[1] ? { id: atuais[1].id, versao: atuais[1].versao } : null,
  transicoesDesativar: atuais[2].filter((item) => item.permitida && !manter.has(item.etapaDestino.nome)).map((item) => item.etapaDestino.nome),
  transicoesManter: atuais[2].filter((item) => manter.has(item.etapaDestino.nome)).map((item) => item.etapaDestino.nome),
  cadenciasExistentes: atuais[3].map((item) => ({ id: item.id, nome: item.nome, ativa: item.ativa })),
  ressalva: "Forma de pagamento usa as três opções aprovadas; Exportador é texto editável. A obrigatoriedade dos campos da análise será configurada na UI.",
};
if (!apply) {
  console.log(JSON.stringify({ mode: "PLAN", ...plan }, null, 2));
  await db.$disconnect();
  process.exit(0);
}

if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Turso remoto explícito obrigatório");
if (process.env.REUNIAO_AGENDADA_APPROVED !== "AUTORIZO_REUNIAO_AGENDADA_RADAR") throw new Error("Confirmação específica ausente");
const expectedVersion = Number(args.get("--expected-config-version"));
if (expectedVersion !== pipeline.configVersion) throw new Error("Configuração mudou; refaça o plano");
const adminId = Number(args.get("--admin-id"));
const admin = Number.isSafeInteger(adminId) ? await db.usuarios.findUnique({ where: { id: adminId }, select: { role: true } }) : null;
if (!admin || !["Admin", "TI"].includes(admin.role)) throw new Error("Informe --admin-id de conta autorizada válida");
const backupBase = args.get("--backup-base");
if (!backupBase?.startsWith("database-backups/pre-change/")) throw new Error("Backup pre-change obrigatório");
const dumpPath = path.resolve(`${backupBase}.sql`);
const manifestPath = path.resolve(`${backupBase}.manifest.json`);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const idade = Date.now() - Date.parse(manifest.generatedAt);
if (!Number.isFinite(idade) || idade < 0 || idade > 48 * 60 * 60 * 1000) throw new Error("Backup vencido");
execFileSync(process.execPath, ["scripts/verify-turso-backup.mjs", dumpPath, manifestPath], { stdio: "inherit" });
const snapshotPath = path.resolve(`${backupBase}.reuniao-agendada-config.${Date.now()}.json`);
await writeFile(snapshotPath, JSON.stringify({ plan, atuais, etapa }, null, 2), { flag: "wx", mode: 0o600 });

await repetirTransacaoOcupada(() => db.$transaction(async (tx) => {
  const vigente = await tx.bpmPipeline.findUnique({ where: { id: pipeline.id }, select: { configVersion: true } });
  if (vigente?.configVersion !== expectedVersion) throw new Error("Configuração alterada durante publicação");
  const camposPorSlug = new Map();
  for (const [ordem, [slug, nome, tipo, opcoes]] of campos.entries()) {
    const existente = atuais[0].find((campo) => campo.chave === chave(slug));
    const campo = existente ?? await tx.bpmCampo.create({
      data: { pipelineId: pipeline.id, chave: chave(slug), nome, tipo, ordem: ordem + 20,
        ativo: !(tipo === "selecao" && opcoes.length === 0),
        opcoesJson: opcoes.length ? JSON.stringify(opcoes) : null },
    });
    if (existente && (existente.nome !== nome || existente.tipo !== tipo)) throw new Error(`Campo ${slug} divergiu do plano`);
    camposPorSlug.set(slug, campo.id);
    if (!existente && opcoes.length) await tx.bpmCampoOpcao.createMany({ data: opcoes.map((rotulo, indice) => ({ campoId: campo.id, chave: String(indice + 1), rotulo, ordem: indice })) });
  }
  const camposFormulario = [radar.id, ...campos.slice(0, 12).map(([slug]) => camposPorSlug.get(slug))];
  for (const [ordem, campoId] of camposFormulario.entries()) {
    await tx.bpmCampoEtapaConfig.upsert({
      where: { campoId_etapaId: { campoId, etapaId: etapa.id } },
      create: { campoId, etapaId: etapa.id, visivel: true, editavel: true, ordem, grupo: "Análise de Viabilidade" },
      update: { visivel: true, editavel: true, ordem, grupo: "Análise de Viabilidade" },
    });
  }
  await tx.bpmCampoEtapaConfig.upsert({
    where: { campoId_etapaId: { campoId: camposPorSlug.get("resumo_reuniao"), etapaId: etapa.id } },
    create: { campoId: camposPorSlug.get("resumo_reuniao"), etapaId: etapa.id, visivel: true, editavel: true, ordem: 100, grupo: "Resumo da reunião" },
    update: { visivel: true, editavel: true, ordem: 100, grupo: "Resumo da reunião" },
  });
  const formulario = atuais[1] ?? await tx.bpmEtapaFormulario.create({ data: { etapaId: etapa.id } });
  if (atuais[1]?.secoes.length) throw new Error("Formulário criado por outra operação; refaça plano");
  const secaoReuniao = await tx.bpmFormularioSecao.create({ data: { formularioId: formulario.id, chave: "reuniao", titulo: "Reunião e acompanhamento", ordem: 0 } });
  await tx.bpmFormularioComponente.createMany({ data: [
    { secaoId: secaoReuniao.id, chave: "transcricao", tipo: "CAPABILITY", capability: "MEETING_TRANSCRIPT", configJson: JSON.stringify({ obrigatorioSaida: true }), ordem: 0 },
    { secaoId: secaoReuniao.id, chave: "proximo_contato", tipo: "CAPABILITY", capability: "FOLLOW_UP_SCHEDULER", ordem: 1 },
  ] });
  const secaoAnalise = await tx.bpmFormularioSecao.create({ data: { formularioId: formulario.id, chave: "analise_viabilidade", titulo: "Análise de Viabilidade", ordem: 1 } });
  await tx.bpmFormularioComponente.createMany({ data: camposFormulario.map((campoId, ordem) => ({
    secaoId: secaoAnalise.id, chave: `campo_${ordem}`, tipo: "CAMPO", campoId, ordem,
    configJson: campoId === camposPorSlug.get("valor_acordado")
      ? JSON.stringify({ label: "Valor acordado no contrato (valor final após desconto)" }) : null,
  })) });
  const secaoResumo = await tx.bpmFormularioSecao.create({ data: { formularioId: formulario.id, chave: "resumo", titulo: "Resumo da reunião", ordem: 2 } });
  await tx.bpmFormularioComponente.create({ data: { secaoId: secaoResumo.id, chave: "resumo_reuniao", tipo: "CAMPO", campoId: camposPorSlug.get("resumo_reuniao") } });
  await tx.bpmEtapa.update({ where: { id: etapa.id }, data: { capabilitiesJson: JSON.stringify(["MEETING_TRANSCRIPT", "FOLLOW_UP_SCHEDULER"]) } });
  for (const transicao of atuais[2]) {
    if (!manter.has(transicao.etapaDestino.nome) && transicao.permitida) {
      await tx.bpmTransicaoEtapa.update({ where: { id: transicao.id }, data: { permitida: false } });
    }
  }
  if (atuais[3].length) throw new Error("Cadência desta etapa já existe; revise antes de publicar");
  await tx.bpmCadencia.create({ data: {
    nome: "Reunião Agendada — 8 ligações em 8 dias úteis", pipelineId: pipeline.id,
    descricao: "Uma ligação por dia útil após a reunião, até oito; pausa com Próximo Contato.", ativa: true, criadoPorId: adminId,
    etapas: { create: { etapaId: etapa.id } },
    passos: { create: Array.from({ length: 8 }, (_, indice) => ({ ordem: indice, intervaloDias: indice === 0 ? 0 : 1, tipoTarefa: "LIGACAO", titulo: `Ligação após reunião ${indice + 1}/8`, prioridade: "NORMAL" })) },
  } });
  await tx.bpmPipeline.update({ where: { id: pipeline.id }, data: { configVersion: { increment: 1 } } });
  await tx.bpmPipelineConfigAuditoria.create({ data: {
    pipelineId: pipeline.id, adminId, campoAlterado: "reuniao_agendada_viabilidade",
    valorAnteriorJson: JSON.stringify({ etapa, campos: atuais[0].map((campo) => ({ id: campo.id, chave: campo.chave })), formulario: atuais[1], transicoes: atuais[2].map((item) => ({ id: item.id, permitida: item.permitida })), cadencias: atuais[3].map((item) => item.id) }),
    valorNovoJson: JSON.stringify(plan),
  } });
}, { maxWait: 20_000, timeout: 120_000 }));
console.log(JSON.stringify({ mode: "APPLIED", pipelineId: pipeline.id, etapaId: etapa.id, snapshotPath }));
await db.$disconnect();
