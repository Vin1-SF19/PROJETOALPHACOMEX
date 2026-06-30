import { NextRequest, NextResponse } from "next/server";
import {
  listDocumentSets,
  createDocumentSet,
  updateDocumentSet,
  deleteDocumentSet,
  OnyxError,
} from "@/lib/onyx/client";
import { authorizeConnectors } from "@/lib/onyx/connectors-guard";

export const dynamic = "force-dynamic";

function fail(err: unknown) {
  const status = err instanceof OnyxError ? err.status : 500;
  return NextResponse.json({ error: (err as Error).message }, { status });
}

// GET /api/onyx/connectors/document-sets — lista document sets.
export async function GET() {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  try {
    return NextResponse.json({ documentSets: await listDocumentSets() });
  } catch (err) {
    return fail(err);
  }
}

interface CreateBody {
  name: string;
  description?: string;
  cc_pair_ids: number[];
  is_public?: boolean;
}

// POST /api/onyx/connectors/document-sets — cria document set.
export async function POST(req: NextRequest) {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.name || !Array.isArray(body.cc_pair_ids)) {
    return NextResponse.json({ error: "name e cc_pair_ids são obrigatórios." }, { status: 400 });
  }
  try {
    const id = await createDocumentSet({
      name: body.name,
      description: body.description ?? "",
      cc_pair_ids: body.cc_pair_ids,
      is_public: body.is_public ?? true,
    });
    return NextResponse.json({ success: true, id });
  } catch (err) {
    return fail(err);
  }
}

interface PatchBody {
  id: number;
  description?: string;
  cc_pair_ids: number[];
  is_public?: boolean;
}

// PATCH /api/onyx/connectors/document-sets — atualiza document set.
export async function PATCH(req: NextRequest) {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body?.id || !Array.isArray(body.cc_pair_ids)) {
    return NextResponse.json({ error: "id e cc_pair_ids são obrigatórios." }, { status: 400 });
  }
  try {
    await updateDocumentSet({
      id: body.id,
      description: body.description ?? "",
      cc_pair_ids: body.cc_pair_ids,
      is_public: body.is_public ?? true,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return fail(err);
  }
}

// DELETE /api/onyx/connectors/document-sets?id=N — exclui document set.
export async function DELETE(req: NextRequest) {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  try {
    await deleteDocumentSet(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return fail(err);
  }
}
