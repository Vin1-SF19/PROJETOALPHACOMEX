"use server";

import db from "@/lib/prisma";
import { hashSync } from "bcryptjs";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

export default async function registerAction(
  _prevState: unknown,
  formData: FormData
) {
  try {
    await requireAdmin();

    const nome = formData.get("nome") as string;
    const usuario = formData.get("usuario") as string;
    const email = formData.get("email") as string;
    const senha = formData.get("senha") as string;
    const role = (formData.get("role") as string) || "User";

    if (!nome || !usuario || !email || !senha) {
      return {
        success: false,
        message: "Preencha todos os campos obrigatórios",
      };
    }

    const exists = await db.usuarios.findFirst({
      where: {
        OR: [{ email }, { usuario }],
      },
    });

    if (exists) {
      return {
        success: false,
        message: "E-mail ou Usuário já cadastrado no sistema",
      };
    }

    // Derive initial permissoes from sector's SetorPermissao for backwards compat
    const setorPerms = await db.setorPermissao.findMany({
      where: { setor: role },
      select: { modulo: true },
    });
    const permissoesString = setorPerms.map(p => p.modulo).join(',');

    const novoUsuario = await db.usuarios.create({
      data: {
        nome,
        usuario,
        email,
        senha: hashSync(senha, 10),
        role,
        permissoes: permissoesString,
      },
      select: { id: true, nome: true, usuario: true, email: true, role: true, telefone: true, telefone_corporativo: true },
    });

    // senhaTemporaria não está nos tipos Prisma ainda — atualiza via raw SQL
    await db.$executeRawUnsafe(`UPDATE usuarios SET senhaTemporaria = 1 WHERE id = ?`, novoUsuario.id);

    revalidatePath("/PainelAlpha/cadastro");

    return {
      success: true,
      message: "Usuário criado com sucesso!",
      novoUsuario,
    };

  } catch (error) {
    console.error("Erro ao registrar:", error);
    return {
      success: false,
      message: "Falha na permissão ou erro de banco de dados",
    };
  }
}
