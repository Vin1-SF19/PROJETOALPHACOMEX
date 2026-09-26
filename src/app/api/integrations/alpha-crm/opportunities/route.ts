import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { checarAcessoModuloBpm, exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { callStandaloneCrm } from "@/lib/alpha-crm/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function authorizedUserId() {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!Number.isInteger(id) || id <= 0 || !await checarAcessoModuloBpm(id)) return null;
  return { id, role: session?.user?.role || null };
}

export async function GET(request: NextRequest) {
  const userId = await authorizedUserId();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const clienteId = Number(request.nextUrl.searchParams.get("clienteId"));
  if (!Number.isInteger(clienteId) || clienteId <= 0) return NextResponse.json({ error: "clienteId inválido" }, { status: 400 });
  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  try {
    const result = await callStandaloneCrm(`/api/integrations/painel-alpha/opportunities?panelCompanyId=${clienteId}`);
    return NextResponse.json(result.payload, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[alpha-crm/opportunities:GET]", error);
    return NextResponse.json({ error: "CRM independente indisponível" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await authorizedUserId();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const parsed = z.object({ cardId: z.string().min(1).max(100) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "cardId inválido" }, { status: 400 });
  try { await exigirAcessoBpmCard(parsed.data.cardId, userId.id, userId.role, "visualizar"); }
  catch { return NextResponse.json({ error: "Acesso negado ao card" }, { status: 403 }); }
  const card = await db.bpmCard.findUnique({ where: { id: parsed.data.cardId }, select: { id: true, empresaId: true, servico: true, tipoProcesso: true,
    empresa: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } } } });
  if (!card) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });
  const companyName = card.empresa.nomeFantasia || card.empresa.razaoSocial;
  try {
    const result = await callStandaloneCrm("/api/integrations/painel-alpha/opportunities", { method: "POST", body: {
      panelCardId: card.id, panelCompanyId: card.empresaId, companyName, taxId: card.empresa.cnpj,
      title: `${companyName} — ${card.servico || card.tipoProcesso || "Oportunidade"}`,
    } });
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    console.error("[alpha-crm/opportunities:POST]", error);
    return NextResponse.json({ error: "CRM independente indisponível" }, { status: 502 });
  }
}
