import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import { extrairApresentacaoPptx } from "@/lib/apresentacoes/pptx/parser";
import { mapearSlideExtraido } from "@/lib/apresentacoes/pptx/mapear";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { resumirDiagnosticos } from "@/lib/apresentacoes/pptx/diagnostico";
import { renderizarReferenciaPptx } from "@/lib/apresentacoes/pptx/reference-renderer";
import { excluirBlobMotion, obterTokenMotion } from "@/lib/apresentacoes/blob";
import { carregarArquivoPptx, ErroEntradaPptx, prefixoPreviewPptx } from "@/lib/apresentacoes/pptx/upload";
import { fontePersonalizadaSchema, type FontePersonalizada } from "@/lib/apresentacoes/fontes-personalizadas";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAdmin(role?: string) {
  return isAdminRole(role);
}

async function podeEditar(apresentacaoId: string, userId: number, role?: string): Promise<boolean> {
  if (isAdmin(role)) return true;
  const apresentacao = await db.apresentacao.findUnique({
    where: { id: apresentacaoId },
    select: { autorId: true, colaboradores: { where: { userId, papel: { in: ["EDITOR"] } }, select: { id: true } } },
  });
  return Boolean(apresentacao && (apresentacao.autorId === userId || apresentacao.colaboradores.length > 0));
}

/**
 * Pré-visualização de um `.pptx` ANTES de importar de verdade: roda o MESMO parser da rota de
 * commit (`importar-pptx`), mas nunca cria `Slide` nem registra asset no banco. Imagens da
 * prévia usam URLs temporárias no store MOTION para manter a resposta abaixo do limite das
 * Functions; o modal as remove ao confirmar/cancelar. `ModalPreImportarPptx.tsx` usa essa
 * resposta para renderizar os slides de verdade antes do usuário confirmar.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const urlsTemporarias: string[] = [];
  try {
    const { id: apresentacaoId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });

    const userId = Number(session.user.id);
    const autorizado = await podeEditar(apresentacaoId, userId, session.user.role);
    if (!autorizado) return NextResponse.json({ success: false, error: "Sem permissão para editar esta apresentação" }, { status: 403 });

    const arquivo = await carregarArquivoPptx(request, apresentacaoId);

    const ultimoSlide = await db.slide.findFirst({
      where: { apresentacaoId },
      orderBy: { ordem: "desc" },
      select: { dadosJson: true },
    });
    if (!ultimoSlide) return NextResponse.json({ success: false, error: "Apresentação não encontrada ou sem slides" }, { status: 404 });

    const canvas: CanvasConfig = obterCanvasSeguro((ultimoSlide.dadosJson as { canvas?: unknown } | null)?.canvas);

    const buffer = arquivo.buffer;

    let extraido: Awaited<ReturnType<typeof extrairApresentacaoPptx>>;
    try {
      extraido = await extrairApresentacaoPptx(buffer, canvas);
    } catch (erro) {
      console.error("[pptx-preview] Falha ao interpretar o arquivo", erro);
      return NextResponse.json({ success: false, error: "Não foi possível interpretar este .pptx — verifique se o arquivo não está corrompido." }, { status: 422 });
    }

    if (extraido.slides.length === 0) {
      return NextResponse.json({ success: false, error: "Nenhum slide encontrado neste arquivo." }, { status: 422 });
    }

    const referenceWidth = Math.min(640, canvas.width);
    const referencia = await renderizarReferenciaPptx(buffer, {
      width: referenceWidth,
      height: Math.max(1, Math.round(referenceWidth * canvas.height / canvas.width)),
    }, 40_000);
    const referenceImages = referencia.ok
      ? await Promise.all(referencia.slides.map(async (slide) => {
        const caminho = `${prefixoPreviewPptx(apresentacaoId)}${crypto.randomUUID()}-reference-${slide.slideNumber}.png`;
        const blob = await put(caminho, slide.png, {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/png",
          token: obterTokenMotion(),
        });
        urlsTemporarias.push(blob.url);
        return { slideNumber: slide.slideNumber, url: blob.url };
      }))
      : [];

    // URLs temporárias mantêm a resposta da Function pequena. Base64 inline fazia decks com
    // muitas imagens ultrapassarem o mesmo teto de payload que causava o 413 no upload.
    const cacheUploads = new Map<string, Promise<string>>();
    const enviarImagemTemporaria = (bytes: Uint8Array, mimeType: string, nomeArquivo: string): Promise<string> => {
      const hash = createHash("sha256").update(bytes).digest("hex");
      const existente = cacheUploads.get(hash);
      if (existente) return existente;
      const upload = (async () => {
        const extensao = nomeArquivo.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
        const caminho = `${prefixoPreviewPptx(apresentacaoId)}${crypto.randomUUID()}-${hash.slice(0, 12)}.${extensao}`;
        const blob = await put(caminho, Buffer.from(bytes), {
          access: "public",
          addRandomSuffix: false,
          contentType: mimeType,
          token: obterTokenMotion(),
        });
        urlsTemporarias.push(blob.url);
        return blob.url;
      })();
      cacheUploads.set(hash, upload);
      return upload;
    };

    // Registra as fontes incorporadas somente como assets temporarios nesta etapa. Assim a
    // miniatura usa exatamente a familia do PPTX sem poluir o catalogo se o usuario cancelar.
    const fontesEmbutidas: FontePersonalizada[] = await Promise.all(
      extraido.fontesEmbutidas.map(async (fonte) => {
        const url = await enviarImagemTemporaria(fonte.bytes, fonte.mimeType, fonte.nomeArquivo);
        return fontePersonalizadaSchema.parse({
          id: crypto.randomUUID(),
          nome: fonte.nome,
          url,
          formato: fonte.formato,
          mimeType: fonte.mimeType,
          nomeOriginal: fonte.nomeArquivo,
          tamanhoBytes: fonte.bytes.byteLength,
          criadoEm: new Date().toISOString(),
        });
      }),
    );

    const slides = await Promise.all(
      extraido.slides.map(async (slide): Promise<{ componentes: ComponenteSlide[]; canvas: CanvasConfig }> => {
        try {
          const componentes = await mapearSlideExtraido(slide, enviarImagemTemporaria);
          return {
            componentes,
            canvas: {
              ...canvas,
              backgroundColor: slide.backgroundColor || "#FFFFFF",
              ...(slide.backgroundImage ? { backgroundImage: slide.backgroundImage } : { backgroundImage: undefined }),
            },
          };
        } catch (erro) {
          console.error("[pptx-preview] Falha ao mapear slide extraído", erro);
          return { componentes: [], canvas: { ...canvas, backgroundColor: "#FFFFFF", backgroundImage: undefined } };
        }
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        slides,
        canvas,
        ignorados: extraido.ignorados,
        fontesDetectadas: extraido.fontesDetectadas,
        fontesEmbutidas,
        diagnosticos: extraido.diagnosticosDetalhados,
        resumoDiagnosticos: resumirDiagnosticos(extraido.diagnosticosDetalhados),
        importerVersion: extraido.intermediateModel.importerVersion,
        referenceImages,
        temporaryAssetUrls: urlsTemporarias,
        referenceRenderer: referencia.ok
          ? { available: true, name: referencia.renderer }
          : { available: false, reason: referencia.reason },
      },
    });
  } catch (error) {
    if (urlsTemporarias.length > 0) await excluirBlobMotion(urlsTemporarias).catch(() => undefined);
    if (error instanceof ErroEntradaPptx) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[POST /api/apresentacoes/[id]/pptx-preview]", error);
    return NextResponse.json({ success: false, error: "Erro ao gerar a prévia do PowerPoint." }, { status: 500 });
  }
}
