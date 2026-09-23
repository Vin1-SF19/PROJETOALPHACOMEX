"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { revalidatePath } from "next/cache";


export async function atualizarInterfaceAction(tema: string, densidade: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
    await db.usuarios.update({
      where: { id: Number(session.user.id) },
      data: {
        tema_interface: tema,
        densidade_painel: densidade
      }
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

export async function toggleBibbleAction(ativo: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
    await db.usuarios.update({
      where: { id: Number(session.user.id) },
      data: { bibble_ativo: ativo },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}
