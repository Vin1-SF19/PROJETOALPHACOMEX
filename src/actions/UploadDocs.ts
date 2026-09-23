"use server";

import { put } from "@vercel/blob";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function uploadDocumento(formData: FormData) {
  try {
    const file = formData.get("file") as File | null;
    const urlPrevia = formData.get("url")?.toString();

    const titulo = (formData.get("titulo")?.toString() || file?.name || "SEM TITULO").toUpperCase().trim();
    const setor = formData.get("setor")?.toString().toUpperCase().trim();
    const pasta = formData.get("tipo_pasta")?.toString().toUpperCase().trim();
    const criado_por = formData.get("criado_por")?.toString() || "SISTEMA";
    const protecao = formData.get("protecao")?.toString() || "ATIVO";
    const ordem_manual = parseInt(formData.get("ordem_manual")?.toString() || "0");

    let tipo_midia = formData.get("tipo_midia")?.toString();
    if (!tipo_midia) {
      tipo_midia = file?.type?.startsWith("video/") ? "VIDEO" : "PDF";
    }

    if (!setor || !pasta) return { success: false, error: "DADOS OBRIGATORIOS AUSENTES" };

    let finalUrl = urlPrevia;

    if (!finalUrl) {
      if (!file || file.size === 0) return { success: false, error: "ARQUIVO NAO DETECTADO" };

      const blob = await put(file.name, file, {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type,
      });
      finalUrl = blob.url;
    }

    await db.documentos.create({
      data: {
        titulo,
        PastaArquivos: pasta,
        url: finalUrl!,
        setor,
        tipo: tipo_midia,
        criado_por,
        protecao,
        ordem_manual,
        status: "ATIVO",
      },
    });

    revalidatePath("/PainelAlpha/DocsAlpha");
    return { success: true };
  } catch (error) {
    console.error("FALHA_ACTION:", error);
    return { success: false, error: "Falha ao enviar documento." };
  }
}

export async function desativarDocumentoAction(id: number) {
  try {
    await db.documentos.update({
      where: { id },
      data: { status: "INATIVO" },
    });

    revalidatePath("/PainelAlpha/DocsAlpha");
    return { success: true };
  } catch (error) {
    console.error("ERRO_DESATIVAR:", error);
    return { success: false, error: "Falha ao desativar documento." };
  }
}
