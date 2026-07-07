import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validarPinComRateLimit } from "@/lib/convite-pin";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  token: z.string().min(10),
  pin: z.string().length(4),
});

/**
 * Valida o PIN de entrada do wizard de convite de parceiro (StepPin). Rota
 * pública (sem auth()) — o token é a credencial. Compartilha o mesmo rate-limit
 * da consulta de CPF via validarPinComRateLimit (contador único por convite).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }

    const resultado = await validarPinComRateLimit(parsed.data.token, parsed.data.pin);
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: resultado.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[convite/validar-pin] erro inesperado →", err);
    const message = err instanceof Error ? err.message : "Erro ao validar PIN";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
