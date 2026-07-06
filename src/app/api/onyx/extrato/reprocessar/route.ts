import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { organizarPagina } from "@/lib/onyx/extrato-agents";
import type { PaginaComErro } from "@/types/extrato";
import type { TransacaoNormalizada } from "@/types/extrato";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/onyx/extrato/reprocessar
 *
 * Reprocessa páginas específicas que falharam no processamento inicial de um
 * extrato bancário — sem precisar re-upload do PDF, já que o texto de cada
 * página com erro já veio na resposta original (POST /api/onyx/extrato).
 *
 * Body: { paginas: PaginaComErro[] }
 * Retorna: { success: true, data: TransacaoNormalizada[], paginasComErro: PaginaComErro[] }
 * (paginasComErro na resposta contém só as que ainda falharam nesta tentativa)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }

  let body: { paginas?: PaginaComErro[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Corpo inválido (JSON esperado)." }, { status: 400 });
  }

  const paginas = body.paginas;
  if (!Array.isArray(paginas) || paginas.length === 0) {
    return NextResponse.json({ success: false, error: "Campo 'paginas' ausente ou vazio." }, { status: 400 });
  }

  console.log(`[POST /api/onyx/extrato/reprocessar] reprocessando ${paginas.length} página(s)`);

  const transacoes: TransacaoNormalizada[] = [];
  const paginasComErro: PaginaComErro[] = [];

  for (const p of paginas) {
    try {
      const doTexto = await organizarPagina(p.texto, p.pagina - 1);
      console.log(`[POST /api/onyx/extrato/reprocessar] página ${p.pagina}: ${doTexto.length} transação(ões)`);
      transacoes.push(...doTexto);
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err);
      console.warn(`[POST /api/onyx/extrato/reprocessar] página ${p.pagina} falhou novamente: ${motivo}`);
      paginasComErro.push({ pagina: p.pagina, texto: p.texto, motivo });
    }
  }

  return NextResponse.json({ success: true, data: transacoes, paginasComErro });
}
