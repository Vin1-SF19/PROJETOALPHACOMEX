import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { podeGerenciarMetas } from "@/lib/metas-permissoes";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autenticado", { status: 401 });

  const userId = Number(session.user.id);
  const role = (session.user as { role?: string }).role ?? "";

  if (!podeGerenciarMetas(role)) {
    const permissoes = await getPermissoesEfetivas(userId);
    if (!permissoes.includes("metas")) return new Response("Sem permissão", { status: 403 });
  }

  const { id } = await context.params;
  const justificativa = await db.justificativaMeta.findUnique({
    where: { id },
    select: { arquivoUrl: true, nomeArquivo: true },
  });
  if (!justificativa) return new Response("Justificativa não encontrada", { status: 404 });

  if (!process.env.METAS_READ_WRITE_TOKEN) {
    return new Response("Armazenamento não configurado", { status: 503 });
  }

  const respostaBlob = await fetch(justificativa.arquivoUrl);
  if (!respostaBlob.ok || !respostaBlob.body) {
    return new Response("Arquivo não encontrado", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": respostaBlob.headers.get("content-type") ?? "application/pdf",
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": `inline; filename="${justificativa.nomeArquivo.replace(/"/g, "")}"`,
    "X-Content-Type-Options": "nosniff",
  };
  return new Response(respostaBlob.body, { status: 200, headers });
}
