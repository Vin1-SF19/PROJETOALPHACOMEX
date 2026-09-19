"use server";

import db from "@/lib/prisma";
import { hash } from "bcryptjs";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validarNovaSenha } from "@/lib/auth/password-policy";

const cadastroUsuarioSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  usuario: z.string().trim().min(3).max(64),
  email: z.string().trim().toLowerCase().email().max(254),
  senha: z.string(),
  role: z.string().trim().min(1).max(100),
  callixUserId: z.string().trim().max(100).nullable(),
  tokenOnyx: z.string().trim().max(4096).nullable(),
});

export default async function registerAction(
  _prevState: unknown,
  formData: FormData
) {
  try {
    await requireAdmin();

    const parsed = cadastroUsuarioSchema.safeParse({
      nome: formData.get("nome"),
      usuario: formData.get("usuario"),
      email: formData.get("email"),
      senha: formData.get("senha"),
      role: formData.get("role") || "User",
      callixUserId: formData.get("callixUserId") || null,
      tokenOnyx: formData.get("token_onyx") || null,
    });
    if (!parsed.success) {
      return {
        success: false,
        message: "Dados de cadastro inválidos",
      };
    }

    const senhaValidada = validarNovaSenha(parsed.data.senha);
    if (!senhaValidada.success) {
      return { success: false, message: senhaValidada.error };
    }

    const { nome, usuario, email, role, callixUserId, tokenOnyx } = parsed.data;
    const callixHabilitado = role === "COMERCIAL" && formData.get("callixHabilitado") === "on";

    if (callixHabilitado && !callixUserId) {
      return {
        success: false,
        message: "Informe o ID do agente na Callix para habilitar as ligações.",
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
        senha: await hash(senhaValidada.password, 12),
        senhaTemporaria: true,
        role,
        permissoes: permissoesString,
        callixHabilitado,
        callixUserId: callixHabilitado ? callixUserId : null,
        ...(tokenOnyx ? { token_onyx: tokenOnyx } : {}),
      },
      // token_onyx NUNCA retornado ao cliente.
      select: { id: true, nome: true, usuario: true, email: true, role: true, telefone: true, telefone_corporativo: true },
    });

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
