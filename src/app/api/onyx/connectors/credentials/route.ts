import { acessoEstaIndisponivel, mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { NextRequest, NextResponse } from "next/server";
import {
  listCredentials,
  createCredential,
  deleteCredential,
  OnyxError,
  type CreateCredentialInput,
} from "@/lib/onyx/client";
import { authorizeConnectors } from "@/lib/onyx/connectors-guard";

export const dynamic = "force-dynamic";

function fail(err: unknown) {
  const status = err instanceof OnyxError ? err.status : 500;
  return NextResponse.json({ error: (err as Error).message }, { status });
}

// GET /api/onyx/connectors/credentials — lista credenciais.
export async function GET() {
  try {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  try {
    return NextResponse.json({ credentials: await listCredentials() });
  } catch (err) {
    if (acessoEstaIndisponivel(err)) throw err;
    return fail(err);
  }

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}

// POST /api/onyx/connectors/credentials — cria credencial.
export async function POST(req: NextRequest) {
  try {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const body = (await req.json().catch(() => null)) as CreateCredentialInput | null;
  if (!body?.source || typeof body.credential_json !== "object") {
    return NextResponse.json({ error: "source e credential_json são obrigatórios." }, { status: 400 });
  }
  try {
    const cred = await createCredential(body);
    return NextResponse.json({ success: true, credential: cred });
  } catch (err) {
    if (acessoEstaIndisponivel(err)) throw err;
    return fail(err);
  }

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}

// DELETE /api/onyx/connectors/credentials?id=N — exclui credencial.
export async function DELETE(req: NextRequest) {
  try {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  try {
    await deleteCredential(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (acessoEstaIndisponivel(err)) throw err;
    return fail(err);
  }

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
