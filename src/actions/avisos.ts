"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/roles";

export async function dispararAvisoAction(msg: string, tipo: string = "warning") {
  const session = await auth();
  
  if (!isAdminRole(session?.user?.role)) {
    return { success: false, error: "Acesso Negado" };
  }

  try {
    await db.$transaction([
      db.avisos_globais.updateMany({
        where: { ativo: true },
        data: { ativo: false }
      }),
      db.avisos_globais.create({
        data: {
          mensagem: msg.toUpperCase().trim(),
          tipo: tipo,
          ativo: true,
          criado_em: new Date()
        }
      })
    ]);

    revalidatePath("/", "layout");
    
    return { success: true };
  } catch (error) {
    console.error("❌ Erro no Broadcast:", error);
    return { success: false, error: "Falha na persistência do aviso." };
  }
}

export async function encerrarAvisoAction() {
  const session = await auth();
  if (!isAdminRole(session?.user?.role)) return { success: false };

  try {
    await db.avisos_globais.updateMany({
      where: { ativo: true },
      data: { ativo: false }
    });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}
