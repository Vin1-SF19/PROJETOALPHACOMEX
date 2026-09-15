import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import db from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";
const createSessionSchema = z.object({ title: z.string().trim().min(1).max(120).optional(), projectId: z.string().trim().min(1).max(128).optional() }).strict();

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);

  const sessions = await db.bibbleSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, projectId: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const parsed = createSessionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const body = parsed.data;

  // Verify project ownership if provided
  if (body.projectId) {
    const project = await db.bibbleProject.findUnique({ where: { id: body.projectId } });
    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
    }
  }

  const newSession = await db.bibbleSession.create({
    data: {
      userId,
      title: body.title?.trim() || "Nova conversa",
      ...(body.projectId ? { projectId: body.projectId } : {}),
    },
    select: { id: true, title: true, projectId: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(newSession, { status: 201 });
}
