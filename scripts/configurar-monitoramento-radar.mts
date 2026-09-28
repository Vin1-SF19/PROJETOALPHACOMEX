/** Publicação protegida de Monitoramento configurável na Revisão de Radar. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { gatilhoConfigSchema, validarGrafoAutomacao } = await import("../src/lib/bpm/automacoes/central-schemas");

const PIPELINE_ID = "cmuih48la000009gmzw3wwuzf";
const ETAPA_ID = "draft-stage-689a8008-147a-4a7b-9277-0f68a8487e1d";
const DESTINO_ID = "draft-stage-3dc45c6e-2b99-4fd7-bb41-0adfd47ba162";
const CHAVE_REVISAO = "monitoramento_revisao_interna";
const CHAVE_CONDICAO = "monitoramento_condicao_retorno";
const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const aplicar = args.includes("--apply");
if (aplicar === args.includes("--preview")) throw new Error("Escolha --preview ou --apply.");

const recorrencia = { escopo: "ETAPAS", etapaId: ETAPA_ID, etapasIds: [ETAPA_ID],
  recorrencia: { tipo: "INTERVALO_DIAS", intervaloDias: 10, ancora: "ENTRADA_ETAPA" } };
const gatilhoCondicao = { escopo: "ETAPAS", etapaId: ETAPA_ID, etapasIds: [ETAPA_ID], tipoTarefa: "MONITORAMENTO_REVISAO" };
const tarefaRevisao = { titulo: "Verificar monitoramento", descricao: "Revisão interna do card em Monitoramento.",
  tipo: "MONITORAMENTO_REVISAO", prioridade: "NORMAL", prazoMinutos: 0, alertaMinutos: 0 };
const grafoRevisao = { inicioId: "revisao", nos: [
  { id: "revisao", tipo: "ACAO", acaoTipo: "CRIAR_TAREFA", parametros: tarefaRevisao, proximoId: "fim" },
  { id: "fim", tipo: "FIM" },
] };
const grafoCondicao = { inicioId: "alerta", nos: [
  { id: "alerta", tipo: "ACAO", acaoTipo: "CRIAR_ALERTA", parametros: { texto: "Condição de interesse identificada no CRM." }, proximoId: "atividade" },
  { id: "atividade", tipo: "ACAO", acaoTipo: "CRIAR_TAREFA", parametros: { titulo: "Retomar contato comercial", tipo: "RETORNO_MONITORAMENTO", prioridade: "NORMAL", prazoMinutos: 0, alertaMinutos: 0 }, proximoId: "retorno" },
  { id: "retorno", tipo: "ACAO", acaoTipo: "MOVER_CARD", parametros: { etapaId: DESTINO_ID, validarRequisitos: true, exigirProximoContatoVazio: false }, proximoId: "fim" },
  { id: "fim", tipo: "FIM" },
] };
gatilhoConfigSchema.parse(recorrencia);
gatilhoConfigSchema.parse(gatilhoCondicao);
validarGrafoAutomacao(grafoRevisao);
validarGrafoAutomacao(grafoCondicao);

try {
  const [pipeline, etapa, destino, existentes, centralLegada, transicao] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: PIPELINE_ID }, select: { nome: true, ativo: true, configVersion: true } }),
    db.bpmEtapa.findUnique({ where: { id: ETAPA_ID }, select: { nome: true, pipelineId: true, ativo: true, ehFinal: true, capabilitiesJson: true, formulario: { select: { id: true } } } }),
    db.bpmEtapa.findUnique({ where: { id: DESTINO_ID }, select: { nome: true, pipelineId: true, ativo: true } }),
    db.bpmAutomacao.count({ where: { pipelineId: PIPELINE_ID, chave: { in: [CHAVE_REVISAO, CHAVE_CONDICAO] } } }),
    db.bpmAutomacao.count({ where: { pipelineId: PIPELINE_ID, OR: [
      { chave: "monitoramento_mensal" },
      { versoes: { some: { gatilhoConfigJson: { contains: "monitoramento_mensal" } } } },
    ] } }),
    db.bpmTransicaoEtapa.findFirst({ where: { etapaOrigemId: ETAPA_ID, etapaDestinoId: DESTINO_ID }, select: { id: true } }),
  ]);
  if (!pipeline?.ativo || pipeline.nome !== "Revisão de Radar" || !etapa?.ativo || etapa.nome !== "Monitoramento"
    || etapa.pipelineId !== PIPELINE_ID || !etapa.ehFinal || etapa.formulario || etapa.capabilitiesJson
    || !destino?.ativo || destino.nome !== "Agendar Reunião" || destino.pipelineId !== PIPELINE_ID || existentes || centralLegada || transicao) {
    throw new Error("Configuração de Monitoramento mudou; revisar plano.");
  }
  const preview = { pipeline: { id: PIPELINE_ID, version: pipeline.configVersion }, etapa: { id: ETAPA_ID, nome: etapa.nome },
    frequenciaDias: 10, fonte: "CRM", proximaVerificacao: "calculada", retornoDestino: destino.nome,
    retornoCondicao: "inativa e editável", inserts: { formulario: 1, secao: 1, bloco: 1, automacoes: 2, versoes: 2, transicaoAutomatica: 1, auditoria: 1 },
    updates: { etapaFinal: false, capabilities: ["MONITORING_STATUS"], configVersion: pipeline.configVersion + 1 } };
  if (!aplicar) process.stdout.write(`${JSON.stringify({ mode: "preview", ...preview }, null, 2)}\n`);
  else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Turso remoto explícito obrigatório.");
    const backup = option("backup"), manifest = option("manifest");
    const versao = Number(option("radar-version")), adminId = Number(option("admin-id"));
    if (!backup || !manifest || versao !== pipeline.configVersion || !Number.isSafeInteger(adminId) || adminId <= 0
      || option("approval") !== "AUTORIZO_MONITORAMENTO_RADAR") throw new Error("Backup, versão, auditor e autorização específica são obrigatórios.");
    const manifesto = JSON.parse(readFileSync(manifest, "utf8"));
    const arquivo = statSync(backup);
    const criadoEm = new Date(manifesto.generatedAt ?? manifesto.createdAt).getTime();
    if (!backup.includes("database-backups/pre-change/") || arquivo.size < 1_000_000 || arquivo.size !== manifesto.sizeBytes
      || !Number.isFinite(criadoEm) || criadoEm > Date.now() || Date.now() - criadoEm > 48 * 3600_000
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== manifesto.sha256) throw new Error("Backup ausente, divergente ou vencido.");
    execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
    if (!await db.usuarios.findUnique({ where: { id: adminId }, select: { id: true } })) throw new Error("Auditor não encontrado.");
    await db.$transaction(async (tx) => {
      const mudou = await tx.bpmPipeline.updateMany({ where: { id: PIPELINE_ID, configVersion: versao }, data: { configVersion: { increment: 1 } } });
      if (mudou.count !== 1) throw new Error("Versão mudou; cancelado.");
      const atual = await tx.bpmEtapa.findUnique({ where: { id: ETAPA_ID }, select: { ehFinal: true, capabilitiesJson: true, formulario: { select: { id: true } } } });
      if (!atual?.ehFinal || atual.capabilitiesJson || atual.formulario) throw new Error("Etapa mudou; cancelado.");
      if (await tx.bpmAutomacao.count({ where: { pipelineId: PIPELINE_ID, chave: { in: [CHAVE_REVISAO, CHAVE_CONDICAO] } } })) throw new Error("Automação já existe; cancelado.");
      if (await tx.bpmAutomacao.count({ where: { pipelineId: PIPELINE_ID, OR: [
        { chave: "monitoramento_mensal" },
        { versoes: { some: { gatilhoConfigJson: { contains: "monitoramento_mensal" } } } },
      ] } })) throw new Error("Automação mensal central legada presente; cancelar para evitar dupla execução.");
      await tx.bpmEtapa.update({ where: { id: ETAPA_ID }, data: { ehFinal: false, capabilitiesJson: JSON.stringify(["MONITORING_STATUS"]) } });
      await tx.bpmEtapaFormulario.create({ data: { etapaId: ETAPA_ID, ativo: true, secoes: { create: [{ chave: "monitoramento", titulo: "Monitoramento", ordem: 0,
        componentes: { create: [{ chave: "proxima_verificacao", tipo: "CAPABILITY", capability: "MONITORING_STATUS", ordem: 0, configJson: JSON.stringify({ label: "Próxima verificação" }) }] } }] } } });
      await tx.bpmTransicaoEtapa.create({ data: { pipelineId: PIPELINE_ID, chave: "monitoramento_retorno_agendar_reuniao", etapaOrigemId: ETAPA_ID, etapaDestinoId: DESTINO_ID,
        origem: "AUTOMACAO", permitida: true, lifecycleDestino: "ATIVO", limparSubStatus: true } });
      const revisao = await tx.bpmAutomacao.create({ data: { chave: CHAVE_REVISAO, nome: "Monitoramento — revisão interna", descricao: "Cria tarefa interna a cada dez dias para cards ativos em Monitoramento.", pipelineId: PIPELINE_ID, etapaId: ETAPA_ID,
        gatilhoTipo: "RECORRENCIA_ATINGIDA", acaoTipo: "CRIAR_TAREFA", parametrosJson: JSON.stringify(tarefaRevisao), ativa: true, criadoPorId: adminId } });
      await tx.bpmAutomacaoVersao.create({ data: { automacaoId: revisao.id, versao: 1, status: "ATIVA", gatilhoTipo: "RECORRENCIA_ATINGIDA", gatilhoConfigJson: JSON.stringify(recorrencia),
        grafoJson: JSON.stringify(grafoRevisao), timezone: "America/Sao_Paulo", criadoPorId: adminId, ativadaEm: new Date() } });
      const condicao = await tx.bpmAutomacao.create({ data: { chave: CHAVE_CONDICAO, nome: "Monitoramento — condição de retorno", descricao: "Aguarda critério objetivo no CRM; ao ativar, alerta, cria atividade e retorna a Agendar reunião.",
        pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, gatilhoTipo: "TAREFA_CRIADA", acaoTipo: "CRIAR_ALERTA", parametrosJson: JSON.stringify({ texto: "Condição de interesse identificada no CRM." }), ativa: false, criadoPorId: adminId } });
      await tx.bpmAutomacaoVersao.create({ data: { automacaoId: condicao.id, versao: 1, status: "ATIVA", gatilhoTipo: "TAREFA_CRIADA", gatilhoConfigJson: JSON.stringify(gatilhoCondicao), condicaoJson: null,
        grafoJson: JSON.stringify(grafoCondicao), timezone: "America/Sao_Paulo", criadoPorId: adminId } });
      await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId: PIPELINE_ID, adminId, campoAlterado: "MONITORAMENTO_REVISAO_DEZ_DIAS_PUBLICADO",
        valorAnteriorJson: JSON.stringify({ configVersion: versao, formulario: null, ehFinal: true, revisao: "legado_30_dias" }),
        valorNovoJson: JSON.stringify({ configVersion: versao + 1, etapaId: ETAPA_ID, revisaoDias: 10, condicaoAtiva: false, destinoRetornoId: DESTINO_ID }) } });
    });
    process.stdout.write(`${JSON.stringify({ mode: "apply", success: true, radarVersion: versao + 1 })}\n`);
  }
} finally {
  await db.$disconnect();
}
