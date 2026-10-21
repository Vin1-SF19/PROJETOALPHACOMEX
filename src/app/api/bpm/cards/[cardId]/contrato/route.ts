import { get } from "@vercel/blob";
import { z } from "zod";
import { auth } from "../../../../../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { bpmCardIdSchema } from "@/lib/validations/bpm";
import { carregarAcompanhamentoComercial } from "@/lib/bpm/contratacao-comercial-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ cardId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autorizado", { status: 401 });
  const parsedCard = bpmCardIdSchema.safeParse((await context.params).cardId);
  const tipo = z.enum(["para_envio", "assinado"]).safeParse(new URL(request.url).searchParams.get("tipo") ?? "para_envio");
  if (!parsedCard.success || !tipo.success) return new Response("Solicitação inválida", { status: 400 });
  const cardId = parsedCard.data;
  try { await exigirAcessoBpmCard(cardId, Number(session.user.id), session.user.role ?? null, "visualizar"); }
  catch { return new Response("Sem permissão", { status: 403 }); }
  let documento;
  try {
    const contexto = await carregarAcompanhamentoComercial(cardId);
    documento = tipo.data === "assinado" ? contexto?.assinado : contexto?.documento;
  } catch { return new Response("Contrato indisponível", { status: 404 }); }
  if (!documento) return new Response("Contrato ainda não disponível", { status: 404 });
  try {
    const token = documento.armazenamento === "privado" ? process.env.BLOBCRM_READ_WRITE_TOKEN
      : documento.armazenamento === "gerado" ? process.env.BLOB_READ_WRITE_TOKEN : process.env.CRM_READ_WRITE_TOKEN;
    if (!token) return new Response("Armazenamento indisponível", { status: 503 });
    const blob = await get(documento.referencia, { access: documento.armazenamento === "privado" ? "private" : "public", token, useCache: false });
    if (!blob || blob.statusCode !== 200 || !blob.stream) return new Response("Arquivo indisponível", { status: 404 });
    if (blob.blob.contentType.split(";")[0].trim().toLowerCase() !== documento.tipo) {
      await blob.stream.cancel();
      return new Response("Arquivo indisponível", { status: 404 });
    }
    const nome = documento.nome.replace(/[\\\r\n"\u0000-\u001f]/g, "_").slice(0, 180) || "contrato";
    const inline = ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(documento.tipo);
    return new Response(blob.stream, { headers: { "Content-Type": documento.tipo,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${nome.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Não foi possível obter o contrato. Tente novamente.", { status: 502 }); }
}
