/**
 * Configuração pontual: Meet confirmado em Agendar Reunião → Reunião Agendada.
 * Sem --apply, executa apenas o plano. A escrita exige autorização específica
 * recebida fora deste script e backup Turso pre-change recente e verificado.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { default: db } = await import("../src/lib/prisma");
const { gatilhoConfigSchema, validarGrafoAutomacao } = await import("../src/lib/bpm/automacoes/central-schemas");

const CHAVE = "agendar_reuniao_meet_para_reuniao_agendada";
const NOME = "Meet confirmado — mover para Reunião Agendada";
const ADMIN_ID = 8;
const args = process.argv.slice(2);
const aplicar = args.includes("--apply");
const manifestArg = args.find((arg) => arg.startsWith("--backup-manifest="))?.slice("--backup-manifest=".length);

async function validarBackup() {
  if (!manifestArg?.startsWith("database-backups/pre-change/")) {
    throw new Error("Informe --backup-manifest=database-backups/pre-change/...");
  }
  const manifest = JSON.parse(await readFile(resolve(manifestArg), "utf8")) as {
    generatedAt?: string; reason?: string; sizeBytes?: number; sha256?: string;
  };
  const idade = Date.now() - Date.parse(manifest.generatedAt ?? "");
  if (manifest.reason !== "pre-change Agendar Reuniao Revisao de Radar 2026-09-28"
    || !Number.isFinite(idade) || idade < 0 || idade > 48 * 60 * 60 * 1000
    || !manifestArg.endsWith(".manifest.json")) {
    throw new Error("Backup pre-change inválido, vencido ou de outra operação");
  }
  const dump = await readFile(resolve(manifestArg.replace(/\.manifest\.json$/, ".sql")));
  if (dump.length !== manifest.sizeBytes || createHash("sha256").update(dump).digest("hex") !== manifest.sha256) {
    throw new Error("Backup pre-change não confere com o manifesto");
  }
}

try {
  const pipelines = await db.bpmPipeline.findMany({
    where: { nome: "Revisão de Radar", ativo: true },
    select: { id: true, configVersion: true, etapas: {
      where: { nome: { in: ["Agendar Reunião", "Reunião Agendada"] }, ativo: true },
      select: { id: true, nome: true },
    } },
  });
  if (pipelines.length !== 1) throw new Error("Pipeline Revisão de Radar ausente ou ambíguo");
  const pipeline = pipelines[0];
  const origens = pipeline.etapas.filter((etapa) => etapa.nome === "Agendar Reunião");
  const destinos = pipeline.etapas.filter((etapa) => etapa.nome === "Reunião Agendada");
  if (origens.length !== 1 || destinos.length !== 1) throw new Error("Etapas de origem/destino ausentes ou ambíguas");
  const origem = origens[0];
  const destino = destinos[0];
  const transicao = await db.bpmTransicaoEtapa.findUnique({
    where: { etapaOrigemId_etapaDestinoId: { etapaOrigemId: origem.id, etapaDestinoId: destino.id } },
    select: { permitida: true, origem: true },
  });
  if (!transicao?.permitida || !["AMBOS", "AUTOMACAO"].includes(transicao.origem)) {
    throw new Error("Transição automática para Reunião Agendada não permitida");
  }
  const admin = await db.usuarios.findUnique({
    where: { id: ADMIN_ID }, select: { id: true, nome: true, role: true, status: true },
  });
  if (!admin || admin.status !== "ATIVO" || admin.role !== "TI" || !admin.nome.startsWith("Vinicius")) {
    throw new Error("Conta administrativa Vinicius (TI) indisponível");
  }
  const gatilhoConfig = gatilhoConfigSchema.parse({ escopo: "ETAPAS", etapaId: origem.id, etapasIds: [origem.id] });
  const grafo = validarGrafoAutomacao({ inicioId: "mover", nos: [
    { id: "mover", tipo: "ACAO", acaoTipo: "MOVER_CARD", parametros: { etapaId: destino.id, validarRequisitos: true }, proximoId: "fim" },
    { id: "fim", tipo: "FIM" },
  ] });
  const existente = await db.bpmAutomacao.findUnique({
    where: { pipelineId_chave: { pipelineId: pipeline.id, chave: CHAVE } },
    select: { id: true, ativa: true },
  });
  const plano = {
    modo: aplicar ? "APPLY" : "PLAN",
    pipeline: pipeline.id,
    origem: origem.id,
    destino: destino.id,
    gatilho: "REUNIAO_AGENDADA",
    acao: "MOVER_CARD",
    chave: CHAVE,
    auditor: { id: admin.id, nome: admin.nome },
    automacaoExistente: Boolean(existente),
    configVersionAntes: pipeline.configVersion,
  };
  if (!aplicar) {
    console.log(JSON.stringify(plano));
  } else {
    if (process.env.MEET_AUTO_MOVE_APROVADO !== "SIM_PUBLICAR_MEET_REUNIAO_AGENDADA") {
      throw new Error("Autorização específica ausente");
    }
    await validarBackup();
    if (existente) throw new Error("Automação já existe; revisar antes de alterar sua versão");
    const criado = await db.$transaction(async (tx) => {
      const versaoConfig = await tx.bpmPipeline.updateMany({
        where: { id: pipeline.id, configVersion: pipeline.configVersion },
        data: { configVersion: { increment: 1 } },
      });
      if (versaoConfig.count !== 1) throw new Error("Configuração do pipeline mudou; refaça o plano");
      const automacao = await tx.bpmAutomacao.create({ data: {
        chave: CHAVE, nome: NOME,
        descricao: "Após confirmar e salvar um novo Google Meet, mover o card para Reunião Agendada.",
        pipelineId: pipeline.id, etapaId: origem.id,
        gatilhoTipo: "REUNIAO_AGENDADA", acaoTipo: "MOVER_CARD",
        parametrosJson: JSON.stringify({ etapaId: destino.id, validarRequisitos: true }),
        ativa: true, criadoPorId: admin.id,
      } });
      const versao = await tx.bpmAutomacaoVersao.create({ data: {
        automacaoId: automacao.id, versao: 1, status: "ATIVA", gatilhoTipo: "REUNIAO_AGENDADA",
        gatilhoConfigJson: JSON.stringify(gatilhoConfig), grafoJson: JSON.stringify(grafo),
        timezone: "America/Sao_Paulo", criadoPorId: admin.id, ativadaEm: new Date(),
      } });
      await tx.bpmPipelineConfigAuditoria.create({ data: {
        pipelineId: pipeline.id, adminId: admin.id,
        campoAlterado: "AUTOMACAO_CENTRAL_CRIADA",
        valorNovoJson: JSON.stringify({ automacaoId: automacao.id, versaoId: versao.id, escopo: "ETAPAS", etapasIds: [origem.id] }),
      } });
      return { automacaoId: automacao.id, versaoId: versao.id };
    });
    console.log(JSON.stringify({ ...plano, criado, configVersionDepois: pipeline.configVersion + 1 }));
  }
} finally {
  await db.$disconnect();
}
