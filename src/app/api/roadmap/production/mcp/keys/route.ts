import { z } from "zod";
import { auth } from "../../../../../../../auth";
import db from "@/lib/prisma";
import {
  ROADMAP_API_READ_SCOPE,
  ROADMAP_API_WRITE_SCOPE,
  createRoadmapApiToken,
  hashRoadmapApiSecret,
} from "@/lib/roadmap-production-api/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    scopes: z
      .array(z.enum([ROADMAP_API_READ_SCOPE, ROADMAP_API_WRITE_SCOPE]))
      .min(1)
      .default([ROADMAP_API_READ_SCOPE, ROADMAP_API_WRITE_SCOPE]),
    expiresInDays: z.number().int().min(1).max(365).optional(),
    rateLimitMax: z.number().int().min(10).max(10_000).default(120),
  })
  .strict();

async function requireAuthenticatedUser(): Promise<number> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("UNAUTHENTICATED");
  }
  return userId;
}

export async function GET() {
  try {
    const userId = await requireAuthenticatedUser();
    const rows = await db.roadmapApiKey.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        label: true,
        prefix: true,
        scopesJson: true,
        enabled: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
    return Response.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireAuthenticatedUser();
    const input = createSchema.parse(await request.json());
    const { token: key, prefix } = createRoadmapApiToken();
    const row = await db.roadmapApiKey.create({
      data: {
        createdById: userId,
        label: input.label,
        keyHash: hashRoadmapApiSecret(key),
        prefix,
        scopesJson: JSON.stringify(input.scopes),
        rateLimitMax: input.rateLimitMax,
        expiresAt: input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 86_400_000)
          : null,
      },
      select: {
        id: true,
        label: true,
        prefix: true,
        scopesJson: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    return Response.json(
      { ...row, key },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "API_KEY_CREATE_FAILED" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const keyId = url.searchParams.get("keyId") ?? "";
    if (!keyId) {
      return Response.json({ error: "KEY_ID_REQUIRED" }, { status: 400 });
    }
    const result = await db.roadmapApiKey.updateMany({
      where: { id: keyId, createdById: userId, revokedAt: null },
      data: { enabled: false, revokedAt: new Date() },
    });
    return Response.json(
      { revoked: result.count === 1 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
}
