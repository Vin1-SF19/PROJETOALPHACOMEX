import { NextResponse } from "next/server";

import { ExplorerError } from "@/lib/alpha-explorer/errors";
import { explorerErrorResponse, requireExplorerIdentity } from "@/lib/alpha-explorer/http";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireExplorerIdentity();
    if (!identity.authorization.admin) throw new ExplorerError("FORBIDDEN", 403, "Sem permissão administrativa");
    const users = await db.usuarios.findMany({
      where: { status: "ATIVO" },
      select: { id: true, nome: true, usuario: true, email: true, role: true },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      take: 500,
    });
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    return explorerErrorResponse(error, "smb.admin.users.list");
  }
}
