import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);

  const projects = await db.bibbleProject.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      systemPrompt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const body = (await req.json()) as { title?: string; systemPrompt?: string };

  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const project = await db.bibbleProject.create({
    data: {
      userId,
      title,
      systemPrompt: body.systemPrompt?.trim() || null,
    },
    select: {
      id: true,
      title: true,
      systemPrompt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { sessions: true } },
    },
  });

  return NextResponse.json(project, { status: 201 });
}
