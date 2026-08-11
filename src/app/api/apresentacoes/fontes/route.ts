import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { checarOwnershipApresentacao } from "@/lib/apresentacoes/ownership";
import { nomeArquivoSeguro } from "@/lib/apresentacoes/assets";
import {
  configuracaoDaFontePorNomeArquivo,
  fontePersonalizadaSchema,
  nomeFonteJaExiste,
  nomeFontePersonalizadaSchema,
  assinaturaConfereComFormato,
  TAMANHO_MAX_FONTE_PERSONALIZADA_BYTES,
  type FontePersonalizada,
} from "@/lib/apresentacoes/fontes-personalizadas";
import {
  caminhoFonteGlobal,
  LIMITE_FONTES_GLOBAIS,
  listarFontesGlobais,
} from "@/lib/apresentacoes/fontes-globais";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }

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
  if (!autorizado) {
    return NextResponse.json({ success: false, error: "Sem permissão para editar esta apresentação" }, { status: 403 });
  }

  let fontesGlobais: FontePersonalizada[];
  try {
    fontesGlobais = await listarFontesGlobais();
  } catch (error) {
    console.error("[POST /api/apresentacoes/fontes] catálogo global indisponível", error);
    return NextResponse.json({ success: false, error: "O catálogo global de fontes está indisponível no momento." }, { status: 503 });
  }
  if (fontesGlobais.length >= LIMITE_FONTES_GLOBAIS) {
    return NextResponse.json({ success: false, error: `Limite global de ${LIMITE_FONTES_GLOBAIS} fontes atingido.` }, { status: 400 });
  }
  if (nomeFonteJaExiste(fontesGlobais, resultadoNome.data)) {
    return NextResponse.json({ success: false, error: "Já existe uma fonte global com esse nome." }, { status: 409 });
  }

  const nomeSeguro = nomeArquivoSeguro(arquivo.name) || `fonte.${arquivo.name.split(".").pop()?.toLowerCase()}`;
  const fonteId = crypto.randomUUID();
  const caminho = caminhoFonteGlobal(fonteId, resultadoNome.data, nomeSeguro);
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
      id: fonteId,
      nome: resultadoNome.data,
      url: blob.url,
      formato: configuracao.formato,
      mimeType: configuracao.mimeType,
      nomeOriginal: arquivo.name.slice(0, 255),
      tamanhoBytes: arquivo.size,
      criadoEm: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, fonte });
  } catch (error) {
    if (urlEnviada) {
      await del(urlEnviada, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
    }
    console.error("[POST /api/apresentacoes/fontes]", error);
    return NextResponse.json({ success: false, error: "Não foi possível adicionar a fonte." }, { status: 500 });
  }
}
