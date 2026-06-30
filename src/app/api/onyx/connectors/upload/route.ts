import { NextRequest, NextResponse } from "next/server";
import { uploadConnectorFiles, OnyxError } from "@/lib/onyx/client";
import { authorizeConnectors } from "@/lib/onyx/connectors-guard";

export const dynamic = "force-dynamic";

// POST /api/onyx/connectors/upload (multipart) — sobe arquivos para um conector
// "file" e devolve os file_paths que vão em connector_specific_config.file_locations.
export async function POST(req: NextRequest) {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido (multipart esperado)." }, { status: 400 });
  }

  const entries = form.getAll("files").filter((f): f is File => f instanceof File);
  if (entries.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  try {
    const result = await uploadConnectorFiles(
      entries.map((f) => ({ blob: f, name: f.name })),
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
