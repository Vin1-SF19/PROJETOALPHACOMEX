import { put, del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import db from "@/lib/prisma";
import { checarOwnershipApresentacao } from "@/lib/apresentacoes/ownership";
import { nomeArquivoSeguro } from "@/lib/apresentacoes/assets";
import { dadosSlideSchema } from "@/lib/validations/slide-componentes";
import {
  configuracaoDaFontePorNomeArquivo,
  fontePersonalizadaSchema,
  LIMITE_FONTES_PERSONALIZADAS,
  nomeFonteJaExiste,
  nomeFontePersonalizadaSchema,
  normalizarFontesPersonalizadas,
  assinaturaConfereComFormato,
  TAMANHO_MAX_FONTE_PERSONALIZADA_BYTES,
} from "@/lib/apresentacoes/fontes-personalizadas";

export const dynamic = "force-dynamic";

class ConflitoFonteError extends Error {}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Formulário inválido" }, { status: 400 });
  }

  const arquivo = formData.get("file");
  const apresentacaoId = formData.get("apresentacaoId");
  const resultadoNome = nomeFontePersonalizadaSchema.safeParse(formData.get("nome"));
  if (!(arquivo instanceof File) || typeof apresentacaoId !== "string" || !apresentacaoId || !resultadoNome.success) {
    return NextResponse.json({
      success: false,
      error: resultadoNome.success ? "Arquivo ou apresentação ausente" : resultadoNome.error.issues[0]?.message,
    }, { status: 400 });
  }

  if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAX_FONTE_PERSONALIZADA_BYTES) {
    return NextResponse.json({ success: false, error: "A fonte deve ter no máximo 10 MB" }, { status: 400 });
  }

  const configuracao = configuracaoDaFontePorNomeArquivo(arquivo.name);
  if (!configuracao) {
    return NextResponse.json({ success: false, error: "Formato não permitido. Use WOFF2, WOFF, TTF ou OTF." }, { status: 400 });
  }

  const cabecalho = new Uint8Array(await arquivo.slice(0, 4).arrayBuffer());
  if (!assinaturaConfereComFormato(cabecalho, configuracao.formato)) {
    return NextResponse.json({ success: false, error: "O conteúdo do arquivo não corresponde a uma fonte válida." }, { status: 400 });
  }

  const autorizado = await checarOwnershipApresentacao(apresentacaoId, Number(session.user.id), session.user.role);
  if (!autorizado) return NextResponse.json({ success: false, error: "Sem permissão para editar esta apresentação" }, { status: 403 });

  const slidesAtuais = await db.slide.findMany({
    where: { apresentacaoId },
    orderBy: { ordem: "asc" },
    select: { id: true, dadosJson: true },
  });
  const slidesValidos = slidesAtuais.flatMap((slide) => {
    const resultado = dadosSlideSchema.safeParse(slide.dadosJson);
    return resultado.success ? [{ id: slide.id, dados: resultado.data }] : [];
  });
  const fontesAtuais = slidesValidos.map((slide) => slide.dados.fontesPersonalizadas).find(Array.isArray) ?? [];
  if (fontesAtuais.length >= LIMITE_FONTES_PERSONALIZADAS) {
    return NextResponse.json({ success: false, error: `Limite de ${LIMITE_FONTES_PERSONALIZADAS} fontes atingido.` }, { status: 400 });
  }
  if (nomeFonteJaExiste(fontesAtuais, resultadoNome.data)) {
    return NextResponse.json({ success: false, error: "Já existe uma fonte com esse nome nesta apresentação." }, { status: 409 });
  }
  if (slidesValidos.length === 0) {
    return NextResponse.json({ success: false, error: "A apresentação não possui um slide válido." }, { status: 400 });
  }

  const nomeSeguro = nomeArquivoSeguro(arquivo.name) || `fonte.${arquivo.name.split(".").pop()?.toLowerCase()}`;
  const caminho = `apresentacoes/${apresentacaoId}/fontes/${Date.now()}-${crypto.randomUUID()}-${nomeSeguro}`;
  let urlEnviada: string | null = null;

  try {
    const blob = await put(caminho, arquivo, {
      access: "public",
      addRandomSuffix: false,
      contentType: configuracao.mimeType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    urlEnviada = blob.url;

    const fonte = fontePersonalizadaSchema.parse({
      id: crypto.randomUUID(),
      nome: resultadoNome.data,
      url: blob.url,
      formato: configuracao.formato,
      mimeType: configuracao.mimeType,
      nomeOriginal: arquivo.name.slice(0, 255),
      tamanhoBytes: arquivo.size,
      criadoEm: new Date().toISOString(),
    });

    await db.$transaction(async (tx) => {
      const slides = await tx.slide.findMany({
        where: { apresentacaoId },
        orderBy: { ordem: "asc" },
        select: { id: true, dadosJson: true },
      });
      const validos = slides.flatMap((slide) => {
        const resultado = dadosSlideSchema.safeParse(slide.dadosJson);
        return resultado.success ? [{ id: slide.id, dados: resultado.data }] : [];
      });
      const hospedeiro = validos.find((slide) => slide.dados.fontesPersonalizadas)
        ?? validos.find((slide) => slide.dados.presetsAnimacao)
        ?? validos[0];
      if (!hospedeiro) throw new Error("Nenhum slide válido");

      const existentes = normalizarFontesPersonalizadas(hospedeiro.dados.fontesPersonalizadas);
      if (existentes.length >= LIMITE_FONTES_PERSONALIZADAS || nomeFonteJaExiste(existentes, fonte.nome)) {
        throw new ConflitoFonteError("A biblioteca de fontes foi alterada durante o envio.");
      }
      await tx.slide.update({
        where: { id: hospedeiro.id },
        data: { dadosJson: { ...hospedeiro.dados, fontesPersonalizadas: [...existentes, fonte] } as object },
      });
    });

    return NextResponse.json({ success: true, fonte });
  } catch (error) {
    if (urlEnviada) await del(urlEnviada, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
    if (error instanceof ConflitoFonteError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    console.error("[POST /api/apresentacoes/fontes]", error);
    return NextResponse.json({ success: false, error: "Não foi possível adicionar a fonte." }, { status: 500 });
  }
}
