"use server";
import db from "@/lib/prisma";
import { auth } from "../../auth";
import { registrarAnexoSchema, type RegistrarAnexoInput } from "@/lib/validations/notas";
import { podeEditarNota, podeVisualizarNota } from "@/lib/notas/permissoes";
import { registrarAuditoriaNotaBestEffort } from "@/lib/notas/auditoria";

async function sessaoUsuario() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: Number(session.user.id), role: session.user.role ?? "" };
}

/**
 * Grava o metadado do anexo APÓS o upload real ao Vercel Blob (POST /api/notas/upload) já ter
 * sido concluído — esta action nunca recebe o arquivo em si, só o resultado do upload.
 */
export async function RegistrarAnexoNota(input: RegistrarAnexoInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = registrarAnexoSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  const dados = parsed.data;

  if (!(await podeEditarNota(usuario, dados.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  const anexo = await db.noteAttachment.create({
    data: {
      noteId: dados.noteId,
      fileName: dados.fileName,
      mimeType: dados.mimeType,
      size: dados.size,
      storageKey: dados.storageKey,
      uploadedById: usuario.id,
    },
  });

  await registrarAuditoriaNotaBestEffort(usuario.id, "ANEXAR_ARQUIVO_NOTA", `noteId=${dados.noteId} anexoId=${anexo.id} fileName=${dados.fileName}`);

  return { success: true as const, data: anexo };
}

export async function ListarAnexosNota(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };

  if (!(await podeVisualizarNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão", data: [] };
  }

  const anexos = await db.noteAttachment.findMany({
    where: { noteId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true, uploadedBy: { select: { id: true, nome: true } } },
  });

  return { success: true as const, data: anexos };
}

export async function ExcluirAnexoNota(attachmentId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const anexo = await db.noteAttachment.findUnique({ where: { id: attachmentId }, select: { noteId: true } });
  if (!anexo) return { success: false as const, error: "Anexo não encontrado" };

  if (!(await podeEditarNota(usuario, anexo.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.noteAttachment.update({ where: { id: attachmentId }, data: { deletedAt: new Date() } });
  await registrarAuditoriaNotaBestEffort(usuario.id, "EXCLUIR_ANEXO_NOTA", `noteId=${anexo.noteId} anexoId=${attachmentId}`);

  return { success: true as const };
}
