import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validarPinComRateLimit } from "@/lib/convite-pin";
import { getReceitaData } from "@/lib/cnpj/receita-federal";
import { validarCnpj } from "@/lib/gerador-documentos/cnpj";
import { consumeAuthRateLimit } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

const Schema = z.object({
  token: z.string().min(10).max(256),
  pin: z.string().length(4),
  cnpj: z.string().min(14).max(20),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const { token, pin } = parsed.data;
    const validacao = await validarPinComRateLimit(token, pin, false);
    if (!validacao.ok) return NextResponse.json({ error: validacao.error }, { status: validacao.status });

    const cnpj = parsed.data.cnpj.replace(/\D/g, "");
    if (!validarCnpj(cnpj)) return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });

    const limit = await consumeAuthRateLimit("pre_analise_convite", token).catch(() => null);
    if (!limit) {
      return NextResponse.json({ error: "Consulta temporariamente indisponível" }, { status: 503 });
    }
    if (!limit.allowed) {
      return NextResponse.json({ error: "Limite de consultas atingido. Tente novamente em instantes." }, {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      });
    }

    const dados = await getReceitaData(cnpj);
    if (!dados || typeof dados !== "object" || !(dados as { razaoSocial?: string }).razaoSocial) {
      return NextResponse.json({ error: "Cadastro indisponível no momento" }, { status: 502 });
    }
    return NextResponse.json(dados, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o CNPJ. Tente novamente." }, { status: 502 });
  }
}
