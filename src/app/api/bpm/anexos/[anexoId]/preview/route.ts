import { get } from "@vercel/blob";

import { auth } from "../../../../../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { CONTRATO_PADRAO_ID, VARIAVEIS_CONTRATO_PADRAO } from "@/lib/gerador-documentos/contrato-padrao";
import { validarVariaveisObrigatorias } from "@/lib/gerador-documentos/render";

export const dynamic = "force-dynamic";

const ROTA_CONFERENCIA = /^\/PainelAlpha\/GeradorDocumentos\/conferencia\/([0-9a-f-]{36})$/;

export async function GET(request: Request, context: { params: Promise<{ anexoId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autorizado", { status: 401 });

  const { anexoId } = await context.params;
  const anexo = await db.bpmCardAnexo.findUnique({
    where: { id: anexoId },
    select: { cardId: true, url: true, tipo: true },
  });
  if (!anexo) return new Response("Anexo não encontrado", { status: 404 });

  try {
    await exigirAcessoBpmCard(anexo.cardId, Number(session.user.id), session.user.role ?? null, "visualizar");
  } catch {
    return new Response("Sem permissão", { status: 403 });
  }

  const token = anexo.tipo === "application/x-painel-alpha-documento"
    ? ROTA_CONFERENCIA.exec(anexo.url)?.[1]
    : null;
  if (!token) return new Response("Este anexo não é um contrato gerado", { status: 422 });

  const documento = await db.documentoGerado.findUnique({
    where: { tokenAcesso: token },
    select: {
      titulo: true, status: true, pdfUrl: true, variaveisJson: true, templateId: true,
      clausulas: { orderBy: { ordem: "asc" }, select: { id: true, ordem: true, titulo: true, conteudo: true } },
    },
  });
  if (!documento) return new Response("Contrato não encontrado", { status: 404 });
  let variaveis: Record<string, unknown>;
  try {
    const dados: unknown = typeof documento.variaveisJson === "string"
      ? JSON.parse(documento.variaveisJson)
      : documento.variaveisJson;
    if (!dados || typeof dados !== "object" || Array.isArray(dados)
      || (dados as Record<string, unknown>).__bpmCardId !== anexo.cardId) {
      return new Response("Contrato não encontrado", { status: 404 });
    }
    variaveis = dados as Record<string, unknown>;
  } catch {
    return new Response("Contrato não encontrado", { status: 404 });
  }

  const pendencias = documento.templateId === CONTRATO_PADRAO_ID && documento.status === "CONFERENCIA"
    ? validarVariaveisObrigatorias(VARIAVEIS_CONTRATO_PADRAO, variaveis as Record<string, string | number | boolean | null | undefined>)
      .map((nome) => VARIAVEIS_CONTRATO_PADRAO.find((item) => item.nome === nome)?.label ?? nome)
    : [];

  if (new URL(request.url).searchParams.get("formato") === "pdf") {
    if (!documento.pdfUrl) return new Response("PDF ainda não disponível", { status: 404 });
    try {
      const arquivo = await get(documento.pdfUrl, { access: "public", useCache: false });
      if (!arquivo || arquivo.statusCode !== 200 || !arquivo.stream) {
        return new Response("PDF não encontrado", { status: 404 });
      }
      return new Response(arquivo.stream, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline; filename=contrato.pdf",
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return new Response("Não foi possível abrir o PDF", { status: 502 });
    }
  }

  return Response.json({
    titulo: documento.titulo,
    status: documento.status,
    pdfDisponivel: Boolean(documento.pdfUrl),
    pendencias,
    clausulas: documento.clausulas,
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
