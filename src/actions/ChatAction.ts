"use server"

import { auth } from "../../auth";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export async function getHistoricoMensagens(contatoId: number) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const meuId = Number(session.user.id);

  try {
    return await db.mensagens.findMany({
      where: {
        OR: [
          { remetenteId: meuId, destinatarioId: contatoId },
          { remetenteId: contatoId, destinatarioId: meuId }
        ]
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    return [];
  }
}

export async function enviarMensagemChatAction(destinatarioId: number, texto: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autorizado" };

  const remetenteId = Number(session.user.id);
  const targetId = Number(destinatarioId);

  try {
    const novaMsg = await db.mensagens.create({
      data: {
        texto,
        remetenteId,
        destinatarioId: targetId,
        lida: false
      }
    });

    const [p1, p2] = [remetenteId, targetId].sort((a, b) => a - b);

    await db.conversas.upsert({
      where: {
        p1Id_p2Id: { p1Id: p1, p2Id: p2 }
      },
      update: {
        ultimaMsg: texto,
        updatedAt: new Date()
      },
      create: {
        p1Id: p1,
        p2Id: p2,
        ultimaMsg: texto
      }
    });

    const canalId = `chat-${p1}-${p2}`;
    await pusher.trigger(canalId, "nova-mensagem", novaMsg);

    await pusher.trigger(`user-notifications-${targetId}`, "atualizar-lista", {
      remetenteId: remetenteId, 
      texto: texto
    });

    await pusher.trigger(`user-notifications-${remetenteId}`, "atualizar-lista", {
      remetenteId: targetId, 
      texto: texto
    });

    return { success: true, data: novaMsg };
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return { error: "Falha na transmissão" };
  }
}

export async function marcarChatComoLido(remetenteId: number) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autorizado" };

  const meuId = Number(session.user.id);

  try {
    await db.mensagens.updateMany({
      where: {
        remetenteId: Number(remetenteId),
        destinatarioId: meuId,
        lida: false
      },
      data: { lida: true }
    });

    revalidatePath("/PainelAlpha/AlphaComm");
    return { success: true };
  } catch (error) {
    return { error: "Erro ao atualizar status" };
  }
}
