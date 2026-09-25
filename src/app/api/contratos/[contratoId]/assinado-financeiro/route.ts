import { get } from "@vercel/blob";
import { z } from "zod";

import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { buscarAnexosAssinadosFinanceiroPorContrato } from "@/lib/bpm/financeiro-metas";
import { extrairPathnamePrivadoAnexoBpm, extrairUrlLegadaAnexoBpm } from "@/lib/bpm/anexos-storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ contratoId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autorizado", { status: 401 });
  const { contratoId } = await context.params;
  if (!z.string().cuid().safeParse(contratoId).success) return new Response("Contrato inválido", { status: 400 });
  const contrato = await db.contratoComercial.findUnique({
    where: { id: contratoId }, select: { id: true, usuarioId: true, arquivado: true },
  });
  if (!contrato || contrato.arquivado) return new Response("Contrato não encontrado", { status: 404 });
  const role = session.user.role ?? "";
  const podeVerTodos = isAdminRole(role) || role === "FINANCEIRO";
  if (!podeVerTodos && contrato.usuarioId !== Number(session.user.id)) {
    return new Response("Sem permissão", { status: 403 });
  }
  const anexos = await buscarAnexosAssinadosFinanceiroPorContrato([contratoId]);
  const anexoId = anexos.get(contratoId);
  if (!anexoId) return new Response("Contrato assinado indisponível", { status: 404 });
  const anexo = await db.bpmCardAnexo.findUnique({
    where: { id: anexoId }, select: { url: true, nome: true, tipo: true },
  });
  if (!anexo) return new Response("Arquivo não encontrado", { status: 404 });
  const pathnamePrivado = extrairPathnamePrivadoAnexoBpm(anexo.url);
  const urlLegada = pathnamePrivado ? null : extrairUrlLegadaAnexoBpm(anexo.url);
  if (!pathnamePrivado && !urlLegada) return new Response("Arquivo inválido", { status: 422 });
  try {
    const blob = await get(pathnamePrivado ?? urlLegada!, {
      access: pathnamePrivado ? "private" : "public",
      token: process.env.CRM_READ_WRITE_TOKEN,
      useCache: false,
    });
    if (!blob || blob.statusCode !== 200 || !blob.stream) return new Response("Arquivo não encontrado", { status: 404 });
    return new Response(blob.stream, {
      headers: {
        "Content-Type": anexo.tipo || blob.blob.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${anexo.nome.replace(/[\\\r\n"]/g, "_").slice(0, 255)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Não foi possível obter o arquivo", { status: 502 });
  }
}
