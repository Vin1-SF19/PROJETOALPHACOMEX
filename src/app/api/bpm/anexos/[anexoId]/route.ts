import { get } from "@vercel/blob";

import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import {
  extrairPathnamePrivadoAnexoBpm,
  extrairUrlLegadaAnexoBpm,
} from "@/lib/bpm/anexos-storage";

export const dynamic = "force-dynamic";

function nomeSeguroParaHeader(nome: string): string {
  return nome.replace(/[\\\r\n"]/g, "_").slice(0, 255) || "anexo";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ anexoId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autorizado", { status: 401 });

  const { anexoId } = await context.params;
  const anexo = await db.bpmCardAnexo.findUnique({
    where: { id: anexoId },
    select: { cardId: true, url: true, nome: true, tipo: true },
  });
  if (!anexo) return new Response("Anexo não encontrado", { status: 404 });

  try {
    await exigirAcessoBpmCard(
      anexo.cardId,
      Number(session.user.id),
      session.user.role ?? null,
      "visualizar",
    );
  } catch {
    return new Response("Sem permissão", { status: 403 });
  }

  const pathnamePrivado = extrairPathnamePrivadoAnexoBpm(anexo.url);
  const urlLegada = pathnamePrivado ? null : extrairUrlLegadaAnexoBpm(anexo.url);
  if (!pathnamePrivado && !urlLegada) {
    return new Response("Anexo com referência inválida", { status: 422 });
  }

  try {
    const blob = await get(pathnamePrivado ?? urlLegada!, {
      access: pathnamePrivado ? "private" : "public",
      token: process.env.CRM_READ_WRITE_TOKEN,
      useCache: false,
    });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return new Response("Arquivo não encontrado no armazenamento", { status: 404 });
    }
    return new Response(blob.stream, {
      headers: {
        "Content-Type": anexo.tipo || blob.blob.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${nomeSeguroParaHeader(anexo.nome)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[GET /api/bpm/anexos]", { anexoId, error: error instanceof Error ? error.name : "unknown" });
    return new Response("Não foi possível obter o anexo", { status: 502 });
  }
}
