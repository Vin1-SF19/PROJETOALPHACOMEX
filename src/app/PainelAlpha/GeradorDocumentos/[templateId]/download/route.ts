import { auth } from "../../../../../../auth";
import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/roles";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { exigirOwnershipDocumento } from "@/lib/gerador-documentos/ownership";

// Limites separados: editar cláusulas recarrega a prévia PDF várias vezes.
const downloadTimestamps = new Map<string, number[]>();

function verificarRateLimit(userId: string, disposition: "inline" | "attachment"): boolean {
  const agora = Date.now();
  const janela = 60 * 1000;
  const limite = disposition === "inline" ? 30 : 5;
  const chave = `${userId}:${disposition}`;
  const registros = (downloadTimestamps.get(chave) || []).filter((t) => agora - t < janela);
  if (registros.length >= limite) return false;
  registros.push(agora);
  downloadTimestamps.set(chave, registros);
  return true;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
): Promise<NextResponse> {
  const { templateId: documentoId } = await params;

  const session = await auth();
  const user = session?.user as { id?: string | number; role?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = Number(user.id);
  const role = user.role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("geradorDocumentos")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
  }

  let documento;
  try {
    documento = await exigirOwnershipDocumento(documentoId, { userId, role, isAdmin }, "visualizar");
  } catch (error) {
    if (error instanceof Error && error.message === "Documento não encontrado") {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  if (!documento.pdfUrl) {
    return NextResponse.json({ error: "PDF ainda não gerado para este documento" }, { status: 404 });
  }

  const disposition = new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  if (!verificarRateLimit(String(userId), disposition)) {
    return NextResponse.json(
      { error: "Limite de downloads atingido. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  // Busca o PDF do Vercel Blob
  try {
    const res = await fetch(documento.pdfUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Falha ao buscar o PDF" }, { status: 502 });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = `${documento.titulo.replace(/[^a-zA-Z0-9à-úÀ-Ú\s-]/g, "").trim() || "documento"}.pdf`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buffer.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar o PDF" }, { status: 502 });
  }
}
