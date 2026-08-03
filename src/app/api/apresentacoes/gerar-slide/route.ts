import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "../../../../../auth";
import db from "@/lib/prisma";
import { gerarSlideStream, type EventoGeracaoSlide } from "@/lib/apresentacoes-ia/gerar-slide";
import { encodeSSE } from "@/lib/bibble/completion";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  apresentacaoId: z.string().min(1),
  prompt: z.string().min(1).max(8000),
});

function isAdmin(role?: string) {
  return isAdminRole(role);
}

/** Mesmo padrão de ownership de src/actions/slides.ts — sobe até Apresentacao.autorId/colaboradores. */
async function checarOwnershipApresentacao(apresentacaoId: string, userId: number, role?: string) {
  if (isAdmin(role)) return true;
  const apresentacao = await db.apresentacao.findUnique({
    where: { id: apresentacaoId },
    select: {
      autorId: true,
      colaboradores: { where: { userId }, select: { id: true } },
    },
  });
  if (!apresentacao) return false;
  return apresentacao.autorId === userId || apresentacao.colaboradores.length > 0;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), { status: 401 });
  }

  const userId = Number(session.user.id);
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ success: false, error: "Dados inválidos", details: parsed.error.flatten() }), { status: 400 });
  }

  const { apresentacaoId, prompt } = parsed.data;

  // Ownership verificado ANTES de qualquer chamada à IA — nunca gastar tokens sem permissão confirmada.
  const autorizado = await checarOwnershipApresentacao(apresentacaoId, userId, session.user.role);
  if (!autorizado) {
    return new Response(JSON.stringify({ success: false, error: "Sem permissão" }), { status: 403 });
  }

  const providerCtrl = new AbortController();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: EventoGeracaoSlide) => {
        try { controller.enqueue(encodeSSE(event, enc)); } catch { /* stream closed */ }
      };
      try {
        for await (const evento of gerarSlideStream(prompt, providerCtrl.signal)) {
          send(evento);
        }
      } catch (err) {
        if (!providerCtrl.signal.aborted) {
          const msg = err instanceof Error ? err.message : "Erro interno";
          console.error("[GERAR-SLIDE]", msg);
          send({ type: "error", message: "Tive um problema para gerar o slide. Tente de novo." });
        }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      providerCtrl.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
