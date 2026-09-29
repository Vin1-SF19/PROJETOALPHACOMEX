/** Prévia read-only por padrão; publicação exige backup Vault e autorização específica. */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { cpfEhValido } = await import("../src/lib/bpm/alinhamento-estrategico");

const OPERACIONAL = "cmuih4tnh000409gm5z34jvss";
const ALINHAMENTO = "draft-stage-fea7d252-8276-439f-9b39-c676c15d7cf9";
const RESPONSAVEL = "alpha.operacional.analista.responsavel";
const NOME = "alpha.operacional.analista.nome";
const CPF = "alpha.operacional.analista.cpf";
const LINK = "alpha.operacional.alinhamento.link.resumo";
const VERSAO = 9;
const MOTIVO_BACKUP = "alinhamento-operacional-v10";
const aplicar = process.argv.includes("--apply");
const arg = (chave: string) => process.argv.slice(2).find((item) => item.startsWith(`--${chave}=`))?.slice(chave.length + 3);

try {
  const [pipeline, responsavel, duplicados, analistas] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: OPERACIONAL }, select: { nome: true, ativo: true,
      configVersion: true, etapas: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: {
        id: true, nome: true, ordem: true, formulario: { select: { id: true, versao: true,
          secoes: { select: { componentes: { select: { campoId: true } } } } } },
      } } } }),
    db.bpmCampo.findUnique({ where: { chave: RESPONSAVEL }, select: { id: true, pipelineId: true,
      escopo: true, fonteEntidade: true, fonteAtributo: true,
      etapaConfiguracoes: { where: { etapaId: ALINHAMENTO }, select: { id: true } },
    } }),
    db.bpmCampo.findMany({ where: { chave: { in: [NOME, CPF, LINK] } }, select: { chave: true } }),
    db.usuarios.findMany({ where: { id: { in: [15, 32, 34] } }, select: { id: true, cpf: true, status: true } }),
  ]);
  const alinhamento = pipeline?.etapas.find((etapa) => etapa.id === ALINHAMENTO);
  if (pipeline?.nome !== "Operacional" || !pipeline.ativo || pipeline.configVersion !== VERSAO
    || pipeline.etapas.length !== 13 || alinhamento?.ordem !== 1
    || alinhamento.formulario?.versao !== 1
    || alinhamento.formulario.secoes.flatMap((secao) => secao.componentes).length !== 19
    || pipeline.etapas.some((etapa) => !etapa.formulario)
    || responsavel?.pipelineId !== OPERACIONAL || responsavel.escopo !== "GLOBAL"
    || responsavel.fonteEntidade !== "CARD" || responsavel.fonteAtributo !== "responsavelId"
    || responsavel.etapaConfiguracoes.length !== 1 || duplicados.length
    || analistas.length !== 3 || analistas.some((item) => item.status !== "ATIVO" || !item.cpf || !cpfEhValido(item.cpf))) {
    throw new Error("Pré-condições do Alinhamento divergentes; refazer inventário antes de publicar.");
  }
  const etapasDestino = pipeline.etapas.filter((etapa) => etapa.ordem >= alinhamento.ordem);
  const plano = { mode: aplicar ? "apply" : "preview", pipelineId: OPERACIONAL,
    versaoDe: VERSAO, versaoPara: VERSAO + 1, etapaId: ALINHAMENTO,
    camposNovos: [NOME, CPF, LINK], responsavelExistente: RESPONSAVEL,
    etapasComNovosCampos: etapasDestino.length, alinhamentoFormularioDe: 1,
    alinhamentoFormularioPara: 2, alinhamentoComponentesDe: 19,
    alinhamentoComponentesPara: 22, linkObrigatorioSaida: true,
    nomeCanonicoObrigatorioSaida: true,
    cpfCanonicoObrigatorioSaida: true, responsavelObrigatorioSaida: true,
    cardsExistentesAlterados: false };
  if (!aplicar) {
    console.log(JSON.stringify(plano, null, 2));
  } else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")
      || arg("approval") !== "AUTORIZO_ALINHAMENTO_OPERACIONAL"
      || Number(arg("expect-version")) !== VERSAO || Number(arg("admin-id")) !== 1) {
      throw new Error("Ambiente, autorização ou versão inválidos.");
    }
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup Vault dedicado obrigatório.");
    const m = JSON.parse(readFileSync(manifest, "utf8")), b = statSync(backup), criado = Date.parse(m.generatedAt);
    if (!backup.includes("database-backups/pre-change/") || m.reason !== MOTIVO_BACKUP
      || !Number.isFinite(criado) || criado > Date.now() || Date.now() - criado > 48 * 3600_000
      || b.size < 1_000_000 || b.size !== m.sizeBytes
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== m.sha256) {
      throw new Error("Backup dedicado, completo, íntegro e recente obrigatório.");
    }
    await verificarBackupTurso(backup, manifest);
    await db.$transaction(async (tx) => {
      const reservado = await tx.bpmPipeline.updateMany({ where: { id: OPERACIONAL,
        configVersion: VERSAO }, data: { configVersion: { increment: 1 } } });
      if (reservado.count !== 1) throw new Error("Versão do Operacional mudou durante a publicação.");
      const nome = await tx.bpmCampo.create({ data: { pipelineId: OPERACIONAL, chave: NOME,
        nome: "Nome do responsável pelo processo", tipo: "texto", escopo: "GLOBAL",
        fonteEntidade: "CARD", fonteAtributo: "responsavelNome", visivel: true,
        editavel: false, somenteLeitura: true, ativo: true, ordem: 500 } });
      const cpf = await tx.bpmCampo.create({ data: { pipelineId: OPERACIONAL, chave: CPF,
        nome: "CPF do responsável pelo processo", tipo: "cpf", escopo: "GLOBAL",
        fonteEntidade: "CARD", fonteAtributo: "responsavelCpf", visivel: true,
        editavel: false, somenteLeitura: true, ativo: true, ordem: 501 } });
      const link = await tx.bpmCampo.create({ data: { pipelineId: OPERACIONAL, chave: LINK,
        nome: "Link do resumo da reunião", tipo: "url", escopo: "CARD",
        visivel: true, editavel: true, somenteLeitura: false, ativo: true, ordem: 502 } });
      await tx.bpmCampoPipeline.createMany({ data: [nome.id, cpf.id, link.id].map((campoId) => ({
        campoId, pipelineId: OPERACIONAL,
      })) });
      await tx.bpmCampoEtapaConfig.updateMany({ where: { campoId: responsavel.id,
        etapaId: ALINHAMENTO }, data: { visivel: true, obrigatorioSaida: true } });
      for (const etapa of etapasDestino) {
        const obrigatorioSaida = etapa.id === ALINHAMENTO;
        await tx.bpmCampoEtapaConfig.createMany({ data: [
          { campoId: nome.id, etapaId: etapa.id, visivel: true, editavel: false,
            somenteLeitura: true, obrigatorioSaida, ordem: 500, grupo: "Alinhamento estratégico" },
          { campoId: cpf.id, etapaId: etapa.id, visivel: true, editavel: false,
            somenteLeitura: true, obrigatorioSaida, ordem: 501, grupo: "Alinhamento estratégico" },
          { campoId: link.id, etapaId: etapa.id, visivel: true, editavel: true,
            somenteLeitura: false, obrigatorioSaida, ordem: 502, grupo: "Alinhamento estratégico" },
        ] });
        const formulario = etapa.formulario!;
        const secao = await tx.bpmFormularioSecao.create({ data: { formularioId: formulario.id,
          chave: "alinhamento_estrategico", titulo: "Alinhamento estratégico", ordem: 2 } });
        await tx.bpmFormularioComponente.createMany({ data: [
          { secaoId: secao.id, chave: `campo:${nome.id}`, tipo: "CAMPO", campoId: nome.id, ordem: 0 },
          { secaoId: secao.id, chave: `campo:${cpf.id}`, tipo: "CAMPO", campoId: cpf.id, ordem: 1 },
          { secaoId: secao.id, chave: `campo:${link.id}`, tipo: "CAMPO", campoId: link.id, ordem: 2 },
        ] });
        await tx.bpmEtapaFormulario.update({ where: { id: formulario.id },
          data: { versao: { increment: 1 } } });
      }
    }, { maxWait: 20_000, timeout: 180_000 });
    console.log(JSON.stringify({ ...plano, sucesso: true }));
  }
} finally {
  await db.$disconnect();
}
