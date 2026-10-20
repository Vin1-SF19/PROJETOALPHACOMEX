import { get } from "@vercel/blob";
import { auth } from "../../../../../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { carregarAcompanhamentoComercial } from "@/lib/bpm/contratacao-comercial-server";

export async function GET(_request: Request, context: { params: Promise<{ cardId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autorizado", { status: 401 });
  const { cardId } = await context.params;
  try { await exigirAcessoBpmCard(cardId, Number(session.user.id), session.user.role ?? null, "visualizar"); }
  catch { return new Response("Sem permissão", { status: 403 }); }
  try {
    const contexto = await carregarAcompanhamentoComercial(cardId);
    const documento = contexto?.documento;
    if (!documento) return new Response("Contrato ainda não disponível para envio", { status: 404 });
    const token = documento.armazenamento === "privado" ? process.env.BLOBCRM_READ_WRITE_TOKEN
      : documento.armazenamento === "gerado" ? process.env.BLOB_READ_WRITE_TOKEN : process.env.CRM_READ_WRITE_TOKEN;
    if (!token) return new Response("Armazenamento indisponível", { status: 503 });
    const blob = await get(documento.referencia, { access: documento.armazenamento === "privado" ? "private" : "public", token, useCache: false });
    if (!blob || blob.statusCode !== 200 || !blob.stream) return new Response("Arquivo indisponível", { status: 404 });
    return new Response(blob.stream, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=contrato.pdf",
      "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Não foi possível obter o contrato. Tente novamente.", { status: 502 }); }
}
