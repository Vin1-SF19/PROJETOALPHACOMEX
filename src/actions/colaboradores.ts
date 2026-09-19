"use server";

import { requireAdmin } from "@/lib/auth-guard";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const textoCurto = z.string().trim().min(1).max(160);
const textoOpcional = z.string().trim().max(160).optional();
const statusSchema = z.enum(["ATIVO", "INATIVO"]);
const idPositivoSchema = z.coerce.number().int().positive();

export async function adicionarColaboradorCoreAction(formData: FormData) {
  try {
    await requireAdmin();
    const input = z.object({
      nome: textoCurto,
      setor: textoCurto,
      cargo: textoCurto,
      data: textoOpcional,
    }).safeParse({
      nome: formData.get("nome")?.toString().toUpperCase(),
      setor: formData.get("setor")?.toString().toUpperCase(),
      cargo: formData.get("cargo")?.toString().toUpperCase(),
      data: formData.get("data")?.toString() || undefined,
    });

    if (!input.success) {
      return { success: false, error: "DADOS OBRIGATÓRIOS AUSENTES" };
    }

    await db.colaboradores_core.create({
      data: {
        nome: input.data.nome,
        setor: input.data.setor,
        cargo: input.data.cargo,
        data_contratacao: input.data.data || null,
        status: "ATIVO",
      },
    });

    revalidatePath("/PainelAlpha/AlphaVault");
    return { success: true };
  } catch (error: unknown) {
    console.error("ERRO_CORE:", error);
    return { success: false, error: "NÃO FOI POSSÍVEL ADICIONAR O COLABORADOR" };
  }
}

export async function atualizarAgenteSistemaAction(formData: FormData) {
  try {
    await requireAdmin();
    const input = z.object({
      id: z.string().trim().min(1).max(32),
      cargo: textoCurto,
      data: textoOpcional,
      status: statusSchema,
      setor: textoCurto,
    }).safeParse({
      id: formData.get("id"),
      cargo: formData.get("cargo")?.toString().toUpperCase(),
      data: formData.get("data")?.toString() || undefined,
      status: formData.get("status"),
      setor: formData.get("setor")?.toString().toUpperCase(),
    });

    if (!input.success) return { success: false, error: "DADOS INVÁLIDOS" };

    const idBruto = input.data.id;
    const isCore = idBruto.startsWith("ext-");
    const idReal = isCore ? idBruto.replace("ext-", "") : idBruto;
    const id = idPositivoSchema.safeParse(idReal);
    if (!id.success) return { success: false, error: "ID NÃO LOCALIZADO" };

    if (isCore) {
      await db.colaboradores_core.update({
        where: { id: id.data },
        data: {
          cargo: input.data.cargo,
          data_contratacao: input.data.data || null,
          status: input.data.status,
          setor: input.data.setor,
        },
      });
    } else {
      await db.usuarios.update({
        where: { id: id.data },
        data: {
          cargo: input.data.cargo,
          data_contratacao: input.data.data || null,
          status: input.data.status,
          role: input.data.setor,
          authSessionVersion: { increment: 1 },
        },
      });
    }

    revalidatePath("/PainelAlpha/AlphaVault");
    return { success: true };
  } catch (error: unknown) {
    console.error("ERRO_AO_SALVAR:", error);
    return { success: false, error: "NÃO FOI POSSÍVEL ATUALIZAR O AGENTE" };
  }
}

export async function adicionarSistemaCoreAction(formData: FormData) {
  try {
    await requireAdmin();
    const nome = formData.get("nome")?.toString().toUpperCase().trim();
    const link = formData.get("link")?.toString().trim();
    const icone = formData.get("icone")?.toString();

    if (!nome || !link) {
      return { success: false, error: "NOME E LINK SÃO OBRIGATÓRIOS" };
    }

    await db.sistemas_core.create({
      data: {
        nome,
        link,
        icone: icone || "google",
      },
    });

    revalidatePath("/PainelAlpha/AlphaVault");
    return { success: true };
  } catch (error: unknown) {
    console.error("ERRO_SISTEMA_CORE:", error);
    return { success: false, error: "NÃO FOI POSSÍVEL ADICIONAR O SISTEMA" };
  }
}

export async function adicionarRecursoVaultAction(formData: FormData) {
  try {
    await requireAdmin();
    const colabId = formData.get("colaborador_id")?.toString();
    const sistemaId = formData.get("sistema_id")?.toString();
    const login = formData.get("login")?.toString().trim();
    const senha = formData.get("senha")?.toString().trim();

    if (!colabId || !sistemaId || !login || !senha) {
      return { success: false, error: "TODOS OS CAMPOS SÃO OBRIGATÓRIOS" };
    }

    await db.vault_recursos.create({
      data: {
        colaborador_id: colabId,
        sistema_id: parseInt(sistemaId),
        login,
        senha,
      },
    });

    revalidatePath("/PainelAlpha/AlphaVault");
    return { success: true };
  } catch (error: unknown) {
    console.error("ERRO_RECURSO_VAULT:", error);
    return { success: false, error: "NÃO FOI POSSÍVEL ADICIONAR O RECURSO" };
  }
}
