"use server";
import db from "@/lib/prisma";
import { auth } from "../../auth";

export async function marcarOnboardingBlueprintVisto() {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await db.usuarios.update({
      where: { id: userId },
      data: { onboarding_blueprint_visto: true },
    });

    return { success: true };
  } catch (error) {
    console.error("[marcarOnboardingBlueprintVisto]", error);
    return { success: false, error: "Erro ao salvar preferência" };
  }
}

export async function reiniciarOnboardingBlueprint() {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await db.usuarios.update({
      where: { id: userId },
      data: { onboarding_blueprint_visto: false },
    });

    return { success: true };
  } catch (error) {
    console.error("[reiniciarOnboardingBlueprint]", error);
    return { success: false, error: "Erro ao reiniciar tutorial" };
  }
}
