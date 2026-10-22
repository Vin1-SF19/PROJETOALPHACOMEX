import { timingSafeEqual } from "node:crypto";
import { resolverTransporteChecklist } from "@/lib/checklist/realtime";
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
  const config = resolverTransporteChecklist(
    process.env.NEXT_PUBLIC_CHECKLIST_REALTIME_MODE,
  );
  if (!config.valid) {
    return Response.json(
      { error: "Transporte CheckList indisponível." },
      { status: 503 },
    );
  }
  // Polling reads the journal directly. An external publication did not occur,
  // so no outbox claim, retry or publicadoEm update belongs to this endpoint.
  return Response.json({ processed: 0, transport: config.transport });
}
