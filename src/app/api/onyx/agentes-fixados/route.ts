import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_FIXADOS = 3;

// GET /api/onyx/agentes-fixados — lista os agentes fixados do usuário (máx. 3)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = Number(session.user.id);

  const fixados = await db.onyxAgenteFixado.findMany({
    where: { userId },
    orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
    select: { onyxAgentId: true, agentName: true, ordem: true },
  });

  return NextResponse.json({ fixados });
}

// POST /api/onyx/agentes-fixados — fixa ou desfixa um agente
// body: { onyxAgentId: number, agentName?: string, acao: "fixar" | "desfixar" }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = Number(session.user.id);

  let body: { onyxAgentId?: number; agentName?: string; acao?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const onyxAgentId = Number(body.onyxAgentId);
  if (!onyxAgentId) return NextResponse.json({ error: "onyxAgentId obrigatório" }, { status: 400 });

  try {
    if (body.acao === "desfixar") {
      await db.onyxAgenteFixado.deleteMany({ where: { userId, onyxAgentId } });
    } else {
      // fixar — respeita o limite de 3
      const jaFixado = await db.onyxAgenteFixado.findUnique({
        where: { userId_onyxAgentId: { userId, onyxAgentId } },
      });
      if (!jaFixado) {
        const total = await db.onyxAgenteFixado.count({ where: { userId } });
        if (total >= MAX_FIXADOS) {
          return NextResponse.json({ error: `Você pode fixar no máximo ${MAX_FIXADOS} agentes.` }, { status: 400 });
        }
        await db.onyxAgenteFixado.create({
          data: { userId, onyxAgentId, agentName: body.agentName ?? null, ordem: total },
        });
      }
    }

    const fixados = await db.onyxAgenteFixado.findMany({
      where: { userId },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      select: { onyxAgentId: true, agentName: true, ordem: true },
    });
    return NextResponse.json({ fixados });
  } catch (err) {
    console.error("[agentes-fixados] erro:", err);
    return NextResponse.json({ error: "Erro ao atualizar fixados" }, { status: 500 });
  }
}
