/** Publicação pontual de Lost. --preview lê; --apply exige backup verificado e autorização específica. */
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

const motivos = ["Sem orçamento", "Escolheu concorrente", "Sem resposta", "Empresa não tem viabilidade", "Outro"];
const chaves = ["alpha.motivo.de.lost", "alpha.radar.lost.observacao_complementar"];

try {
  const pipelines = await db.bpmPipeline.findMany({
    where: { nome: "Revisão de Radar", ativo: true },
    select: { id: true, nome: true, configVersion: true, etapas: {
      where: { nome: "Lost", ativo: true },
      select: { id: true, nome: true, formulario: { select: { id: true } }, campoConfiguracoes: { select: { id: true } } },
    } },
  });
  if (pipelines.length !== 1 || pipelines[0].etapas.length !== 1) throw new Error("Pipeline ou etapa Lost ambíguos.");
  const pipeline = pipelines[0];
  const etapa = pipeline.etapas[0];
  const [camposEtapa, chavesExistentes, secoes] = await Promise.all([
    db.bpmCampo.findMany({ where: { pipelineId: pipeline.id, OR: [
      { nome: { in: ["Motivo do Lost", "Observação complementar"] } },
      { etapaConfiguracoes: { some: { etapaId: etapa.id } } },
    ] }, select: { id: true } }),
    db.bpmCampo.findMany({ where: { chave: { in: chaves } }, select: { id: true, chave: true } }),
    db.bpmFormularioSecao.findMany({ where: { formulario: { etapaId: etapa.id } }, select: { id: true } }),
  ]);
  if (camposEtapa.length || chavesExistentes.length || etapa.campoConfiguracoes.length || etapa.formulario || secoes.length) {
    throw new Error("Lost já recebeu campos/formulário; revisar plano antes de publicar.");
  }

  const preview = {
    pipeline: { id: pipeline.id, nome: pipeline.nome, versao: pipeline.configVersion },
    etapa: { id: etapa.id, nome: etapa.nome },
    campos: [
      { chave: chaves[0], nome: "Motivo do Lost", tipo: "selecao", opcoes: motivos, obrigatorioEntrada: true, obrigatorioNaEtapa: true },
      { chave: chaves[1], nome: "Observação complementar", tipo: "texto_longo", obrigatorioEntrada: false, obrigatorioNaEtapa: false },
    ],
    formulario: { secao: "Dados da perda", componentes: ["Motivo do Lost", "Observação complementar"] },
    dataPerda: "BpmCardHistorico.CARD_MOVIDO.createdAt na entrada em Lost",
    inserts: { BpmCampo: 2, BpmCampoOpcao: 5, BpmCampoEtapaConfig: 2, BpmEtapaFormulario: 1, BpmFormularioSecao: 1, BpmFormularioComponente: 2, BpmPipelineConfigAuditoria: 1 },
    updates: { BpmPipeline: 1 },
  };
  if (!aplicar) {
    process.stdout.write(`${JSON.stringify({ modo: "preview", ...preview }, null, 2)}\n`);
  } else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Turso remoto explícito obrigatório.");
    const backup = option("backup"), manifest = option("manifest");
    const version = Number(option("expect-version")), adminId = Number(option("admin-id"));
    if (!backup || !manifest || version !== pipeline.configVersion || !Number.isSafeInteger(adminId) || adminId <= 0
      || option("approval") !== "AUTORIZO_LOST_REVISAO_RADAR") {
      throw new Error("Aplicação exige backup, versão vigente, admin-id real e autorização específica.");
    }
    const manifesto = JSON.parse(readFileSync(manifest, "utf8"));
    const arquivo = statSync(backup);
    const criadoEm = new Date(manifesto.generatedAt ?? manifesto.createdAt).getTime();
    if (!backup.includes("database-backups/pre-change/") || arquivo.size < 1_000_000
      || arquivo.size !== manifesto.sizeBytes || !Number.isFinite(criadoEm)
      || criadoEm > Date.now() || Date.now() - criadoEm > 48 * 3600_000
      || !String(manifesto.reason ?? "").includes("Lost Revisao de Radar")
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== manifesto.sha256) {
      throw new Error("Backup dedicado ausente, divergente ou vencido.");
    }
    execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
    if (!await db.usuarios.findUnique({ where: { id: adminId }, select: { id: true } })) throw new Error("Administrador de auditoria não encontrado.");

    await db.$transaction(async (tx) => {
      const versao = await tx.bpmPipeline.updateMany({
        where: { id: pipeline.id, configVersion: version },
        data: { configVersion: { increment: 1 } },
      });
      if (versao.count !== 1) throw new Error("Versão do pipeline mudou; operação cancelada.");
      const [camposNovos, formNovo, etapaAtual] = await Promise.all([
        tx.bpmCampo.count({ where: { OR: [
          { chave: { in: chaves } },
          { pipelineId: pipeline.id, nome: { in: ["Motivo do Lost", "Observação complementar"] } },
          { etapaConfiguracoes: { some: { etapaId: etapa.id } } },
        ] } }),
        tx.bpmEtapaFormulario.count({ where: { etapaId: etapa.id } }),
        tx.bpmEtapa.findUnique({ where: { id: etapa.id }, select: { ativo: true, nome: true } }),
      ]);
      if (camposNovos || formNovo || !etapaAtual?.ativo || etapaAtual.nome !== "Lost") throw new Error("Configuração de Lost mudou; operação cancelada.");
      const motivo = await tx.bpmCampo.create({ data: {
        pipelineId: pipeline.id, chave: chaves[0], nome: "Motivo do Lost", tipo: "selecao", ordem: 0,
        opcoesJson: JSON.stringify(motivos), ativo: true, escopo: "CARD", visivel: true, editavel: true,
        opcoes: { create: motivos.map((rotulo, ordem) => ({ chave: `motivo_${ordem + 1}`, rotulo, ordem, ativo: true })) },
        etapaConfiguracoes: { create: { etapaId: etapa.id, visivel: true, editavel: true,
          obrigatorio: true, obrigatorioEntrada: true, obrigatorioSaida: false, ordem: 0, grupo: "Dados da perda" } },
      } });
      const observacao = await tx.bpmCampo.create({ data: {
        pipelineId: pipeline.id, chave: chaves[1], nome: "Observação complementar", tipo: "texto_longo", ordem: 1,
        ativo: true, escopo: "CARD", visivel: true, editavel: true,
        etapaConfiguracoes: { create: { etapaId: etapa.id, visivel: true, editavel: true,
          obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false, ordem: 1, grupo: "Dados da perda" } },
      } });
      await tx.bpmEtapaFormulario.create({ data: { etapaId: etapa.id, ativo: true, secoes: { create: [{
        chave: "dados_perda", titulo: "Dados da perda", ordem: 0,
        componentes: { create: [
          { chave: "motivo_lost", tipo: "CAMPO", campoId: motivo.id, ordem: 0 },
          { chave: "observacao_complementar", tipo: "CAMPO", campoId: observacao.id, ordem: 1 },
        ] },
      }] } } });
      await tx.bpmPipelineConfigAuditoria.create({ data: {
        pipelineId: pipeline.id, adminId, campoAlterado: "LOST_CONFIGURACAO_PUBLICADA",
        valorAnteriorJson: JSON.stringify({ configVersion: version, campos: 0, formulario: null }),
        valorNovoJson: JSON.stringify({ configVersion: version + 1, campos: [motivo.id, observacao.id], motivos }),
      } });
    });
    process.stdout.write(`${JSON.stringify({ modo: "apply", sucesso: true, pipelineId: pipeline.id, etapaId: etapa.id, configVersion: version + 1 })}\n`);
  }
} finally {
  await db.$disconnect();
}
