import { compare } from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";

import db from "@/lib/prisma";
import { pipelineEhRevisaoRadar } from "@/lib/bpm/proximo-contato";
import {
  ErroMovimentoCardWebhook, moverCardViaWebhook, moverCardWebhookSchema, statusErroTransicaoWebhook,
} from "@/lib/bpm/mover-card-webhook-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY = 256 * 1024;
const janelaRateLimit = new Map<string, { inicio: number; total: number }>();

function rateLimitPermitido(endpointId: string) {
  const agora = Date.now();
  const janela = janelaRateLimit.get(endpointId);
  if (!janela || agora - janela.inicio >= 60_000) {
    janelaRateLimit.set(endpointId, { inicio: agora, total: 1 });
    return true;
  }
  return ++janela.total <= 60;
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string; cardId: string }> }) {
  try {
    const { slug, cardId } = await context.params;
    const endpoint = await db.bpmWebhookEndpoint.findUnique({
      where: { caminhoSlug: slug },
      select: { id: true, ativo: true, segredoHash: true, pipelineId: true,
        pipeline: { select: { nome: true, ativo: true } } },
    });
    if (!endpoint?.ativo || !endpoint.pipelineId || !endpoint.pipeline?.ativo
      || !pipelineEhRevisaoRadar(endpoint.pipeline.nome)) {
      return NextResponse.json({ success: false, error: "Endpoint não encontrado" }, { status: 404 });
    }
    if (!rateLimitPermitido(endpoint.id)) {
      return NextResponse.json({ success: false, error: "Limite de requisições excedido" }, { status: 429 });
    }
    const secret = request.headers.get("x-bpm-webhook-secret") ?? "";
    if (!secret || !await compare(secret, endpoint.segredoHash)) {
      return NextResponse.json({ success: false, error: "Credencial inválida" }, { status: 401 });
    }
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    if (!/^[A-Za-z0-9._:-]{1,200}$/.test(idempotencyKey)) {
      return NextResponse.json({ success: false, error: "Header Idempotency-Key obrigatório ou inválido" }, { status: 400 });
    }
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) {
      return NextResponse.json({ success: false, error: "Payload muito grande" }, { status: 413 });
    }
    const texto = await request.text();
    if (Buffer.byteLength(texto, "utf8") > MAX_BODY) {
      return NextResponse.json({ success: false, error: "Payload muito grande" }, { status: 413 });
    }
    let body: unknown;
    try { body = JSON.parse(texto); }
    catch { return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 }); }
    const parsed = moverCardWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const resultado = await moverCardViaWebhook({
      endpointId: endpoint.id, pipelineId: endpoint.pipelineId, cardId, idempotencyKey, dados: parsed.data,
    });
    return NextResponse.json(resultado, { status: resultado.success ? 200 : statusErroTransicaoWebhook(resultado.code) });
  } catch (error) {
    if (error instanceof ErroMovimentoCardWebhook) {
      return NextResponse.json({ success: false, error: error.message, code: error.codigo }, { status: error.status });
    }
    console.error("[POST /api/bpm/webhooks/:slug/cards/:cardId/etapa]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, error: "Erro interno ao mover card" }, { status: 500 });
  }
}
