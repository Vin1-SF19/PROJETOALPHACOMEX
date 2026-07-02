import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { extractTextFromBuffer } from "@/lib/bibble/tika";
import { obterParser } from "@/lib/extrato/parsers";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";
// PDFs sem texto extraível acionam OCR via PDF24 (job assíncrono que pode
// levar vários minutos) — sem isso o timeout padrão é curto demais.
export const maxDuration = 800;

/** Considera "sem texto útil" descontando os marcadores de página do pdf-parse ("-- N of M --"). */
function textoInsuficiente(texto: string): boolean {
  return texto.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").trim().length < 20;
}

/**
 * POST /api/onyx/extrato
 *
 * Recebe um PDF de extrato bancário (multipart, campo "file") e processa em 2 etapas,
 * sem IA — determinístico:
 *   1. Extração de texto: Apache Tika → pdf-parse → OCR via PDF24 (fallback em cascata,
 *      ver src/lib/bibble/tika.ts)
 *   2. Parsing: um parser dedicado por banco (regex sobre o layout de tabela conhecido
 *      daquele banco, ver src/lib/extrato/parsers/) organiza o texto em transações
 *
 * Retorna: { success: true, data: TransacaoNormalizada[] }
 *
 * O campo "bancoId" recebido é o id numérico do registro BancosVinculados — é usado
 * para descobrir o TIPO do banco (campo bancoId String desse registro, ex: "bradesco")
 * e assim escolher o parser certo.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Envio inválido (multipart esperado)." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Campo 'file' ausente ou inválido." }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Arquivo excede o limite de 20MB." },
      { status: 400 },
    );
  }

  const bancoIdRegistro = form.get("bancoId");

  try {
    console.log(`[POST /api/onyx/extrato] iniciando — arquivo: ${file.name} (${file.size} bytes)`);

    // Descobre o TIPO do banco (ex: "bradesco") a partir do id numérico do registro
    let tipoBanco: string | null = null;
    const idNumerico = Number(bancoIdRegistro);
    if (bancoIdRegistro && Number.isFinite(idNumerico)) {
      const registro = await db.bancosVinculados.findUnique({
        where: { id: idNumerico },
        select: { bancoId: true },
      });
      tipoBanco = registro?.bancoId ?? null;
      if (!tipoBanco) {
        console.warn(`[POST /api/onyx/extrato] BancosVinculados id=${idNumerico} não encontrado — usando parser genérico.`);
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text: textoExtrato, source } = await extractTextFromBuffer(
      buffer,
      file.type || "application/pdf",
      file.name,
    );

    if (textoInsuficiente(textoExtrato)) {
      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível extrair texto do PDF. O arquivo pode estar corrompido, protegido, ou ser um PDF de imagem sem camada de texto (scan sem OCR).",
        },
        { status: 422 },
      );
    }

    console.log(`[POST /api/onyx/extrato] texto extraído via ${source} — ${textoExtrato.length} chars, banco=${tipoBanco ?? "desconhecido (parser genérico)"}`);

    const parser = obterParser(tipoBanco);
    const transacoes = parser.parse(textoExtrato);

    console.log(`[POST /api/onyx/extrato] concluído — ${transacoes.length} transações`);

    if (transacoes.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        warning: "Nenhuma transação encontrada no extrato. Verifique se o PDF está legível.",
      });
    }

    const ultimaData = transacoes.at(-1)?.data ?? "";

    return NextResponse.json({
      success: true,
      data: transacoes,
      ultimaDataEncontrada: ultimaData,
    });
  } catch (err) {
    const message = (err as Error).message || "Erro ao processar extrato.";
    console.error("[POST /api/onyx/extrato]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
