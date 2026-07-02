import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { processarExtratoPorAgentes } from "@/lib/onyx/extrato-agents";
import { OnyxError } from "@/lib/onyx/client";

export const dynamic = "force-dynamic";
// Extratos longos são divididos em vários trechos processados em sequência
// (cada um com até 2 tentativas), e PDFs sem texto extraível acionam OCR via
// PDF24 (job assíncrono que pode levar vários minutos) — soma alta.
export const maxDuration = 800;

/**
 * POST /api/onyx/extrato
 *
 * Recebe um PDF de extrato bancário (multipart, campo "file") e processa em 2 etapas:
 *   1. Apache Tika (local, sem IA): extrai o texto bruto do PDF
 *   2. Agente 32 (Organizador de Extratos Bancários): o texto é dividido em
 *      trechos menores e cada um é enviado ao agente, que devolve as
 *      movimentações daquele trecho; os resultados são agregados no final
 *
 * Retorna: { success: true, data: TransacaoNormalizada[] }
 *
 * O campo "bancoId" e "layoutAlvo" são aceitos no FormData mas não usados
 * internamente — são preservados para compatibilidade com o ModalUploadExtrato.
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

  try {
    console.log(`[POST /api/onyx/extrato] iniciando — arquivo: ${file.name} (${file.size} bytes)`);
    const pdfBlob = new Blob([await file.arrayBuffer()], { type: file.type || "application/pdf" });
    console.log("[POST /api/onyx/extrato] chamando processarExtratoPorAgentes...");
    const transacoes = await processarExtratoPorAgentes(pdfBlob, file.name);
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
    const status = err instanceof OnyxError ? err.status : 500;
    const message = (err as Error).message || "Erro ao processar extrato.";
    console.error("[POST /api/onyx/extrato]", message);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
