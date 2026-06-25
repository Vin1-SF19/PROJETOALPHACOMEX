"use server"
import db from "@/lib/prisma";

export async function getUsers() {
  try {
    // SELECT explícito: nunca retornar senha, reset_token nem token_onyx
    // (credenciais) — esta action é consumida por componentes client.
    const users = await db.usuarios.findMany({
      select: {
        id: true,
        nome: true,
        usuario: true,
        email: true,
        role: true,
        imagemUrl: true,
        status: true,
        cargo: true,
      },
    });

    return users || [];
  } catch (error) {
    console.error("Erro no Banco de Dados:", error);
    return [];
  }
}