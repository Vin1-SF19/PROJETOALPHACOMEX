import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { podeVisualizarNota } from "@/lib/notas/permissoes";
import { registrarAuditoriaNotaBestEffort } from "@/lib/notas/auditoria";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autenticado", { status: 401 });

  const userId = Number(session.user.id);
  const role = session.user.role ?? "";

  const { id } = await context.params;
  const anexo = await db.noteAttachment.findUnique({
    where: { id },
    select: { noteId: true, storageKey: true, fileName: true, mimeType: true, deletedAt: true },
  });
  if (!anexo || anexo.deletedAt) return new Response("Anexo não encontrado", { status: 404 });

  if (!(await podeVisualizarNota({ id: userId, role }, anexo.noteId))) {
    return new Response("Sem permissão", { status: 403 });
  }

  // Defesa em profundidade contra SSRF: mesmo com a validação de gravação em
  // registrarAnexoSchema, nunca fazer fetch() de uma storageKey fora do domínio esperado.
  let urlBlob: URL;
  try {
    urlBlob = new URL(anexo.storageKey);
  } catch {
    return new Response("Anexo com referência inválida", { status: 422 });
  }
  if (urlBlob.protocol !== "https:" || !urlBlob.hostname.endsWith(".blob.vercel-storage.com")) {
    console.error(`[notas/anexos] storageKey fora do domínio esperado: anexoId=${id}`);
    return new Response("Anexo com referência inválida", { status: 422 });
  }

  const respostaBlob = await fetch(anexo.storageKey);
  if (!respostaBlob.ok || !respostaBlob.body) {
    return new Response("Arquivo não encontrado no armazenamento", { status: 404 });
  }

  await registrarAuditoriaNotaBestEffort(userId, "DOWNLOAD_ANEXO_NOTA", `noteId=${anexo.noteId} anexoId=${id}`);

  const headers: Record<string, string> = {
    "Content-Type": anexo.mimeType,
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": `inline; filename="${anexo.fileName.replace(/"/g, "")}"`,
    "X-Content-Type-Options": "nosniff",
  };
  return new Response(respostaBlob.body, { status: 200, headers });
}
