import { NextRequest, NextResponse } from "next/server";
import {
  getCCPair,
  setCCPairStatus,
  renameCCPair,
  runConnectorOnce,
  deleteCCPair,
  OnyxError,
  type CCPairStatus,
} from "@/lib/onyx/client";
import { authorizeConnectors } from "@/lib/onyx/connectors-guard";

export const dynamic = "force-dynamic";

function fail(err: unknown) {
  const status = err instanceof OnyxError ? err.status : 500;
  return NextResponse.json({ error: (err as Error).message }, { status });
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// GET /api/onyx/connectors/:ccPairId — detalhe completo da fonte.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ ccPairId: string }> }) {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const { ccPairId } = await ctx.params;
  const id = parseId(ccPairId);
  if (id == null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  try {
    const cc = await getCCPair(id);
    return NextResponse.json(cc);
  } catch (err) {
    return fail(err);
  }
}

interface PatchBody {
  action: "pause" | "resume" | "rename" | "reindex";
  name?: string;
  fromBeginning?: boolean;
}

// PATCH /api/onyx/connectors/:ccPairId — pausar / reativar / renomear / reindexar.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ ccPairId: string }> }) {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const { ccPairId } = await ctx.params;
  const id = parseId(ccPairId);
  if (id == null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body?.action) return NextResponse.json({ error: "action obrigatória." }, { status: 400 });

  try {
    switch (body.action) {
      case "pause":
        await setCCPairStatus(id, "PAUSED" as CCPairStatus);
        break;
      case "resume":
        await setCCPairStatus(id, "ACTIVE" as CCPairStatus);
        break;
      case "rename":
        if (!body.name?.trim()) {
          return NextResponse.json({ error: "name obrigatório para renomear." }, { status: 400 });
        }
        await renameCCPair(id, body.name.trim());
        break;
      case "reindex": {
        // run-once exige connector_id + credential_ids — busca no detalhe do CC-pair.
        const cc = await getCCPair(id);
        const credIds = cc.connector.credential_ids ?? (cc.credential ? [cc.credential.id] : []);
        if (credIds.length === 0) {
          return NextResponse.json({ error: "Fonte sem credencial para reindexar." }, { status: 409 });
        }
        await runConnectorOnce(cc.connector.id, credIds, body.fromBeginning ?? false);
        break;
      }
      default:
        return NextResponse.json({ error: "action desconhecida." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return fail(err);
  }
}

// DELETE /api/onyx/connectors/:ccPairId — agenda exclusão da fonte.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ ccPairId: string }> }) {
  const authz = await authorizeConnectors();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const { ccPairId } = await ctx.params;
  const id = parseId(ccPairId);
  if (id == null) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  try {
    const cc = await getCCPair(id);
    const credId = cc.credential?.id ?? cc.connector.credential_ids?.[0];
    if (credId == null) {
      return NextResponse.json({ error: "Fonte sem credencial associada." }, { status: 409 });
    }
    await deleteCCPair(cc.connector.id, credId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return fail(err);
  }
}
