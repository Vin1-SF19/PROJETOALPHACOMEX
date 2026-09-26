"use server";

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { gatilhoConfigSchema, salvarVersaoAutomacaoSchema, validarGrafoAutomacao } from "@/lib/bpm/automacoes/central-schemas";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import { sincronizarAgendasVersaoAutomacao } from "@/lib/bpm/automacoes/agenda";
import { reprocessarExecucaoAutomacaoCentral } from "@/lib/bpm/automacoes/central-runtime";
import { encerrarExecucoesEmAndamentoAutomacao, filtroExecucoesRelevantes, validarReferenciasPublicacaoAutomacao } from "@/lib/bpm/automacoes/publicacao";
import { etapaIdCardSchema } from "@/lib/validations/bpm";

const ROTA = "/PainelAlpha/AlphaCRM/admin/automacoes";
const idSchema = z.string().cuid();

async function exigirAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = Number(session.user.id);
  await exigirAcessoConfigPipeline(userId, "configurarEtapas");
  return userId;
}

function erroPublico(error: unknown) {
  if (error instanceof z.ZodError) return "Configuração inválida";
  return error instanceof Error ? error.message.slice(0, 500) : "Não foi possível concluir a operação";
}

const salvarDefinicaoCentralSchema = z.object({
  automacaoId: z.string().cuid().optional(),
  nome: z.string().trim().min(2).max(120),
  descricao: z.string().trim().max(1_000).optional().nullable(),
  pipelineId: z.string().cuid(),
  etapaAncoraId: etapaIdCardSchema,
  ativa: z.boolean().default(true),
  gatilhoTipo: salvarVersaoAutomacaoSchema.shape.gatilhoTipo,
  gatilhoConfig: gatilhoConfigSchema,
  condicao: grupoCondicaoSchema.nullable().optional(),
  grafo: salvarVersaoAutomacaoSchema.shape.grafo,
  timezone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
}).strict();

/** Editor único: metadados e versão executável são persistidos juntos. */
export async function SalvarDefinicaoAutomacaoCentralBpm(payload: unknown) {
  try {
    const userId = await exigirAdmin();
    const dados = salvarDefinicaoCentralSchema.parse(payload);
    const grafo = validarGrafoAutomacao(dados.grafo);
    const gatilhoConfig = gatilhoConfigSchema.parse(dados.gatilhoConfig);
    if (dados.condicao) grupoCondicaoSchema.parse(dados.condicao);
    const etapa = await db.bpmEtapa.findFirst({
      where: { id: dados.etapaAncoraId, pipelineId: dados.pipelineId },
      select: { id: true },
    });
    if (!etapa) throw new Error("Pipeline ou etapa de referência inválida");
    await validarReferenciasPublicacaoAutomacao(
      { pipelineId: dados.pipelineId, etapaId: dados.etapaAncoraId },
      dados.gatilhoTipo,
      JSON.stringify(gatilhoConfig),
      JSON.stringify(grafo),
    );
    const primeiroNoAcao = grafo.nos.find((no) => no.tipo === "ACAO");
    const agora = new Date();
    const salvo = await db.$transaction(async (tx) => {
      const atual = dados.automacaoId
        ? await tx.bpmAutomacao.findUnique({ where: { id: dados.automacaoId } })
        : null;
      if (dados.automacaoId && !atual) throw new Error("Automação não encontrada");
      const automacao = atual
        ? await tx.bpmAutomacao.update({
            where: { id: atual.id },
            data: {
              nome: dados.nome,
              descricao: dados.descricao || null,
              pipelineId: dados.pipelineId,
              etapaId: dados.etapaAncoraId,
              gatilhoTipo: dados.gatilhoTipo,
              tempoMinutos: gatilhoConfig.minutos ?? null,
              acaoTipo: primeiroNoAcao?.acaoTipo ?? "SEM_ACAO",
              parametrosJson: JSON.stringify(primeiroNoAcao?.parametros ?? {}),
              ativa: dados.ativa,
            },
          })
        : await tx.bpmAutomacao.create({
            data: {
              nome: dados.nome,
              descricao: dados.descricao || null,
              pipelineId: dados.pipelineId,
              etapaId: dados.etapaAncoraId,
              gatilhoTipo: dados.gatilhoTipo,
              tempoMinutos: gatilhoConfig.minutos ?? null,
              acaoTipo: primeiroNoAcao?.acaoTipo ?? "SEM_ACAO",
              parametrosJson: JSON.stringify(primeiroNoAcao?.parametros ?? {}),
              ativa: dados.ativa,
              criadoPorId: userId,
            },
          });
      const ultima = await tx.bpmAutomacaoVersao.aggregate({ where: { automacaoId: automacao.id }, _max: { versao: true } });
      await tx.bpmAutomacaoVersao.updateMany({ where: { automacaoId: automacao.id, status: "ATIVA" }, data: { status: "ARQUIVADA", arquivadaEm: agora } });
      await tx.bpmAutomacaoAgenda.updateMany({ where: { automacaoVersao: { automacaoId: automacao.id }, ativo: true }, data: { ativo: false } });
      // As esperas da versão anterior foram desativadas acima: encerra as
      // execuções dela em vez de deixá-las presas em AGUARDANDO.
      if (atual) await encerrarExecucoesEmAndamentoAutomacao(tx, { automacaoId: automacao.id, motivo: "VERSAO_SUBSTITUIDA" });
      const versao = await tx.bpmAutomacaoVersao.create({ data: {
        automacaoId: automacao.id,
        versao: (ultima._max.versao ?? 0) + 1,
        status: "ATIVA",
        gatilhoTipo: dados.gatilhoTipo,
        gatilhoConfigJson: JSON.stringify(gatilhoConfig),
        condicaoJson: dados.condicao ? JSON.stringify(dados.condicao) : null,
        grafoJson: JSON.stringify(grafo),
        timezone: dados.timezone,
        criadoPorId: userId,
        ativadaEm: agora,
      } });
      await tx.bpmPipelineConfigAuditoria.create({ data: {
        pipelineId: dados.pipelineId,
        adminId: userId,
        campoAlterado: atual ? "AUTOMACAO_CENTRAL_ATUALIZADA" : "AUTOMACAO_CENTRAL_CRIADA",
        valorAnteriorJson: atual ? JSON.stringify({ automacaoId: atual.id, pipelineId: atual.pipelineId, etapaId: atual.etapaId }) : null,
        valorNovoJson: JSON.stringify({ automacaoId: automacao.id, versaoId: versao.id, escopo: gatilhoConfig.escopo, etapasIds: gatilhoConfig.etapasIds ?? [] }),
      } });
      return { automacaoId: automacao.id, versaoId: versao.id, versao: versao.versao };
    });
    await sincronizarAgendasVersaoAutomacao(salvo.versaoId);
    revalidatePath(ROTA);
    return { success: true as const, data: salvo };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function SalvarRascunhoAutomacaoCentralBpm(payload: unknown) {
  try {
    const userId = await exigirAdmin();
    const dados = salvarVersaoAutomacaoSchema.parse(payload);
    const grafo = validarGrafoAutomacao(dados.grafo);
    gatilhoConfigSchema.parse(dados.gatilhoConfig);
    if (dados.condicao) grupoCondicaoSchema.parse(dados.condicao);
    const automacao = await db.bpmAutomacao.findUnique({ where: { id: dados.automacaoId }, select: { id: true, pipelineId: true } });
    if (!automacao) throw new Error("Automação não encontrada");
    const ultima = await db.bpmAutomacaoVersao.aggregate({ where: { automacaoId: automacao.id }, _max: { versao: true } });
    const versao = await db.bpmAutomacaoVersao.create({ data: {
      automacaoId: automacao.id, versao: (ultima._max.versao ?? 0) + 1, status: "RASCUNHO",
      gatilhoTipo: dados.gatilhoTipo, gatilhoConfigJson: JSON.stringify(dados.gatilhoConfig),
      condicaoJson: dados.condicao ? JSON.stringify(dados.condicao) : null, grafoJson: JSON.stringify(grafo),
      timezone: dados.timezone, criadoPorId: userId,
    } });
    await db.bpmPipelineConfigAuditoria.create({ data: { pipelineId: automacao.pipelineId, adminId: userId, campoAlterado: "AUTOMACAO_VERSAO_CRIADA", valorNovoJson: JSON.stringify({ automacaoId: automacao.id, versaoId: versao.id, versao: versao.versao }) } });
    revalidatePath(ROTA);
    return { success: true as const, data: { id: versao.id, versao: versao.versao } };
  } catch (error) { return { success: false as const, error: erroPublico(error) }; }
}

export async function AtivarVersaoAutomacaoCentralBpm(versaoId: string) {
  try {
    const userId = await exigirAdmin(); const id = idSchema.parse(versaoId);
    const versao = await db.bpmAutomacaoVersao.findUnique({ where: { id }, include: { automacao: true } });
    if (!versao) throw new Error("Versão não encontrada");
    await validarReferenciasPublicacaoAutomacao(versao.automacao, versao.gatilhoTipo, versao.gatilhoConfigJson, versao.grafoJson);
    if (versao.condicaoJson) grupoCondicaoSchema.parse(JSON.parse(versao.condicaoJson));
    await db.$transaction(async (tx) => {
      await tx.bpmAutomacaoVersao.updateMany({ where: { automacaoId: versao.automacaoId, status: "ATIVA", id: { not: id } }, data: { status: "ARQUIVADA", arquivadaEm: new Date() } });
      await tx.bpmAutomacaoVersao.update({ where: { id }, data: { status: "ATIVA", ativadaEm: new Date(), arquivadaEm: null } });
      await tx.bpmAutomacaoAgenda.updateMany({ where: { automacaoVersao: { automacaoId: versao.automacaoId }, automacaoVersaoId: { not: id }, ativo: true }, data: { ativo: false } });
      await encerrarExecucoesEmAndamentoAutomacao(tx, { automacaoId: versao.automacaoId, manterVersaoId: id, motivo: "VERSAO_SUBSTITUIDA" });
      await tx.bpmAutomacao.update({ where: { id: versao.automacaoId }, data: { ativa: true, gatilhoTipo: versao.gatilhoTipo } });
      await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId: versao.automacao.pipelineId, adminId: userId, campoAlterado: "AUTOMACAO_VERSAO_ATIVADA", valorNovoJson: JSON.stringify({ automacaoId: versao.automacaoId, versaoId: id, versao: versao.versao }) } });
    });
    await sincronizarAgendasVersaoAutomacao(id);
    revalidatePath(ROTA); return { success: true as const };
  } catch (error) { return { success: false as const, error: erroPublico(error) }; }
}

const filtrosSchema = z.object({ status: z.string().max(40).optional(), automacaoId: z.string().cuid().optional(), pagina: z.number().int().min(1).max(10_000).default(1), porPagina: z.number().int().min(5).max(100).default(25) }).default({ pagina: 1, porPagina: 25 });

export async function ListarMonitoramentoAutomacoesCentraisBpm(filtros?: unknown) {
  try {
    await exigirAdmin(); const f = filtrosSchema.parse(filtros);
    // Sem filtro de status, oculta eventos que não correspondem ao gatilho.
    const where = { automacaoVersaoId: { not: null }, ...(f.status ? { status: f.status } : filtroExecucoesRelevantes), ...(f.automacaoId ? { automacaoId: f.automacaoId } : {}) };
    const [total, execucoes, versoes, endpoints] = await Promise.all([
      db.bpmAutomacaoExecucao.count({ where }),
      db.bpmAutomacaoExecucao.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.pagina - 1) * f.porPagina, take: f.porPagina, include: { automacao: { select: { nome: true } }, automacaoVersao: { select: { versao: true } }, passos: { orderBy: { ordem: "asc" } } } }),
      db.bpmAutomacaoVersao.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { automacao: { select: { id: true, nome: true, pipelineId: true } } } }),
      db.bpmWebhookEndpoint.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, nome: true, caminhoSlug: true, pipelineId: true, automacaoId: true, ativo: true, createdAt: true, _count: { select: { entradas: true } } } }),
    ]);
    return { success: true as const, data: { total, pagina: f.pagina, porPagina: f.porPagina, execucoes: execucoes.map((e) => ({ ...e, createdAt: e.createdAt.toISOString(), iniciadoEm: e.iniciadoEm?.toISOString() ?? null, executadoEm: e.executadoEm?.toISOString() ?? null, disponivelEm: e.disponivelEm.toISOString(), proximaTentativaEm: e.proximaTentativaEm?.toISOString() ?? null, passos: e.passos.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), iniciadoEm: p.iniciadoEm?.toISOString() ?? null, concluidoEm: p.concluidoEm?.toISOString() ?? null })) })), versoes: versoes.map((v) => ({ ...v, createdAt: v.createdAt.toISOString(), ativadaEm: v.ativadaEm?.toISOString() ?? null, arquivadaEm: v.arquivadaEm?.toISOString() ?? null })), endpoints: endpoints.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })) } };
  } catch (error) { return { success: false as const, error: erroPublico(error), data: { total: 0, pagina: 1, porPagina: 25, execucoes: [], versoes: [], endpoints: [] } }; }
}

export async function ReprocessarExecucaoAutomacaoCentralBpm(execucaoId: string) {
  try { await exigirAdmin(); const ok = await reprocessarExecucaoAutomacaoCentral(idSchema.parse(execucaoId)); if (!ok) throw new Error("Execução não está disponível para reprocessamento"); revalidatePath(ROTA); return { success: true as const }; }
  catch (error) { return { success: false as const, error: erroPublico(error) }; }
}

const endpointSchema = z.object({ nome: z.string().trim().min(1).max(120), descricao: z.string().trim().max(500).optional(), pipelineId: z.string().cuid().optional(), automacaoId: z.string().cuid().optional() }).strict();

export async function CriarWebhookAutomacaoCentralBpm(payload: unknown) {
  try {
    const userId = await exigirAdmin(); const dados = endpointSchema.parse(payload);
    const segredo = randomBytes(32).toString("base64url"); const caminhoSlug = `${dados.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "webhook"}-${randomBytes(5).toString("hex")}`;
    const endpoint = await db.bpmWebhookEndpoint.create({ data: { ...dados, descricao: dados.descricao || null, caminhoSlug, segredoHash: await hash(segredo, 12), criadoPorId: userId } });
    revalidatePath(ROTA); return { success: true as const, data: { id: endpoint.id, caminhoSlug, segredo } };
  } catch (error) { return { success: false as const, error: erroPublico(error) }; }
}

export async function AlternarWebhookAutomacaoCentralBpm(endpointId: string, ativo: boolean) {
  try { await exigirAdmin(); await db.bpmWebhookEndpoint.update({ where: { id: idSchema.parse(endpointId) }, data: { ativo } }); revalidatePath(ROTA); return { success: true as const }; }
  catch (error) { return { success: false as const, error: erroPublico(error) }; }
}
