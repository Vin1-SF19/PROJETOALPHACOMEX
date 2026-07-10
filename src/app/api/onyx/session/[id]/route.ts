import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { getChatSession, OnyxError } from "@/lib/onyx/client";
import { getUserOnyxToken } from "@/lib/onyx/user-token";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/onyx/session/[id] — reidrata o histórico de uma conversa com agente
 * Onyx. `id` é o id da BibbleSession do Painel.
 *
 * Fonte primária: BibbleMessage local (Prisma). O front já salva, ao fim de
 * cada streaming, o par user/assistant com o content BRUTO — inclusive o
 * markdown ![alt](/api/onyx/file/{id}) de imagens geradas (ver saveMessages em
 * BibbleChatLayout.tsx). Isso é necessário porque o Onyx NÃO persiste imagens
 * geradas: get-chat-session devolve files:[] e o texto sem o markdown da
 * imagem para a mensagem que gerou a imagem (confirmado inspecionando a
 * resposta bruta do Onyx). Também não garante ordem cronológica no array
 * devolvido (mensagens de usuário vêm todas antes das de assistente).
 *
 * Fallback: get-chat-session do Onyx, só para sessões antigas sem nenhuma
 * BibbleMessage local salva (ex.: criadas antes deste fix).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const userId = Number(session.user.id);

  // Ownership: a BibbleSession precisa ser do usuário logado.
  const bibbleSession = await db.bibbleSession.findFirst({
    where: { id, userId },
    select: { onyxSessionId: true },
  });

  if (!bibbleSession) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  // Sem sessão Onyx vinculada → não é conversa de agente (front usa o histórico local).
  if (!bibbleSession.onyxSessionId) {
    return NextResponse.json({ onyx: false, messages: [] });
  }

  // ── Fonte primária: histórico local (ordem correta + imagens preservadas) ──
  const localMessages = await db.bibbleMessage.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
  });

  if (localMessages.length > 0) {
    return NextResponse.json({
      onyx: true,
      messages: localMessages.map((m) => ({
        id: m.id,
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
        images: [] as Array<{ id: string; name: string; src: string }>,
      })),
    });
  }

  // ── Fallback: sessão antiga sem BibbleMessage local — busca no Onyx ────────
  try {
    const userToken = await getUserOnyxToken(session.user.id);
    const data = await getChatSession(bibbleSession.onyxSessionId, userToken);

    const messages = (data.messages ?? [])
      // Ignora mensagens de sistema/vazias sem arquivos
      .filter((m) => m.message?.trim() || (m.files?.length ?? 0) > 0)
      // O Onyx não garante a ordem cronológica no array de get-chat-session
      // (é uma árvore via parent_message, não uma lista linear). message_id é
      // sempre auto-incremental na criação, então ordenar por ele restaura a
      // ordem real da conversa — sem isso, mensagens do usuário e do assistente
      // podem vir agrupadas por tipo em vez de intercaladas.
      .sort((a, b) => a.message_id - b.message_id)
      .map((m) => {
        // O Onyx embute imagens geradas no texto como ![alt](file://{uuid}).
        // Reescreve para o proxy autenticado /api/onyx/file/{uuid} (file:// não
        // renderiza no browser). Cobre tanto links markdown quanto file:// solto.
        const content = (m.message ?? "")
          .replace(/file:\/\/([a-f0-9-]+)/gi, "/api/onyx/file/$1");

        return {
          id: String(m.message_id),
          role: m.message_type === "user" ? ("user" as const) : ("assistant" as const),
          content,
          // Anexos de imagem em files[] → URL do proxy autenticado.
          images: (m.files ?? [])
            .filter((f) => f.type === "image")
            .map((f) => ({ id: f.id, name: f.name ?? "imagem", src: `/api/onyx/file/${f.id}` })),
        };
      });

    return NextResponse.json({ onyx: true, messages });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
