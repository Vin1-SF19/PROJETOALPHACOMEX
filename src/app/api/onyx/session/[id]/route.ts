import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { getChatSession, OnyxError } from "@/lib/onyx/client";
import { getUserOnyxToken } from "@/lib/onyx/user-token";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/onyx/session/[id] — reidrata o histórico de uma conversa com agente
 * Onyx. `id` é o id da BibbleSession do Painel; resolvemos o onyxSessionId
 * vinculado e lemos o histórico COMPLETO (texto + imagens) direto do Onyx.
 *
 * Cada imagem é servida pelo proxy autenticado /api/onyx/file/{fileId}, então a
 * conversa volta completa ao reabrir/atualizar.
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

  try {
    const userToken = await getUserOnyxToken(session.user.id);
    const data = await getChatSession(bibbleSession.onyxSessionId, userToken);

    const messages = (data.messages ?? [])
      // Ignora mensagens de sistema/vazias sem arquivos
      .filter((m) => m.message?.trim() || (m.files?.length ?? 0) > 0)
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
