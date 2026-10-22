import { timingSafeEqual } from "node:crypto";
import { publicarPendentes } from "@/lib/checklist/eventos";
import { pusherServer } from "@/lib/pusher-server.ts";
export async function POST(req: Request) {
  const secret = process.env.CHECKLIST_WORKER_SECRET;
  const actual = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  return Response.json(
    await publicarPendentes((e) =>
      pusherServer.trigger("private-checklist-docs", "checklist-evento", e),
    ),
  );
}
