import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { salvarDocumentoSchema } from "@/lib/validations/blueprint";

type ClienteDocumento = Pick<Prisma.TransactionClient, "blueprintDocument" | "blueprintActivity">;
type EntradaDocumento = z.infer<typeof salvarDocumentoSchema>;

/** A PK existente também identifica a intenção de criação; não depende de migration. */
export function idDocumentoBlueprint(projectId: string, userId: number, creationKey: string): string {
  return `c${createHash("sha256").update(JSON.stringify([projectId, userId, creationKey])).digest("hex").slice(0, 24)}`;
}

export async function persistirDocumentoBlueprint(client: ClienteDocumento, dados: EntradaDocumento, userId: number) {
  const id = dados.documentId ?? idDocumentoBlueprint(dados.projectId, userId, dados.creationKey!);
  const atual = await client.blueprintDocument.findUnique({ where: { id } });
  if (atual && atual.projectId !== dados.projectId) throw new Error("Documento não encontrado");
  if (dados.documentId && !atual) throw new Error("Documento não encontrado");

  if (atual) {
    // Repetir um envio já confirmado não gera outra versão ou outro histórico.
    if (atual.title === dados.title && atual.contentJson === dados.contentJson
      && (atual.contentText ?? "") === (dados.contentText ?? "")) {
      return { success: true as const, data: atual };
    }
    if (!dados.documentId || atual.updatedAt.getTime() !== dados.baseUpdatedAt?.getTime()) {
      return { success: false as const, error: "CONFLITO_DOCUMENTO", data: atual };
    }
    const updatedAt = new Date(Math.max(Date.now(), atual.updatedAt.getTime() + 1));
    const gravacao = await client.blueprintDocument.updateMany({
      where: { id, projectId: dados.projectId, updatedAt: dados.baseUpdatedAt },
      data: { title: dados.title, contentJson: dados.contentJson, contentText: dados.contentText, updatedById: userId, updatedAt },
    });
    if (gravacao.count !== 1) throw new Error("CONFLITO_DOCUMENTO");
  } else {
    await client.blueprintDocument.create({
      data: { id, projectId: dados.projectId, title: dados.title, contentJson: dados.contentJson, contentText: dados.contentText, createdById: userId },
    });
  }

  await client.blueprintActivity.create({
    data: { projectId: dados.projectId, userId, action: atual ? "ATUALIZACAO" : "CRIACAO", entityType: "DOCUMENTO", entityId: id },
  });
  const confirmado = await client.blueprintDocument.findUnique({ where: { id } });
  if (!confirmado) throw new Error("Documento não encontrado");
  return { success: true as const, data: confirmado };
}
