/** Prévia read-only; publicação exige autorização específica e backup completo verificado. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const { default: dbImport } = await import("../src/lib/prisma");
const db = dbImport;
const RADAR_ID = "cmuih48la000009gmzw3wwuzf";
const FINANCEIRO_ID = "cmuih4i54000209gmmyqrg557";
const FECHADO_ID = "draft-stage-2484d2bc-34dd-49b6-baf8-e53d58f07a83";
const NOVO_CONTRATO_ID = "draft-stage-92d707af-9b90-4f71-a9be-58ec7fbe98f8";
const CHAVES = ["alpha.radar.viabilidade.valor_acordado", "alpha.radar.viabilidade.forma_pagamento"];
const CHAVES_FINANCEIRO = ["alpha.valor.acordado.no.contrato", "alpha.forma.de.pagamento"];
const ANEXOS = [
  { chave: "alpha.radar.fechado.contrato_para_envio", nome: "Contrato para envio" },
  { chave: "alpha.radar.fechado.contrato_assinado", nome: "Contrato assinado" },
] as const;
const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const aplicar = args.includes("--apply");
if (aplicar === args.includes("--preview")) throw new Error("Escolha --preview ou --apply.");

try {
  const [radar, financeiro, fechado, novoContrato, campos, anexosExistentes, camposFinanceirosExistentes] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: RADAR_ID }, select: { nome: true, ativo: true, configVersion: true } }),
    db.bpmPipeline.findUnique({ where: { id: FINANCEIRO_ID }, select: { nome: true, ativo: true, configVersion: true } }),
    db.bpmEtapa.findUnique({ where: { id: FECHADO_ID }, select: { nome: true, pipelineId: true, capabilitiesJson: true, formulario: { select: { id: true } } } }),
    db.bpmEtapa.findUnique({ where: { id: NOVO_CONTRATO_ID }, select: { nome: true, pipelineId: true, formulario: { select: { id: true } } } }),
    db.bpmCampo.findMany({ where: { chave: { in: CHAVES }, ativo: true }, select: {
      id: true, chave: true, nome: true, tipo: true, pipelineId: true,
      pipelinesAssociados: { select: { pipelineId: true } },
      etapaConfiguracoes: { where: { etapaId: { in: [FECHADO_ID, NOVO_CONTRATO_ID] } }, select: { etapaId: true } },
      opcoes: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: { rotulo: true } },
    } }),
    db.bpmCampo.findMany({ where: { chave: { in: ANEXOS.map((item) => item.chave) } }, select: { id: true } }),
    db.bpmCampo.findMany({ where: { chave: { in: CHAVES_FINANCEIRO } }, select: { id: true } }),
  ]);
  if (!radar?.ativo || radar.nome !== "Revisão de Radar" || !financeiro?.ativo || financeiro.nome !== "Financeiro") throw new Error("Pipeline alterado.");
  if (!fechado || fechado.pipelineId !== RADAR_ID || fechado.nome !== "Fechado" || fechado.formulario || fechado.capabilitiesJson) throw new Error("Fechado alterado; revisar plano.");
  if (!novoContrato || novoContrato.pipelineId !== FINANCEIRO_ID || novoContrato.nome !== "Novo Contrato" || novoContrato.formulario) throw new Error("Novo Contrato alterado; revisar plano.");
  if (campos.length !== 2 || campos.some((campo) => campo.pipelineId !== RADAR_ID
    || campo.etapaConfiguracoes.length > 0)) throw new Error("Campos compartilhados alterados; revisar plano.");
  const valor = campos.find((campo) => campo.chave === CHAVES[0]);
  const forma = campos.find((campo) => campo.chave === CHAVES[1]);
  if (!valor || valor.tipo !== "moeda" || !forma || forma.tipo !== "selecao" || forma.opcoes.length < 1) throw new Error("Tipos ou opções de contrato inválidos.");
  if (anexosExistentes.length) throw new Error("Campos de contrato já existem; revisar plano.");
  if (camposFinanceirosExistentes.length) throw new Error("Campos canônicos do Financeiro já existem; revisar plano.");
  const preview = {
    pipelines: [{ id: RADAR_ID, version: radar.configVersion }, { id: FINANCEIRO_ID, version: financeiro.configVersion }],
    etapas: [{ id: FECHADO_ID, nome: fechado.nome }, { id: NOVO_CONTRATO_ID, nome: novoContrato.nome }],
    campos: campos.map((campo) => ({ id: campo.id, nome: campo.nome, tipo: campo.tipo, opcoes: campo.opcoes.map((item) => item.rotulo) })),
    fechado: { formulario: ["Valor acordado no contrato", "Forma de pagamento", "Contrato para envio", "Contrato assinado", "Pós-fechamento comercial"], obrigatoriosEntrada: CHAVES, script: "existente preservado" },
    financeiro: { formulario: ["Valor acordado no contrato", "Forma de pagamento"], origem: "2 campos canônicos Financeiro mapeados dos campos Radar" },
    inserts: { formularios: 2, secoes: 2, componentes: 7, camposAnexo: 2, camposFinanceiro: 2, mapeamentos: 2, opcoesFinanceiro: forma.opcoes.length, campoEtapaConfigs: 6, auditorias: 2 },
    updates: { pipelines: 2, etapaFechado: 1 },
  };
  if (!aplicar) {
    process.stdout.write(`${JSON.stringify({ mode: "preview", ...preview }, null, 2)}\n`);
  } else {
    if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Turso remoto explícito obrigatório.");
    const backup = option("backup"), manifest = option("manifest");
    const radarVersion = Number(option("radar-version")), financeiroVersion = Number(option("financeiro-version"));
    const adminId = Number(option("admin-id"));
    if (!backup || !manifest || radarVersion !== radar.configVersion || financeiroVersion !== financeiro.configVersion
      || !Number.isSafeInteger(adminId) || adminId <= 0 || option("approval") !== "AUTORIZO_FECHADO_RADAR_FINANCEIRO") {
      throw new Error("Aplicação exige backup, versões vigentes, auditor e autorização específica.");
    }
    const manifesto = JSON.parse(readFileSync(manifest, "utf8"));
    const arquivo = statSync(backup);
    const criadoEm = new Date(manifesto.generatedAt ?? manifesto.createdAt).getTime();
    if (!backup.includes("database-backups/pre-change/") || arquivo.size < 1_000_000
      || arquivo.size !== manifesto.sizeBytes || !Number.isFinite(criadoEm)
      || criadoEm > Date.now() || Date.now() - criadoEm > 48 * 3600_000
      || createHash("sha256").update(readFileSync(backup)).digest("hex") !== manifesto.sha256) throw new Error("Backup ausente, divergente ou vencido.");
    execFileSync("node", ["scripts/verify-turso-backup.mjs", backup, manifest], { stdio: "pipe" });
    if (!await db.usuarios.findUnique({ where: { id: adminId }, select: { id: true } })) throw new Error("Auditor não encontrado.");
    await db.$transaction(async (tx) => {
      for (const [id, configVersion] of [[RADAR_ID, radarVersion], [FINANCEIRO_ID, financeiroVersion]] as const) {
        const mudou = await tx.bpmPipeline.updateMany({ where: { id, configVersion }, data: { configVersion: { increment: 1 } } });
        if (mudou.count !== 1) throw new Error("Versão de configuração mudou; cancelado.");
      }
      const etapas = await tx.bpmEtapa.findMany({ where: { id: { in: [FECHADO_ID, NOVO_CONTRATO_ID] } }, select: {
        id: true, capabilitiesJson: true, formulario: { select: { id: true } },
      } });
      if (etapas.length !== 2 || etapas.some((item) => item.formulario)
        || etapas.find((item) => item.id === FECHADO_ID)?.capabilitiesJson) throw new Error("Formulário/etapa mudou; cancelado.");
      await tx.bpmEtapa.update({ where: { id: FECHADO_ID }, data: { capabilitiesJson: JSON.stringify(["COMMERCIAL_POST_CLOSING"]) } });
      const valoresFinanceiros = [];
      for (const [ordem, origem] of [valor, forma].entries()) {
        const destinoCampo = await tx.bpmCampo.create({ data: {
          pipelineId: FINANCEIRO_ID, chave: CHAVES_FINANCEIRO[ordem], nome: origem.nome,
          tipo: origem.tipo, escopo: "CARD", ordem,
          ...(ordem === 1 ? { opcoes: { create: origem.opcoes.map((opcao, indice) => ({
            chave: `opcao_${indice + 1}`, rotulo: opcao.rotulo, ordem: indice,
          })) } } : {}),
        } });
        valoresFinanceiros.push(destinoCampo);
        await tx.bpmCampoMapeamento.create({ data: {
          campoOrigemId: origem.id, campoDestinoId: destinoCampo.id, modo: "COPIAR", ativo: true,
        } });
      }
      const anexosCriados = [];
      for (const [ordem, anexo] of ANEXOS.entries()) {
        const campo = await tx.bpmCampo.create({ data: {
          pipelineId: RADAR_ID, chave: anexo.chave, nome: anexo.nome, tipo: "arquivo",
          escopo: "CARD", ordem: 100 + ordem,
        } });
        anexosCriados.push(campo);
        await tx.bpmCampoEtapaConfig.create({ data: {
          campoId: campo.id, etapaId: FECHADO_ID, visivel: true, editavel: true,
          obrigatorio: false, obrigatorioEntrada: false, obrigatorioSaida: false,
          ordem: 2 + ordem, grupo: "Contratação",
        } });
      }
      for (const [etapaId, grupo, entrada] of [
        [FECHADO_ID, "Contratação", true], [NOVO_CONTRATO_ID, "Dados da negociação", false],
      ] as const) {
        const camposDaEtapa = etapaId === FECHADO_ID ? [valor, forma] : valoresFinanceiros;
        for (const [ordem, campo] of camposDaEtapa.entries()) {
          await tx.bpmCampoEtapaConfig.create({ data: {
            campoId: campo.id, etapaId, visivel: true, editavel: true,
            obrigatorio: entrada, obrigatorioEntrada: entrada, obrigatorioSaida: false,
            ordem, grupo,
          } });
        }
        await tx.bpmEtapaFormulario.create({ data: { etapaId, ativo: true, secoes: { create: [{
          chave: etapaId === FECHADO_ID ? "contratacao" : "dados_negociacao", titulo: grupo, ordem: 0,
          componentes: { create: [
            { chave: "valor_acordado", tipo: "CAMPO", campoId: camposDaEtapa[0].id, ordem: 0, configJson: JSON.stringify({ label: "Valor acordado no contrato (final após desconto)" }) },
            { chave: "forma_pagamento", tipo: "CAMPO", campoId: camposDaEtapa[1].id, ordem: 1 },
            ...(etapaId === FECHADO_ID ? [
              { chave: "contrato_para_envio", tipo: "CAMPO", campoId: anexosCriados[0].id, ordem: 2 },
              { chave: "contrato_assinado", tipo: "CAMPO", campoId: anexosCriados[1].id, ordem: 3 },
              { chave: "status_pos_fechamento", tipo: "CAPABILITY", capability: "COMMERCIAL_POST_CLOSING", ordem: 4 },
            ] : []),
          ] },
        }] } } });
      }
      for (const [pipelineId, versao] of [[RADAR_ID, radarVersion], [FINANCEIRO_ID, financeiroVersion]] as const) {
        await tx.bpmPipelineConfigAuditoria.create({ data: {
          pipelineId, adminId, campoAlterado: "FECHADO_CONTRATACAO_FINANCEIRO_PUBLICADO",
          valorAnteriorJson: JSON.stringify({ configVersion: versao, formulario: null }),
          valorNovoJson: JSON.stringify({ configVersion: versao + 1, camposRadar: CHAVES, camposFinanceiro: CHAVES_FINANCEIRO, fechadoId: FECHADO_ID, financeiroId: NOVO_CONTRATO_ID }),
        } });
      }
    });
    process.stdout.write(`${JSON.stringify({ mode: "apply", success: true, radarVersion: radarVersion + 1, financeiroVersion: financeiroVersion + 1 })}\n`);
  }
} finally {
  await db.$disconnect();
}
