import { compare } from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";

import db from "@/lib/prisma";
import { criarCardWebhookSchema, criarCardNovoLeadViaWebhook, ErroCriacaoCardWebhook } from "@/lib/bpm/criar-card-webhook-server";
import { pipelineEhRevisaoRadar } from "@/lib/bpm/proximo-contato";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY = 256 * 1024;
const MAX_REQUESTS_PER_MINUTE = 60;
const janelaRateLimit = new Map<string, { inicio: number; total: number }>();

function rateLimitPermitido(chave: string): boolean {
  const agora = Date.now();
  const atual = janelaRateLimit.get(chave);
  if (!atual || agora - atual.inicio > 60_000) {
    janelaRateLimit.set(chave, { inicio: agora, total: 1 });
    return true;
  }
  atual.total += 1;
  return atual.total <= MAX_REQUESTS_PER_MINUTE;
}

function ipDaRequisicao(request: NextRequest): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 100) ?? null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const endpoint = await db.bpmWebhookEndpoint.findUnique({
    where: { caminhoSlug: slug },
    select: {
      id: true,
      ativo: true,
      segredoHash: true,
      pipelineId: true,
      pipeline: { select: { nome: true, ativo: true } },
    },
  });
  if (!endpoint?.ativo || !endpoint.pipelineId || !endpoint.pipeline?.ativo
    || !pipelineEhRevisaoRadar(endpoint.pipeline.nome)) {
    return NextResponse.json({ success: false, error: "Endpoint não encontrado" }, { status: 404 });
  }

  const ip = ipDaRequisicao(request);
  if (!rateLimitPermitido(`${endpoint.id}:${ip ?? "-"}`)) {
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

  const tamanhoDeclarado = Number(request.headers.get("content-length") ?? 0);
  if (tamanhoDeclarado > MAX_BODY) {
    return NextResponse.json({ success: false, error: "Payload muito grande" }, { status: 413 });
  }

  const texto = await request.text();
  if (Buffer.byteLength(texto, "utf8") > MAX_BODY) {
    return NextResponse.json({ success: false, error: "Payload muito grande" }, { status: 413 });
  }

  let body: unknown;
  try { body = JSON.parse(texto); }
  catch { return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 }); }

  const parsed = criarCardWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      error: "Dados inválidos",
      details: parsed.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  try {
    const resultado = await criarCardNovoLeadViaWebhook({
      endpointId: endpoint.id,
      pipelineId: endpoint.pipelineId,
      idempotencyKey,
      origemIp: ip,
      dados: parsed.data,
    });
    return NextResponse.json({ success: true, data: resultado }, { status: resultado.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof ErroCriacaoCardWebhook) {
      return NextResponse.json({ success: false, error: error.message, code: error.codigo }, { status: error.status });
    }
    console.error("[POST /api/bpm/webhooks/:slug/cards]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, error: "Erro interno ao criar card" }, { status: 500 });
  }
}
