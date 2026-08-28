import { NextRequest, NextResponse } from "next/server";

import { GerarDocumento } from "@/actions/gerador-documentos";

/**
 * Endpoint de conveniência para outros módulos do painel dispararem a geração
 * de documento via HTTP (mesmo processo Next.js). Reaproveita a Server Action
 * `GerarDocumento` — auth()/ownership/validação Zod já resolvidos lá, nenhuma
 * lógica duplicada aqui.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const resultado = await GerarDocumento(body);
  if (!resultado.success) {
    const status = resultado.error === "Não autenticado" ? 401 : resultado.error === "Não autorizado" ? 403 : 400;
    return NextResponse.json(resultado, { status });
  }

  return NextResponse.json(resultado, { status: 201 });
}
