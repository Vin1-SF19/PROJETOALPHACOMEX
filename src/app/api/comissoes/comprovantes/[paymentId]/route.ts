import { get } from "@vercel/blob";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { verificarAcessoCategoria } from "@/lib/commissions/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autenticado", { status: 401 });

  const role = (session.user as { role?: string }).role ?? "";
  const acesso = await verificarAcessoCategoria(Number(session.user.id), role, "VISUALIZAR");
  if (!acesso.ok) return new Response("Sem permissão", { status: 403 });

  const { paymentId } = await context.params;
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { comprovanteUrl: true },
  });
  if (!payment?.comprovanteUrl) return new Response("Comprovante não encontrado", { status: 404 });

  const token = process.env.COMISSOES_COLAB_READ_WRITE_TOKEN;
  if (!token) return new Response("Armazenamento não configurado", { status: 503 });

  const result = await get(payment.comprovanteUrl, {
    access: "private",
    token,
    useCache: false,
  });
  if (!result?.stream) return new Response("Comprovante não encontrado", { status: 404 });

  const headers: Record<string, string> = {};
  result.headers.forEach((value, key) => {
    headers[key] = value;
  });
  headers["Cache-Control"] = "private, no-store, max-age=0";
  headers["Content-Disposition"] = 'attachment; filename="comprovante"';
  headers["X-Content-Type-Options"] = "nosniff";
  return new Response(result.stream, { status: 200, headers });
}
