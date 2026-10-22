import { obterAtorChecklist } from "@/lib/checklist/acesso";
import { gerarZipChecklist } from "@/lib/checklist/zip";
import { resultado } from "@/lib/checklist/result";
import { resultHttp } from "@/lib/checklist/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  req: Request,
  { params }: { params: Promise<{ empresaId: string }> },
) {
  const url = new URL(req.url);
  const result = await resultado(async () =>
    gerarZipChecklist(
      await obterAtorChecklist(),
      (await params).empresaId,
      {
        escopo: url.searchParams.get("escopo") ?? "ATIVO",
        checklistId: url.searchParams.get("checklistId") ?? undefined,
      },
      req.signal,
    ),
  );
  if (!result.ok) return resultHttp(result);
  return new Response(result.data, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="checklist-documentos.zip"',
      "Cache-Control": "no-store",
    },
  });
}
