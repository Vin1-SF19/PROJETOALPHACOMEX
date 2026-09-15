import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { z } from "zod";
import { readRequestTextWithLimit } from "@/lib/bibble/attachment-security";

export const dynamic = "force-dynamic";
const sessionPatchSchema = z.object({ title: z.string().trim().min(1).max(160) }).strict();
const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(100),
}).strict();

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

async function getSessionOwned(sessionId: string, userId: number) {
  return db.bibbleSession.findFirst({
    where: { id: sessionId, userId },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { id } = await params;

  const query = historyQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!query.success) return NextResponse.json({ error: "Paginação inválida" }, { status: 400 });
  const bibbleSession = await db.bibbleSession.findFirst({
    where: { id, userId },
  });

  if (!bibbleSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const descending = await db.bibbleMessage.findMany({
    where: { sessionId: id }, orderBy: { createdAt: "desc" },
    skip: query.data.page * query.data.limit, take: query.data.limit + 1,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  const hasMore = descending.length > query.data.limit;
  return NextResponse.json({ ...bibbleSession, messages: descending.slice(0, query.data.limit).reverse(), pagination: { page: query.data.page, limit: query.data.limit, hasMore } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origem não permitida" }, { status: 403 });

  const userId = Number(session.user.id);
  const { id } = await params;

  const owned = await getSessionOwned(id, userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await readRequestTextWithLimit(req, 4_096).catch(() => null);
  const parsed = raw === null ? null : sessionPatchSchema.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
  if (!parsed?.success) return NextResponse.json({ error: "Sessão inválida" }, { status: raw === null ? 413 : 400 });
  const body = parsed.data;
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
