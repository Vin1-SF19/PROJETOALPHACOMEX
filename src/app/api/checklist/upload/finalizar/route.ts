import { obterAtorChecklist } from "@/lib/checklist/acesso";
import { finalizarUploadDireto } from "@/lib/checklist/documentos";
import { resultado } from "@/lib/checklist/result";
import { resultHttp } from "@/lib/checklist/http";
export const runtime = "nodejs";
export async function POST(req: Request) {
  return resultHttp(
    await resultado(async () =>
      finalizarUploadDireto(await obterAtorChecklist(), await req.json()),
    ),
  );
}
