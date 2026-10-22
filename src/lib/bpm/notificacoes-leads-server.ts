import "server-only";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { normalizeRole } from "@/lib/roles";
import { checarAcessoBpmCard, listarUsuariosComAcessoCrmBpm, podeAcessarPipelineBpm } from "@/lib/bpm/ownership";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
import { carregarEndpointInstagram, etapaEntradaInstagram, ErroInstagram } from "@/lib/bpm/instagram-leads-server";
import { lerLeadInstagram } from "@/lib/bpm/instagram-leads";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";
import { ehPipelineOperacional } from "@/lib/bpm/financeiro-config.client";
import { canalTarefasBpmDoUsuario } from "@/lib/bpm/notificacoes-tarefas";
import { BPM_LEAD_ALERTA_EVENT, type AlertaLeadBpm, type PaginaAlertasLeadsBpm } from "./notificacoes-leads";

export type ClienteNotificacoesLeads = Prisma.TransactionClient;
export const cursorAlertasLeadsBpmSchema = z.object({ versao: z.literal(1), usuarioId: z.number().int().positive(), fonte: z.enum(["INSTAGRAM", "NOLOSS", "ENCAMINHAMENTO"]),
  id: z.string().max(200), snapshotEm: z.string().datetime() }).strict();
type Cursor = z.infer<typeof cursorAlertasLeadsBpmSchema>;
const TAMANHO_PAGINA = 50;

export function lerCursorAlertasLeadsBpm(cursor: string | null, usuarioId: number): Cursor {
  if (!cursor) return { versao: 1, usuarioId, fonte: "INSTAGRAM", id: "", snapshotEm: new Date().toISOString() };
  if (cursor.length > 2000 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("Cursor inválido");
  try {
    const parsed = cursorAlertasLeadsBpmSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (parsed.usuarioId !== usuarioId) throw new Error("Cursor inválido");
    return parsed;
  }
  catch { throw new Error("Cursor inválido"); }
}
function proximo(cursor: Cursor) { return Buffer.from(JSON.stringify(cursor)).toString("base64url"); }

export function setorUsuarioFilaBpm(role: string): "COMERCIAL" | "FINANCEIRO" | "OPERACIONAL" | null {
  const setor = normalizeRole(role).replace(/^LIDER/, "");
  return setor === "COMERCIAL" || setor === "FINANCEIRO" || setor === "OPERACIONAL" ? setor : null;
}

export function ehObservadorTiAlertasLeadsBpm(role: string): boolean {
  const perfil = normalizeRole(role);
  return perfil === "ADMIN" || perfil === "TI";
}

/** A audiência usa permissões efetivas atuais; TI/Admin observa sem autoridade de assunção. */
export async function listarDestinatariosFilaLeadsBpm(pipelineId: string, etapaId: string, client: ClienteNotificacoesLeads = db) {
  const [usuarios, pipeline] = await Promise.all([
    listarUsuariosComAcessoCrmBpm(client),
    client.bpmPipeline.findUnique({ where: { id: pipelineId }, select: { id: true, chave: true, nome: true, ativo: true,
      visualizacaoConfigJson: true, setores: { select: { setor: { select: { nome: true, ativo: true } } } },
      etapas: { where: { id: etapaId, ativo: true }, select: { visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } } },
    } }),
  ]);
  if (!pipeline?.ativo || !pipeline.etapas.length) return [];
  const setor = pipeline.chave === "comercial" || pipeline.nome === "Revisão de Radar" ? "COMERCIAL" : pipeline.chave === "financeiro" ? "FINANCEIRO"
    : ehPipelineOperacional(pipeline) ? "OPERACIONAL" : null;
  if (!setor) return [];
  return usuarios.flatMap((usuario) => {
    const observador = ehObservadorTiAlertasLeadsBpm(usuario.role);
    if (!observador && setorUsuarioFilaBpm(usuario.role) !== setor) return [];
    const visibilidade = resolverVisibilidadeEtapa(usuario.role, pipeline.etapas[0].visibilidades);
    const permitido = visibilidade.podeVer && (observador || setor !== "COMERCIAL" || visibilidade.podeAgir) && podeAcessarPipelineBpm({
      role: usuario.role, permissoes: ["crm"], usuarioId: usuario.id, visualizacaoConfigJson: pipeline.visualizacaoConfigJson,
      setoresPipeline: pipeline.setores.filter(({ setor }) => setor.ativo).map(({ setor }) => setor.nome), ehMembroPipeline: false,
    });
    return permitido ? [{ ...usuario, podeAgir: !observador && visibilidade.podeAgir }] : [];
  });
}

export async function notificarPendenciasLeadsBpm(params: { pipelineId: string; etapaId?: string }) {
  try {
    const etapa = params.etapaId ? { id: params.etapaId } : await db.bpmEtapa.findFirst({
      where: { pipelineId: params.pipelineId, ativo: true }, orderBy: { ordem: "asc" }, select: { id: true },
    });
    if (!etapa) return;
    const usuarios = await listarDestinatariosFilaLeadsBpm(params.pipelineId, etapa.id);
    const { pusherServer } = await import("@/lib/pusher-server.ts");
    const payload = { pipelineId: params.pipelineId, timestamp: new Date().toISOString() };
    await Promise.allSettled(usuarios.map((usuario) => pusherServer.trigger(canalTarefasBpmDoUsuario(usuario.id), BPM_LEAD_ALERTA_EVENT, payload)));
  } catch { console.error("[AlphaCRM/leads] Atualização de pendências indisponível"); }
}

async function filaComercial(fonte: "INSTAGRAM" | "NOLOSS", client: ClienteNotificacoesLeads) {
  if (fonte === "INSTAGRAM") {
    const endpoint = await carregarEndpointInstagram(client);
    if (!endpoint?.pipelineId) return null;
    try {
      const etapa = await etapaEntradaInstagram(endpoint.pipelineId, client);
      return { pipelineId: endpoint.pipelineId, pipelineNome: endpoint.pipeline!.nome, etapa, endpointId: endpoint.id };
    } catch (error) { if (error instanceof ErroInstagram) return null; throw error; }
  }
  const pipeline = await client.bpmPipeline.findFirst({ where: { nome: "Revisão de Radar", ativo: true },
    select: { id: true, nome: true, etapas: { where: { ativo: true, ehInicial: true },
      orderBy: { ordem: "asc" }, take: 2, select: { id: true, nome: true } } } });
  const etapa = pipeline?.etapas.length === 1 && etapaEhNovosLeads(pipeline.etapas[0].nome) ? pipeline.etapas[0] : null;
  return pipeline && etapa ? { pipelineId: pipeline.id, pipelineNome: pipeline.nome, etapa, endpointId: null } : null;
}

/** Paginação por fonte/identidade, com cutoff de chegada comum a todas as páginas. */
export async function listarAlertasLeadsBpm(usuarioId: number, cursorTexto: string | null = null, client: ClienteNotificacoesLeads = db): Promise<PaginaAlertasLeadsBpm> {
  const cursor = lerCursorAlertasLeadsBpm(cursorTexto, usuarioId);
  const snapshotEm = cursor.snapshotEm;
  if (cursor.fonte === "ENCAMINHAMENTO") return listarPaginaRecepcoes(usuarioId, cursor, client);
  const fila = await filaComercial(cursor.fonte, client);
  const autorizados = fila ? await listarDestinatariosFilaLeadsBpm(fila.pipelineId, fila.etapa.id, client) : [];
  const seguinte: Cursor["fonte"] = cursor.fonte === "INSTAGRAM" ? "NOLOSS" : "ENCAMINHAMENTO";
  if (!fila || !autorizados.some((usuario) => usuario.id === usuarioId)) {
    return { alertas: [], proximoCursor: proximo({ ...cursor, fonte: seguinte, id: "" }), snapshotEm };
  }
  const base = { tipo: "LEAD_SEM_RESPONSAVEL" as const, pipelineId: fila.pipelineId, pipelineNome: fila.pipelineNome,
    etapaId: fila.etapa.id, etapaNome: fila.etapa.nome, responsaveisAnteriores: [] };
  let alertas: AlertaLeadBpm[];
  let ids: string[];
  if (cursor.fonte === "INSTAGRAM") {
    const entradas = await client.bpmWebhookEntrada.findMany({
      where: { endpointId: fila.endpointId!, statusRecebimento: "AUTENTICADO", eventoId: null,
        recebidoEm: { lte: new Date(snapshotEm) }, ...(cursor.id ? { id: { gt: cursor.id } } : {}) },
      orderBy: { id: "asc" }, take: TAMANHO_PAGINA + 1,
      select: { id: true, recebidoEm: true, payloadSanitizadoJson: true },
    });
    ids = entradas.map((entrada) => entrada.id);
    alertas = entradas.slice(0, TAMANHO_PAGINA).flatMap((entrada): AlertaLeadBpm[] => {
      const dados = lerLeadInstagram(entrada.payloadSanitizadoJson);
      return dados ? [{ ...base, id: `lead:${fila.pipelineId}:INSTAGRAM:${entrada.id}`, fonte: "INSTAGRAM", origem: "INSTAGRAM",
        nome: dados.nome, email: dados.email, telefone: dados.telefone, cnpj: dados.cnpj, recebidoEm: entrada.recebidoEm.toISOString(),
        resumo: [dados.radarPretendido, dados.volume, dados.prazo].filter(Boolean).join(" · ") || null,
        destino: { tipo: "LEAD_VIRTUAL", pipelineId: fila.pipelineId, origemLead: "instagram", leadId: entrada.id } }] : [];
    });
  } else {
    const entradas = await client.nolossLead.findMany({
      where: { status: "pending", promotedCardId: null, promotedByUserId: null,
        receivedAt: { lte: new Date(snapshotEm) }, ...(cursor.id ? { id: { gt: cursor.id } } : {}) },
      orderBy: { id: "asc" }, take: TAMANHO_PAGINA + 1,
      select: { id: true, nome: true, email: true, telefone: true, utmSource: true, receivedAt: true },
    });
    ids = entradas.map((entrada) => entrada.id);
    alertas = entradas.slice(0, TAMANHO_PAGINA).map((entrada) => ({ ...base, id: `lead:${fila.pipelineId}:NOLOSS:${entrada.id}`,
      fonte: "NOLOSS", origem: ["site", "website"].includes(entrada.utmSource?.trim().toLowerCase() ?? "") ? "SITE" : "OUTRA",
      nome: entrada.nome || entrada.email || "Lead sem nome", email: entrada.email, telefone: entrada.telefone, cnpj: null,
      resumo: null, recebidoEm: entrada.receivedAt.toISOString(),
      destino: { tipo: "LEAD_VIRTUAL", pipelineId: fila.pipelineId, origemLead: "noloss", leadId: entrada.id },
    }));
  }
  return { alertas, snapshotEm, proximoCursor: ids.length > TAMANHO_PAGINA
    ? proximo({ ...cursor, id: ids[TAMANHO_PAGINA - 1] }) : proximo({ ...cursor, fonte: seguinte, id: "" }) };
}

async function listarPaginaRecepcoes(usuarioId: number, cursor: Cursor, client: ClienteNotificacoesLeads): Promise<PaginaAlertasLeadsBpm> {
  const { ACAO_RECEPCAO_PIPELINE, carregarRecepcoesPipelineBpm } = await import("./recebimentos-card-server");
  const registros = await client.bpmCardHistorico.findMany({
    where: { acao: ACAO_RECEPCAO_PIPELINE, createdAt: { lte: new Date(cursor.snapshotEm) },
      ...(cursor.id ? { id: { gt: cursor.id } } : {}), card: { status: "ATIVO", pipeline: { ativo: true } } },
    orderBy: { id: "asc" }, take: TAMANHO_PAGINA + 1, select: { id: true },
  });
  const recepcoes = await carregarRecepcoesPipelineBpm(registros.slice(0, TAMANHO_PAGINA).map((item) => item.id), client);
  const audiences = new Map<string, ReturnType<typeof listarDestinatariosFilaLeadsBpm>>();
  const alertas: AlertaLeadBpm[] = [];
  for (const { registro, marker, card, claim } of recepcoes.values()) {
    if (claim || card.status !== "ATIVO" || !card.pipeline.ativo || !card.etapa.ativo) continue;
    const chave = `${card.pipelineId}:${card.etapaId}`;
    if (!audiences.has(chave)) audiences.set(chave, listarDestinatariosFilaLeadsBpm(card.pipelineId, card.etapaId, client));
    if (!(await audiences.get(chave))?.some((usuario) => usuario.id === usuarioId)) continue;
    alertas.push({ id: `recepcao:${registro.id}`, tipo: "LEAD_SEM_RESPONSAVEL", fonte: "ENCAMINHAMENTO", origem: "OUTRA",
      pipelineId: card.pipelineId, pipelineNome: card.pipeline.nome, etapaId: card.etapaId, etapaNome: card.etapa.nome,
      nome: card.empresa.razaoSocial, email: null, telefone: null, cnpj: card.empresa.cnpj, resumo: card.servico,
      recebidoEm: registro.createdAt.toISOString(), responsaveisAnteriores: marker.responsaveisAnteriores,
      destino: { tipo: "CARD", pipelineId: card.pipelineId, cardId: card.id, recepcaoId: registro.id } });
  }
  return { alertas, snapshotEm: cursor.snapshotEm, proximoCursor: registros.length > TAMANHO_PAGINA
    ? proximo({ ...cursor, id: registros[TAMANHO_PAGINA - 1].id }) : null };
}

export async function obterAlertaLeadPendenteBpm(usuarioId: number,
  destino: { tipo: "LEAD_VIRTUAL"; pipelineId: string; origemLead: "instagram" | "noloss"; leadId: string }, client: ClienteNotificacoesLeads = db): Promise<AlertaLeadBpm | null> {
  const fila = await filaComercial(destino.origemLead === "instagram" ? "INSTAGRAM" : "NOLOSS", client);
  if (!fila || fila.pipelineId !== destino.pipelineId
    || !(await listarDestinatariosFilaLeadsBpm(fila.pipelineId, fila.etapa.id, client)).some((usuario) => usuario.id === usuarioId)) return null;
  const base = { tipo: "LEAD_SEM_RESPONSAVEL" as const, pipelineId: fila.pipelineId, pipelineNome: fila.pipelineNome,
    etapaId: fila.etapa.id, etapaNome: fila.etapa.nome, responsaveisAnteriores: [], destino };
  if (destino.origemLead === "instagram") {
    const entrada = await client.bpmWebhookEntrada.findFirst({ where: { id: destino.leadId, endpointId: fila.endpointId!,
      statusRecebimento: "AUTENTICADO", eventoId: null }, select: { id: true, recebidoEm: true, payloadSanitizadoJson: true } });
    const dados = entrada && lerLeadInstagram(entrada.payloadSanitizadoJson);
    return entrada && dados ? { ...base, id: `lead:${fila.pipelineId}:INSTAGRAM:${entrada.id}`, fonte: "INSTAGRAM", origem: "INSTAGRAM",
      nome: dados.nome, email: dados.email, telefone: dados.telefone, cnpj: dados.cnpj, recebidoEm: entrada.recebidoEm.toISOString(),
      resumo: [dados.radarPretendido, dados.volume, dados.prazo].filter(Boolean).join(" · ") || null } : null;
  }
  const entrada = await client.nolossLead.findFirst({ where: { id: destino.leadId, status: "pending", promotedCardId: null, promotedByUserId: null },
    select: { id: true, nome: true, email: true, telefone: true, utmSource: true, receivedAt: true } });
  return entrada ? { ...base, id: `lead:${fila.pipelineId}:NOLOSS:${entrada.id}`, fonte: "NOLOSS",
    origem: ["site", "website"].includes(entrada.utmSource?.trim().toLowerCase() ?? "") ? "SITE" : "OUTRA",
    nome: entrada.nome || entrada.email || "Lead sem nome", email: entrada.email, telefone: entrada.telefone,
    cnpj: null, resumo: null, recebidoEm: entrada.receivedAt.toISOString() } : null;
}

/** Resolve somente a identidade persistida pela promoção; a origem não concede acesso ao alvo. */
export async function obterDestinoLeadPromovidoBpm(usuarioId: number,
  destino: { tipo: "LEAD_VIRTUAL"; pipelineId: string; origemLead: "instagram" | "noloss"; leadId: string },
  client: ClienteNotificacoesLeads = db): Promise<{ pipelineId: string; cardId: string } | null> {
  const fila = await filaComercial(destino.origemLead === "instagram" ? "INSTAGRAM" : "NOLOSS", client);
  if (!fila || fila.pipelineId !== destino.pipelineId
    || !(await listarDestinatariosFilaLeadsBpm(fila.pipelineId, fila.etapa.id, client)).some((usuario) => usuario.id === usuarioId)) return null;
  let cardId: string;
  let empresaOrigemId: number | null = null;
  if (destino.origemLead === "instagram") {
    const entrada = await client.bpmWebhookEntrada.findFirst({
      where: { id: destino.leadId, endpointId: fila.endpointId!, statusRecebimento: "PROCESSADO" },
      select: { payloadSanitizadoJson: true, evento: { select: { tipo: true, entidadeTipo: true, entidadeId: true,
        cardId: true, pipelineId: true, idempotencyKey: true, valorNovoJson: true } } },
    });
    const evento = entrada?.evento;
    if (!entrada || !lerLeadInstagram(entrada.payloadSanitizadoJson) || !evento?.cardId
      || evento.tipo !== "CARD_CRIADO" || evento.entidadeTipo !== "CARD" || evento.entidadeId !== evento.cardId
      || evento.pipelineId !== fila.pipelineId || evento.idempotencyKey !== `instagram-assumido:${destino.leadId}`) return null;
    try {
      if (!z.object({ origem: z.literal("INSTAGRAM") }).safeParse(JSON.parse(evento.valorNovoJson ?? "null")).success) return null;
    } catch { return null; }
    cardId = evento.cardId;
  } else {
    const entrada = await client.nolossLead.findFirst({ where: { id: destino.leadId, status: "promoted" },
      select: { promotedCardId: true, promotedClienteId: true } });
    if (!entrada?.promotedCardId) return null;
    cardId = entrada.promotedCardId;
    empresaOrigemId = entrada.promotedClienteId;
  }
  const card = await client.bpmCard.findUnique({ where: { id: cardId }, select: {
    id: true, pipelineId: true, empresaId: true, status: true, pipeline: { select: { ativo: true } }, etapa: { select: { ativo: true } },
  } });
  if (!card || !card.pipeline.ativo || !card.etapa.ativo || !["ATIVO", "CONCLUIDO"].includes(card.status)
    || empresaOrigemId !== null && empresaOrigemId !== card.empresaId
    || !(await checarAcessoBpmCard(card.id, usuarioId, null, "visualizar", client)).autorizado) return null;
  return { pipelineId: card.pipelineId, cardId: card.id };
}
