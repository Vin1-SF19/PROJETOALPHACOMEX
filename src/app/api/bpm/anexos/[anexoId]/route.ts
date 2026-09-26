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
  request: Request,
  context: { params: Promise<{ anexoId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autorizado", { status: 401 });

  const { anexoId } = await context.params;
  const anexo = await db.bpmCardAnexo.findUnique({
    where: { id: anexoId },
    select: { cardId: true, url: true, nome: true, tipo: true, card: { select: { pipeline: { select: { chave: true } } } } },
  });
  if (!anexo) return new Response("Anexo não encontrado", { status: 404 });

  let autorizado = false;
  try {
    await exigirAcessoBpmCard(
      anexo.cardId,
      Number(session.user.id),
      session.user.role ?? null,
      "visualizar",
    );
    autorizado = true;
  } catch {
    // A entrega Financeiro → Operacional concede acesso aos documentos da
    // contratação a quem pode visualizar o card operacional vinculado.
    if (["financeiro", "comercial"].includes(anexo.card.pipeline.chave ?? "")) {
      const vinculosDiretos = await db.bpmCardVinculo.findMany({
        where: { cardOrigemId: anexo.cardId, cardDestino: { pipeline: { chave: "operacional" }, status: { not: "ARQUIVADO" } } },
        select: { cardDestinoId: true },
      });
      const financeiros = anexo.card.pipeline.chave === "comercial"
        ? await db.bpmCardVinculo.findMany({
            where: { cardOrigemId: anexo.cardId, cardDestino: { pipeline: { chave: "financeiro" }, status: { not: "ARQUIVADO" } } },
            select: { cardDestinoId: true },
          }) : [];
      const vinculosIndiretos = financeiros.length
        ? await db.bpmCardVinculo.findMany({
            where: { cardOrigemId: { in: financeiros.map((item) => item.cardDestinoId) },
              cardDestino: { pipeline: { chave: "operacional" }, status: { not: "ARQUIVADO" } } },
            select: { cardDestinoId: true },
          }) : [];
      for (const destinoId of new Set([...vinculosDiretos, ...vinculosIndiretos].map((item) => item.cardDestinoId))) {
        try {
          await exigirAcessoBpmCard(destinoId, Number(session.user.id), session.user.role ?? null, "visualizar");
          autorizado = true;
          break;
        } catch { /* verificar os demais vínculos */ }
      }
    }
  }
  if (!autorizado) return new Response("Sem permissão", { status: 403 });

  // Documento gerado pertence ao módulo autenticado de conferência; o token
  // identifica a rota, mas a própria página ainda verifica acesso e ownership.
  if (anexo.tipo === "application/x-painel-alpha-documento"
    && /^\/PainelAlpha\/GeradorDocumentos\/conferencia\/[0-9a-f-]{36}$/.test(anexo.url)) {
    return Response.redirect(new URL(anexo.url, request.url), 302);
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
