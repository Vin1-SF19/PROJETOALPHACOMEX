import { NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { checarAcessoModuloBpm } from "@/lib/bpm/ownership";
import { listarAlertasLeadsBpm, lerCursorAlertasLeadsBpm } from "@/lib/bpm/notificacoes-leads-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
/** Recupera pendências canônicas; nenhuma leitura promove ou assume um lead. */
export async function GET(request: Request) {
  try {
    const session = await auth();
    const usuarioId = Number(session?.user?.id);
    if (!session?.user?.id || !Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers });
    }
    if (!await checarAcessoModuloBpm(usuarioId)) return NextResponse.json({ error: "Sem acesso ao CRM" }, { status: 403, headers });
    const parametros = new URL(request.url).searchParams;
    if ([...parametros.keys()].some((chave) => chave !== "cursor") || parametros.getAll("cursor").length > 1) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400, headers });
    }
    const cursor = parametros.get("cursor");
    try { lerCursorAlertasLeadsBpm(cursor, usuarioId); }
    catch { return NextResponse.json({ error: "Cursor inválido" }, { status: 400, headers }); }
    return NextResponse.json(await listarAlertasLeadsBpm(usuarioId, cursor), { headers });
  } catch {
    console.error("[AlphaCRM/leads] Não foi possível carregar as pendências");
    return NextResponse.json({ error: "Não foi possível carregar as pendências" }, { status: 500, headers });
  }
}
