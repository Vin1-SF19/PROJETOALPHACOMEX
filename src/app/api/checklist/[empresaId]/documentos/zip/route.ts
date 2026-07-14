import JSZip from "jszip";
import { NextResponse } from "next/server";
import { auth } from "../../../../../../../auth";
import db from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_DOCUMENTOS = 100;
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_BYTES_POR_DOCUMENTO = 25 * 1024 * 1024;

function nomeSeguro(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\.+$/g, "")
    .trim()
    .slice(0, 120) || "documento";
}

function urlPermitida(valor: string) {
  try {
    const url = new URL(valor);
    const host = url.hostname.toLowerCase();
    const hostPrivado =
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "::1" ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
    return url.protocol === "https:" && !hostPrivado;
  } catch {
    return false;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ empresaId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { empresaId } = await params;
  if (!empresaId || empresaId.length > 64) {
    return NextResponse.json({ error: "Empresa inválida" }, { status: 400 });
  }

  const documentos = await db.documentoChecklist.findMany({
    where: {
      deletadoEm: null,
      item: { checklist: { empresaId } },
    },
    select: {
      nome: true,
      url: true,
      item: { select: { codigo: true, secao: true } },
    },
    take: MAX_DOCUMENTOS + 1,
    orderBy: { criadoEm: "asc" },
  });

  if (documentos.length > MAX_DOCUMENTOS) {
    return NextResponse.json(
      { error: "A empresa possui mais documentos que o limite permitido para um único ZIP." },
      { status: 413 }
    );
  }
  if (documentos.length === 0) {
    return NextResponse.json({ error: "Não há documentos ativos para baixar." }, { status: 404 });
  }

  const zip = new JSZip();
  const falhas: string[] = [];
  let totalBytes = 0;

  for (const documento of documentos) {
    if (!urlPermitida(documento.url)) {
      falhas.push(documento.nome + " — URL inválida para download.");
      continue;
    }

    try {
      const resposta = await fetch(documento.url, {
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      if (!resposta.ok) throw new Error("HTTP " + resposta.status);

      const contentLength = Number(resposta.headers.get("content-length") ?? "0");
      if (contentLength > MAX_BYTES_POR_DOCUMENTO || totalBytes + contentLength > MAX_BYTES) {
        throw new Error("arquivo excede o limite de tamanho");
      }

      const conteudo = new Uint8Array(await resposta.arrayBuffer());
      totalBytes += conteudo.byteLength;
      if (conteudo.byteLength > MAX_BYTES_POR_DOCUMENTO || totalBytes > MAX_BYTES) {
        throw new Error("arquivo excede o limite de tamanho");
      }

      const pasta = nomeSeguro(documento.item.secao);
      const arquivo = nomeSeguro(documento.item.codigo + " - " + documento.nome);
      zip.file(pasta + "/" + arquivo, conteudo);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : "erro desconhecido";
      falhas.push(documento.nome + " — " + motivo);
    }
  }

  if (falhas.length) {
    zip.file("LEIA-ME.txt", "Documentos não incluídos:\n\n" + falhas.join("\n"));
  }

  const arquivoZip = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const nome = "checklist-" + nomeSeguro(empresaId) + "-documentos.zip";
  const corpo = arquivoZip.buffer.slice(
    arquivoZip.byteOffset,
    arquivoZip.byteOffset + arquivoZip.byteLength
  ) as ArrayBuffer;

  return new NextResponse(corpo, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(nome),
      "Cache-Control": "no-store",
    },
  });
}
