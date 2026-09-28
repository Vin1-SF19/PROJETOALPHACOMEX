/** Prévia e publicação transacional da etapa Agendar Reunião da Revisão de Radar. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import prismaDefault from "../src/lib/prisma";

const db = (prismaDefault as unknown as { default?: typeof prismaDefault }).default ?? prismaDefault;
const PIPELINE_ID = "cmuih48la000009gmzw3wwuzf";
const ETAPA_ID = "draft-stage-3dc45c6e-2b99-4fd7-bb41-0adfd47ba162";
const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = args.includes("--apply");
if (apply === args.includes("--preview")) throw new Error("Escolha --preview ou --apply.");

const pipeline = await db.bpmPipeline.findUnique({ where: { id: PIPELINE_ID }, select: {
  id: true, nome: true, ativo: true, configVersion: true,
  etapas: { select: { id: true, nome: true, capabilitiesJson: true, script: true, formulario: { select: { id: true } } } },
  transicoesEtapa: { select: { id: true, etapaOrigemId: true, etapaDestinoId: true, permitida: true, origem: true } },
  cadencias: { where: { excluidoEm: null }, select: { id: true, etapas: { select: { etapaId: true } } } },
} });
if (!pipeline || !pipeline.ativo || pipeline.nome !== "Revisão de Radar") throw new Error("Pipeline ativo divergente.");
const etapa = pipeline.etapas.find((item) => item.id === ETAPA_ID && item.nome === "Agendar Reunião");
if (!etapa || etapa.formulario || etapa.capabilitiesJson || etapa.script) throw new Error("Etapa/formulário/script mudaram; revisar plano.");
if (pipeline.cadencias.some((item) => item.etapas.some((vinculo) => vinculo.etapaId === ETAPA_ID))) throw new Error("Cadência já vinculada à etapa.");
const saidas = pipeline.transicoesEtapa.filter((item) => item.etapaOrigemId === ETAPA_ID);
const permitidas = saidas.filter((item) => item.permitida);
const nomes = (itens: typeof saidas) => itens.map((item) => pipeline.etapas.find((destino) => destino.id === item.etapaDestinoId)?.nome).sort();
if (saidas.length !== 8 || permitidas.length !== 8 || permitidas.some((item) => item.origem !== "AMBOS")) throw new Error("Matriz de saídas mudou.");
const manter = permitidas.filter((item) => ["Reunião Agendada", "Stand By"].includes(pipeline.etapas.find((destino) => destino.id === item.etapaDestinoId)?.nome ?? ""));
if (manter.length !== 2 || JSON.stringify(nomes(manter)) !== JSON.stringify(["Reunião Agendada", "Stand By"])) throw new Error("Saídas desejadas divergiram.");
const desligar = permitidas.filter((item) => !manter.some((alvo) => alvo.id === item.id));
const preview = {
  pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, configVersion: pipeline.configVersion,
  saidasManter: nomes(manter), saidasDesligar: desligar.map((item) => ({ id: item.id, nome: nomes([item])[0] })),
  capabilities: ["MEETING_SCHEDULER", "FOLLOW_UP_SCHEDULER"],
  cadencia: { nome: "Agendar Reunião — 8 ligações em 8 dias úteis", passos: 8, intervaloDiasUteis: [0, 1, 1, 1, 1, 1, 1, 1] },
  inserts: { BpmEtapaFormulario: 1, BpmFormularioSecao: 1, BpmFormularioComponente: 2, BpmCadencia: 1, BpmCadenciaPasso: 8, BpmCadenciaEtapa: 1, BpmPipelineConfigAuditoria: 1 },
  updates: { BpmPipeline: 1, BpmEtapa: 1, BpmTransicaoEtapa: 6 },
};
if (!apply) { console.log(JSON.stringify({ modo: "preview", ...preview }, null, 2)); process.exit(0); }

const backup = option("backup");
const manifest = option("manifest");
const expectedVersion = Number(option("expect-version"));
const adminId = Number(option("admin-id"));
if (!backup || !manifest || expectedVersion !== 12 || expectedVersion !== pipeline.configVersion
  || !Number.isInteger(adminId) || adminId <= 0
  || option("approval") !== "CONFIGURAR_AGENDAR_REUNIAO_REVISAO_RADAR") {
  throw new Error("Aplicação exige backup dedicado, versão 12, admin real e autorização específica.");
}
const manifestData = JSON.parse(readFileSync(manifest, "utf8"));
const stat = statSync(backup);
const criadoEm = new Date(manifestData.generatedAt ?? manifestData.createdAt).getTime();
if (!backup.includes("database-backups/pre-change/") || stat.size < 1_000_000
  || stat.size !== manifestData.sizeBytes
  || !String(manifestData.reason ?? "").includes("Agendar Reuniao Revisao de Radar")
  || !Number.isFinite(criadoEm) || criadoEm > Date.now() || Date.now() - criadoEm > 48 * 3600_000
  || createHash("sha256").update(readFileSync(backup)).digest("hex") !== manifestData.sha256) {
  throw new Error("Backup dedicado inválido ou vencido.");
}
execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
if (!(await db.usuarios.findUnique({ where: { id: adminId }, select: { id: true } }))) throw new Error("Administrador não encontrado.");

await db.$transaction(async (tx) => {
  const versao = await tx.bpmPipeline.updateMany({ where: { id: PIPELINE_ID, configVersion: expectedVersion }, data: { configVersion: { increment: 1 } } });
  if (versao.count !== 1) throw new Error("Versão mudou; publicação cancelada.");
  const [etapaAtual, associacoes, transicoes] = await Promise.all([
    tx.bpmEtapa.findUnique({ where: { id: ETAPA_ID }, select: { capabilitiesJson: true, script: true, formulario: { select: { id: true } } } }),
    tx.bpmCadenciaEtapa.count({ where: { etapaId: ETAPA_ID } }),
    tx.bpmTransicaoEtapa.findMany({ where: { etapaOrigemId: ETAPA_ID }, select: { id: true, permitida: true } }),
  ]);
  if (!etapaAtual || etapaAtual.capabilitiesJson || etapaAtual.script || etapaAtual.formulario || associacoes
    || transicoes.length !== 8 || transicoes.some((item) => !item.permitida || !saidas.some((anterior) => anterior.id === item.id))) {
    throw new Error("Configuração mudou em paralelo; publicação cancelada.");
  }
  await tx.bpmEtapa.update({ where: { id: ETAPA_ID }, data: { capabilitiesJson: JSON.stringify(preview.capabilities) } });
  await tx.bpmEtapaFormulario.create({ data: { etapaId: ETAPA_ID, ativo: true, secoes: { create: [{
    chave: "agendamento_e_contato", titulo: "Agendamento e próximo contato", ordem: 0,
    componentes: { create: [
      { chave: "reuniao", tipo: "CAPABILITY", capability: "MEETING_SCHEDULER", ordem: 0, configJson: JSON.stringify({ obrigatorioSaida: true }) },
      { chave: "proximo_contato", tipo: "CAPABILITY", capability: "FOLLOW_UP_SCHEDULER", ordem: 1 },
    ] },
  }] } } });
  const cadencia = await tx.bpmCadencia.create({ data: {
    nome: preview.cadencia.nome, descricao: "Uma ligação por dia útil enquanto Próximo Contato estiver vazio; até oito dias úteis.",
    pipelineId: PIPELINE_ID, ativa: true, criadoPorId: adminId,
    etapas: { create: [{ etapaId: ETAPA_ID }] },
    passos: { create: Array.from({ length: 8 }, (_, index) => ({
      ordem: index + 1, intervaloDias: index === 0 ? 0 : 1, tipoTarefa: "LIGACAO",
      titulo: `Ligação ${index + 1} de 8 — Agendar Reunião`,
      descricao: "Registre o resultado como ligação no card.", prioridade: "NORMAL", ativo: true,
    })) },
  }, select: { id: true } });
  const alteradas = await tx.bpmTransicaoEtapa.updateMany({ where: { id: { in: desligar.map((item) => item.id) }, etapaOrigemId: ETAPA_ID, permitida: true }, data: { permitida: false } });
  if (alteradas.count !== 6) throw new Error("Saídas mudaram em paralelo; publicação cancelada.");
  await tx.bpmPipelineConfigAuditoria.create({ data: {
    pipelineId: PIPELINE_ID, adminId, campoAlterado: "AGENDAR_REUNIAO_CONFIGURACAO_PUBLICADA",
    valorAnteriorJson: JSON.stringify({ configVersion: expectedVersion, saidas: nomes(permitidas), formulario: null, capabilitiesJson: null }),
    valorNovoJson: JSON.stringify({ configVersion: expectedVersion + 1, saidas: nomes(manter), capabilities: preview.capabilities, cadenciaId: cadencia.id }),
  } });
});
console.log(JSON.stringify({ modo: "apply", sucesso: true, pipelineId: PIPELINE_ID, configVersion: expectedVersion + 1 }));
