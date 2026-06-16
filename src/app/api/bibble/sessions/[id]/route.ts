import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getSessionOwned(sessionId: string, userId: number) {
  return db.bibbleSession.findFirst({
    where: { id: sessionId, userId },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { id } = await params;

  const bibbleSession = await db.bibbleSession.findFirst({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });

  if (!bibbleSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(bibbleSession);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { id } = await params;

  const owned = await getSessionOwned(id, userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as { title?: string };
  const updated = await db.bibbleSession.update({
    where: { id },
    data: { title: body.title?.trim() || owned.title },
    select: { id: true, title: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { id } = await params;

  const owned = await getSessionOwned(id, userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.bibbleSession.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
