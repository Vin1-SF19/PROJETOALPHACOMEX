import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../../auth";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

  const { userContent, assistantContent } = (await req.json()) as {
    userContent: string;
    assistantContent: string;
  };

  try {
    // Two individual creates — more reliable than createMany with LibSQL adapter
    await db.bibbleMessage.create({
      data: { sessionId: id, role: "user", content: userContent },
    });
    await db.bibbleMessage.create({
      data: { sessionId: id, role: "assistant", content: assistantContent },
    });

    // Touch session updatedAt
    await db.bibbleSession.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  } catch (err) {
    console.error("[bibble/messages] Failed to save messages:", err);
    return NextResponse.json({ error: "Failed to save messages" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
