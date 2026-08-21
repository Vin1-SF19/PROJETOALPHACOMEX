import { z } from "zod";
import db from "@/lib/prisma";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { createOpaqueMcpToken, hashMcpSecret, MCP_ALLOWED_SCOPES } from "@/lib/alpha-seo/mcp/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({ projectId: z.string().min(1).max(100), label: z.string().trim().min(1).max(120), scopes: z.array(z.enum(MCP_ALLOWED_SCOPES)).min(1).default([...MCP_ALLOWED_SCOPES]), expiresInDays: z.number().int().min(1).max(365).optional(), rateLimitMax: z.number().int().min(10).max(10_000).default(120) }).strict();

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  try {
    await requireAlphaSeoProjectAccess({ projectId, action: "member:manage", minimumRole: "OWNER" });
    const rows = await db.alphaSeoApiKey.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, label: true, prefix: true, scopes: true, enabled: true, lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true } });
    return Response.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "ACCESS_DENIED" }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const input = createSchema.parse(await request.json());
    const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "member:manage", minimumRole: "OWNER" });
    const key = createOpaqueMcpToken("aseo_key_");
    const prefix = key.slice(0, 18);
    const row = await db.alphaSeoApiKey.create({ data: { projectId: input.projectId, createdById: access.userId, label: input.label, keyHash: hashMcpSecret(key), prefix, scopes: input.scopes, rateLimitMax: input.rateLimitMax, expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null }, select: { id: true, label: true, prefix: true, scopes: true, expiresAt: true, createdAt: true } });
    return Response.json({ ...row, key }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "API_KEY_CREATE_FAILED" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? "";
  const keyId = url.searchParams.get("keyId") ?? "";
  try {
    await requireAlphaSeoProjectAccess({ projectId, action: "member:manage", minimumRole: "OWNER" });
    const result = await db.alphaSeoApiKey.updateMany({ where: { id: keyId, projectId, revokedAt: null }, data: { enabled: false, revokedAt: new Date() } });
    return Response.json({ revoked: result.count === 1 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "ACCESS_DENIED" }, { status: 403 });
  }
}

