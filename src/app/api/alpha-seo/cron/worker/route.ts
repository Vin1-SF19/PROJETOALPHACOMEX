import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/bpm/cron-auth";
import { runPersistentAlphaSeoWorkerOnce } from "@/lib/alpha-seo/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ success: false, error: "CRON_SECRET nao configurado" }, { status: 503 });
  if (!autorizarCron(request.headers.get("authorization"), secret)) return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
  const result = await runPersistentAlphaSeoWorkerOnce();
  return NextResponse.json({ success: true, data: result });
}

export const POST = GET;
