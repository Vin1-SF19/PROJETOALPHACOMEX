"use server"
import { requireAdmin } from "@/lib/auth-guard";
import { validarNovaSenha } from "@/lib/auth/password-policy";
import db from "@/lib/prisma";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const usuarioIdSchema = z.coerce.number().int().positive();
const atualizarUsuarioSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  usuario: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.string().trim().min(1).max(80),
  permissoes: z.array(z.string().trim().min(1).max(100)).max(100),
});

export async function updateUser(idDoUsuario: string, formData: FormData) {
  try {
    await requireAdmin();

    const id = usuarioIdSchema.safeParse(idDoUsuario);
    const input = atualizarUsuarioSchema.safeParse({
      nome: formData.get("nome"),
      usuario: formData.get("usuario"),
      email: formData.get("email"),
      role: formData.get("role"),
      permissoes: formData.getAll("permissoes"),
    });

    if (!id.success || !input.success) {
      return { success: false, error: "Dados de usuário inválidos." };
    }

    const dataUpdate: Record<string, unknown> = {
      nome: input.data.nome,
      usuario: input.data.usuario,
      email: input.data.email,
      role: input.data.role,
      permissoes: input.data.permissoes.join(","),
      authSessionVersion: { increment: 1 },
    };

    const senhaNova = formData.get("senha")?.toString() ?? "";
    if (senhaNova.length > 0) {
      const senha = validarNovaSenha(senhaNova);
      if (!senha.success) return senha;
      dataUpdate.senha = await hash(senha.password, 12);
    }

    await db.usuarios.update({
      where: { id: id.data },
      data: dataUpdate,
    });

    revalidatePath("/PainelAlpha/cadastro"); 

    return { success: true };
  } catch (error) {
    console.error("ERRO AO ATUALIZAR:", error);
    return { success: false, error: "Não foi possível atualizar o usuário." };
  }
}

export async function deleteUser(idDoUsuario: string) {
  await requireAdmin(); 
  try {
    await db.usuarios.delete({
      where: {
        id: Number(idDoUsuario),
      },
    });

    revalidatePath("/PainelAlpha/cadastro");
    return { success: true };
  } catch (error) {
    console.error("ERRO AO DELETAR:", error);
    return { success: false, error: "Falha ao deletar usuário" };
  }
}
