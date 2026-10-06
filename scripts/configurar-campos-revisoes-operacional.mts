/** Prévia somente leitura por padrão. Publicação exige aprovação específica e backup Vault. */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { config } from "dotenv";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { grupoCondicaoSchema } = await import("../src/lib/bpm/regras/schemas");

const PIPELINE = "cmuih4tnh000409gm5z34jvss";
const VERSAO = 12;
const ETAPAS = [
  { id: "draft-stage-cb2023f8-7e31-438e-83f9-4bb0fc359f79", nome: "Revisão", ordem: 4 },
  { id: "draft-stage-2bcb8beb-a711-4428-bd0d-0cf3404cba8d", nome: "Revisado", ordem: 5 },
  { id: "draft-stage-3297611b-1023-4993-978d-01986d834e5c", nome: "Revisão do protocolo", ordem: 6 },
] as const;
const CAMPOS = [
  { chave: "alpha.operacional.revisao.resultado", nome: "Anotação com resultado da revisão", tipo: "texto_longo", inicio: 4, obrigatorioSaida: null, grupo: "Revisão", secao: "revisao_resultado" },
  { chave: "alpha.operacional.protocolo.anotacao", nome: "Anotação após protocolo", tipo: "texto_longo", inicio: 5, obrigatorioSaida: null, grupo: "Protocolo", secao: "protocolo_registro" },
  { chave: "alpha.operacional.protocolo.data", nome: "Data do protocolo", tipo: "data_hora", inicio: 5, obrigatorioSaida: 6, grupo: "Protocolo", secao: "protocolo_registro" },
  { chave: "alpha.operacional.protocolo.certificado", nome: "Certificado digital utilizado", tipo: "texto", inicio: 5, obrigatorioSaida: null, grupo: "Protocolo", secao: "protocolo_registro" },
  { chave: "alpha.operacional.protocolo.numero", nome: "Número do protocolo", tipo: "texto", inicio: 6, obrigatorioSaida: 6, grupo: "Revisão do protocolo", secao: "protocolo_revisao" },
  { chave: "alpha.operacional.protocolo.documentos_juntados", nome: "Todos os documentos foram juntados?", tipo: "booleano", inicio: 6, obrigatorioSaida: 6, grupo: "Revisão do protocolo", secao: "protocolo_revisao" },
  { chave: "alpha.operacional.protocolo.codigos_corretos", nome: "Os documentos possuem os códigos corretos?", tipo: "booleano", inicio: 6, obrigatorioSaida: 6, grupo: "Revisão do protocolo", secao: "protocolo_revisao" },
] as const;
const aplicar = process.argv.includes("--apply");
const arg = (chave: string) => process.argv.slice(2).find((item) => item.startsWith(`--${chave}=`))?.slice(chave.length + 3);

try {
  const [pipeline, existentes, requisitos, cards] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: PIPELINE }, select: {
      nome: true, ativo: true, configVersion: true,
      etapas: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: {
        id: true, nome: true, ordem: true, formulario: { select: { id: true, versao: true,
          secoes: { select: { chave: true, ordem: true, componentes: { select: { campoId: true } } } },
        } },
      } },
    } }),
    db.bpmCampo.findMany({ where: { chave: { in: CAMPOS.map((campo) => campo.chave) } }, select: { chave: true } }),
    db.bpmRequisito.findMany({ where: { pipelineId: PIPELINE, chave: { in: [
      "alpha.operacional.protocolo.revisao.documentos_nao_confirmados",
      "alpha.operacional.protocolo.revisao.codigos_nao_confirmados",
    ] } }, select: { chave: true } }),
    db.bpmCard.count({ where: { pipelineId: PIPELINE } }),
  ]);
  if (pipeline?.nome !== "Operacional" || !pipeline.ativo || pipeline.etapas.length !== 13
    || pipeline.configVersion !== VERSAO
    || ETAPAS.some((esperada) => {
      const etapa = pipeline.etapas.find((item) => item.id === esperada.id);
      return etapa?.nome !== esperada.nome || etapa.ordem !== esperada.ordem || !etapa.formulario;
    }) || pipeline.etapas.some((etapa) => !etapa.formulario)
    || existentes.length || requisitos.length
    || pipeline.etapas.some((etapa) => etapa.ordem >= 4 && etapa.formulario!.secoes.some((secao) =>
      ["revisao_resultado", "protocolo_registro", "protocolo_revisao"].includes(secao.chave)))) {
    throw new Error("Configuração do Operacional divergente; refaça o inventário antes de publicar.");
  }
  const versao = pipeline.configVersion;
  const motivoBackup = `operacional-revisoes-campos-v${versao + 1}`;
  const etapasDestino = pipeline.etapas.filter((etapa) => etapa.ordem >= 4);
  const plano = {
    mode: aplicar ? "apply" : "preview", pipelineId: PIPELINE, versaoDe: versao, versaoPara: versao + 1,
    motivoBackup, cardsNoPipeline: cards, cardsExistentesAlterados: 0,
    camposNovos: CAMPOS.map(({ chave, nome, tipo, inicio, obrigatorioSaida }) => ({
      chave, nome, tipo, inicio, obrigatorioSaida,
      etapasComCampo: pipeline.etapas.filter((etapa) => etapa.ordem >= inicio).length,
    })),
    etapas: etapasDestino.map((etapa) => ({ id: etapa.id, nome: etapa.nome,
      formularioDe: etapa.formulario!.versao, formularioPara: etapa.formulario!.versao + 1,
      secoesNovas: [...new Set(CAMPOS.filter((campo) => campo.inicio <= etapa.ordem).map((campo) => campo.secao))],
      componentesNovos: CAMPOS.filter((campo) => campo.inicio <= etapa.ordem).length,
    })),
    regrasSaida: ["Todos os documentos foram juntados? = Sim", "Os documentos possuem os códigos corretos? = Sim"],
    automacoesDePrazoOuAlerta: 0,
  };
  if (!aplicar) {
    console.log(JSON.stringify(plano, null, 2));
  } else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")
      || arg("approval") !== "AUTORIZO_CAMPOS_REVISOES_OPERACIONAL"
      || Number(arg("expect-version")) !== versao || Number(arg("admin-id")) !== 1) {
      throw new Error("Ambiente, autorização específica, administrador ou versão inválidos.");
    }
    const backup = arg("backup"), manifest = arg("manifest");
    if (!backup || !manifest) throw new Error("Backup e manifesto Vault dedicados obrigatórios.");
    const caminhoBackup = resolve(backup);
    const diretorioPreChange = resolve("database-backups/pre-change") + sep;
    const meta = JSON.parse(readFileSync(manifest, "utf8"));
    const arquivo = statSync(caminhoBackup);
    const criado = Date.parse(meta.generatedAt);
    if (!caminhoBackup.startsWith(diretorioPreChange) || meta.reason !== motivoBackup
      || !Number.isFinite(criado) || criado > Date.now() || Date.now() - criado > 48 * 3600_000
      || arquivo.size < 1_000_000 || arquivo.size !== meta.sizeBytes
      || createHash("sha256").update(readFileSync(caminhoBackup)).digest("hex") !== meta.sha256) {
      throw new Error("Backup completo, íntegro, dedicado e recente obrigatório.");
    }
    await verificarBackupTurso(caminhoBackup, manifest);
    const admin = await db.usuarios.findUnique({ where: { id: 1 }, select: { role: true, status: true } });
    if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Administrador inválido.");
    await db.$transaction(async (tx) => {
      const reservado = await tx.bpmPipeline.updateMany({ where: { id: PIPELINE, configVersion: versao },
        data: { configVersion: { increment: 1 } } });
      if (reservado.count !== 1) throw new Error("Versão alterada durante a publicação.");
      const ids = new Map<string, string>();
      for (const [indice, spec] of CAMPOS.entries()) {
        const campo = await tx.bpmCampo.create({ data: { pipelineId: PIPELINE, chave: spec.chave,
          nome: spec.nome, tipo: spec.tipo, escopo: "CARD", ordem: 520 + indice,
          ativo: true, visivel: true, editavel: true, somenteLeitura: false,
          opcoesJson: null,
        } });
        ids.set(spec.chave, campo.id);
      }
      for (const etapa of etapasDestino) {
        const specs = CAMPOS.filter((campo) => campo.inicio <= etapa.ordem);
        await tx.bpmCampoEtapaConfig.createMany({ data: specs.map((spec) => ({
          campoId: ids.get(spec.chave)!, etapaId: etapa.id, visivel: true,
          editavel: true, somenteLeitura: false, obrigatorioSaida: etapa.ordem === spec.obrigatorioSaida,
          ordem: 520 + CAMPOS.indexOf(spec), grupo: spec.grupo,
        })) });
        const formulario = etapa.formulario!;
        const secoes = [...new Set(specs.map((spec) => spec.secao))];
        const proximaOrdem = Math.max(-1, ...formulario.secoes.map((secao) => secao.ordem)) + 1;
        for (const [offset, chave] of secoes.entries()) {
          const secaoSpecs = specs.filter((spec) => spec.secao === chave);
          const secao = await tx.bpmFormularioSecao.create({ data: { formularioId: formulario.id,
            chave, titulo: secaoSpecs[0].grupo, ordem: proximaOrdem + offset } });
          await tx.bpmFormularioComponente.createMany({ data: secaoSpecs.map((spec, ordem) => ({
            secaoId: secao.id, chave: `campo:${ids.get(spec.chave)!}`, tipo: "CAMPO",
            campoId: ids.get(spec.chave)!, ordem,
          })) });
        }
        const atualizado = await tx.bpmEtapaFormulario.updateMany({ where: { id: formulario.id,
          versao: formulario.versao }, data: { versao: { increment: 1 } } });
        if (atualizado.count !== 1) throw new Error(`Formulário da etapa ${etapa.nome} mudou durante a publicação.`);
      }
      const revisao = ETAPAS[2];
      for (const [indice, campo] of CAMPOS.filter((spec) => spec.chave.endsWith("documentos_juntados")
        || spec.chave.endsWith("codigos_corretos")).entries()) {
        const condicao = { operador: "AND", condicoes: [{ tipo: "condicao", campo: {
          fonte: "campo_dinamico", campo: ids.get(campo.chave)!,
        }, operador: "diferente", valor: "Sim" }] };
        grupoCondicaoSchema.parse(condicao);
        await tx.bpmRequisito.create({ data: { pipelineId: PIPELINE, etapaId: revisao.id,
          chave: indice === 0 ? "alpha.operacional.protocolo.revisao.documentos_nao_confirmados"
            : "alpha.operacional.protocolo.revisao.codigos_nao_confirmados",
          alvoTipo: "REGRA", fase: "EXIT_STAGE", fonte: "ADMIN", ativo: true,
          ordem: 520 + indice, condicaoJson: JSON.stringify(condicao),
          mensagem: indice === 0 ? "Confirme que todos os documentos foram juntados."
            : "Confirme que os documentos possuem os códigos corretos.",
        } });
      }
    }, { maxWait: 20_000, timeout: 180_000 });
    console.log(JSON.stringify({ ...plano, sucesso: true }));
  }
} finally {
  await db.$disconnect();
}
