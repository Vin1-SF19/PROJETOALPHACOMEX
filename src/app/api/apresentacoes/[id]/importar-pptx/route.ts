import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import { nomeArquivoSeguro } from "@/lib/apresentacoes/assets";
import { extrairApresentacaoPptx } from "@/lib/apresentacoes/pptx/parser";
import { mapearSlideExtraido } from "@/lib/apresentacoes/pptx/mapear";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { resumirDiagnosticos } from "@/lib/apresentacoes/pptx/diagnostico";
import { renderizarReferenciaPptx } from "@/lib/apresentacoes/pptx/reference-renderer";
import { createHash } from "node:crypto";
import { obterTokenMotion } from "@/lib/apresentacoes/blob";
import { carregarArquivoPptx, ErroEntradaPptx } from "@/lib/apresentacoes/pptx/upload";

export const dynamic = "force-dynamic";
// Parsing de zip/XML + upload de cada imagem embutida pro Blob pode levar um tempo real em
// decks grandes — mesmo teto já usado por exportar-html/gerar-slide neste projeto.
export const maxDuration = 120;

const IMAGEM_MAX_BYTES = 50 * 1024 * 1024;

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: apresentacaoId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });

    const userId = Number(session.user.id);
    const autorizado = await podeEditar(apresentacaoId, userId, session.user.role);
    if (!autorizado) return NextResponse.json({ success: false, error: "Sem permissão para editar esta apresentação" }, { status: 403 });

    const arquivo = await carregarArquivoPptx(request, apresentacaoId);
    const indicesExcluidos = arquivo.excluirIndices;

    const ultimoSlide = await db.slide.findFirst({
      where: { apresentacaoId },
      orderBy: { ordem: "desc" },
      select: { ordem: true, dadosJson: true },
    });
    if (!ultimoSlide) return NextResponse.json({ success: false, error: "Apresentação não encontrada ou sem slides" }, { status: 404 });

    // Usa o canvas do último slide já existente como referência de escala — mantém os slides
    // importados no mesmo tamanho dos que já estão na apresentação.
    const canvas: CanvasConfig = obterCanvasSeguro((ultimoSlide.dadosJson as { canvas?: unknown } | null)?.canvas);

    const buffer = arquivo.buffer;

    let extraido: Awaited<ReturnType<typeof extrairApresentacaoPptx>>;
    try {
      extraido = await extrairApresentacaoPptx(buffer, canvas);
    } catch (erro) {
      console.error("[importar-pptx] Falha ao interpretar o arquivo", erro);
      return NextResponse.json({ success: false, error: "Não foi possível interpretar este .pptx — verifique se o arquivo não está corrompido." }, { status: 422 });
    }

    if (extraido.slides.length === 0) {
      return NextResponse.json({ success: false, error: "Nenhum slide encontrado neste arquivo." }, { status: 422 });
    }

    let originalFileUrl: string;
    try {
      if (arquivo.blobUrl) {
        originalFileUrl = arquivo.blobUrl;
      } else {
        const originalPath = `apresentacoes/${apresentacaoId}/originais/${Date.now()}-${crypto.randomUUID()}-${nomeArquivoSeguro(arquivo.nome)}`;
        const originalBlob = await put(originalPath, buffer, {
          access: "public",
          addRandomSuffix: false,
          contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          token: obterTokenMotion(),
        });
        originalFileUrl = originalBlob.url;
      }
      await db.apresentacaoAsset.create({
        data: {
          apresentacaoId,
          tipo: "PPTX",
          url: originalFileUrl,
          nomeOriginal: arquivo.nome.slice(0, 255),
          tamanhoBytes: buffer.byteLength,
        },
      });
    } catch (erro) {
      console.error("[importar-pptx] Falha ao preservar o arquivo original", erro);
      return NextResponse.json({ success: false, error: "Não foi possível preservar o PowerPoint original; a importação foi cancelada sem criar slides." }, { status: 502 });
    }

    const referencia = await renderizarReferenciaPptx(buffer, canvas, 40_000);
    const referenceUrls = new Map<number, string>();
    if (referencia.ok) {
      await Promise.all(referencia.slides.map(async (slide) => {
        const referencePath = `apresentacoes/${apresentacaoId}/reference/${crypto.randomUUID()}-slide-${slide.slideNumber}.png`;
        const blob = await put(referencePath, slide.png, {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/png",
          token: obterTokenMotion(),
        });
        referenceUrls.set(slide.slideNumber, blob.url);
      })).catch((error: unknown) => console.error("[importar-pptx] Falha ao preservar renders de referência", error));
    } else {
      console.warn("[importar-pptx] Render de referência indisponível", referencia.reason);
    }

    const errosDeImagem: string[] = [];
    const cacheUploads = new Map<string, Promise<string>>();
    const enviarImagem = (bytes: Uint8Array, mimeType: string, nomeArquivoOriginal: string): Promise<string> => {
      const hash = createHash("sha256").update(bytes).digest("hex");
      const cacheKey = `${mimeType}:${hash}`;
      const existente = cacheUploads.get(cacheKey);
      if (existente) return existente;
      const upload = (async () => {
        try {
        if (bytes.byteLength > IMAGEM_MAX_BYTES) throw new Error("Imagem excede o limite de tamanho");
        const caminho = `apresentacoes/${apresentacaoId}/pptx-${Date.now()}-${crypto.randomUUID()}-${nomeArquivoSeguro(nomeArquivoOriginal)}`;
        const blob = await put(caminho, Buffer.from(bytes), {
          access: "public",
          addRandomSuffix: false,
          contentType: mimeType,
          token: obterTokenMotion(),
        });
        await db.apresentacaoAsset.create({
          data: { apresentacaoId, tipo: "IMAGEM", url: blob.url, nomeOriginal: nomeArquivoOriginal.slice(0, 255), tamanhoBytes: bytes.byteLength },
        }).catch((erroAsset: unknown) => console.error("[importar-pptx] Falha ao registrar asset da imagem", erroAsset));
        return blob.url;
      } catch (erro) {
        console.error("[importar-pptx] Falha ao enviar imagem extraída", erro);
        errosDeImagem.push(nomeArquivoOriginal);
        return "";
        }
      })();
      cacheUploads.set(cacheKey, upload);
      return upload;
    };

    // Mapeia (e envia imagem pro Blob) todos os slides EM PARALELO — sequencial aqui já causou
    // timeout real em decks com várias imagens (cada upload é 1 round-trip de rede; 20 slides
    // com 2-3 imagens cada passavam fácil dos 60s do maxDuration). Cada slide é isolado em
    // try/catch — 1 falha não derruba os demais. A ordem de gravação no banco continua
    // determinística (índice na lista), só o TRABALHO de preparar os dados roda em paralelo.
    const slidesParaCriar = extraido.slides
      .map((slide, indice) => ({ slide, indice }))
      .filter(({ indice }) => !indicesExcluidos.has(indice));

    const slidesMapeados = await Promise.all(
      slidesParaCriar.map(async ({ slide, indice }) => {
        try {
          const componentes = await mapearSlideExtraido(slide, enviarImagem);
          // Remove componentes de imagem cujo upload falhou (url vazia) em vez de gravar um
          // componente quebrado no slide — o erro já fica registrado em errosDeImagem.
          return {
            componentes: componentes.filter((c) => c.tipo !== "imagem" || c.url),
            canvas: {
              ...canvas,
              backgroundColor: slide.backgroundColor || "#FFFFFF",
              ...(slide.backgroundImage ? { backgroundImage: slide.backgroundImage } : { backgroundImage: undefined }),
            },
            slideNumber: indice + 1,
          };
        } catch (erro) {
          console.error("[importar-pptx] Falha ao mapear slide extraído", erro);
          return { componentes: [] as ComponenteSlide[], canvas: { ...canvas, backgroundColor: "#FFFFFF", backgroundImage: undefined }, slideNumber: indice + 1 };
        }
      }),
    );

    let proximaOrdem = ultimoSlide.ordem + 1;
    const resumoDiagnosticos = resumirDiagnosticos(extraido.diagnosticosDetalhados);
    for (const slideMapeado of slidesMapeados) {
      await db.slide.create({
        // Cast seguro (mesmo padrão de AtualizarSlide/DuplicarSlide em actions/slides.ts):
        // Prisma exige InputJsonValue (index signature genérica) pro campo Json, que não é
        // estruturalmente igual ao tipo forte ComponenteSlide[] recursivo.
        data: {
          apresentacaoId,
          ordem: proximaOrdem,
          dadosJson: {
            componentes: slideMapeado.componentes,
            canvas: slideMapeado.canvas,
            pptxSource: {
              type: "pptx",
              originalFileUrl,
              originalFileName: arquivo.nome.slice(0, 255),
              importerVersion: extraido.intermediateModel.importerVersion,
              slideNumber: slideMapeado.slideNumber,
              diagnostics: resumoDiagnosticos,
              ...(referenceUrls.get(slideMapeado.slideNumber) ? { referenceImageUrl: referenceUrls.get(slideMapeado.slideNumber) } : {}),
            },
          } as object,
        },
      });
      proximaOrdem += 1;
    }
    const slidesCriados = slidesMapeados.length;

    revalidatePath(`/PainelAlpha/Apresentacoes/${apresentacaoId}/editor`);

    return NextResponse.json({
      success: true,
      data: {
        slidesCriados,
        ignorados: extraido.ignorados,
        errosDeImagem,
        originalFileUrl,
        fontesDetectadas: extraido.fontesDetectadas,
        resumoDiagnosticos,
        importerVersion: extraido.intermediateModel.importerVersion,
        referenceRenderer: referencia.ok
          ? { available: true, name: referencia.renderer, slides: referenceUrls.size }
          : { available: false, reason: referencia.reason },
      },
    });
  } catch (error) {
    if (error instanceof ErroEntradaPptx) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[POST /api/apresentacoes/[id]/importar-pptx]", error);
    return NextResponse.json({ success: false, error: "Erro ao importar o arquivo PowerPoint." }, { status: 500 });
  }
}
