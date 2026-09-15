import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { z } from "zod";
import { readRequestTextWithLimit } from "@/lib/bibble/attachment-security";

export const dynamic = "force-dynamic";
const projectPatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  systemPrompt: z.string().trim().max(30_000).nullable().optional(),
}).strict().refine(value => value.title !== undefined || value.systemPrompt !== undefined);

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
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

  const existing = await db.bibbleProject.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const raw = await readRequestTextWithLimit(req, 32_768).catch(() => null);
  const parsed = raw === null ? null : projectPatchSchema.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
  if (!parsed?.success) return NextResponse.json({ error: "Projeto inválido" }, { status: raw === null ? 413 : 400 });
  const body = parsed.data;

  const updated = await db.bibbleProject.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.systemPrompt !== undefined ? { systemPrompt: body.systemPrompt?.trim() || null } : {}),
    },
    select: {
      id: true,
      title: true,
      systemPrompt: true,
      updatedAt: true,
      _count: { select: { sessions: true } },
    },
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

  const existing = await db.bibbleProject.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.bibbleProject.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
