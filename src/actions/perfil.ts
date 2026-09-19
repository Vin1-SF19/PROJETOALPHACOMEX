"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { validarNovaSenha } from "@/lib/auth/password-policy";

export async function alterarSenhaPropriaAction(formData: FormData) {
    try {


        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Sessão expirada." };

        const senhaAtual = formData.get("senhaAtual")?.toString();
        const senhaNova = formData.get("novaSenha")?.toString();

        if (!senhaAtual || !senhaNova) return { success: false, error: "Preencha os campos." };
        const senhaValidada = validarNovaSenha(senhaNova);
        if (!senhaValidada.success) return senhaValidada;

        const usuarioBanco = await db.usuarios.findUnique({
            where: { id: Number(session.user.id) }
        });

        if (!usuarioBanco) return { success: false, error: "Usuário não encontrado." };

        const senhaCorreta = await compare(senhaAtual, usuarioBanco.senha);
        if (!senhaCorreta) return { success: false, error: "Senha atual incorreta." };

        await db.usuarios.update({
            where: { id: usuarioBanco.id },
            data: {
                senha: await hash(senhaValidada.password, 12),
                authSessionVersion: { increment: 1 },
            }
        });

        return { success: true };
    } catch {
        return { success: false, error: "Erro na sincronização." };
    }
}

export async function atualizarFotoPerfilAction(url: string | null) {
    try {
      const session = await auth();
      
      const userId = session?.user?.id;
      if (!userId) return { success: false, error: "Sessão inválida." };
  
      console.log("📡 Tentando atualizar foto para o ID:", userId);
  
      const usuarioAtualizado = await db.usuarios.update({
        where: { 
          id: Number(userId)
        },
        data: { 
          imagemUrl: url 
        }
      });
  
      console.log("✅ Usuário atualizado no banco:", usuarioAtualizado.id);
  
      revalidatePath("/PainelAlpha/InfosPerfil/Perfil");
      
      return { success: true };
    } catch (error: unknown) {
      console.error(
        "❌ ERRO NO PRISMA:",
        error instanceof Error ? error.message : "erro desconhecido",
      );
      return { success: false, error: "Erro ao sincronizar imagem no banco." };
    }
  }

  export async function deletarImagemAction() {
    const session = await auth();
    if (!session?.user?.id) return { success: false };

    await db.usuarios.update({
        where: { id: Number(session.user.id) },
        data: { imagemUrl: null }
    });

    return { success: true };
}
