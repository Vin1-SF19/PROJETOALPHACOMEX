/** Configuração apenas; nunca altera cards/valores. Preview padrão, apply condicionado ao Vault. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import type { Prisma } from "@prisma/client";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";
config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { isAdminRole } = await import("../src/lib/roles");
const RADAR = "cmuih48la000009gmzw3wwuzf";
const FECHADO = "draft-stage-2484d2bc-34dd-49b6-baf8-e53d58f07a83";
const STANDBY = "draft-stage-10cb9f48-1e00-4814-8ccd-6e076a82a8d1";
const TARIFA = "alpha.radar.fechado.tarifario_padrao";
const EMAIL = "alpha.radar.contrato.e_mail";
const FORMAS = ["50% Entrada / 50% Êxito (Pix)", "Parcelamento Cartão de Crédito - até 12x com juros", "Integral na contratação - 10% OFF (Pix)"];
const dir = "database-backups/pre-change/crm-alinhamento";
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const databaseHash = createHash("sha256").update(process.env.TURSO_DATABASE_URL ?? "").digest("hex");
const modo = process.argv[2] ?? "preview";
if (!["preview", "apply", "rollback"].includes(modo)) throw new Error("Use preview, apply ou rollback.");
async function snapshot(tx: Prisma.TransactionClient = db) {
  return {
    pipeline: await tx.bpmPipeline.findUniqueOrThrow({ where: { id: RADAR }, select: { id: true, nome: true, ativo: true, configVersion: true } }),
    etapas: await tx.bpmEtapa.findMany({ where: { id: { in: [FECHADO, STANDBY] } }, orderBy: { id: "asc" }, select: { id: true, pipelineId: true, nome: true, chave: true, ativo: true } }),
    campos: await tx.bpmCampo.findMany({ where: { chave: { in: [TARIFA, EMAIL, "alpha.radar.viabilidade.forma_pagamento"] } }, orderBy: { id: "asc" },
      include: { opcoes: { orderBy: { ordem: "asc" } }, etapaConfiguracoes: { orderBy: { id: "asc" } } } }),
    formulario: await tx.bpmEtapaFormulario.findUniqueOrThrow({ where: { etapaId: FECHADO }, include: { secoes: { orderBy: { ordem: "asc" }, include: { componentes: { orderBy: { ordem: "asc" } } } } } }),
  };
}
function validar(s: Awaited<ReturnType<typeof snapshot>>) {
  if (!s.pipeline.ativo || s.pipeline.nome !== "Revisão de Radar" || s.etapas.length !== 2 || s.etapas.some((e) => e.pipelineId !== RADAR || !e.ativo)) throw new Error("Contexto alterado.");
  if (s.campos.some((c) => c.chave === TARIFA)) throw new Error("Tarifário já existe; revisar a configuração, sem duplicar.");
  const email = s.campos.find((c) => c.chave === EMAIL)!;
  if (!email || email.tipo !== "email" || email.fonteEntidade !== "CONTATO" || email.fonteAtributo !== "email") throw new Error("E-mail canônico divergente.");
  const configEmail = email.etapaConfiguracoes.find((c) => c.etapaId === FECHADO);
  const componenteEmail = s.formulario.secoes.flatMap((s) => s.componentes).find((c) => c.campoId === email.id);
  const secao = s.formulario.secoes.find((s) => s.titulo === "Contratação");
  if (!s.formulario.ativo || !secao || !configEmail || !componenteEmail) throw new Error("Formulário/e-mail não configurado na etapa.");
  if (JSON.stringify(s.campos.find((c) => c.chave?.endsWith("forma_pagamento"))?.opcoes.filter((o) => o.ativo).map((o) => o.rotulo)) !== JSON.stringify(FORMAS)) throw new Error("Catálogo de pagamentos mudou; revisar prévia.");
  if (!s.etapas.every((e) => e.id === FECHADO ? e.nome === "Fechado" && (!e.chave || e.chave === "fechado") : e.nome === "Stand By" && (!e.chave || e.chave === "standby_follow_up"))) throw new Error("Etapas já alteradas; revisar prévia.");
  return { email, configEmail, componenteEmail, secao };
}
try {
  if (modo === "preview") {
    const antes = await snapshot(); validar(antes);
    const plano = { databaseHash, antes, mudancas: { fechado: "Contrato fechado", standby: "Stand-by — follow-up semanal", emailObrigatorioEntrada: true, tarifario: { nome: "Fechado no tarifário padrão", opcoes: ["Sim", "Não"], obrigatorio: false }, formasPagamento: FORMAS } };
    const fingerprint = hash(plano);
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/plan.json`, JSON.stringify({ ...plano, fingerprint }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ modo, fingerprint, arquivo: `${dir}/plan.json`, versao: antes.pipeline.configVersion, ...plano.mudancas }, null, 2));
  } else {
    const plano = JSON.parse(readFileSync(`${dir}/plan.json`, "utf8"));
    const { fingerprint, ...conteudo } = plano;
    if (hash(conteudo) !== fingerprint || plano.databaseHash !== databaseHash) throw new Error("Plano divergente ou de outro banco.");
    if (arg("confirm") !== `${modo}:${fingerprint}`) throw new Error("Falta confirmação específica da operação e plano.");
    const backup = arg("backup");
    if (!backup?.includes("database-backups/pre-change/")) throw new Error("Backup pre-change obrigatório.");
    const manifestPath = backup.replace(/\.sql$/, ".manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const age = Date.now() - Date.parse(manifest.generatedAt);
    if (manifest.databaseHash !== databaseHash || !Number.isFinite(age) || age < 0 || age > 48 * 3600000) throw new Error("Backup inválido ou vencido.");
    await verificarBackupTurso(backup, manifestPath);
    const adminId = Number(arg("admin-id"));
    const admin = await db.usuarios.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
    if (!admin || !isAdminRole(admin.role) || admin.status !== "ATIVO") throw new Error("Administrador auditor inválido.");
    if (modo === "apply") {
      const receipt = await db.$transaction(async (tx) => {
        const antes = await snapshot(tx);
        if (hash(antes) !== hash(plano.antes)) throw new Error("Configuração mudou desde a prévia; operação cancelada.");
        const { configEmail, componenteEmail, secao } = validar(antes);
        await tx.bpmEtapa.update({ where: { id: FECHADO }, data: { nome: "Contrato fechado", chave: "fechado" } });
        await tx.bpmEtapa.update({ where: { id: STANDBY }, data: { nome: "Stand-by — follow-up semanal", chave: "standby_follow_up" } });
        await tx.bpmCampoEtapaConfig.update({ where: { id: configEmail.id }, data: { obrigatorioEntrada: true } });
        await tx.bpmFormularioComponente.update({ where: { id: componenteEmail.id }, data: { configJson: JSON.stringify({ ...JSON.parse(componenteEmail.configJson ?? "{}"), obrigatorioEntrada: true }) } });
        const tarifa = await tx.bpmCampo.create({ data: { pipelineId: RADAR, chave: TARIFA, nome: "Fechado no tarifário padrão", tipo: "selecao", escopo: "CARD",
          opcoes: { create: [{ chave: "sim", rotulo: "Sim", ordem: 0 }, { chave: "nao", rotulo: "Não", ordem: 1 }] },
          etapaConfiguracoes: { create: { etapaId: FECHADO, ordem: 20 } } } });
        const componente = await tx.bpmFormularioComponente.create({ data: { secaoId: secao.id, chave: "tarifario-padrao", tipo: "CAMPO", campoId: tarifa.id, ordem: Math.max(...secao.componentes.map((c) => c.ordem)) + 1 } });
        await tx.bpmEtapaFormulario.update({ where: { id: antes.formulario.id }, data: { versao: { increment: 1 } } });
        await tx.bpmPipeline.update({ where: { id: RADAR }, data: { configVersion: { increment: 1 } } });
        const depois = await snapshot(tx);
        await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId: RADAR, adminId, campoAlterado: "ALINHAMENTO_CRM_CARDS", valorAnteriorJson: JSON.stringify(antes), valorNovoJson: JSON.stringify({ fingerprint, depois, tarifaId: tarifa.id, componenteId: componente.id }) } });
        return { fingerprint, antes, depois, tarifaId: tarifa.id, componenteId: componente.id };
      }, { timeout: 60000 });
      writeFileSync(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2), { mode: 0o600 });
      console.log(JSON.stringify({ aplicado: true, fingerprint, versao: receipt.depois.pipeline.configVersion }));
    } else {
      // Recibo canônico no banco; queda ao gravar o arquivo local não impede recuperação.
      const auditoria = await db.bpmPipelineConfigAuditoria.findFirst({ where: { pipelineId: RADAR, campoAlterado: "ALINHAMENTO_CRM_CARDS" }, orderBy: { createdAt: "desc" } });
      const receipt = JSON.parse(auditoria?.valorNovoJson ?? "{}");
      if (receipt.fingerprint !== fingerprint) throw new Error("Recibo não encontrado.");
      await db.$transaction(async (tx) => {
        if (hash(await snapshot(tx)) !== hash(receipt.depois)) throw new Error("Configuração posterior mudou; rollback automático bloqueado.");
        const antes = plano.antes;
        for (const etapa of antes.etapas) await tx.bpmEtapa.update({ where: { id: etapa.id }, data: { nome: etapa.nome, chave: etapa.chave } });
        const email = antes.campos.find((c: { chave: string }) => c.chave === EMAIL);
        const cfg = email.etapaConfiguracoes.find((c: { etapaId: string }) => c.etapaId === FECHADO);
        await tx.bpmCampoEtapaConfig.update({ where: { id: cfg.id }, data: { obrigatorioEntrada: cfg.obrigatorioEntrada } });
        const comp = antes.formulario.secoes.flatMap((s: { componentes: { id: string; campoId: string; configJson: string | null }[] }) => s.componentes).find((c: { campoId: string }) => c.campoId === email.id);
        await tx.bpmFormularioComponente.update({ where: { id: comp.id }, data: { configJson: comp.configJson } });
        await tx.bpmFormularioComponente.delete({ where: { id: receipt.componenteId } });
        // Valores eventualmente preenchidos permanecem armazenados e auditáveis.
        await tx.bpmCampo.update({ where: { id: receipt.tarifaId }, data: { ativo: false } });
        await tx.bpmEtapaFormulario.update({ where: { id: antes.formulario.id }, data: { versao: { increment: 1 } } });
        await tx.bpmPipeline.update({ where: { id: RADAR }, data: { configVersion: { increment: 1 } } });
        await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId: RADAR, adminId, campoAlterado: "ALINHAMENTO_CRM_CARDS_ROLLBACK", valorNovoJson: JSON.stringify({ fingerprint, valoresTarifarioPreservados: true }) } });
      }, { timeout: 60000 });
      console.log(JSON.stringify({ revertido: true, valoresPreservados: true }));
    }
  }
} finally { await db.$disconnect(); }
