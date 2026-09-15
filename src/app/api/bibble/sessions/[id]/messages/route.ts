import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../../auth";
import db from "@/lib/prisma";
import { z } from "zod";
import { BIBBLE_HISTORY_MESSAGE_MAX_CHARS, readRequestTextWithLimit } from "@/lib/bibble/attachment-security";

export const dynamic = "force-dynamic";

const turnSchema = z.object({
  userContent: z.string().trim().min(1).max(BIBBLE_HISTORY_MESSAGE_MAX_CHARS),
  assistantContent: z.string().trim().min(1).max(1_000_000),
}).strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(session.user.id);
  const { id } = await params;

  const owned = await db.bibbleSession.findFirst({ where: { id, userId } });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await readRequestTextWithLimit(req, 4 * 1024 * 1024).catch(() => null);
  const parsed = turnSchema.safeParse((() => { try { return raw === null ? null : JSON.parse(raw); } catch { return null; } })());
  if (!parsed.success) return NextResponse.json({ error: "Turno inválido" }, { status: 400 });
  const { userContent, assistantContent } = parsed.data;

  try {
    await db.$transaction([
      db.bibbleMessage.create({ data: { sessionId: id, role: "user", content: userContent } }),
      db.bibbleMessage.create({ data: { sessionId: id, role: "assistant", content: assistantContent, tokens: null } }),
      db.bibbleSession.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
  } catch (err) {
    console.error("[bibble/messages] transaction-failed", { error: err instanceof Error ? err.name : "unknown" });
    return NextResponse.json({ error: "Failed to save messages" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
