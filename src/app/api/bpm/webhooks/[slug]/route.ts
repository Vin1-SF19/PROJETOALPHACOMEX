import { createHash } from "node:crypto";
import { compare } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import db from "@/lib/prisma";
import { sanitizarPayloadAutomacao } from "@/lib/bpm/automacoes/eventos";

export const runtime = "nodejs";
const MAX_BODY = 256 * 1024;
const janela = new Map<string, { inicio: number; total: number }>();

function rateLimitPermitido(chave: string): boolean {
  const agora = Date.now(); const atual = janela.get(chave);
  if (!atual || agora - atual.inicio > 60_000) { janela.set(chave, { inicio: agora, total: 1 }); return true; }
  atual.total++; return atual.total <= 60;
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const endpoint = await db.bpmWebhookEndpoint.findUnique({ where: { caminhoSlug: slug }, include: { automacao: true } });
  if (!endpoint?.ativo) return NextResponse.json({ error: "Endpoint não encontrado" }, { status: 404 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 100) ?? null;
  if (!rateLimitPermitido(`${endpoint.id}:${ip ?? "-"}`)) return NextResponse.json({ error: "Limite de requisições excedido" }, { status: 429 });
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (tamanho > MAX_BODY) return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  const segredo = request.headers.get("x-bpm-webhook-secret") ?? "";
  const idempotencyKey = (request.headers.get("idempotency-key") ?? "").trim().slice(0, 300);
  if (!idempotencyKey) return NextResponse.json({ error: "Header Idempotency-Key obrigatório" }, { status: 400 });
  if (!segredo || !await compare(segredo, endpoint.segredoHash)) {
    await db.bpmWebhookEntrada.upsert({ where: { endpointId_idempotencyKey: { endpointId: endpoint.id, idempotencyKey } }, create: { endpointId: endpoint.id, idempotencyKey, origemIp: ip, statusRecebimento: "REJEITADO", motivoRejeicao: "CREDENCIAL_INVALIDA" }, update: {} });
    return NextResponse.json({ error: "Credencial inválida" }, { status: 401 });
  }
  const texto = await request.text();
  if (Buffer.byteLength(texto, "utf8") > MAX_BODY) return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  let payload: Record<string, unknown>;
  try { const parsed = JSON.parse(texto); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); payload = parsed; }
  catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const cardId = typeof payload.cardId === "string" ? payload.cardId : "";
  if (!/^c[a-z0-9]{20,}$/i.test(cardId)) return NextResponse.json({ error: "cardId obrigatório" }, { status: 400 });
  const card = await db.bpmCard.findFirst({ where: { id: cardId, ...(endpoint.pipelineId ? { pipelineId: endpoint.pipelineId } : {}) }, select: { id: true, pipelineId: true } });
  if (!card) return NextResponse.json({ error: "Card incompatível" }, { status: 400 });
  const payloadSanitizado = sanitizarPayloadAutomacao(payload);
  try {
    const entrada = await db.$transaction(async (tx) => {
      const existente = await tx.bpmWebhookEntrada.findUnique({ where: { endpointId_idempotencyKey: { endpointId: endpoint.id, idempotencyKey } } });
      if (existente?.eventoId) return existente;
      const evento = await tx.bpmEventoDominio.create({ data: {
        tipo: "WEBHOOK_RECEBIDO", entidadeTipo: "WEBHOOK", entidadeId: endpoint.id, cardId: card.id, pipelineId: card.pipelineId,
        valorNovoJson: JSON.stringify({ endpointId: endpoint.id, payload: payloadSanitizado }), atorTipo: "WEBHOOK",
        correlationId: `webhook:${endpoint.id}:${idempotencyKey}`, idempotencyKey: `webhook:${endpoint.id}:${idempotencyKey}`,
      } });
      return existente
        ? tx.bpmWebhookEntrada.update({ where: { id: existente.id }, data: { origemIp: ip, statusRecebimento: "AUTENTICADO", motivoRejeicao: null, payloadSanitizadoJson: JSON.stringify(payloadSanitizado), eventoId: evento.id } })
        : tx.bpmWebhookEntrada.create({ data: { endpointId: endpoint.id, idempotencyKey, origemIp: ip, statusRecebimento: "AUTENTICADO", payloadSanitizadoJson: JSON.stringify(payloadSanitizado), eventoId: evento.id } });
    });
    return NextResponse.json({ accepted: true, requestId: createHash("sha256").update(entrada.id).digest("hex").slice(0, 16) }, { status: 202 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ accepted: true, duplicate: true }, { status: 202 });
    console.error("[WebhookAutomacoesBpm]", error);
    return NextResponse.json({ error: "Falha ao registrar webhook" }, { status: 500 });
  }
}
