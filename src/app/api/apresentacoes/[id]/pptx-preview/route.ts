import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import { extrairApresentacaoPptx } from "@/lib/apresentacoes/pptx/parser";
import { mapearSlideExtraido } from "@/lib/apresentacoes/pptx/mapear";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { resumirDiagnosticos } from "@/lib/apresentacoes/pptx/diagnostico";
import { renderizarReferenciaPptx } from "@/lib/apresentacoes/pptx/reference-renderer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PPTX_MAX_BYTES = 80 * 1024 * 1024;

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
 * commit (`importar-pptx`), mas nunca grava nada — nem `Slide` no banco, nem imagem no Blob.
 * Imagens viram `data:` URI inline (bytes convertidos direto, sem round-trip de rede), pra
 * quem cancelar não deixar nenhum resíduo. `ModalPreImportarPptx.tsx` usa essa resposta pra
 * renderizar os slides de verdade (via `RenderComponente`) antes do usuário confirmar.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: apresentacaoId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });

    const userId = Number(session.user.id);
    const autorizado = await podeEditar(apresentacaoId, userId, session.user.role);
    if (!autorizado) return NextResponse.json({ success: false, error: "Sem permissão para editar esta apresentação" }, { status: 403 });

    const formData = await request.formData();
    const arquivo = formData.get("file");
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ success: false, error: "Arquivo ausente" }, { status: 400 });
    }
    if (!arquivo.name.toLowerCase().endsWith(".pptx")) {
      return NextResponse.json({ success: false, error: "Envie um arquivo .pptx (PowerPoint)." }, { status: 400 });
    }
    if (arquivo.size <= 0) {
      return NextResponse.json({ success: false, error: "O arquivo está vazio." }, { status: 400 });
    }
    if (arquivo.size > PPTX_MAX_BYTES) {
      return NextResponse.json({ success: false, error: `O arquivo excede o limite de ${Math.round(PPTX_MAX_BYTES / 1024 / 1024)} MB.` }, { status: 413 });
    }

    const ultimoSlide = await db.slide.findFirst({
      where: { apresentacaoId },
      orderBy: { ordem: "desc" },
      select: { dadosJson: true },
    });
    if (!ultimoSlide) return NextResponse.json({ success: false, error: "Apresentação não encontrada ou sem slides" }, { status: 404 });

    const canvas: CanvasConfig = obterCanvasSeguro((ultimoSlide.dadosJson as { canvas?: unknown } | null)?.canvas);

    let buffer: Buffer;
    try {
      buffer = Buffer.from(await arquivo.arrayBuffer());
    } catch {
      return NextResponse.json({ success: false, error: "Não foi possível ler o arquivo enviado." }, { status: 400 });
    }

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
      ? referencia.slides.map((slide) => ({ slideNumber: slide.slideNumber, url: `data:image/png;base64,${slide.png.toString("base64")}` }))
      : [];

    // Sem upload de verdade — só base64 inline, em paralelo (é conversão local, não I/O de rede,
    // mas paralelizar ainda ajuda com decks grandes por não serializar o trabalho de CPU/await).
    const enviarImagemComoDataUri = async (bytes: Uint8Array, mimeType: string): Promise<string> =>
      `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;

    const slides = await Promise.all(
      extraido.slides.map(async (slide): Promise<{ componentes: ComponenteSlide[]; canvas: CanvasConfig }> => {
        try {
          const componentes = await mapearSlideExtraido(slide, enviarImagemComoDataUri);
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
        diagnosticos: extraido.diagnosticosDetalhados,
        resumoDiagnosticos: resumirDiagnosticos(extraido.diagnosticosDetalhados),
        importerVersion: extraido.intermediateModel.importerVersion,
        referenceImages,
        referenceRenderer: referencia.ok
          ? { available: true, name: referencia.renderer }
          : { available: false, reason: referencia.reason },
      },
    });
  } catch (error) {
    console.error("[POST /api/apresentacoes/[id]/pptx-preview]", error);
    return NextResponse.json({ success: false, error: "Erro ao gerar a prévia do PowerPoint." }, { status: 500 });
  }
}
