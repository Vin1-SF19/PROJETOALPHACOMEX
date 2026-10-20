/** Configuração administrativa delimitada; sem --apply, apenas apresenta a prévia. */
import { config, parse } from "dotenv";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";

const aplicar = process.argv.includes("--apply");
const arg = (nome: string) => process.argv.find((item) => item.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const envFile = arg("env-file") ?? ".env.staging.local";
const ambienteSelecionado = parse(readFileSync(envFile));
if (!ambienteSelecionado.TURSO_DATABASE_URL || !ambienteSelecionado.TURSO_AUTH_TOKEN) {
  throw new Error("O arquivo de ambiente deve informar o banco e o token de acesso.");
}
if (process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL !== ambienteSelecionado.TURSO_DATABASE_URL) {
  throw new Error("O banco herdado do processo difere do arquivo selecionado; limpe a variável antes de executar.");
}
config({ path: envFile, quiet: true, override: true });
const bancoLocal = ambienteSelecionado.TURSO_DATABASE_URL.startsWith("file:");
const bancoStaging = !bancoLocal && new URL(ambienteSelecionado.TURSO_DATABASE_URL.replace(/^libsql:/, "https:"))
  .hostname.split(".")[0] === "painel-alpha-staging-alphacomex";
if (resolve(envFile) === resolve(".env.staging.local") && !bancoStaging) {
  throw new Error("O arquivo de staging precisa apontar para o banco painel-alpha-staging-alphacomex.");
}
if (aplicar && !bancoLocal && !bancoStaging && !process.argv.includes("--production")) {
  throw new Error("Produção exige --production e autorização específica do usuário após validação em staging.");
}
const { default: db } = await import("../src/lib/prisma");
const { gatilhoConfigSchema, validarGrafoAutomacao } = await import("../src/lib/bpm/automacoes/central-schemas");

const SMART = "ca6920da81c6e3472ff83fffa";
const OPERACIONAL = "cmuih4tnh000409gm5z34jvss";
const DOCUMENTACAO = "cf571affb178558c16dd45c87";
const CANCELADOS = "ce39a27743ea5be0c3e431391";
const REVISAO = "draft-stage-cb2023f8-7e31-438e-83f9-4bb0fc359f79";
const ETAPA = "csmartenviarevisao00000001";
const CHAVE = "smart.enviar_revisao.operacional";
try {
  const [smart, operacional, admin] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: SMART }, include: {
      etapas: { where: { ativo: true }, orderBy: { ordem: "asc" }, include: {
        campoConfiguracoes: true,
        formulario: { include: { secoes: { include: { componentes: true } } } },
      } },
      automacoes: { where: { chave: CHAVE }, include: { versoes: { where: { status: "ATIVA" } } } },
    } }),
    db.bpmPipeline.findUnique({ where: { id: OPERACIONAL }, include: {
      etapas: { where: { id: REVISAO, ativo: true } },
    } }),
    db.usuarios.findUnique({ where: { id: 1 }, select: { role: true, status: true } }),
  ]);
  if (!smart?.ativo || smart.nome !== "REVISÃO DO RADAR - ASSESSORIA SMART"
    || !operacional?.ativo || operacional.nome !== "Operacional" || operacional.etapas[0]?.nome !== "Revisão"
    || admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Pipeline, destino ou administrador divergentes.");

  const existente = smart.etapas.find((etapa) => etapa.id === ETAPA);
  if (existente || smart.automacoes.length) {
    const automacao = smart.automacoes[0];
    const versao = automacao?.versoes[0];
    if (!existente || existente.nome !== "Enviar para REVISÃO" || !existente.ehFinal
      || smart.etapas.at(-2)?.id !== ETAPA || smart.etapas.at(-1)?.id !== CANCELADOS
      || !automacao?.ativa || automacao.etapaId !== ETAPA || automacao.versoes.length !== 1
      || versao?.gatilhoTipo !== "ENTRAR_COLUNA") throw new Error("Configuração parcial ou alterada; revisar manualmente.");
    const grafo = validarGrafoAutomacao(JSON.parse(versao.grafoJson));
    const gatilho = gatilhoConfigSchema.parse(JSON.parse(versao.gatilhoConfigJson));
    if (versao.condicaoJson || gatilho.escopo !== "ETAPAS" || gatilho.etapaId !== ETAPA
      || gatilho.etapasIds?.some((id) => id !== ETAPA)
      || !existente.formulario?.ativo || existente.campoConfiguracoes.length !== 33
      || await db.bpmTransicaoEtapa.count({ where: { pipelineId: SMART, permitida: true,
        lifecycleDestino: null, OR: [
          { etapaOrigemId: DOCUMENTACAO, etapaDestinoId: ETAPA },
          { etapaOrigemId: ETAPA, etapaDestinoId: CANCELADOS },
        ] } }) !== 2) throw new Error("Gatilho, formulário ou transições divergentes.");
    const acao = grafo.nos.find((no) => no.id === grafo.inicioId);
    if (acao?.tipo !== "ACAO" || acao.acaoTipo !== "CRIAR_CARD_OUTRO_PIPELINE"
      || acao.parametros.pipelineId !== OPERACIONAL || acao.parametros.etapaId !== REVISAO
      || acao.parametros.vincularAoOriginal !== true || acao.parametros.somenteSeNaoExistirAtivo !== false) {
      throw new Error("Automação publicada diverge do espelhamento esperado.");
    }
    console.log(JSON.stringify({ status: "JA_CONFIGURADO", envFile, etapaId: ETAPA, automacaoId: automacao.id }));
  } else {
    const documentacao = smart.etapas.find((etapa) => etapa.id === DOCUMENTACAO);
    const cancelados = smart.etapas.at(-1);
    if (smart.configVersion !== 1 || smart.etapas.length !== 4
      || documentacao?.ordem !== 2 || !documentacao.formulario?.ativo
      || cancelados?.id !== CANCELADOS || cancelados.ordem !== 3
      || smart.etapas.some((etapa) => etapa.nome === "Enviar para REVISÃO")) {
      throw new Error("Configuração do Smart mudou; refazer inventário.");
    }
    const gatilho = gatilhoConfigSchema.parse({ escopo: "ETAPAS", etapaId: ETAPA });
    // O runtime já deduplica por vínculo. Não reutilizar outro processo da mesma
    // empresa: ele pode estar em outra etapa e não representa este envio.
    const parametros = { pipelineId: OPERACIONAL, etapaId: REVISAO,
      vincularAoOriginal: true, somenteSeNaoExistirAtivo: false };
    const grafo = validarGrafoAutomacao({ inicioId: "espelhar", nos: [
      { id: "espelhar", tipo: "ACAO", acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", parametros, proximoId: "fim" },
      { id: "fim", tipo: "FIM" },
    ] });
    const plano = { envFile, pipelineId: SMART, configVersion: smart.configVersion,
      etapa: { id: ETAPA, nome: "Enviar para REVISÃO", ordem: 3, ehFinal: true },
      ultimaEtapa: { id: CANCELADOS, ordem: 4 }, gatilho: "ENTRAR_COLUNA", parametros,
      formularioOrigem: DOCUMENTACAO, campos: documentacao.campoConfiguracoes.length,
      cardsExistentesAlterados: false, lifecycleAlterado: false };
    if (!aplicar) console.log(JSON.stringify({ status: "PREVIA", ...plano }, null, 2));
    else {
      if (arg("expect-version") !== "1") throw new Error("Informe --expect-version=1 após conferir a prévia.");
      const backup = arg("backup"), manifest = arg("manifest");
      if (!backup?.includes("database-backups/pre-change/") || !manifest) throw new Error("Informe backup pre-change completo.");
      const comprovante = JSON.parse(await readFile(manifest, "utf8"));
      const idade = Date.now() - Date.parse(comprovante.generatedAt);
      const databaseHash = createHash("sha256").update(process.env.TURSO_DATABASE_URL ?? "").digest("hex");
      if (!Number.isFinite(idade) || idade < 0 || idade > 48 * 3600_000
        || comprovante.databaseHash !== databaseHash) throw new Error("Backup vencido ou de outro banco.");
      await verificarBackupTurso(backup, manifest);
      await db.$transaction(async (tx) => {
        const reserva = await tx.bpmPipeline.updateMany({ where: { id: SMART, configVersion: 1 },
          data: { configVersion: { increment: 1 } } });
        if (reserva.count !== 1) throw new Error("Smart alterado por outra sessão.");
        const destinoAtual = await tx.bpmPipeline.findFirst({ where: { id: OPERACIONAL, ativo: true,
          configVersion: operacional.configVersion, etapas: { some: { id: REVISAO, ativo: true } } }, select: { id: true } });
        if (!destinoAtual) throw new Error("Operacional alterado durante a publicação.");
        await tx.bpmEtapa.update({ where: { id: CANCELADOS }, data: { ordem: 4 } });
        await tx.bpmEtapa.create({ data: { id: ETAPA, pipelineId: SMART, chave: "enviar_revisao",
          nome: "Enviar para REVISÃO", ordem: 3, ehFinal: true } });
        for (const configCampo of documentacao.campoConfiguracoes) {
          await tx.bpmCampoEtapaConfig.create({ data: { ...configCampo, id: undefined,
            createdAt: undefined, updatedAt: undefined, etapaId: ETAPA } });
        }
        await tx.bpmEtapaFormulario.create({ data: { etapaId: ETAPA, secoes: { create:
          documentacao.formulario!.secoes.map((secao) => ({ chave: secao.chave, titulo: secao.titulo,
            ordem: secao.ordem, componentes: { create: secao.componentes.map((componente) => ({
              chave: componente.chave, tipo: componente.tipo, campoId: componente.campoId,
              capability: componente.capability, configJson: componente.configJson, ordem: componente.ordem,
            })) } })),
        } } });
        await tx.bpmTransicaoEtapa.createMany({ data: [
          { pipelineId: SMART, etapaOrigemId: DOCUMENTACAO, etapaDestinoId: ETAPA, origem: "AMBOS" },
          { pipelineId: SMART, etapaOrigemId: ETAPA, etapaDestinoId: CANCELADOS, origem: "AMBOS" },
        ] });
        const automacao = await tx.bpmAutomacao.create({ data: {
          pipelineId: SMART, etapaId: ETAPA, chave: CHAVE,
          nome: "Assessoria Smart — espelhar na Revisão do Operacional", gatilhoTipo: "ENTRAR_COLUNA",
          acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", parametrosJson: JSON.stringify(parametros), criadoPorId: 1,
          versoes: { create: { versao: 1, status: "ATIVA", gatilhoTipo: "ENTRAR_COLUNA",
            gatilhoConfigJson: JSON.stringify(gatilho), grafoJson: JSON.stringify(grafo),
            criadoPorId: 1, ativadaEm: new Date() } },
        } });
        await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId: SMART, adminId: 1,
          campoAlterado: "assessoria_smart_enviar_revisao",
          valorAnteriorJson: JSON.stringify({ configVersion: 1, canceladosOrdem: 3 }),
          valorNovoJson: JSON.stringify({ ...plano, automacaoId: automacao.id }),
        } });
      }, { maxWait: 20_000, timeout: 180_000 });
      console.log(JSON.stringify({ status: "APLICADO", ...plano, configVersion: 2 }));
    }
  }
} finally {
  await db.$disconnect();
}
