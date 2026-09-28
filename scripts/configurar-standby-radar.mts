/** Prévia da configuração de Stand By; --apply exige aprovação específica e backup verificado. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const aplicar = args.includes("--apply");
if (aplicar === args.includes("--preview")) throw new Error("Escolha --preview ou --apply.");

const CHAVE_AUTOMACAO = "standby_follow_up_semanal";
const CHAVE_STATUS = "alpha.radar.standby.status_follow_up";
const CHAVE_MOTIVO = "alpha.radar.standby.motivo_interrupcao";
const gatilho = { origemChave: CHAVE_AUTOMACAO, escopo: "ETAPAS", recorrencia: { tipo: "INTERVALO_DIAS", intervaloDias: 7, ancora: "ENTRADA_ETAPA" } };
const grafo = { inicioId: "criar-tarefa", nos: [
  { id: "criar-tarefa", tipo: "ACAO", acaoTipo: "CRIAR_TAREFA", parametros: {
    titulo: "Realizar follow-up semanal", descricao: "NoLoss: registre a tentativa real como interação no card. Nenhuma mensagem é enviada automaticamente.",
    tipo: "LIGACAO", prioridade: "NORMAL", prazoMinutos: 0, alertaMinutos: 0,
    interromperSeCampoPreenchido: "standbyFollowUpInterrompidoEm", registrarExecucaoEmCampo: "standbyFollowUpUltimoEm",
  }, proximoId: "fim" }, { id: "fim", tipo: "FIM" },
] };

try {
  const pipelines = await db.bpmPipeline.findMany({ where: { nome: "Revisão de Radar", ativo: true }, select: {
    id: true, nome: true, configVersion: true, etapas: { where: { nome: "Stand By", ativo: true }, select: {
      id: true, nome: true, capabilitiesJson: true, formulario: { select: { id: true } }, campoConfiguracoes: { select: { id: true } },
    } },
  } });
  if (pipelines.length !== 1 || pipelines[0].etapas.length !== 1) throw new Error("Pipeline ou etapa Stand By ambíguos.");
  const pipeline = pipelines[0], etapa = pipeline.etapas[0];
  const [campos, automacoes] = await Promise.all([
    db.bpmCampo.findMany({ where: { OR: [{ chave: { in: [CHAVE_STATUS, CHAVE_MOTIVO] } }, { pipelineId: pipeline.id, nome: { in: ["Status de follow-up", "Motivo da interrupção"] } }] }, select: { id: true } }),
    db.bpmAutomacao.findMany({ where: { pipelineId: pipeline.id, OR: [{ chave: CHAVE_AUTOMACAO }, { etapaId: etapa.id }] }, select: { id: true } }),
  ]);
  if (etapa.capabilitiesJson || etapa.formulario || etapa.campoConfiguracoes.length || campos.length || automacoes.length) throw new Error("Stand By já tem configuração; revisar plano antes de publicar.");
  const gatilhoFinal = { ...gatilho, etapaId: etapa.id, etapasIds: [etapa.id] };
  const preview = {
    pipeline: { id: pipeline.id, versao: pipeline.configVersion }, etapa: { id: etapa.id, nome: etapa.nome },
    campos: ["Próximo Contato (capacidade nativa editável)", "Status de follow-up (seleção Ativo/Interrompido, leitura)", "Motivo da interrupção (texto, preenchido na ação de interrupção)"],
    formulario: { secao: "Acompanhamento NoLoss", componentes: ["FOLLOW_UP_SCHEDULER", "Status de follow-up", "Motivo da interrupção", "STANDBY_FOLLOW_UP"] },
    automacao: { chave: CHAVE_AUTOMACAO, gatilho: gatilhoFinal, grafo, prazo: "indeterminado; enquanto o card estiver ativo em Stand By e o contato não tiver sido interrompido" },
    inserts: { BpmCampo: 2, BpmCampoOpcao: 2, BpmCampoEtapaConfig: 2, BpmEtapaFormulario: 1, BpmFormularioSecao: 1, BpmFormularioComponente: 4, BpmAutomacao: 1, BpmAutomacaoVersao: 1, BpmPipelineConfigAuditoria: 1 },
    updates: { BpmPipeline: 1, BpmEtapa: 1 },
  };
  if (!aplicar) { process.stdout.write(`${JSON.stringify({ modo: "preview", ...preview }, null, 2)}\n`); }
  else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Turso remoto explícito obrigatório.");
    const backup = option("backup"), manifest = option("manifest"), version = Number(option("expect-version")), adminId = Number(option("admin-id"));
    if (!backup || !manifest || version !== pipeline.configVersion || !Number.isSafeInteger(adminId) || adminId <= 0 || option("approval") !== "AUTORIZO_STANDBY_REVISAO_RADAR") throw new Error("Aplicação exige backup, versão vigente, admin-id e autorização específica.");
    const manifesto = JSON.parse(readFileSync(manifest, "utf8"));
    const arquivo = statSync(backup);
    const criadoEm = new Date(manifesto.generatedAt ?? manifesto.createdAt).getTime();
    if (!backup.includes("database-backups/pre-change/") || arquivo.size < 1_000_000 || arquivo.size !== manifesto.sizeBytes || !Number.isFinite(criadoEm) || criadoEm > Date.now() || Date.now() - criadoEm > 48 * 3600_000 || !String(manifesto.reason ?? "").includes("Stand By Revisao de Radar") || createHash("sha256").update(readFileSync(backup)).digest("hex") !== manifesto.sha256) throw new Error("Backup dedicado ausente, divergente ou vencido.");
    execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
    if (!await db.usuarios.findUnique({ where: { id: adminId }, select: { id: true } })) throw new Error("Administrador de auditoria não encontrado.");
    await db.$transaction(async (tx) => {
      const mudou = await tx.bpmPipeline.updateMany({ where: { id: pipeline.id, configVersion: version }, data: { configVersion: { increment: 1 } } });
      if (mudou.count !== 1) throw new Error("Versão do pipeline mudou; publicação cancelada.");
      const [atual, camposAtuais, automacoesAtuais] = await Promise.all([
        tx.bpmEtapa.findUnique({ where: { id: etapa.id }, select: { nome: true, ativo: true, capabilitiesJson: true, formulario: { select: { id: true } }, campoConfiguracoes: { select: { id: true } } } }),
        tx.bpmCampo.count({ where: { chave: { in: [CHAVE_STATUS, CHAVE_MOTIVO] } } }),
        tx.bpmAutomacao.count({ where: { pipelineId: pipeline.id, OR: [{ chave: CHAVE_AUTOMACAO }, { etapaId: etapa.id }] } }),
      ]);
      if (!atual?.ativo || atual.nome !== "Stand By" || atual.capabilitiesJson || atual.formulario || atual.campoConfiguracoes.length || camposAtuais || automacoesAtuais) throw new Error("Configuração de Stand By mudou; publicação cancelada.");
      await tx.bpmEtapa.update({ where: { id: etapa.id }, data: { capabilitiesJson: JSON.stringify(["FOLLOW_UP_SCHEDULER", "STANDBY_FOLLOW_UP"]) } });
      const status = await tx.bpmCampo.create({ data: {
        pipelineId: pipeline.id, chave: CHAVE_STATUS, nome: "Status de follow-up", tipo: "selecao", ordem: 0, escopo: "CARD", ativo: true, visivel: true, editavel: false, somenteLeitura: true, valorPadrao: "Ativo",
        opcoesJson: JSON.stringify(["Ativo", "Interrompido"]), opcoes: { create: [{ chave: "ativo", rotulo: "Ativo", ordem: 0 }, { chave: "interrompido", rotulo: "Interrompido", ordem: 1 }] },
        etapaConfiguracoes: { create: { etapaId: etapa.id, visivel: true, editavel: false, somenteLeitura: true, obrigatorio: false, ordem: 0, grupo: "Acompanhamento NoLoss" } },
      } });
      const motivo = await tx.bpmCampo.create({ data: {
        pipelineId: pipeline.id, chave: CHAVE_MOTIVO, nome: "Motivo da interrupção", tipo: "texto_longo", ordem: 1, escopo: "CARD", ativo: true, visivel: true, editavel: false, somenteLeitura: true,
        etapaConfiguracoes: { create: { etapaId: etapa.id, visivel: true, editavel: false, somenteLeitura: true, obrigatorio: false, ordem: 1, grupo: "Acompanhamento NoLoss" } },
      } });
      await tx.bpmEtapaFormulario.create({ data: { etapaId: etapa.id, ativo: true, secoes: { create: [{ chave: "acompanhamento_noloss", titulo: "Acompanhamento NoLoss", ordem: 0, componentes: { create: [
        { chave: "proximo_contato", tipo: "CAPABILITY", capability: "FOLLOW_UP_SCHEDULER", ordem: 0, configJson: JSON.stringify({ obrigatorioEntrada: false, obrigatorioSaida: false }) },
        { chave: "status_follow_up", tipo: "CAMPO", campoId: status.id, ordem: 1 },
        { chave: "motivo_interrupcao", tipo: "CAMPO", campoId: motivo.id, ordem: 2 },
        { chave: "standby_follow_up", tipo: "CAPABILITY", capability: "STANDBY_FOLLOW_UP", ordem: 3, configJson: JSON.stringify({ obrigatorioEntrada: false, obrigatorioSaida: false }) },
      ] } }] } } });
      const automacao = await tx.bpmAutomacao.create({ data: {
        chave: CHAVE_AUTOMACAO, nome: "Stand By — follow-up semanal NoLoss", descricao: "Cria tarefa semanal enquanto elegível, sem envio automático; interrupção encerra a agenda.",
        pipelineId: pipeline.id, etapaId: etapa.id, gatilhoTipo: "RECORRENCIA_ATINGIDA", acaoTipo: "CRIAR_TAREFA", parametrosJson: JSON.stringify(grafo.nos[0].parametros), ativa: true, criadoPorId: adminId,
        versoes: { create: { versao: 1, status: "ATIVA", gatilhoTipo: "RECORRENCIA_ATINGIDA", gatilhoConfigJson: JSON.stringify(gatilhoFinal), grafoJson: JSON.stringify(grafo), timezone: "America/Sao_Paulo", criadoPorId: adminId, ativadaEm: new Date() } },
      }, select: { id: true } });
      await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId: pipeline.id, adminId, campoAlterado: "STANDBY_CONFIGURACAO_PUBLICADA", valorAnteriorJson: JSON.stringify({ configVersion: version, formulario: null, automacao: null }), valorNovoJson: JSON.stringify({ configVersion: version + 1, campos: [status.id, motivo.id], automacaoId: automacao.id, gatilho: gatilhoFinal }) } });
    });
    process.stdout.write(`${JSON.stringify({ modo: "apply", sucesso: true, pipelineId: pipeline.id, etapaId: etapa.id, configVersion: version + 1 })}\n`);
  }
} finally { await db.$disconnect(); }
