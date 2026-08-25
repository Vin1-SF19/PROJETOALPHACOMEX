import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import db from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Endpoint chamado pelo NoLoss (campanha → webhook) — não há sessão de usuário.
 * Autenticação por segredo compartilhado (header x-noloss-webhook-secret),
 * mesmo padrão de src/app/api/onyx/agent-tools/[tool]/route.ts.
 *
 * Env necessária:
 *   NOLOSS_WEBHOOK_SECRET — segredo que o NoLoss envia no header (obrigatório)
 */
function checkSecret(req: NextRequest): boolean {
  const expected = process.env.NOLOSS_WEBHOOK_SECRET;
  if (!expected) return false; // sem segredo configurado = bloqueado
  const got = req.headers.get("x-noloss-webhook-secret") ?? "";
  return got.length === expected.length && got === expected;
}

// O node "Webhook" do NoLoss só suporta placeholders simples sobre campos
// nativos do contato — sem acesso a custom fields (UTMs ficam de fora nesta
// versão, ver docs/ da feature).
const ingestSchema = z.object({
  id: z.string().min(1),
  email: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { id, email, firstName, lastName, phone } = parsed.data;
  const nome = [firstName, lastName].filter((parte) => parte?.trim()).join(" ").trim() || null;

  try {
    const existente = await db.nolossLead.findUnique({
      where: { nolossContactId: id },
      select: { id: true },
    });

    if (existente) {
      // Idempotência a retry do NoLoss — nunca reverte um lead já promovido/descartado
      // de volta para pending, só atualiza os dados de contato.
      await db.nolossLead.update({
        where: { id: existente.id },
        data: { nome, email: email ?? null, telefone: phone ?? null },
      });
    } else {
      await db.nolossLead.create({
        data: {
          nolossContactId: id,
          nome,
          email: email ?? null,
          telefone: phone ?? null,
          status: "pending",
        },
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/bpm/noloss-leads/ingest]", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}
