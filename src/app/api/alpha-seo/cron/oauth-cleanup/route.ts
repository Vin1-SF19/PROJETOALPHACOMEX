import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/bpm/cron-auth";
import { purgeExpiredAlphaSeoOAuthData } from "@/lib/alpha-seo/jobs/oauth-cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET nao configurado" },
      { status: 503 },
    );
  }
  if (!autorizarCron(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      { success: false, error: "Nao autorizado" },
      { status: 401 },
    );
  }
  const result = await purgeExpiredAlphaSeoOAuthData({ batchSize: 200 });
  return NextResponse.json({ success: true, data: result });
}

export const POST = GET;
