import { obterAtorChecklist } from "@/lib/checklist/acesso";
import { prepararUpload } from "@/lib/checklist/documentos";
import { resultado, fail } from "@/lib/checklist/result";
import { resultHttp } from "@/lib/checklist/http";
export const runtime = "nodejs";
export async function POST(req: Request) {
  return resultHttp(
    await resultado(async () => {
      const ator = await obterAtorChecklist();
      const url = new URL(req.url);
      if (!req.body) fail("UPLOAD_INVALID", "Arquivo vazio.");
      return prepararUpload(ator, {
        itemId: url.searchParams.get("itemId") ?? "",
        nome: url.searchParams.get("filename") ?? "",
        mime: req.headers.get("content-type") ?? "",
        body: req.body,
        signal: req.signal,
      });
    }),
  );
}
