import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import {
  createAgent,
  deleteAgent,
  createChatSession,
  sendChatMessageStream,
  getChatFile,
  uploadAgentImage,
  getImageGenToolId,
  OnyxError,
} from "@/lib/onyx/client";
import { getUserOnyxToken } from "@/lib/onyx/user-token";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RequestBody {
  description?: string;
  system_prompt?: string;
  tool_ids?: number[];
}

interface OnyxGeneratedImage {
  file_id?: string;
  url?: string;
  revised_prompt?: string;
}

interface OnyxPacket {
  obj?: {
    type: string;
    images?: OnyxGeneratedImage[];
  };
}

/**
 * Parseia o stream NDJSON do Onyx procurando pelo pacote image_generation_final.
 * Retorna o primeiro file_id ou url de imagem gerada.
 */
async function extractGeneratedImage(response: Response): Promise<{ file_id?: string; url?: string } | null> {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: { file_id?: string; url?: string } | null = null;

  const handle = (line: string): boolean => {
    const t = line.trim();
    if (!t) return false;
    try {
      const pkt = JSON.parse(t) as OnyxPacket;
      if (pkt.obj?.type === "image_generation_final" && pkt.obj.images?.length) {
        const img = pkt.obj.images[0];
        if (img.file_id || img.url) {
          result = { file_id: img.file_id, url: img.url };
          return true; // encontrou
        }
      }
    } catch { /* linha parcial */ }
    return false;
  };

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (handle(l)) break outer;
    }
  }

  // Cancela o stream — já temos o que precisávamos
  reader.cancel().catch(() => {});

  return result;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const { description = "", system_prompt = "" } = body;

  if (!system_prompt.trim()) {
    return NextResponse.json({ error: "system_prompt obrigatório para gerar avatar." }, { status: 400 });
  }

  const userToken = await getUserOnyxToken(session.user.id);
  let tempPersonaId: number | null = null;

  try {
    // Verifica se a tool generate_image está disponível
    const imageToolId = await getImageGenToolId();
    if (imageToolId === null) {
      return NextResponse.json({ error: "Tool de geração de imagem não disponível no Onyx." }, { status: 503 });
    }

    // 1. Cria persona temporária com generate_image habilitada
    const tempPersona = await createAgent(
      {
        name: `__avatar_gen_${Date.now()}__`,
        description: "Persona temporária para geração de avatar",
        system_prompt: "You are an image generation assistant. When asked, generate images based on the description provided.",
        task_prompt: "",
        tool_ids: [imageToolId],
        is_public: false,
      },
      userToken,
    );
    tempPersonaId = tempPersona.id;

    // 2. Cria sessão de chat com a persona temporária
    const { chat_session_id } = await createChatSession(
      tempPersonaId,
      "Geração de avatar de agente",
      userToken,
    );

    // 3. Monta prompt descrevendo o avatar ideal
    const agentContext = [
      description.trim() ? `Descrição: ${description.trim()}` : null,
      `Função: ${system_prompt.trim().slice(0, 600)}`,
    ].filter(Boolean).join("\n");

    const prompt = [
      `Generate a square avatar icon image for an AI agent with the following characteristics:`,
      ``,
      agentContext,
      ``,
      `Style: minimalist, professional, modern app icon style. Simple or gradient background. No text in the image. Clean and symbolic visual that represents the agent's function and personality.`,
    ].join("\n");

    // 4. Envia mensagem e parseia o stream NDJSON
    const streamResponse = await sendChatMessageStream({
      chatSessionId: chat_session_id,
      message: prompt,
      userToken,
    });

    if (!streamResponse.ok) {
      const errText = await streamResponse.text().catch(() => "");
      throw new OnyxError(errText || `Onyx respondeu ${streamResponse.status}`, streamResponse.status);
    }

    const imageInfo = await extractGeneratedImage(streamResponse);

    if (!imageInfo) {
      return NextResponse.json(
        { error: "Onyx não retornou imagem gerada. Verifique se o modelo de imagem está configurado no painel do Onyx." },
        { status: 502 },
      );
    }

    // 5. Resolve o file_id — o Onyx pode mandar em obj.file_id OU embutido em
    // obj.url como "file://{uuid}" (não é uma URL HTTP, é um identificador interno).
    const fileUrlMatch = imageInfo.url?.match(/^file:\/\/([a-f0-9-]+)/i);
    const resolvedFileId = imageInfo.file_id ?? fileUrlMatch?.[1] ?? null;

    let imgBlob: Blob;
    let contentType = "image/png";

    if (resolvedFileId) {
      const fileRes = await getChatFile(resolvedFileId);
      if (!fileRes.ok) {
        throw new OnyxError(`Não foi possível baixar o arquivo gerado (${fileRes.status}).`, fileRes.status);
      }
      contentType = fileRes.headers.get("content-type") ?? "image/png";
      imgBlob = await fileRes.blob();
    } else if (imageInfo.url && /^https?:\/\//i.test(imageInfo.url)) {
      // URL HTTP de verdade (alguns provedores retornam URL externa direta)
      const imgRes = await fetch(imageInfo.url, {
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : {},
      });
      if (!imgRes.ok) {
        throw new OnyxError(`Não foi possível baixar a imagem gerada (${imgRes.status}).`, imgRes.status);
      }
      contentType = imgRes.headers.get("content-type") ?? "image/png";
      imgBlob = await imgRes.blob();
    } else {
      return NextResponse.json({ error: "Imagem gerada sem URL ou file_id reconhecível." }, { status: 502 });
    }

    // 6. Faz upload da imagem como avatar de agente no Onyx
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "png";
    const uploaded_image_id = await uploadAgentImage(imgBlob, `avatar-gerado.${ext}`, userToken);

    // 7. Converte para base64 para preview imediato no modal
    const arrayBuffer = await imgBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const previewDataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ uploaded_image_id, previewDataUrl });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  } finally {
    // Limpa a persona temporária em qualquer cenário
    if (tempPersonaId !== null) {
      deleteAgent(tempPersonaId, userToken).catch(() => {});
    }
  }
}
